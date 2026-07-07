# SprintFlow — Product Requirements Document

**Version:** 2.0
**Status:** Current
**Scope:** Sprint Forecasting (Jira Forge App)

---

## 1. Executive Summary

SprintFlow is an Atlassian Forge app that adds a **SprintFlow** action to the Jira Cloud backlog view. It gives engineering managers a day-by-day visualization of how the currently selected sprint's work will flow through Dev and QA, grounded in the team's own historical cycle time data and daily capacity — instead of relying on velocity alone.

Unlike a standalone planning tool, SprintFlow runs *inside* Jira as a Forge Custom UI panel (`jira:backlogAction`). It reads sprint, board, team, and issue data directly from the Jira Cloud site it's installed on — no CSV export/import step, no separate login, and no data leaving Atlassian's infrastructure. Cycle times are calculated automatically from each team's own closed-issue history (time spent in each workflow status), removing the need to manually estimate Dev/QA duration per story-point value.

Configuration (cycle times, team member roles, capacity, phase assignments) is saved via Forge's managed app storage, scoped per Jira project, and persists across sessions without any user account or backend to maintain.

---

## 2. Problem Statement

Scrum teams use velocity to decide *how much* work to commit to a sprint. Velocity tells you the budget but not the shape — it cannot answer whether the selected stories will create a QA bottleneck on Days 7–8, or whether starting three large stories on Day 1 will overload developers in the first half and leave testers idle in the second.

Sprint planning decisions are currently made by intuition during a time-pressured meeting, with no model to validate whether the plan is physically executable given the team's capacity on each day. Compounding this, "how long does a story of size X actually take in each phase of our workflow" is rarely tracked systematically — teams either guess or rely on stale, manually-maintained spreadsheets that drift out of sync with how the team actually works today.

SprintFlow addresses both halves of this: it computes real cycle times directly from Jira issue history (so the inputs are trustworthy and self-updating), and it visualizes how those cycle times interact with the team's day-by-day capacity for the specific sprint being planned (so bottlenecks are visible *before* commitments are made, not after).

---

## 3. Users

| Role | Description |
|---|---|
| **Scrum Master** | Primary user. Owns sprint planning for the team associated with a given Jira board/project. Configures cycle time phase assignments and team capacity. Uses the Flow Grid during backlog refinement and sprint planning sessions to validate scope against capacity. |

SprintFlow is scoped to **one team per Jira board/project context** — there is no in-app team switcher. A manager overseeing multiple teams opens SprintFlow from within each team's respective Jira board; each board/project gets its own independent configuration.

---

## 4. Goals

- Provide a **visual, day-level forecast** of story progression through Dev and QA phases for the currently selected sprint
- Enable teams to **validate sprint commitments against actual daily capacity** before the sprint begins
- Surface **workflow bottlenecks** (e.g., QA overload on Days 8–10) proactively
- Maintain a **non-prescriptive model** — no individual assignments, no task deadlines; the tool models aggregate flow, not individual schedules
- **Derive cycle times automatically from Jira issue history** rather than requiring teams to estimate or manually maintain them
- Let teams **map their own workflow statuses to Dev/QA phases**, since status names and workflows differ by project
- Require **zero manual data entry to get started**: opening the app inside a Jira board with sprints and story points is sufficient
- Persist configuration **per Jira project** so returning to the app reflects the last session's settings without re-entry

---

## 5. Success Metrics

- Teams adjust sprint scope (add, remove, or reorder stories, or change story start days) based on Flow Grid output during planning
- Fewer mid-sprint bottlenecks surface as surprises (QA queue buildups, late-sprint Dev crunches)
- Cycle time estimates used for planning are recalculated from real Jira history rather than going stale
- Increased predictability of flow, not just velocity, across consecutive sprints

---

## 6. Functional Requirements

### 6.1 Jira Context Detection

- On open, SprintFlow reads the current **board ID** and **project key** from the Forge extension context (`jira:backlogAction`) — the user does not select these manually
- Team identity is derived automatically from the Jira **Team** custom field (`customfield_10001`) found on issues in the project; if no Team field value is found, the project key is used as the team name
- There is no team-creation or team-switching UI — each Jira board/project context maps to exactly one SprintFlow configuration

### 6.2 Team Members

- Team member list is populated from Jira, using (in order of preference): the Atlassian Teams API (if a Team ID was resolved), team-scoped board issue assignees, or all project-assignable users as a final fallback
- Each member can be tagged as **Dev**, **QA**, or **Both** via toggle buttons in Config
- **Devs Are QAs** toggle: when enabled, the same people cover both roles; QA capacity is derived from Dev capacity rather than tracked separately
- Default Dev/QA capacity counts are computed from the number of members tagged into each role

### 6.3 Sprint Selection & Backlog Data

- SprintFlow fetches the list of **active and future sprints** for the current board, filtered to only sprints containing at least one plannable issue (Story, Bug, or Spike — Sub-tasks and Epics are excluded) for the current project
- Default sprint selection: previously-saved sprint (if still valid) → first future sprint → first active sprint
- Users can switch sprints via a dropdown in the Sprint view; switching re-fetches that sprint's issues and re-applies any saved per-story overrides
- Per issue, SprintFlow reads: **Summary**, **Story Points** (`customfield_10032`), and **Sprint** (`customfield_10020`, used to detect rollover — an issue present in more than one sprint entry is flagged as a rollover)
- Sprint length (working days) and sprint start day (Monday–Friday) are computed from the selected sprint's start/end dates, not manually entered

### 6.4 Backlog Table

Per story, users can edit:

| Field | Description |
|---|---|
| **Start Day** | Sprint day (1-indexed) on which the story begins. Default: 1. Used to stagger work across the sprint. |
| **Rollover** | Flag indicating the story was carried from a previous sprint (auto-detected from the Sprint field, user-adjustable). Highlighted red in the grid. |
| **Override** | Manual mode: user can set each cell's status directly rather than letting the engine compute it. |

All other fields (Key, Summary, Story Points) are read-only, sourced from Jira. Stories can be removed from the working set and reordered (move up/down) within the backlog table; this does not modify the underlying Jira issue, only SprintFlow's local view of it.

### 6.5 Cycle Time Calculation (from Jira History)

This is the core data input that replaces manual cycle-time estimation:

- **Recalculate from Jira** button in Config triggers a team-scoped query for **Closed** issues with **resolution = Complete** and a non-empty Story Points value, over a configurable lookback window (**Days Back**, default 60, range 7–730)
- For each matching issue, SprintFlow parses its changelog history and computes how many days it spent in each workflow status, then averages those durations across all issues sharing the same story-point value
- Results are shown in a **Breakdown table**: rows = story-point values, columns = board workflow statuses (in board column order), cells = average whole days spent in that status for that point value
- Only statuses in Jira's **"in progress"** status category are considered (To Do and Done category statuses are excluded from the breakdown)
- On first load, if no cycle time data has been saved yet, this calculation runs automatically once; afterward it only re-runs when the user clicks Recalculate

### 6.6 Phase Assignment

- Because workflow status names vary by project, users map each board status to **Dev**, **QA**, or neither via toggle buttons in Config
- Changing a status's phase assignment immediately re-derives the Dev/QA cycle time totals used by the Flow Grid — no re-fetch from Jira is needed
- A status's total time contributes to Dev days if assigned Dev, QA days if assigned QA, or is excluded entirely if assigned neither

### 6.7 Flow Grid Estimates (Derived & Editable)

- The Dev/QA day totals derived from Phase Assignment are shown per story-point value and are individually editable, allowing manual overrides where the historical average doesn't reflect current expectations
- Point buckets can be added or removed to match the team's actual pointing scale

### 6.8 Default Capacity

- Default Dev/QA capacity per day is derived from team membership (count of members tagged into each role)
- Per-day exceptions (holidays, planned leave, part-time days) are entered directly in the Flow Grid's capacity summary rows and persist between sessions

### 6.9 Flow Grid

The Flow Grid is the core forecast output. It is a matrix of **stories (rows) × sprint days (columns)**.

**Cell states:**

| State | Display | Meaning |
|---|---|---|
| `idle` | Gray | Story has not yet started on this day |
| `dev` | Blue · **D** | Story is in active development |
| `qa` | Purple · **Q** | Story is in QA / testing |
| `done` | Green · **✓** | Story is complete |
| `unknown` | Red · **?** | No cycle time defined for this story's point value |

**Computation model:** Each story transitions linearly — `idle → dev → qa → done` — based on its Start Day and the derived (or overridden) cycle time for its point value. This is a waterfall model at the story level; it does not model context switching or partial days.

**Manual override mode:** Toggling a story's Override checkbox lets the user click individual day cells to manually cycle through states (Done → Dev → QA → Idle → Done), bypassing the computed schedule for that story.

**Rollover stories** are highlighted in red in the story name column for immediate visibility.

**Summary rows** (individually toggleable):

| Row | Description |
|---|---|
| Dev Demand | Sum of story points in `dev` state per day |
| Dev Capacity | Available devs per day (default or overridden); editable inline |
| Dev Load | Dev Demand ÷ Dev Capacity; color-coded |
| QA Demand | Sum of story points in `qa` state per day |
| QA Capacity | Available QA per day; editable inline (shows "N/A" if Devs Are QAs is enabled) |
| QA Load | QA Demand ÷ QA Capacity; color-coded |

**Load color coding:**

| Load | Color | Meaning |
|---|---|---|
| 0 | Gray | No demand |
| ≤ 1.0 | Green | At or under capacity |
| ≤ 1.25 | Amber | Mild overload — monitor |
| > 1.25 | Red | Bottleneck — address before sprint starts |

**Capacity overrides** entered inline in the grid are shown in amber to distinguish them from defaults. They persist between sessions.

**Alerts shown above the grid:**
- Zero-capacity warning if both Dev and QA default capacity are 0
- Missing-cycle-time warning listing any story-point values present in the backlog that have no configured cycle time

---

## 7. Navigation & Information Architecture

```
Jira Backlog → "SprintFlow" action → opens Forge panel

Panel Nav (top bar)
├── Sprint   — Flow Grid + Backlog Table for the selected sprint
└── Config   — Team members, cycle times, phase assignment, capacity
```

There is no multi-team sidebar, no home/how-to page, and no quarter-level view — the panel opens directly into the Sprint view for the current board's team, with a sprint dropdown to switch between active/future sprints.

---

## 8. Data Architecture

### 8.1 Persistence

All configuration persists via **Forge's managed app storage** (`storage:app` scope) — not the browser's localStorage. Storage is keyed per Jira project:

| Storage Key Pattern | Contents |
|---|---|
| `sprintflow-config:{projectKey}` | Cycle times (derived + detailed), cycle time settings, member roles, capacity overrides, story overrides, selected sprint ID, Devs-Are-QAs flag |

Sprint, issue, board, and team data itself is **not** duplicated into storage — it's fetched live from Jira on each load via Forge resolvers and only the user's configuration/overrides are persisted. Saves are debounced (500ms) to avoid excessive write calls.

### 8.2 Core Data Models

```typescript
Team {
  id, name
  cycleTimes: CycleTimes                          // sp -> { dev, qa } (derived or overridden)
  detailedCycleTimes?: DetailedCycleTimes          // sp -> statusName -> avgDays (raw, from Jira)
  defaultCapacity: { devs, qa }
  sprintLength: number
  sprintStartDay: 1–5 (Mon–Fri)
  devsAreQAs: boolean
  members: TeamMemberConfig[]
  backlog: Story[]
  capacityOverrides: Record<day, { devs?, qa? }>
}

Story {
  issueKey, summary, storyPoints
  startDay: number          // 1-indexed sprint day work begins
  rollover: boolean
  override: boolean         // manual cell mode
  overrideCells: StoryStatus[]
}

TeamMemberConfig {
  id, name
  role: 'dev' | 'qa' | 'both'
}

BoardStatusConfig {
  id, name                  // in-progress-category board statuses, in board column order
}

CycleTimeSettings {
  devStatuses: string[]     // board status names assigned to Dev
  qaStatuses: string[]      // board status names assigned to QA
  daysBack: number          // lookback window for getCycleTimes
}

SprintOption {
  id, name
  state: 'active' | 'future'
  sprintLength: number
  sprintStartDay: number
}
```

### 8.3 Backend Resolvers (Forge Functions)

| Resolver | Purpose |
|---|---|
| `getTeamMembers` | Resolves team name/ID from the Team field and returns member list |
| `getBoardStatuses` | Returns in-progress-category board statuses in column order |
| `getSprintList` | Returns active/future sprints with plannable issues for the board/project |
| `getSprintIssues` | Returns Story/Bug/Spike issues for a given sprint |
| `getCycleTimes` | Computes time-in-status averages per story-point value from closed, completed, team-scoped issue history |
| `loadConfig` / `saveConfig` | Reads/writes the project-scoped `SavedConfig` object to Forge storage |
| `ping` | Health-check / deployment diagnostic |

### 8.4 Jira Custom Fields Referenced

| Field | ID | Used For |
|---|---|---|
| Team | `customfield_10001` | Team identification and cycle-time JQL scoping |
| Story Points | `customfield_10032` | Cycle time bucketing, backlog display |
| Sprint | `customfield_10020` | Rollover detection (multi-entry = rolled over) |

---

## 9. Non-Functional Requirements

| Requirement | Specification |
|---|---|
| **Platform** | Atlassian Forge Custom UI app (`jira:backlogAction` module), runs inside Jira Cloud |
| **Backend** | Forge resolver functions (Node.js) — no self-hosted server or infrastructure to maintain |
| **Persistence** | Forge app storage, scoped per Jira project; no localStorage |
| **Permissions** | Least-privilege Forge scopes: read access to Jira issues/boards/sprints/projects/accounts, plus app-scoped storage — no write access to Jira issue data |
| **Data residency** | All Jira data access happens via Forge's managed runtime on Atlassian's infrastructure; no data is sent to any third-party service |
| **Performance** | Forecast computation is synchronous and in-memory once data is fetched; must be imperceptible for teams of ≤ 20 members and ≤ 100 backlog issues |
| **State management** | Zustand (frontend), Forge storage (backend persistence) |
| **Styling** | Tailwind CSS |
| **Tech stack** | React 18, TypeScript, Vite, Tailwind CSS, Zustand, `@forge/api`, `@forge/resolver`, `@forge/bridge` |
| **Testing** | Vitest + React Testing Library; flow/metrics engine logic is unit-tested independently of UI |
| **Security** | Executes under Atlassian's Forge sandbox; `asUser()` calls enforce the logged-in user's own Jira permissions when querying issue data |

---

## 10. Out of Scope

| Feature | Rationale for Exclusion |
|---|---|
| CSV backlog upload | Superseded by live Jira sprint/issue data; no manual export/import step needed |
| localStorage persistence | Superseded by Forge app storage, which works across devices/sessions for the same Jira account |
| Multi-team creation / team switcher | Each Jira board/project context implicitly maps to one team; a manager with multiple teams opens SprintFlow from each team's own board |
| Writing back to Jira issues | SprintFlow is read-only against Jira issue data; all planning adjustments (start day, overrides) live in SprintFlow's own config, not on the Jira issue |
| Individual story or task assignments | Violates the non-prescriptive model; would make the tool feel like a project management system |
| Gantt chart or timeline export | Out of scope for current planning workflow |
| Mobile / responsive layout | Primary use is on a laptop during a planning session, inside the Jira web app |
| Quarter Planning / OKR tracking | See Section 11 — exists as an unintegrated prototype from an earlier standalone version of SprintFlow, not part of the current Forge app |

---

## 11. Open Questions / Future Considerations

- **Quarter Planning revival:** An earlier standalone (non-Forge) version of SprintFlow included a Quarter Planning module — T-shirt-sized OKRs, dependency-aware scheduling, per-member absence tracking, and a sprint-by-sprint capacity forecast. That code exists in the repository but is not wired into the current Forge app's navigation. A future version could reintroduce it as a second Forge module/tab, adapted to pull team roster and absence data from Jira where possible rather than manual entry.
- **Multi-board team detection:** The current Team field-based detection assumes issues in a project consistently carry the same Team value. Projects that intentionally span multiple teams within one board are not explicitly modeled beyond the existing team-scoped fallback logic.
- **Cross-sprint rollover tracking:** Rollover is currently a per-issue, per-load flag (detected from the Sprint field) rather than a tracked history; a future version could show how many times a story has rolled over.
- **Confidence interval display:** The cycle time model currently reports a single average per status/point value. A future version could show variance (e.g., min/median/max) to better convey estimate uncertainty.
- **Write-back to Jira:** Currently no SprintFlow-derived data (adjusted start days, phase assignments) is written back to Jira. A future version could optionally sync select fields for visibility outside the app.
