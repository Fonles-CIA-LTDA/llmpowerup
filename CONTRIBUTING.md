# Contributing to LLMPowerUp

Thanks for your interest in contributing!

## Getting Started

```bash
git clone https://github.com/Fonles-CIA-LTDA/llmpowerup.git
cd llmpowerup
```

### Rust Backend
```bash
cd src-rust
cargo build
cargo test
```

### Dashboard
```bash
cd dashboard
pnpm install
pnpm dev
```

### API Proxy
```bash
cd services/api-proxy
pnpm install
pnpm dev
```

## What to Work On

Check the [ROADMAP.md](./ROADMAP.md) for planned features. Issues labeled `good first issue` are great starting points.

**High-impact areas:**
- Docker Compose deployment setup
- Python / TypeScript SDKs
- New tool implementations
- Documentation and tutorials

## Pull Request Process

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Add tests if applicable
4. Run `cargo test` and `cargo clippy`
5. Open a PR with a clear description of what and why

## Code Style

- Rust: follow `rustfmt` defaults
- TypeScript: follow existing patterns in the codebase
- Keep PRs focused — one feature or fix per PR

## License

By contributing, you agree that your contributions will be licensed under the AGPL-3.0 license.
