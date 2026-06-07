# santander-finance

Financial dashboard for Santander Chile via Floid Open Banking API.

**Built with [OpenClaw](https://openclaw.ai)** — AI-assisted development platform.

## What it does

- Syncs transactions and loan data from Santander Chile
- Uses [Floid](https://floid.io) Open Banking API for secure integration
- Dashboard UI to visualize accounts, transactions, and loan status
- Local SQLite database for offline access
- Automated transaction splitting and financial calculations

## Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/GyoGon/santander-finance.git
   cd santander-finance
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with:
   - `FLOID_API_KEY` — Get from https://floid.io
   - `SANTANDER_RUT` — Your RUT (without dashes)
   - `SANTANDER_CLAVE` — Your bank PIN
   - `FLOID_BASE_URL` — Floid API endpoint
   - `DASHBOARD_PORT` — Port for the web UI (default: 8766)

4. Sync data:
   ```bash
   node -r dotenv/config src/sync.js
   ```

5. Start dashboard:
   ```bash
   npm run dashboard
   ```
   Open http://localhost:8766

## Project structure

```
src/
  db/           — SQLite schema and CRUD operations
  santander/    — Floid API client + auth
  dashboard/    — Web UI server
  processor/    — Financial calculations
  sync.js       — Main sync orchestrator

tests/          — Jest test suite
data/           — SQLite database (gitignored)
```

## Security

- Credentials stored **only** in `.env` (never committed)
- `.gitignore` protects:
  - `.env` (environment variables)
  - `data/` (database files)
  - `*.db` (SQLite files)
  - `.santander-token.json` (API tokens)

See `.env.example` for required fields (template values only).

## Notes

Floid is business-focused and may require a paid plan for personal use. This project is ready to use once you have valid Floid credentials.

## Development

Run tests:
```bash
npm test
npm run test:watch
```

---

*Project setup and integration by [OpenClaw](https://openclaw.ai)*
