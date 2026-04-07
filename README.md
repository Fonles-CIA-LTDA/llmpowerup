<p align="center">
  <h1 align="center">LLMPowerUp</h1>
  <p align="center"><strong>The power of Claude Code and OpenAI Codex — as an API for your business.</strong></p>
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

You've seen what Claude Code and OpenAI Codex can do: they plan, execute code, search the web, edit files, orchestrate sub-tasks, and stream results in real time. They don't just generate text — they **act**.

But you can't embed Claude Code into your product. You can't give Codex to your users. These are closed products, not APIs you can build on.

**LLMPowerUp is that API.** The same agent architecture — 42 tools, multi-turn planning, session memory, execution sandboxing, real-time streaming — packaged as an open-source backend you own. Plug in any model (Gemini, Llama, GPT, Mistral, or 300+ others), and it gets the full agent stack. Your users get the Claude Code / Codex experience. You keep the control.

```bash
# This isn't a chat completion. This is a full agent run.
# The model will plan, use tools, search the web, execute code,
# and stream results back — just like Claude Code or Codex.

curl -N https://api.llmpowerup.com/v1/agent/run \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "google/gemini-3-flash-preview",
    "content": "Find all security vulnerabilities in this repo and fix them",
    "stream_format": "native"
  }'
```

## Claude Code / Codex power — as your API

| What Claude Code & Codex do | What LLMPowerUp gives you |
|------------------------------|--------------------------|
| Execute code to solve problems | Bash, Python REPL, PowerShell — sandboxed per tenant |
| Search the web for real-time info | Brave Search, WebFetch |
| Read, write, and edit codebases | FileRead, FileWrite, FileEdit, Glob, Grep, BatchEdit |
| Plan and execute multi-step tasks | Automatic agent loop with tool orchestration |
| Spawn sub-agents for parallel work | Sub-agents, skills, task management |
| Remember context across turns | Session persistence (PostgreSQL) |
| Stream results in real time | SSE in 3 formats (Native, Vercel AI SDK, OpenAI-compat) |
| **Locked to one model** | **300+ models — swap with one parameter** |
| **Closed source, can't self-host** | **Open source, self-host, embed in your product** |
| **Can't white-label for your users** | **Multi-tenant: each customer gets their own sandbox** |

## Why businesses choose LLMPowerUp

| | LLMPowerUp | Building it yourself | Using Claude/Codex directly |
|-|-----------|---------------------|---------------------------|
| **Embed in your product** | Yes — it's your API | Yes, after months of work | No — they're end-user products |
| **Model freedom** | 300+ models, swap anytime | You pick one | Locked to their model |
| **Time to ship** | 1 API call | Weeks/months | N/A |
| **Tools** | 42 built-in | You build each one | Can't customize |
| **Multi-tenant** | Built-in isolation | You build it | Not designed for this |
| **Cost** | Your model costs only | Your model + your infra | Their pricing |
| **Self-host** | Yes | Yes | No |

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
