# SprintFlow

This project contains a Forge app written in Javascript that displays SprintFlow in a Jira backlog action. 

See [developer.atlassian.com/platform/forge/](https://developer.atlassian.com/platform/forge) for documentation and tutorials explaining Forge.

## Requirements

See [Set up Forge](https://developer.atlassian.com/platform/forge/set-up-forge/) for instructions to get set up.

## Quick start
- Install top-level dependencies:
```
npm install
```

- Install dependencies inside of the `static/sprintflow` directory:
```
npm install
```

- Modify your app by editing the files in `static/sprintflow/src/` — SprintFlow's own views live at the top level, Epic Planning's live under `src/epic-planning/`, and Backlog Assistant's live under `src/backlog-assistant/`. `src/Root.tsx` decides which one to render based on which backlog action submenu item was clicked.

- Build your app (inside of the `static/sprintflow` directory):
```
npm run build
```

- Deploy your app by running:
```
forge deploy
```
This deploys to the `development` environment by default. To deploy to `staging` or `production` instead, pass `-e`:
```
forge deploy -e staging
forge deploy -e production
```

- Install your app in an Atlassian site by running:
```
forge install
```

### Notes
- Use the `forge deploy` command when you want to persist code changes. It uploads to one Forge environment bucket (`development`/`staging`/`production`) and has no effect on any live site until that site has been installed against that specific environment.
- Use the `forge install` command when you want to install the app on a new site, or link it to a specific environment (`--environment <env>`).
- Once the app is installed on a site, the site picks up the new app changes you deploy to that same environment without needing to rerun the install command.
- Run `forge install list` at any time to see which sites are installed on which environment. See `docs/Forge-Overview-and-Deployment-Guide.md` for the current environments table.

## Testing Instructions

Local development uses `forge tunnel`, which serves the React frontend from a local Vite preview server and routes resolver invocations through Forge's tunnel service to your machine.

> **Corporate network note:** `forge tunnel` routes Jira API calls through Node.js on your machine. If a corporate SSL proxy is present, set the following in the same terminal before starting the tunnel to avoid `SELF_SIGNED_CERT_IN_CHAIN` errors:
>
> Command Prompt (cmd.exe):
> ```cmd
> set NODE_TLS_REJECT_UNAUTHORIZED=0
> ```
> PowerShell:
> ```powershell
> $env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
> ```

### Terminal order

**Terminal 1 — Frontend watch build** (`static/sprintflow/`)

Recompiles the React app on every source change and outputs to `build/`:
```
npm run watch
```

**Terminal 2 — Vite preview server** (`static/sprintflow/`)

Serves the compiled `build/` directory on port 5173. Forge tunnel proxies this to the Jira modal:
```
npm run serve
```

**Terminal 3 — Forge tunnel** (project root `SprintFlow/`)

Connects your local machine to Forge, routing resolver function calls here and serving static assets from port 5173:
```
forge tunnel
```

**Terminal 4 — Forge logs** (project root `SprintFlow/`)

Tails resolver `console.log` / `console.error` output in real time. Open this after the tunnel is connected to monitor backend activity:
```
forge logs
```

### Typical workflow

1. Start **Terminal 1** (`npm run watch` in `static/sprintflow/`) and wait for the initial build to complete.
2. Start **Terminal 2** (`npm run serve` in `static/sprintflow/`) — confirm it reports `Local: http://localhost:5173`.
3. Start **Terminal 3** (`forge tunnel`) — wait for `Tunnel running` confirmation.
4. Open **Terminal 4** (`forge logs`) to monitor resolver output.
5. Open the Jira board, open the backlog action menu, and hover **Team Tools** to reveal the **SprintFlow** / **Epic Planning** / **Backlog Assistant** submenu.
6. Edit source files in `static/sprintflow/src/` (SprintFlow's own views), `static/sprintflow/src/epic-planning/` (Epic Planning), or `static/sprintflow/src/backlog-assistant/` (Backlog Assistant) — the watch build recompiles automatically. Hard-refresh the Jira page to pick up changes.
7. Resolver changes (files in `src/`) are picked up by the tunnel automatically without a restart.

### Deploying to production

When ready to ship, stop the tunnel and run from the project root:
```
npm run build   # inside static/sprintflow/
forge deploy
```
The deployed build uses Forge's CDN — no local server needed.

## Support

See [Get help](https://developer.atlassian.com/platform/forge/get-help/) for how to get help and provide feedback.
