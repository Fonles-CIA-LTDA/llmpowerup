<p align="center">
  <h1 align="center">LLMPowerUp</h1>
  <p align="center"><strong>Make any LLM as capable as ChatGPT or Claude. One API call.</strong></p>
  <p align="center">
    <a href="https://github.com/Fonles-CIA-LTDA/llmpowerup/stargazers"><img src="https://img.shields.io/github/stars/Fonles-CIA-LTDA/llmpowerup?style=social" alt="GitHub Stars"></a>
    <a href="https://github.com/Fonles-CIA-LTDA/llmpowerup/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="License"></a>
    <a href="https://github.com/Fonles-CIA-LTDA/llmpowerup/issues"><img src="https://img.shields.io/github/issues/Fonles-CIA-LTDA/llmpowerup" alt="Issues"></a>
    <img src="https://img.shields.io/badge/rust-112K%2B_lines-orange" alt="Rust">
    <img src="https://img.shields.io/badge/tools-42-brightgreen" alt="42 Tools">
    <img src="https://img.shields.io/badge/models-300%2B-purple" alt="300+ Models">
    <img src="https://img.shields.io/badge/status-beta-yellow" alt="Beta">
  </p>
  <p align="center">
    <a href="https://www.llmpowerup.com">Website</a> &bull;
    <a href="#quick-start">Quick Start</a> &bull;
    <a href="#api-reference">API</a> &bull;
    <a href="#roadmap">Roadmap</a>
  </p>
</p>

> **If this project is useful to you, please consider giving it a star. It helps us grow and build a better tool for everyone.**

---

## The Problem

When you connect a raw LLM to your app, it feels dumb. It can't run code. It can't search the web. It can't edit files. It forgets the conversation. It doesn't plan, doesn't retry, doesn't orchestrate.

That's because **ChatGPT, Claude, and Gemini aren't just models — they're entire agent systems.** The model is just one piece. Behind it there's tool orchestration, multi-turn planning, session memory, execution sandboxing, cost tracking, and streaming infrastructure. That's what makes them feel intelligent.

**LLMPowerUp gives you that entire system.** Plug in any model, and it instantly gets the same capabilities: 42 tools, agent loop, streaming, sessions, sandboxing — everything. Your Gemma, your Llama, your Mistral suddenly feels as capable as the best closed-source agents.

```bash
# This isn't a chat completion. This is a full agent run.
# The model will plan, use tools, search the web, execute code,
# and stream results back — automatically.

curl -N https://api.llmpowerup.com/v1/agent/run \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "google/gemini-3-flash-preview",
    "content": "Find all TODO comments in this repo and create a summary",
    "stream_format": "native"
  }'
```

## What Makes Models Feel "Smart"

It's not the model. It's the infrastructure around it.

| What you see in ChatGPT/Claude | What LLMPowerUp gives you |
|-------------------------------|--------------------------|
| Runs code to answer questions | Bash, Python REPL, PowerShell |
| Searches the web in real time | Brave Search, WebFetch |
| Reads and edits your files | FileRead, FileWrite, FileEdit, Glob, Grep |
| Plans multi-step tasks | Agent loop with automatic tool orchestration |
| Spawns sub-tasks | Sub-agents, skills, task management |
| Remembers your conversation | Session persistence (PostgreSQL) |
| Streams responses in real time | SSE (Native, Vercel AI SDK, OpenAI-compat) |
| Works with any model | 300+ models via OpenRouter / BYOK |

**Without this infrastructure**, even GPT-4o feels like a fancy autocomplete.
**With it**, even a 7B open model can plan, execute, and deliver.

## Why LLMPowerUp?

| | LLMPowerUp | Building from scratch | Raw LLM API |
|-|-----------|----------------------|-------------|
| **Time to agent** | 1 API call | Weeks/months | You get text back |
| **Tools** | 42 built-in | You build each one | None |
| **Agent loop** | Automatic multi-turn | You implement it | None |
| **Model support** | 300+ models, swap anytime | Locked to one | One provider |
| **Streaming** | 3 formats (SSE, Vercel, OpenAI) | You build it | Varies |
| **Sessions** | Built-in (PostgreSQL) | You build it | None |
| **Sandboxing** | Per-tenant isolation | You build it | None |
| **Cost tracking** | Automatic | You build it | None |

## Key Numbers

- **112,000+ lines** of Rust
- **42 tools** — bash, file I/O, web search, code analysis, sub-agents, MCP, and more
- **300+ models** via OpenRouter — or bring your own key for Anthropic, OpenAI, Google, etc.
- **3 stream formats** — Native SSE, Vercel AI SDK, OpenAI-compatible
- **13 crates** in a modular workspace architecture
- **< 50ms** cold start (it's Rust, not Python)

## Architecture

```
Your App (any language)
    |
    | POST /v1/agent/run
    v
+-----------------------+
|    LLMPowerUp API     |  Axum (Rust)
|  Auth, Rate Limiting  |
|  Session Management   |
+-----------+-----------+
            |
     +------+------+
     |             |
  LLM Provider   42 Tools
  (OpenRouter,   (Bash, Files,
   Anthropic,    Web Search,
   OpenAI...)    Sub-agents...)
```

### The 42 Tools

| Category | Tools |
|----------|-------|
| **Code execution** | Bash, PowerShell, PTY, REPL |
| **File operations** | Read, Write, Edit, Glob, Grep, BatchEdit, ApplyPatch |
| **Web** | WebSearch (Brave), WebFetch |
| **Agent orchestration** | AgentTool (sub-agents), SendMessage, Skills |
| **Planning** | Tasks, TodoWrite, EnterPlanMode, ExitPlanMode |
| **Code intelligence** | LSP, NotebookEdit, ToolSearch |
| **Infrastructure** | Cron, RemoteTrigger, Worktree, ComputerUse |
| **MCP** | MCP Resources, MCP Auth |
| **Utilities** | AskUser, Sleep, Config, Brief, SyntheticOutput |

## Quick Start

> **Note:** LLMPowerUp is currently in **beta**. The API is stable but some features are still being built. See the [Roadmap](#roadmap) for what's coming.

### Option 1: Use the hosted API (fastest)

1. Sign up at [www.llmpowerup.com](https://www.llmpowerup.com)
2. Create an API key
3. Start making requests

### Option 2: Self-host with Docker

```bash
git clone https://github.com/Fonles-CIA-LTDA/llmpowerup.git
cd llmpowerup

# Configure
cp .env.example .env
# Edit .env with your DATABASE_URL, ENCRYPTION_KEY, etc.

# Run
docker compose up -d
```

### Option 3: Build from source

```bash
# Prerequisites: Rust 1.75+, PostgreSQL (or Supabase), Node.js 20+

git clone https://github.com/Fonles-CIA-LTDA/llmpowerup.git
cd llmpowerup

# Set up Supabase (see SUPABASE_SETUP.md for full guide)
# Then configure environment:
cp src-rust/crates/server/.env.example src-rust/crates/server/.env
cp services/api-proxy/.env.example services/api-proxy/.env
cp dashboard/.env.example dashboard/.env.local
# Edit each .env with your Supabase credentials

# Build and run the Rust backend
cd src-rust
cargo build --release -p claurst-server
cd crates/server && cargo run --release
```

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for the complete database and auth setup guide.

## API Reference

### Start an agent run

```bash
POST /v1/agent/run
```

**Request:**
```json
{
  "content": "Your message",
  "model": "google/gemini-3-flash-preview",
  "session_id": "optional-uuid",
  "system_prompt": "optional custom prompt",
  "max_tokens": 16000,
  "max_turns": 10,
  "stream_format": "native"
}
```

**Response:** Server-Sent Events stream

```
event: status
data: {"message":"Calling model..."}

event: content_block_delta
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Here's what I found..."}}

event: tool_start
data: {"tool_name":"WebSearch","tool_id":"abc123"}

event: tool_end
data: {"tool_name":"WebSearch","tool_id":"abc123","result":"...","is_error":false}

event: turn_complete
data: {"stop_reason":"end_turn"}
```

### Other endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/v1/models` | List available models |
| `GET` | `/v1/tools` | List available tools |
| `POST` | `/v1/sessions` | Create a session |
| `GET` | `/v1/sessions` | List sessions |
| `GET` | `/v1/usage` | Monthly usage stats |

### Stream formats

| Format | Header | Compatible with |
|--------|--------|----------------|
| `native` | Default | Raw SSE consumers |
| `vercel` | `stream_format: "vercel"` | Vercel AI SDK |
| `openai` | `stream_format: "openai"` | OpenAI SDK, LangChain |

### SDK examples

**Python (LangChain):**
```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    base_url="https://api.llmpowerup.com/v1",
    api_key="YOUR_KEY",
    model="google/gemini-3-flash-preview",
)
response = llm.invoke("Analyze this data")
```

**TypeScript (Vercel AI SDK):**
```typescript
const response = await fetch('https://api.llmpowerup.com/v1/agent/run', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'google/gemini-3-flash-preview',
    content: 'Build a React component',
    stream_format: 'vercel',
  }),
});
```

## Project Structure

```
llmpowerup/
├── src-rust/                 # Rust backend (112K+ lines)
│   └── crates/
│       ├── server/           # API server (Axum)
│       ├── core/             # Types, sessions, auth
│       ├── api/              # LLM provider clients (30+)
│       ├── tools/            # 42 tool implementations
│       ├── query/            # Agent loop & streaming
│       ├── mcp/              # Model Context Protocol
│       ├── cli/              # CLI entry point
│       ├── tui/              # Terminal UI (Ratatui)
│       ├── bridge/           # IDE integration
│       ├── commands/         # Slash commands
│       ├── plugins/          # Plugin system
│       ├── buddy/            # Companion system
│       └── acp/              # Agent Client Protocol
├── services/
│   └── api-proxy/            # API gateway (Node.js/Hono)
├── dashboard/                # Admin panel (Next.js)
└── chat.sh                   # CLI testing tool
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `ENCRYPTION_KEY` | AES-256 key (64 hex chars) | Required |
| `SUPABASE_JWT_SECRET` | JWT validation secret | Required |
| `SANDBOX_BASE_DIR` | Per-tenant sandbox directory | `/tmp/llmpowerup-sandboxes` |
| `MAX_CONCURRENT_RUNS` | Max parallel agent runs | `200` |
| `BRAVE_SEARCH_API_KEY` | For WebSearch tool | Optional |

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the full development roadmap.

**Coming soon:**
- Stripe billing integration
- Docker Compose deployment
- Python & TypeScript SDKs
- Plugin marketplace
- Real-time usage dashboard
- Team/organization management

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

```bash
# Run tests
cd src-rust && cargo test

# Run the server in development
cd src-rust/crates/server && cargo run

# Run the dashboard
cd dashboard && pnpm dev
```

## License

Licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

You can freely use, modify, and self-host LLMPowerUp. If you run a modified version as a network service, you must make your source code available under the same license.

For commercial licensing (e.g., embedding in proprietary products without AGPL obligations), contact us at hello@llmpowerup.com.

See [LICENSE](./LICENSE) for the full text.

## Star History

If LLMPowerUp helps you, star the repo — it helps us reach more developers.

<a href="https://star-history.com/#Fonles-CIA-LTDA/llmpowerup&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Fonles-CIA-LTDA/llmpowerup&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Fonles-CIA-LTDA/llmpowerup&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Fonles-CIA-LTDA/llmpowerup&type=Date" />
  </picture>
</a>

---

<p align="center">
  <strong>LLMPowerUp</strong> &mdash; Open-Source AI Agent Engine (Beta)
  <br>
  Built with Rust by <a href="https://fonles.com">Fonles Studios, Corp.</a> &mdash; Ecuador
  <br>
  <a href="https://www.llmpowerup.com">www.llmpowerup.com</a>
</p>
