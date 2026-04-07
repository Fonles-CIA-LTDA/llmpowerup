"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

const endpoints = [
  {
    method: "POST",
    path: "/v1/agent/run",
    desc: "Start a full agent run with tools and streaming",
    body: `{
  "model": "google/gemini-3-flash-preview",
  "provider": "openrouter",
  "content": "Your message here",
  "max_turns": 10,
  "stream_format": "native"
}`,
    curl: `curl -X POST https://api.llmpowerup.com/v1/agent/run \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"google/gemini-3-flash-preview","provider":"openrouter","content":"Hello"}'`,
  },
  {
    method: "POST",
    path: "/v1/sessions",
    desc: "Create a new conversation session",
    body: `{
  "model": "google/gemini-3-flash-preview",
  "provider": "openrouter",
  "system_prompt": "You are a helpful assistant"
}`,
    curl: `curl -X POST https://api.llmpowerup.com/v1/sessions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"google/gemini-3-flash-preview","provider":"openrouter"}'`,
  },
  {
    method: "GET",
    path: "/v1/models",
    desc: "List available models",
    body: null,
    curl: `curl https://api.llmpowerup.com/v1/models \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
  },
  {
    method: "GET",
    path: "/v1/tools",
    desc: "List available tools for your plan",
    body: null,
    curl: `curl https://api.llmpowerup.com/v1/tools \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
  },
  {
    method: "GET",
    path: "/v1/usage",
    desc: "Get current credit balance and usage",
    body: null,
    curl: `curl https://api.llmpowerup.com/v1/usage \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
  },
];

const sdkExamples = {
  vercel: `import { useChat } from 'ai/react';

// In your React component:
const { messages, input, handleInputChange, handleSubmit } = useChat({
  api: 'https://api.llmpowerup.com/v1/agent/run',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
  },
  body: {
    model: 'google/gemini-3-flash-preview',
    provider: 'openrouter',
    stream_format: 'vercel',
  },
});`,
  langchain: `from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    base_url="https://api.llmpowerup.com/v1",
    api_key="YOUR_LLMPowerUp_API_KEY",
    model="google/gemini-3-flash-preview",
)

response = llm.invoke("Hello, how are you?")
print(response.content)`,
  typescript: `const response = await fetch('https://api.llmpowerup.com/v1/agent/run', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'google/gemini-3-flash-preview',
    provider: 'openrouter',
    content: 'Analyze this codebase',
    stream_format: 'native',
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(decoder.decode(value));
}`,
};

const methodColors: Record<string, string> = {
  GET: "text-green-400 bg-green-500/10",
  POST: "text-blue-400 bg-blue-500/10",
  DELETE: "text-red-400 bg-red-500/10",
};

export default function DocsPage() {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"vercel" | "langchain" | "typescript">("typescript");

  const copy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">API Documentation</h1>
      <p className="text-white/50 text-sm mb-8">
        Complete reference for the LLMPowerUp API.
      </p>

      {/* Auth */}
      <div className="rounded-xl border border-white/10 p-6 mb-8">
        <h2 className="text-lg font-semibold mb-3">Authentication</h2>
        <p className="text-sm text-white/50 mb-3">
          All API requests require a Bearer token in the Authorization header:
        </p>
        <pre className="p-4 bg-white/5 rounded-lg text-sm font-mono text-white/70 overflow-x-auto">
          Authorization: Bearer clst_your_api_key
        </pre>
      </div>

      {/* SDK Examples */}
      <div className="rounded-xl border border-white/10 p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">SDK Integration</h2>
        <div className="flex gap-2 mb-4">
          {(["typescript", "vercel", "langchain"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs rounded-lg ${
                activeTab === tab ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
              }`}
            >
              {tab === "typescript" ? "TypeScript" : tab === "vercel" ? "Vercel AI SDK" : "LangChain"}
            </button>
          ))}
        </div>
        <pre className="p-4 bg-white/5 rounded-lg text-sm font-mono text-green-300/80 overflow-x-auto whitespace-pre-wrap">
          {sdkExamples[activeTab]}
        </pre>
      </div>

      {/* Endpoints */}
      <h2 className="text-lg font-semibold mb-4">Endpoints</h2>
      <div className="space-y-4">
        {endpoints.map((ep, idx) => (
          <div key={idx} className="rounded-xl border border-white/10 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 text-xs font-bold rounded ${methodColors[ep.method]}`}>
                  {ep.method}
                </span>
                <code className="text-sm font-mono">{ep.path}</code>
              </div>
              <p className="text-xs text-white/40">{ep.desc}</p>
            </div>
            {ep.body && (
              <div className="p-4 border-b border-white/5">
                <p className="text-xs text-white/30 mb-2">Request body:</p>
                <pre className="p-3 bg-white/[0.03] rounded-lg text-xs font-mono text-white/60 overflow-x-auto">
                  {ep.body}
                </pre>
              </div>
            )}
            <div className="p-4 bg-white/[0.01]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-white/30">curl example:</p>
                <button
                  onClick={() => copy(ep.curl, idx)}
                  className="p-1 hover:bg-white/10 rounded text-white/30 hover:text-white/60"
                >
                  {copiedIdx === idx ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
              </div>
              <pre className="p-3 bg-white/[0.03] rounded-lg text-xs font-mono text-green-300/70 overflow-x-auto whitespace-pre-wrap">
                {ep.curl}
              </pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
