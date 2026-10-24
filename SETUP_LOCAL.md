# VYORA — Zero-friction local setup (Windows)

## Project root (important)

Use **this** folder, not the parent:

```text
D:\Ayush\Ayush Projects\Vyora\VYORA_
```

If you run `npm run dev` one level up and see `Missing script: "dev"`, you are in the wrong directory.

## Requirements

- Node.js **22.5+** (you already have **24.22.1** — supported)
- No Visual Studio C++ build tools
- No switching Node versions for SQLite

## One-time install

```powershell
cd "D:\Ayush\Ayush Projects\Vyora\VYORA_"
copy .env.example .env
npm install
```

## Start everything

```powershell
npm run dev
```

Then open:

| Service | URL |
|--------|-----|
| **Frontend (use this)** | http://localhost:5173 |
| Backend API | http://localhost:3000 |

## What changed (SQLite)

`better-sqlite3` was removed. The app now uses Node’s built-in **`node:sqlite` (`DatabaseSync`)**:

- Same file-backed database: `database/vyora.sqlite`
- Same SQL, prepared statements, and schema
- No native binary / no `node-gyp` / no VS Build Tools

## Useful scripts

```powershell
npm run dev          # Vite + Express together
npm run dev:backend  # API only on :3000
npm run dev:frontend # Vite only on :5173
npm run build        # Production frontend → dist/
npm start            # Express serves API + dist/ (or frontend/public)
npm run db:init      # Ensure schema exists
npm test             # Existing node:test suite
```

## Troubleshooting

1. **Wrong folder** — `package.json` with `"dev"` must be inside `VYORA_`.
2. **Port in use** — stop other Node processes or change `PORT` in `.env`.
3. **API fails from the browser** — use **http://localhost:5173** (Vite proxies `/api` → `:3000`).
4. **Old `node_modules`** after pulling these changes:

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm install
```
