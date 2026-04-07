"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Settings2, Loader2, Square, Copy, Check,
  Paperclip, X, Eye, EyeOff, ExternalLink, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useDashboard } from "../layout";
import { Markdown } from "@/components/ui/markdown";

// Shown in curl preview only — actual requests go through /api/agent (same-origin)
const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const MODELS = [
  { id: "google/gemini-3-flash-preview", name: "Gemini 3 Flash", provider: "Google" },
];

interface ToolExecution {
  id: string;
  name: string;
  input?: string;
  status: "running" | "done" | "error";
  result?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  tools?: ToolExecution[];
  fileNames?: string[];
}

export default function PlaygroundPage() {
  useDashboard();
  const { toast } = useToast();

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState(MODELS[0].id);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [liveTools, setLiveTools] = useState<ToolExecution[]>([]);
  const [maxTokens, setMaxTokens] = useState(16000);
  const [maxTurns, setMaxTurns] = useState(10);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(true);
  const [copied, setCopied] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; content: string }[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load API key from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("llmpowerup_playground_key");
    if (saved) setApiKey(saved);
  }, []);

  const saveApiKey = useCallback((key: string) => {
    setApiKey(key);
    if (key) localStorage.setItem("llmpowerup_playground_key", key);
    else localStorage.removeItem("llmpowerup_playground_key");
  }, []);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText, liveTools]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments((prev) => [...prev, { name: file.name, content: reader.result as string }]);
      };
      reader.readAsText(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || streaming) return;
    if (!apiKey.startsWith("clst_")) {
      toast("error", "Enter a valid API key (starts with clst_)");
      return;
    }

    // Build content with file attachments appended
    let content = input.trim();
    const fileNames: string[] = [];
    for (const att of attachments) {
      content += `\n\n--- File: ${att.name} ---\n${att.content}\n--- End of ${att.name} ---`;
      fileNames.push(att.name);
    }

    const userMsg: ChatMessage = {
      role: "user",
      content: input.trim(),
      fileNames: fileNames.length > 0 ? fileNames : undefined,
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setAttachments([]);
    setStreaming(true);
    setStreamText("");
    setLiveTools([]);

    abortRef.current = new AbortController();
    let fullText = "";
    const tools: ToolExecution[] = [];

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content,
          model,
          session_id: sessionId || undefined,
          system_prompt: systemPrompt || undefined,
          max_tokens: maxTokens,
          max_turns: maxTurns,
          stream_format: "native",
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
        toast("error", err.error?.message || err.message || "Request failed");
        setStreaming(false);
        return;
      }

      if (!res.body) {
        toast("error", "No response stream");
        setStreaming(false);
        return;
      }

      // Parse SSE stream from Rust backend (native format)
      // NOTE: The backend sends heartbeats forever, so we must break on
      // turn_complete rather than waiting for the stream to close.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";
      let streamDone = false;

      try {
        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (streamDone) break;
            const t = line.trim();
            if (!t || t.startsWith(":")) continue;
            if (t.startsWith("event: ")) { currentEvent = t.slice(7); continue; }
            if (!t.startsWith("data: ") || t === "data: [DONE]") continue;

            try {
              const data = JSON.parse(t.slice(6));

              switch (currentEvent) {
                case "tool_start":
                  tools.push({
                    id: data.tool_id || `t${tools.length}`,
                    name: data.tool_name || "unknown",
                    input: data.input_json,
                    status: "running",
                  });
                  setLiveTools([...tools]);
                  break;

                case "tool_end": {
                  const tc = tools.find((x) => x.id === data.tool_id) || tools[tools.length - 1];
                  if (tc) {
                    tc.status = data.is_error ? "error" : "done";
                    tc.result = data.result || "";
                  }
                  setLiveTools([...tools]);
                  break;
                }

                case "turn_complete":
                  if (data.session_id) setSessionId(data.session_id);
                  streamDone = true;
                  break;

                case "error":
                  fullText += `\n**Error:** ${data.error?.message || data.message}\n`;
                  setStreamText(fullText);
                  break;

                case "content_block_delta":
                  if (data.delta?.text) {
                    fullText += data.delta.text;
                    setStreamText(fullText);
                  }
                  break;

                case "status": {
                  // Backend sends "session:<uuid>" to communicate session_id
                  const msg = data.message || "";
                  if (msg.startsWith("session:")) {
                    setSessionId(msg.slice(8));
                  }
                  break;
                }

                case "message_start":
                  // Detect empty/failed responses from OpenRouter (model: "unknown", 0 tokens)
                  if (data.message?.model === "unknown" || data.message?.model === "") {
                    fullText += "**The model returned an empty response.** This usually means the model is overloaded or rate-limited. Try again in a few seconds.\n";
                    setStreamText(fullText);
                  }
                  break;

                case "content_block_start":
                case "content_block_stop":
                case "message_delta":
                case "message_stop":
                case "token_warning":
                  break;

                default:
                  if (data.delta?.text) {
                    fullText += data.delta.text;
                    setStreamText(fullText);
                  }
                  break;
              }
              currentEvent = "";
            } catch {}
          }
        }
      } catch (e: any) {
        // AbortError is normal when user clicks stop — ignore it
        if (e.name !== "AbortError") console.error("[playground] stream error:", e);
      }

      try { reader.cancel(); } catch {}

      // Only add assistant message if we got content or tools
      if (fullText || tools.length > 0) {
        setMessages([...newMessages, {
          role: "assistant",
          content: fullText || "(No text response)",
          tools: tools.length > 0 ? [...tools] : undefined,
        }]);
      }
    } catch (err: any) {
      // AbortError is expected when user clicks stop
      if (err.name !== "AbortError") toast("error", err.message);
    } finally {
      setStreaming(false);
      setStreamText("");
      setLiveTools([]);
      abortRef.current = null;
    }
  };

  const handleStop = () => {
    try { abortRef.current?.abort(); } catch {}
  };

  const handleNewSession = () => {
    setMessages([]);
    setStreamText("");
    setSessionId(null);
    setLiveTools([]);
  };

  const copyConversation = () => {
    const text = messages.map((m) => `**${m.role}**: ${m.content}`).join("\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isReady = apiKey.startsWith("clst_");

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-2rem)] -m-4 sm:-m-6 lg:-m-8">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">Playground</h1>
          <Badge variant={isReady ? "success" : "warning"} className="text-[10px]">
            {isReady ? "42 tools" : "No API key"}
          </Badge>
          {sessionId && (
            <span className="text-[10px] text-white/30 font-mono">
              session: {sessionId.slice(0, 8)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={handleNewSession} disabled={messages.length === 0 && !sessionId}>
            <Plus size={14} />
            <span className="ml-1 hidden sm:inline text-xs">New</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={copyConversation} disabled={messages.length === 0}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)}>
            <Settings2 size={14} />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
            {/* Empty state */}
            {messages.length === 0 && !streaming && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                {isReady ? (
                  <>
                    <div className="text-4xl mb-4">⚡</div>
                    <h3 className="text-sm font-medium text-white/60 mb-1">LLMPowerUp Agent Playground</h3>
                    <p className="text-xs text-white/30 max-w-sm">
                      Full agent mode with 42 tools — file ops, bash, web search, code analysis, and more.
                      Connected to the Rust backend.
                    </p>
                  </>
                ) : (
                  <Card className="max-w-md p-6 text-center">
                    <div className="text-3xl mb-3">🔑</div>
                    <h3 className="text-sm font-medium mb-2">API Key Required</h3>
                    <p className="text-xs text-white/40 mb-4">
                      Enter your API key in the settings panel to use the playground, or create one in the API Keys page.
                    </p>
                    <div className="flex gap-2 justify-center">
                      <Button size="sm" variant="ghost" onClick={() => setShowSettings(true)}>
                        <Settings2 size={14} className="mr-1" /> Settings
                      </Button>
                      <a href="/dashboard/api-keys">
                        <Button size="sm">
                          <ExternalLink size={14} className="mr-1" /> Get API Key
                        </Button>
                      </a>
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* Messages */}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] sm:max-w-[75%] rounded-xl px-4 py-3 text-sm ${
                  m.role === "user"
                    ? "bg-blue-500/15 border border-blue-500/20"
                    : "bg-white/[0.03] border border-white/10"
                }`}>
                  {/* File attachment tags */}
                  {m.fileNames?.map((name, j) => (
                    <div key={j} className="flex items-center gap-2 text-xs text-white/40 mb-2 p-2 bg-white/5 rounded-lg">
                      <Paperclip size={12} /> {name}
                    </div>
                  ))}
                  {/* Completed tool executions */}
                  {m.tools?.map((te, j) => (
                    <div key={j} className={`my-2 rounded-lg border text-xs overflow-hidden ${
                      te.status === "error" ? "border-red-500/20 bg-red-500/5" : "border-green-500/20 bg-green-500/5"
                    }`}>
                      <div className="flex items-center gap-2 px-3 py-2">
                        {te.status === "error" ? (
                          <X size={12} className="text-red-400" />
                        ) : (
                          <Check size={12} className="text-green-400" />
                        )}
                        <span className="font-mono font-medium text-white/70">{te.name}</span>
                        <span className={`ml-auto text-[10px] ${te.status === "error" ? "text-red-400" : "text-green-400"}`}>
                          {te.status}
                        </span>
                      </div>
                      {te.result && (
                        <details className="border-t border-white/5">
                          <summary className="px-3 py-1.5 cursor-pointer text-[10px] text-white/30 hover:text-white/50">
                            Output ({te.result.length} chars)
                          </summary>
                          <pre className="px-3 py-2 text-[11px] text-white/40 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                            {te.result}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                  {/* Message content */}
                  {m.content && (m.role === "assistant" ? <Markdown content={m.content} /> : <p className="whitespace-pre-wrap">{m.content}</p>)}
                </div>
              </div>
            ))}

            {/* Streaming: live tools + partial text */}
            {streaming && (liveTools.length > 0 || streamText) && (
              <div className="flex justify-start">
                <div className="max-w-[85%] sm:max-w-[75%] rounded-xl px-4 py-3 text-sm bg-white/[0.03] border border-white/10">
                  {liveTools.map((te, j) => (
                    <div key={j} className={`my-2 rounded-lg border text-xs overflow-hidden ${
                      te.status === "running" ? "border-amber-500/20 bg-amber-500/5" :
                      te.status === "error" ? "border-red-500/20 bg-red-500/5" :
                      "border-green-500/20 bg-green-500/5"
                    }`}>
                      <div className="flex items-center gap-2 px-3 py-2">
                        {te.status === "running" ? (
                          <Loader2 size={12} className="animate-spin text-amber-400" />
                        ) : te.status === "error" ? (
                          <X size={12} className="text-red-400" />
                        ) : (
                          <Check size={12} className="text-green-400" />
                        )}
                        <span className="font-mono font-medium text-white/70">{te.name}</span>
                        <span className={`ml-auto text-[10px] ${
                          te.status === "running" ? "text-amber-400" :
                          te.status === "error" ? "text-red-400" : "text-green-400"
                        }`}>
                          {te.status === "running" ? "running..." : te.status}
                        </span>
                      </div>
                      {te.result && (
                        <details className="border-t border-white/5">
                          <summary className="px-3 py-1.5 cursor-pointer text-[10px] text-white/30 hover:text-white/50">
                            Output ({te.result.length} chars)
                          </summary>
                          <pre className="px-3 py-2 text-[11px] text-white/40 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                            {te.result}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                  {streamText && <Markdown content={streamText} />}
                  <span className="inline-block w-1.5 h-4 bg-white/40 animate-pulse ml-0.5" />
                </div>
              </div>
            )}

            {/* Streaming: initial loading */}
            {streaming && !streamText && liveTools.length === 0 && (
              <div className="flex justify-start">
                <div className="rounded-xl px-4 py-3 bg-white/[0.03] border border-white/10">
                  <Loader2 size={16} className="animate-spin text-white/30" />
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Pending attachments */}
          {attachments.length > 0 && (
            <div className="px-4 sm:px-6 py-2 border-t border-white/5 flex gap-2 flex-wrap">
              {attachments.map((att, i) => (
                <div key={i} className="relative group">
                  <div className="h-10 px-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 text-xs text-white/50">
                    <Paperclip size={12} /> {att.name}
                  </div>
                  <button onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-4 sm:px-6 py-3 border-t border-white/10 shrink-0">
            <div className="flex gap-2 items-end">
              <button onClick={() => fileInputRef.current?.click()}
                className="p-2.5 hover:bg-white/10 rounded-lg text-white/30 hover:text-white/60 transition-colors shrink-0">
                <Paperclip size={18} />
              </button>
              <input ref={fileInputRef} type="file" multiple
                accept=".txt,.csv,.json,.md,.py,.js,.ts,.rs,.go,.java,.c,.cpp,.h,.yaml,.yml,.toml,.xml,.html,.css,.sql,.sh"
                onChange={handleFileUpload} className="hidden" />
              <textarea value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={isReady ? "Send a message to the agent..." : "Configure your API key first"}
                rows={1} disabled={!isReady}
                className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-white/30 resize-none disabled:opacity-40"
              />
              {streaming ? (
                <Button variant="danger" size="sm" onClick={handleStop} className="shrink-0"><Square size={14} /></Button>
              ) : (
                <Button size="sm" onClick={handleSend} disabled={!isReady || (!input.trim() && !attachments.length)} className="shrink-0">
                  <Send size={14} />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="w-72 xl:w-80 border-l border-white/10 overflow-y-auto p-4 space-y-5 hidden lg:block shrink-0">
            {/* API Key */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-white/40 font-medium">API Key</label>
                <a href="/dashboard/api-keys" className="text-[10px] text-blue-400 hover:text-blue-300">
                  Manage keys &rarr;
                </a>
              </div>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => saveApiKey(e.target.value)}
                  placeholder="clst_..."
                  className="w-full px-3 py-2 pr-8 bg-white/5 border border-white/10 rounded-lg text-xs font-mono outline-none focus:border-white/30"
                />
                <button onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/50">
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Model */}
            <div>
              <label className="text-xs text-white/40 mb-2 block font-medium">Model</label>
              <div className="flex items-center gap-2 p-2.5 bg-white/5 border border-white/10 rounded-lg">
                <div>
                  <p className="font-medium text-xs">{MODELS[0].name}</p>
                  <p className="text-[10px] text-white/40">{MODELS[0].provider}</p>
                </div>
              </div>
            </div>

            {/* System Prompt */}
            <div>
              <label className="text-xs text-white/40 mb-2 block font-medium">System Prompt</label>
              <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="You are a helpful assistant..."
                rows={3} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs outline-none focus:border-white/30 resize-none" />
            </div>

            {/* Max Tokens */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-white/40 font-medium">Max Tokens</label>
                <span className="text-xs text-white/50 font-mono">{maxTokens.toLocaleString()}</span>
              </div>
              <input type="range" min="1024" max="64000" step="1024" value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-500" />
            </div>

            {/* Max Turns */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-white/40 font-medium">Max Turns</label>
                <span className="text-xs text-white/50 font-mono">{maxTurns}</span>
              </div>
              <input type="range" min="1" max="50" step="1" value={maxTurns}
                onChange={(e) => setMaxTurns(parseInt(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-500" />
            </div>

            {/* API code preview */}
            <div>
              <label className="text-xs text-white/40 mb-2 block font-medium">API Equivalent</label>
              <pre className="p-2.5 bg-white/[0.03] border border-white/5 rounded-lg text-[9px] font-mono text-green-400/60 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
{`curl -N ${PUBLIC_API_URL}/v1/agent/run \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
  "content": "your message",
  "model": "${model}",${systemPrompt ? `\n  "system_prompt": "${systemPrompt.slice(0, 30)}...",` : ""}
  "max_tokens": ${maxTokens},
  "max_turns": ${maxTurns},
  "stream_format": "native"
}'`}</pre>
            </div>

            {/* Status */}
            <div className="pt-2 border-t border-white/5 space-y-1.5">
              <div className="flex items-center gap-2 text-[10px] text-white/25">
                <span className={`w-1.5 h-1.5 rounded-full ${isReady ? "bg-green-400" : "bg-red-400"}`} />
                {isReady ? "Ready — 42 tools via Rust backend" : "No API key configured"}
              </div>
              {sessionId && (
                <div className="flex items-center gap-2 text-[10px] text-white/25">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  Session: {sessionId.slice(0, 8)}
                </div>
              )}
              <div className="flex items-center gap-2 text-[10px] text-white/25">
                <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                Endpoint: {PUBLIC_API_URL}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
