# SprintFlow — Product Requirements Document

**Version:** 3.1
**Status:** Current
**Scope:** Sprint Forecasting & Quarterly Epic Planning (Jira Forge App)

---

## 1. Executive Summary

SprintFlow is an Atlassian Forge app that adds a **SprintFlow Tools** action to the Jira Cloud backlog view, with two panels reachable from a submenu:

- **SprintFlow** gives engineering managers a day-by-day visualization of how the currently selected sprint's work will flow through Dev and QA, grounded in the team's own historical cycle time data and daily capacity — instead of relying on velocity alone.
- **Epic Planning** (see Section 9) gives teams a quarter-by-quarter forecast of whether their T-shirt-sized Epic commitments fit realistic sprint dev capacity across a full year, before committing to a roadmap.

Both panels run *inside* Jira as Forge Custom UI panels (`jira:backlogAction`). They read sprint, board, team, and issue data directly from the Jira Cloud site they're installed on — no CSV export/import step, no separate login, and no data leaving Atlassian's infrastructure. SprintFlow's cycle times are calculated automatically from each team's own closed-issue history (time spent in each workflow status), removing the need to manually estimate Dev/QA duration per story-point value.

Configuration for both panels is saved via Forge's managed app storage, scoped per Jira project, and persists across sessions without any user account or backend to maintain.

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

**Rollover auto-repositioning:** Checking a story's Rollover box moves it to the bottom of the rollover group at the top of the backlog/Flow Grid (rollover rows cluster together, in the order they were marked, above all non-rollover rows), so carried-over work is immediately visible without scrolling. Unchecking it clears the flag but leaves the row in place — it is not automatically moved back down.

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

**Rollover stories** are highlighted in red in the story name column for immediate visibility, and are automatically repositioned to the top of the grid when flagged (Section 6.4).

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
Jira Backlog → "SprintFlow Tools" action → submenu
├── SprintFlow      — opens the sprint-forecasting Forge panel
└── Epic Planning   — opens the quarterly Epic-forecasting Forge panel (Section 9)

SprintFlow Panel Nav (top bar)
├── Sprint   — Flow Grid + Backlog Table for the selected sprint
└── Config   — Team members, cycle times, phase assignment, capacity

Epic Planning Panel Nav (top bar controls)
├── Year selector       — auto-provisions that year's Q1–Q4 quarters
└── Quarter selector    — Q1 / Q2 / Q3 / Q4 / All (Section 9.7)
```

There is no multi-team sidebar and no home/how-to page — each panel opens directly into its primary working view (Sprint view for SprintFlow, the selected quarter for Epic Planning) for the current board's team.

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

## 9. Epic Planning Module

### 9.1 Overview

Epic Planning is the second panel reachable from the **SprintFlow Tools** backlog action (`epic-planning` submenu item, distinct from the `sprintflow` item — see `manifest.yml`). Where SprintFlow forecasts a single sprint's day-by-day Dev/QA flow at the story level, Epic Planning forecasts Epic-level commitments at the quarter/sprint grain across a full year, so a team can see whether their roadmap fits realistic sprint dev capacity before drilling into per-sprint planning.

### 9.2 Users

| Role | Description |
|---|---|
| **Engineering Manager / Team Lead** | Owns quarterly roadmap planning for the team associated with a given Jira board/project. Assigns T-shirt sizes and dev allocation to Epics, tracks risks/dependencies, records team member absences, and reviews the forecast to catch overcommitment before a quarter starts. |

Epic Planning shares SprintFlow's **one team per Jira board/project context** model — team identity is resolved via the same `getTeamMembers` resolver used by SprintFlow (Section 6.1), so there is no separate team setup step.

### 9.3 Goals

- Let a team plan multiple T-shirt-sized Epics against sprint-level dev capacity across a full year, split into Q1–Q4 quarters
- Auto-provision all four quarters for a selected year with sensible sprint-count defaults, rather than requiring a manual "add quarter" step
- Support **Epic rollover** — an Epic spanning quarter boundaries can be entered in each quarter it's active in without being treated as a duplicate or double-booked
- Model **dependencies** between Epics and **per-member sprint absences**, and compute scheduling automatically via dependency-aware bin-packing rather than requiring manual scheduling
- Surface Epics that don't fit a quarter's capacity ("overflow") so scope conversations happen before commitment, not mid-quarter
- Provide a read-only view spanning all four quarters of a year to catch cross-quarter alignment issues (e.g., an Epic rolling from Q1 into Q2) without flipping between quarters
- Persist entirely in Forge storage, scoped per project, with no separate login or config step beyond what SprintFlow already establishes

### 9.4 Functional Requirements

**Quarters**

- A quarter (`Quarter`) belongs to one team, one year, and one name (Q1–Q4), and holds its own sprint count, member list, and Epic list
- Selecting a year (bounded dropdown: current year − 1 to + 2) auto-creates any of that year's four quarters that don't yet exist, defaulting sprint counts to Q1 = 8 and Q2–Q4 = 6 sprints; existing quarters and their data are left untouched
- **Reset Quarter** clears a single quarter's Epics, sprint count (back to its default), and member absences, without removing the quarter itself or affecting other quarters/years — gated behind a confirmation dialog since it's unrecoverable
- Sprint count per quarter is user-editable (1–20)

**Epics**

- Each Epic has: an optional link to a real Jira Epic (`issueKey` + summary, chosen from a live backlog dropdown) or a free-text title if unlinked; a T-shirt size (XS–XL plus Jumbo, mapped to a fixed sprint duration: XS = 0.5, S = 1, M = 2, L = 3, XL = 6, Jumbo = 8 sprints); a dev-allocation headcount; free-text risks (each tagged low/medium/high) and notes; and dependencies on other Epics in the same quarter
- Within a single quarter, a backlog-linked Epic can only be assigned to one row — Epics already used by another row in that quarter are hidden from the selection dropdown to prevent double-planning. The **same** Epic can be re-selected in a **different** quarter, which is how rollover work continuing into the next quarter is represented
- Epics can be reordered (move up/down) within a quarter; order affects display and, when the scheduler has a tie, scheduling priority
- Available backlog Epics are fetched live from Jira (`getBacklogEpics`): issue type Epic, project-scoped, team-scoped when a real Team ID is resolved, excluding Closed/Cancelled statuses
- **T-shirt size pre-population:** selecting a backlog Epic reads its Jira **T-Shirt Size** field (`customfield_10269`); if it holds a value matching one of the six sizes, the Epic's size is set to that value automatically. If the field is empty or unrecognized, the size is left at its current value for manual selection (defaults to M for a new Epic row)

**Team Capacity**

- Team roster is synced from Jira (same source as SprintFlow's Team Members) into each quarter independently, keyed by the Jira-sourced member ID so a member's identity stays stable across quarters
- Per member, per sprint, a user enters days absent (0–10, where 10 is a fully-out sprint) in a member-by-sprint grid; per-member total available days and a per-sprint "Available Devs" summary row are derived automatically

**Forecast Engine**

For each quarter independently (there is no cross-quarter scheduling model), the forecast engine:

- Computes per-sprint total dev-day capacity from team absences (10 days per sprint per fully-available member, reduced by absence days)
- Topologically sorts Epics by their declared dependencies, so a dependent Epic is never scheduled to start before its dependencies' end sprint
- Greedily bin-packs each Epic into the earliest contiguous sprint range (sized by its T-shirt duration) with sufficient remaining dev-day capacity for its dev allocation
- Flags an Epic that cannot fit anywhere within the quarter's sprint count as **overflow** rather than silently dropping it or force-fitting it
- Produces per-sprint metrics (available/used dev-days, utilization ratio), color-coded green (≤80%), amber (≤100%), or red (>100%)

This mirrors SprintFlow's Flow Grid philosophy — visualize capacity vs. demand before commitment — at the Epic/quarter grain instead of the story/day grain.

**Single-Quarter Forecast Grid**

- Epic rows show a size-colored bar spanning their scheduled sprint range, with size-letter and continuation markers on the first/middle/last sprint of the bar, and a red overflow badge when an Epic doesn't fit
- An "Epics / Members / Both" toggle switches the grid between Epic schedules, a member absence heatmap, or both
- Three footer rows show available dev-days, used dev-days, and utilization per sprint
- An overflow banner lists any Epics that don't fit, or an all-clear banner when everything fits

### 9.5 Combined "All Quarters" View

A fifth option ("All") in the quarter selector renders all four of the selected year's quarters merged into a single, continuous, horizontally-scrollable table rather than four separate grids:

- Column groups run Q1's sprint columns, then Q2's, Q3's, and Q4's, each visually delineated with a labeled quarter header
- An Epic entered into more than one quarter (rollover) merges into a **single row** spanning the relevant quarter blocks, with its own independently-computed forecast bar drawn under each quarter block it's scheduled in — so an Epic's Q1 tail and Q2 continuation are visible on one line, not as duplicate rows
- Team members merge the same way, by their stable Jira-sourced ID
- The three capacity footer rows span the full merged column set
- Strictly read-only — no add/edit/remove controls; users return to a specific quarter to make changes

### 9.6 Data Architecture

- **Storage key:** `sprintflow-quarters:{projectKey}` (Forge app storage, `storage:app` scope) holds the full array of quarters for that project's team — a separate key from SprintFlow's own `sprintflow-config:{projectKey}` so the two modules' data never collide. Saves are debounced (500ms) and flushed immediately on panel close, same pattern as SprintFlow (Section 8.1)
- **Core data model:** `Quarter { id, name, year, sprintCount, teamId, members, epics }`, `Epic { id, title, issueKey?, size, devAllocation, risks, dependencies, notes }`, `TeamMember { id, name, absences }`, plus forecast-only types (`EpicSchedule`, `SprintMetrics`) produced by the forecast engine and not persisted
- **Resolvers added for Epic Planning:**

| Resolver | Purpose |
|---|---|
| `loadQuarters` / `saveQuarters` | Reads/writes the project-scoped `Quarter[]` array to Forge storage |
| `getBacklogEpics` | Live, project/team-scoped Jira query for open Epics available to assign, including each Epic's T-Shirt Size field for size pre-population |

`getTeamMembers` (Section 8.3) is reused unchanged from SprintFlow — there is no separate roster resolver for Epic Planning.

**Jira custom field referenced:** T-Shirt Size, `customfield_10269` — a single-select field on Epics; matched case-insensitively against SprintFlow's own size scale (XS/S/M/L/XL/Jumbo) to pre-populate an Epic's size when assigned.

### 9.7 Out of Scope (Epic Planning–specific)

| Feature | Rationale for Exclusion |
|---|---|
| Cross-quarter scheduling / a unified timeline model | The "All" view is a read-only, render-time merge over four independently-computed per-quarter forecasts, not a shared scheduling engine — deliberately avoided to keep each quarter's forecast simple and independently resettable |
| Writing planning data back to Jira Epics | Same read-only-against-Jira principle as SprintFlow (Section 11) — Epic sizing, dev allocation, risk, dependency, and notes data lives only in Epic Planning's own storage |
| Automatic Epic rollover | The tool does not move an unfinished Epic into the next quarter automatically; a user re-selects the same Epic in the next quarter's Epic list manually |
| Historical/versioned quarters | Resetting or overwriting a quarter's data is destructive and unrecoverable (no undo/history), consistent with the confirmation-gated Reset Quarter action |

---

## 10. Non-Functional Requirements

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

## 11. Out of Scope

| Feature | Rationale for Exclusion |
|---|---|
| CSV backlog upload | Superseded by live Jira sprint/issue data; no manual export/import step needed |
| localStorage persistence | Superseded by Forge app storage, which works across devices/sessions for the same Jira account |
| Multi-team creation / team switcher | Each Jira board/project context implicitly maps to one team; a manager with multiple teams opens SprintFlow from each team's own board |
| Writing back to Jira issues | SprintFlow is read-only against Jira issue data; all planning adjustments (start day, overrides) live in SprintFlow's own config, not on the Jira issue |
| Individual story or task assignments | Violates the non-prescriptive model; would make the tool feel like a project management system |
| Gantt chart or timeline export | Out of scope for current planning workflow |
| Mobile / responsive layout | Primary use is on a laptop during a planning session, inside the Jira web app |

See Section 9.7 for Epic Planning–specific out-of-scope items.

---

## 12. Open Questions / Future Considerations

- **Epic Planning ↔ Jira write-back:** Epic Planning is currently entirely one-directional (reads Epics from Jira, keeps sizing/scheduling data local). A future version could optionally sync computed schedule dates back to Jira Epic fields for visibility outside the app.
- **Epic Planning capacity data entry:** Member absences are entered manually per sprint per quarter. A future version could source planned time off from an existing Jira/HR data source where available, reducing manual upkeep.
- **Multi-board team detection:** The current Team field-based detection assumes issues in a project consistently carry the same Team value. Projects that intentionally span multiple teams within one board are not explicitly modeled beyond the existing team-scoped fallback logic.
- **Cross-sprint rollover tracking:** Rollover is currently a per-issue, per-load flag (detected from the Sprint field) rather than a tracked history; a future version could show how many times a story has rolled over.
- **Confidence interval display:** The cycle time model currently reports a single average per status/point value. A future version could show variance (e.g., min/median/max) to better convey estimate uncertainty.
- **Write-back to Jira:** Currently no SprintFlow-derived data (adjusted start days, phase assignments) is written back to Jira. A future version could optionally sync select fields for visibility outside the app.
