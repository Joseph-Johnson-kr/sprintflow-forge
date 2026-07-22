# SprintFlow — Product Requirements Document

**Version:** 3.1
**Status:** Current
**Scope:** Sprint Forecasting & Quarterly Epic Planning (Jira Forge App)

---

## 1. Executive Summary

SprintFlow is an Atlassian Forge app that adds a **Team Tools** action to the Jira Cloud backlog view, with three panels reachable from a submenu:

- **SprintFlow** gives engineering managers a day-by-day visualization of how the currently selected sprint's work will flow through Dev and QA, grounded in the team's own historical cycle time data and daily capacity — instead of relying on velocity alone.
- **Epic Planning** (see Section 9) gives teams a quarter-by-quarter forecast of whether their T-shirt-sized Epic commitments fit realistic sprint dev capacity across a full year, before committing to a roadmap.
- **Backlog Assistant** (see Section 10) gives teams a dependency-graph view of an entire project's backlog, surfacing which work unblocks the most other work, grouping stories under Objectives, and checking whether a sprint's scope is enough to fully close out an Objective.

All three panels run *inside* Jira as Forge Custom UI panels (`jira:backlogAction`). They read sprint, board, team, and issue data directly from the Jira Cloud site they're installed on — no CSV export/import step, no separate login, and no data leaving Atlassian's infrastructure. SprintFlow's cycle times are calculated automatically from each team's own closed-issue history (time spent in each workflow status), removing the need to manually estimate Dev/QA duration per story-point value.

Configuration for all three panels is saved via Forge's managed app storage, scoped per Jira project, and persists across sessions without any user account or backend to maintain.

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

**Dependencies:** Each story has a Deps panel listing checkboxes for every other story in the current sprint's backlog, plus a search box for linking a Story, Bug, or Spike from any team/project. Checking a box or selecting a search result writes a real Jira "Blocks" issue link (the other issue blocks this one) in addition to updating SprintFlow's local `dependencies` list; unchecking or removing a chip deletes the Jira link the same way. Dependencies on issues outside the current sprint's backlog render as read-only external chips (issue key, summary, Story Points, and current sprint, once resolved) rather than becoming editable local rows. On load, local dependencies are reconciled against Jira's actual "Blocks" links for every story with a real issue key — links added or removed directly in Jira (outside SprintFlow) are picked up automatically. External dependencies do not affect Flow Grid scheduling; only same-sprint dependencies influence day placement.

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
Jira Backlog → "Team Tools" action → submenu
├── SprintFlow         — opens the sprint-forecasting Forge panel
├── Epic Planning      — opens the quarterly Epic-forecasting Forge panel (Section 9)
└── Backlog Assistant  — opens the dependency-graph backlog panel (Section 10)

SprintFlow Panel Nav (top bar)
├── Sprint   — Flow Grid + Backlog Table for the selected sprint
└── Config   — Team members, cycle times, phase assignment, capacity

Epic Planning Panel Nav (top bar controls)
├── Year selector       — auto-provisions that year's Q1–Q4 quarters
└── Quarter selector    — Q1 / Q2 / Q3 / Q4 / All (Section 9.7)

Backlog Assistant Panel Nav (toolbar)
├── Graph canvas (default) / Priority Queue — toggle between the dependency graph and a ranked list view
└── Objective Checker — modal, opened from the toolbar
```

There is no multi-team sidebar and no home/how-to page — each panel opens directly into its primary working view (Sprint view for SprintFlow, the selected quarter for Epic Planning, the dependency graph for Backlog Assistant) for the current board's project.

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
  dependencies: string[]           // issue keys this story depends on; local (checkbox) or external (chip)
  blockedByIssueKeys: string[]     // live from Jira's "Blocks" links; drives read-side reconciliation of `dependencies`
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
| `searchDependencyCandidates` | JQL search for Story/Bug/Spike issues (any team/project) to link as a dependency, shared with Epic Planning's Epic search |
| `getIssuesByKeys` | Resolves display info (summary, team, size/points, sprint) for external dependency chips whose issue isn't in the current backlog |
| `updateDependencyLink` | Creates or deletes a Jira "Blocks" issue link between two issue keys, shared with Epic Planning |
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

Epic Planning is the second panel reachable from the **Team Tools** backlog action (`epic-planning` submenu item, distinct from the `sprintflow` item — see `manifest.yml`). Where SprintFlow forecasts a single sprint's day-by-day Dev/QA flow at the story level, Epic Planning forecasts Epic-level commitments at the quarter/sprint grain across a full year, so a team can see whether their roadmap fits realistic sprint dev capacity before drilling into per-sprint planning.

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

- Each Epic has: an optional link to a real Jira Epic (`issueKey` + summary, chosen from a live backlog dropdown) or a free-text title if unlinked; a T-shirt size (XS–XL plus Jumbo, mapped to a fixed sprint duration: XS = 0.5, S = 1, M = 2, L = 3, XL = 6, Jumbo = 8 sprints); a dev-allocation headcount; free-text risks (each tagged low/medium/high) and notes; and dependencies, either on other Epics in the same quarter (checkbox) or on any Epic found via search across quarters/teams/projects (external chip, read-only, display-only sizing/planning-version info)
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
- **Core data model:** `Quarter { id, name, year, sprintCount, teamId, members, epics }`, `Epic { id, title, issueKey?, size, devAllocation, risks, dependencies, blockedByIssueKeys, notes }`, `TeamMember { id, name, absences }`, plus forecast-only types (`EpicSchedule`, `SprintMetrics`) produced by the forecast engine and not persisted. `blockedByIssueKeys` is live from Jira's "Blocks" links (not persisted) and drives read-side reconciliation of `dependencies`, mirroring `Story` (Section 8.2)
- **Resolvers added for Epic Planning:**

| Resolver | Purpose |
|---|---|
| `loadQuarters` / `saveQuarters` | Reads/writes the project-scoped `Quarter[]` array to Forge storage |
| `getBacklogEpics` | Live, project/team-scoped Jira query for open Epics available to assign, including each Epic's T-Shirt Size field for size pre-population |

`getTeamMembers` (Section 8.3) is reused unchanged from SprintFlow — there is no separate roster resolver for Epic Planning. `searchDependencyCandidates`, `getIssuesByKeys`, and `updateDependencyLink` (Section 8.3) are likewise shared with SprintFlow's Story dependency search/write-back — `searchDependencyCandidates` is called with `issueTypes: ['Epic']` from Epic Planning.

**Jira custom field referenced:** T-Shirt Size, `customfield_10269` — a single-select field on Epics; matched case-insensitively against SprintFlow's own size scale (XS/S/M/L/XL/Jumbo) to pre-populate an Epic's size when assigned.

**Dependency write-back:** Checking a same-quarter dependency checkbox, or selecting a search result for a cross-team/project Epic, writes a real Jira "Blocks" issue link between the two Epics' underlying issues (via `updateDependencyLink`), in addition to updating the local `dependencies` array; unchecking or removing an external chip deletes the Jira link the same way. This is the one exception to Epic Planning's otherwise read-only relationship with Jira (see Section 9.7) — sizing, dev allocation, risk, and notes remain local-only. On load, an Epic's dependencies are reconciled against Jira's actual "Blocks" links for any Epic with a real `issueKey`, so links changed directly in Jira are picked up automatically; local-only Epic rows (free-text title, no `issueKey`) are exempt since they were never synced.

### 9.7 Out of Scope (Epic Planning–specific)

| Feature | Rationale for Exclusion |
|---|---|
| Cross-quarter scheduling / a unified timeline model | The "All" view is a read-only, render-time merge over four independently-computed per-quarter forecasts, not a shared scheduling engine — deliberately avoided to keep each quarter's forecast simple and independently resettable |
| Writing planning data back to Jira Epics | Same read-only-against-Jira principle as SprintFlow (Section 12) — Epic sizing, dev allocation, risk, and notes data lives only in Epic Planning's own storage. The one exception is dependency links, which write to Jira as real "Blocks" issue links (Section 9.4) |
| Automatic Epic rollover | The tool does not move an unfinished Epic into the next quarter automatically; a user re-selects the same Epic in the next quarter's Epic list manually |
| Historical/versioned quarters | Resetting or overwriting a quarter's data is destructive and unrecoverable (no undo/history), consistent with the confirmation-gated Reset Quarter action |

---

## 10. Backlog Assistant Module

### 10.1 Overview

Backlog Assistant is the third panel reachable from the **Team Tools** backlog action (`backlog-assistant` submenu item — see `manifest.yml`). Where SprintFlow and Epic Planning forecast capacity against time, Backlog Assistant visualizes the *shape* of a project's backlog itself: every Story/Task/Bug/Spike/Risk/Epic/Objective in the project as a node in a dependency graph, connected by real Jira "Blocks" and "Relates" issue links, so a team can see at a glance which work is blocking the most other work and which larger Objectives are closest to being fully delivered.

Backlog Assistant reads and writes real Jira data directly — it has no CSV import/export step (a CSV-driven prototype existed during initial development and was fully replaced by live Jira reads/writes; only the optional local "Export/Import Work" JSON save file, Section 10.4, remains).

### 10.2 Users

| Role | Description |
|---|---|
| **Scrum Master / Backlog Owner** | Uses the dependency graph during backlog refinement to identify which items unblock the most downstream work, group related items under Objectives, and check whether a candidate sprint's scope would fully close out an Objective before committing to it. |

Backlog Assistant is scoped to the **current Jira project** (from `view.getContext()`), not a single team or board — Objectives are meant to span a project's initiative-level work, which may cut across multiple teams' boards.

### 10.3 Goals

- Surface which backlog items **unblock the most other work**, so refinement prioritizes items with the highest downstream leverage rather than relying on priority field alone
- Let teams group related Stories/Tasks/Bugs/Spikes under **Objectives** and see at a glance how close each Objective is to being fully deliverable
- Let a team check whether a **specific sprint's scope is sufficient to fully close out an Objective**, before sprint planning locks in that scope
- Read and write **real Jira dependency data** ("Blocks" and "Relates" issue links) rather than maintaining a separate, disconnected model of the backlog
- Persist the graph's layout and any rank-override annotations **per project, in Forge storage**, so returning to the panel (or opening it as a different user) reflects the last session's arrangement

### 10.4 Functional Requirements

**Data scope and loading**

- On open, Backlog Assistant fetches **every non-Sub-task issue in the current project** (`getBacklogAssistantData`), regardless of status — Done/Closed issues are intentionally included in the fetched dataset (not filtered out at the JQL level) so the Objective Checker (Section 10.6) can still see which Objective members are already complete
- If the project has more issues than a single fetch can return, a **truncation banner** is shown so users know the graph may be incomplete rather than silently missing items
- If the initial load fails (e.g., a transient Jira/Forge gateway error), the panel shows an error message with a **Retry** button rather than requiring the panel to be closed and reopened

**Graph canvas**

- Each issue renders as a node, color-coded by issue type (Epic, Objective, Story, Task, Spike, Risk, Bug, Sub-task) via `vis-network`; node border/shadow additionally indicate a rank override (amber) or a newly-added issue since the last session (cyan)
- "Blocks" issue links render as directed edges (arrow pointing from blocker to blocked item); "Relates" links do not render as graph edges — they instead express Objective-to-child membership (Section 10.4's "Objectives" below)
- Issues referenced by a dependency edge but outside the current project's fetched batch render as read-only, dashed-border "ghost" nodes with a distinct label, so a cross-project dependency is still visible without being editable
- **Add Dependency mode**: toggled from the toolbar, lets a user click a source node then a target node to create a new "Blocks" edge, written immediately to Jira as a real issue link
- **Right-click context menu** on a node offers Remove Dependency (for an edge under the cursor), Reverse Dependency direction, and Rank Override actions. Because Jira's site-wide `style-src` Content-Security-Policy silently drops DOM-positioned popups (`style={{left,top}}`), this menu — and Priority Queue's row menu — are drawn directly onto a `<canvas>` element rather than as positioned DOM nodes (see `utils/canvasContextMenu.ts`)
- Removing a dependency shows a transient **Undo** toast; clicking Undo re-creates the same Jira link
- **Objectives**: an `Objective`-type issue can have other issues assigned as members (via a "Relates" link); an Objective's members render clustered near it and can be collapsed to a single node (hiding members) or expanded, individually or all at once
- **Rank Override**: a user can flag any non-Objective node with a free-text reason, visually distinguishing it (amber border/shadow, star prefix in its label) from the graph's default type/priority-driven visual hierarchy — this is an annotation only, not written back to Jira
- **Fit** re-centers/re-scales the canvas to show the whole graph

**Priority Queue**

- An alternate, list-based view (toggled from the toolbar in place of the Sidebar) that ranks all non-Objective, non-Done issues by how many other items they transitively unblock (direct + indirect, via a breadth-first walk of "Blocks" edges), most-unblocking first
- Each row shows the issue's type, priority, and how many items it directly/indirectly unblocks and is blocked by, plus a plain-language explanation sentence (`pqExplanation`) suitable for reading aloud in a refinement session
- Rows support the same right-click context menu actions as the graph canvas (via the same canvas-drawn menu pattern, Section 10.4's context menu note), rendered on its own overlay `<canvas>` since Priority Queue is a plain DOM list, not a `vis-network` canvas

**Sidebar**

- Shown by default (in place of Priority Queue) with an Issue Detail view for the currently-selected node: summary, type, status, priority, story points, parent/Epic, sprint, and its dependency edges

**Objective Checker**

- A modal, opened from the toolbar, that lets a user pick a sprint (from the board's active/future sprints, via the shared `getSprintList` resolver) and checks each Objective in the project against that sprint's issue set plus already-Done issues
- An Objective is reported **"Ready to complete this sprint"** if every one of its members is either already Done or present in the selected sprint; **"Already complete"** if every member is already Done; otherwise it's omitted (some member is neither Done nor in the selected sprint, so the Objective isn't achievable by that sprint alone)
- Each "Ready to complete" row is expandable to show its individual members and whether each is Completed or In Sprint

**Session persistence and Export/Import**

- Node canvas positions, rank-override reasons, and which Objectives are collapsed are debounce-saved (500ms) to Forge app storage, scoped per project (`backlog-assistant-session:{projectKey}`) — shared across users/devices viewing the same project, not per-browser
- A `knownIssueKeys` baseline is stored alongside session data; on each load, any fetched issue key not in the stored baseline is flagged **new** (a "…" prefix and cyan highlight on its node) until the next load re-baselines it to the current full key set
- **Export Work** downloads the current node positions, rank overrides, and collapsed-Objective state as a local JSON file; **Import Work** restores that same shape from a previously-exported file — this is a convenience snapshot/restore mechanism for local layout state, not a substitute for the live Forge-storage session

### 10.5 Dependency Write-Back

Unlike SprintFlow and Epic Planning's dependency links (Sections 6.4, 9.4), Backlog Assistant writes back **two** Jira issue link types:

- **"Blocks"** — created/deleted via `updateDependencyLink` (shared with SprintFlow/Epic Planning) whenever a user adds, removes, or reverses a dependency edge on the graph or in the Priority Queue's context menu
- **"Relates"** — created/deleted via a Backlog Assistant-specific `updateRelatesLink` resolver whenever a user assigns or unassigns an issue to/from an Objective

Edge edits are optimistic: the local graph updates immediately, and the Jira write happens in the background. If reversing an edge's direction fails partway (the removal of the old link succeeds but creating the reversed link fails), the local state reverts to the original edge and the failure is logged.

### 10.6 Data Architecture

**Storage key:** `backlog-assistant-session:{projectKey}` (Forge app storage, `storage:app` scope) — a separate key from SprintFlow's and Epic Planning's own storage, so the three modules' data never collide.

**Core data model:**

```typescript
BAIssue {
  key, summary, type, status, priority, assignee
  storyPoints, sprint
  parentKey, parentSummary, epicName
}

BAEdge {
  id, from, to
  type: 'blocks' | 'relates'
}

RankOverride { reason }

SessionData {
  nodePositions: Record<issueKey, { x, y }>
  collapsedObjectives: string[]
  rankOverrides: Record<issueKey, RankOverride>
}
```

**Resolvers added for Backlog Assistant:**

| Resolver | Purpose |
|---|---|
| `getBacklogAssistantData` | Project-scoped Jira query for all non-Sub-task issues (any status) plus their "Blocks"/"Relates" edges; flags `truncated` if the project has more issues than could be fetched |
| `updateRelatesLink` | Creates or deletes a Jira "Relates" issue link between two issues, used to assign/unassign Objective membership |
| `loadBacklogAssistantSession` / `saveBacklogAssistantSession` | Reads/writes the project-scoped session blob (positions, rank overrides, collapsed state, known-issue-key baseline) to Forge storage |

`getSprintList` and `getSprintIssues` (Section 8.3) are reused unchanged for the Objective Checker's sprint dropdown and sprint-membership check. `updateDependencyLink` (Section 8.3) is reused unchanged for "Blocks" edges. `getTeamMembers` is **not** used — Backlog Assistant's data scope is the whole project, not a single team.

### 10.7 Out of Scope (Backlog Assistant–specific)

| Feature | Rationale for Exclusion |
|---|---|
| CSV backlog upload | An early prototype used CSV import/export; fully replaced by live Jira reads/writes once Phase 2 shipped — no manual export/import step needed to load data |
| Team- or board-scoped data | Objectives are meant to span a project's initiative-level work across teams; scoping to a single team's board would hide cross-team Objective members |
| Writing sizing/priority/status back to Jira | Backlog Assistant is read-only against issue fields — only dependency links ("Blocks", "Relates") are written back (Section 10.5) |
| Cross-quarter or capacity forecasting | That's SprintFlow's and Epic Planning's role; Backlog Assistant answers "what unblocks what" and "is this Objective coverable," not "does this fit our capacity" |
| DOM-positioned popups/menus | Jira's `style-src` CSP silently drops inline-styled positioned elements on this site; all positioned context menus are canvas-drawn instead (Section 10.4) |

---

## 11. Non-Functional Requirements

| Requirement | Specification |
|---|---|
| **Platform** | Atlassian Forge Custom UI app (`jira:backlogAction` module), runs inside Jira Cloud |
| **Backend** | Forge resolver functions (Node.js) — no self-hosted server or infrastructure to maintain |
| **Persistence** | Forge app storage, scoped per Jira project; no localStorage |
| **Permissions** | Least-privilege Forge scopes: read access to Jira issues/boards/sprints/projects/accounts, plus app-scoped storage. The only write access to Jira is `write:issue-link:jira`, used exclusively to create/delete "Blocks" and "Relates" issue links for Story, Epic, and Backlog Assistant dependencies (Sections 6.4, 9.4, 10.5) — no other Jira issue data is modified |
| **Data residency** | All Jira data access happens via Forge's managed runtime on Atlassian's infrastructure; no data is sent to any third-party service |
| **Performance** | Forecast computation is synchronous and in-memory once data is fetched; must be imperceptible for teams of ≤ 20 members and ≤ 100 backlog issues |
| **State management** | Zustand (frontend), Forge storage (backend persistence) |
| **Styling** | Tailwind CSS |
| **Tech stack** | React 18, TypeScript, Vite, Tailwind CSS, Zustand, `@forge/api`, `@forge/resolver`, `@forge/bridge` |
| **Testing** | Vitest + React Testing Library; flow/metrics engine logic is unit-tested independently of UI |
| **Security** | Executes under Atlassian's Forge sandbox; `asUser()` calls enforce the logged-in user's own Jira permissions when querying issue data |

---

## 12. Out of Scope

| Feature | Rationale for Exclusion |
|---|---|
| CSV backlog upload | Superseded by live Jira sprint/issue data; no manual export/import step needed |
| localStorage persistence | Superseded by Forge app storage, which works across devices/sessions for the same Jira account |
| Multi-team creation / team switcher | Each Jira board/project context implicitly maps to one team; a manager with multiple teams opens SprintFlow from each team's own board |
| Writing back to Jira issues | SprintFlow is read-only against Jira issue data for planning adjustments — start day and overrides live in SprintFlow's own config, not on the Jira issue. The one exception is story dependencies, which write to Jira as real "Blocks" issue links (Section 6.4) |
| Individual story or task assignments | Violates the non-prescriptive model; would make the tool feel like a project management system |
| Gantt chart or timeline export | Out of scope for current planning workflow |
| Mobile / responsive layout | Primary use is on a laptop during a planning session, inside the Jira web app |

See Section 9.7 for Epic Planning–specific out-of-scope items, and Section 10.7 for Backlog Assistant–specific out-of-scope items.

---

## 13. Open Questions / Future Considerations

- **Epic Planning ↔ Jira write-back:** Epic Planning writes back only dependency links (Section 9.4); sizing, dev allocation, risk, notes, and computed schedule dates remain local-only. A future version could optionally sync computed schedule dates back to Jira Epic fields for visibility outside the app.
- **Epic Planning capacity data entry:** Member absences are entered manually per sprint per quarter. A future version could source planned time off from an existing Jira/HR data source where available, reducing manual upkeep.
- **Multi-board team detection:** The current Team field-based detection assumes issues in a project consistently carry the same Team value. Projects that intentionally span multiple teams within one board are not explicitly modeled beyond the existing team-scoped fallback logic.
- **Cross-sprint rollover tracking:** Rollover is currently a per-issue, per-load flag (detected from the Sprint field) rather than a tracked history; a future version could show how many times a story has rolled over.
- **Backlog Assistant CSP inconsistency:** Other still-inline-styled spots in Backlog Assistant (e.g., the Priority Queue panel's resizable width, type/status color swatches) have not been reported broken despite the same CSP restriction that forced canvas-drawn context menus (Section 10.4) — the inconsistency is unexplained and left as-is until/unless it surfaces as a real defect.
- **Backlog Assistant Objective write-back:** Only dependency links ("Blocks", "Relates") are written back to Jira (Section 10.5); rank-override reasons and node layout remain local to Forge storage. A future version could consider surfacing rank overrides in Jira (e.g., as a comment or label) for visibility outside the app.
- **Confidence interval display:** The cycle time model currently reports a single average per status/point value. A future version could show variance (e.g., min/median/max) to better convey estimate uncertainty.
- **Write-back to Jira:** Beyond dependency links (Section 6.4), no other SprintFlow-derived data (adjusted start days, phase assignments) is written back to Jira. A future version could optionally sync select fields for visibility outside the app.
