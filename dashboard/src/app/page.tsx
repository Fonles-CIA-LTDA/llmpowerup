import Link from "next/link";
import { Check } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-white/10">
        <span className="text-lg sm:text-xl font-bold tracking-tight">LLMPowerUp</span>
        <div className="flex gap-2 sm:gap-4">
          <Link href="/login" className="px-3 sm:px-4 py-2 text-sm text-white/70 hover:text-white transition-colors">
            Log in
          </Link>
          <Link
            href="/register"
            className="px-3 sm:px-4 py-2 text-sm bg-white text-black rounded-lg font-medium hover:bg-white/90 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      <main className="flex flex-col items-center justify-center px-4 sm:px-8 py-16 sm:py-32 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 text-xs border border-white/20 rounded-full text-white/60">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          Now in Beta
        </div>

        {/* Hero */}
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight max-w-4xl leading-[1.1]">
          Claude Code & Codex power{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">
            as your API
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-white/60 max-w-2xl px-4">
          You can&apos;t embed Claude Code or Codex into your product. LLMPowerUp gives you the same
          agent system — 42 tools, multi-turn planning, code execution, web search — as an API you own. Any model. Your users.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mt-10 w-full sm:w-auto px-4 sm:px-0">
          <Link
            href="/register"
            className="px-8 py-3 bg-white text-black rounded-lg font-semibold hover:bg-white/90 text-sm text-center transition-colors"
          >
            Start Free
          </Link>
          <Link
            href="/dashboard/docs"
            className="px-8 py-3 border border-white/20 rounded-lg font-semibold hover:bg-white/5 text-sm text-center transition-colors"
          >
            View Docs
          </Link>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mt-16 sm:mt-24 max-w-5xl w-full px-4 sm:px-0">
          {[
            { title: "Claude Code / Codex for your product", desc: "Same capabilities: code execution, web search, file editing, sub-agents, planning. But it's your API, not theirs." },
            { title: "Any model, same power", desc: "Gemini, Llama, GPT, Mistral, or 300+ others via OpenRouter. They all get the full 42-tool agent system." },
            { title: "Built for businesses", desc: "Multi-tenant, per-user sandboxing, session persistence, usage tracking, SSE streaming. Ship to your users today." },
          ].map((f) => (
            <div key={f.title} className="p-5 sm:p-6 border border-white/10 rounded-xl text-left hover:border-white/20 transition-colors">
              <h3 className="text-base sm:text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-white/50">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Code Example */}
        <div className="mt-16 sm:mt-24 max-w-2xl w-full text-left px-4 sm:px-0">
          <p className="text-sm text-white/40 mb-3">One call. The model figures out the rest:</p>
          <pre className="p-4 sm:p-6 bg-white/5 border border-white/10 rounded-xl text-xs sm:text-sm overflow-x-auto">
            <code className="text-green-400">{`curl -N https://api.llmpowerup.com/v1/agent/run \\
  -H "Authorization: Bearer clst_your_key" \\
  -d '{
    "model": "google/gemini-3-flash-preview",
    "content": "Find security vulnerabilities in this repo"
  }'

# The model will automatically:
# 1. Search for code files (Glob, Grep)
# 2. Read suspicious files (FileRead)
# 3. Run static analysis (Bash)
# 4. Search for known CVEs (WebSearch)
# 5. Write a detailed report
# All streamed back in real-time via SSE`}</code>
          </pre>
        </div>

        {/* Pricing */}
        <div className="mt-16 sm:mt-24 max-w-4xl w-full px-4 sm:px-0">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">Simple pricing</h2>
          <p className="text-white/50 text-sm sm:text-base mb-8">
            1 request = 1 API call. No matter how many tools run. You bring your own LLM key.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                name: "Free", price: "$0", period: "",
                features: ["100 requests/mo", "All 42 tools", "5 req/min", "300+ models via OpenRouter"],
              },
              {
                name: "Pro", price: "$30", period: "/mo", highlight: true,
                features: ["10,000 requests/mo", "All 42 tools", "60 req/min", "Priority support"],
              },
              {
                name: "Enterprise", price: "$199", period: "/mo",
                features: ["100,000 requests/mo", "All tools + custom", "300 req/min", "Dedicated support"],
              },
            ].map((p) => (
              <div
                key={p.name}
                className={`p-5 sm:p-6 rounded-xl border text-left ${
                  p.highlight ? "border-blue-500 bg-blue-500/5 ring-1 ring-blue-500/20" : "border-white/10"
                }`}
              >
                {p.highlight && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-2 block">
                    Most Popular
                  </span>
                )}
                <h3 className="font-semibold text-lg">{p.name}</h3>
                <p className="text-3xl font-bold mt-1">
                  {p.price}
                  <span className="text-sm font-normal text-white/40">{p.period}</span>
                </p>
                <ul className="mt-4 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="text-sm text-white/60 flex items-center gap-2">
                      <Check size={14} className="text-white/25 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`mt-5 block text-center py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    p.highlight
                      ? "bg-blue-500 text-white hover:bg-blue-600"
                      : "border border-white/10 hover:bg-white/5"
                  }`}
                >
                  {p.name === "Enterprise" ? "Contact Sales" : "Get Started"}
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-24 pb-8 text-xs text-white/20">
          LLMPowerUp &middot; AI Backend-as-a-Service
        </footer>
      </main>
    </div>
  );
}
