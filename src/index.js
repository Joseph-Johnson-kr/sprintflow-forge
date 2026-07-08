import Resolver from '@forge/resolver';
import api, { route, storage } from '@forge/api';

const resolver = new Resolver();

// ─── Forge Storage ────────────────────────────────────────────────────────────

resolver.define('loadConfig', async (req) => {
  const { projectKey } = req.payload;
  try {
    return await storage.get(`sprintflow-config:${projectKey}`) ?? null;
  } catch (err) {
    console.error('[SprintFlow] loadConfig failed:', err);
    return null;
  }
});

resolver.define('saveConfig', async (req) => {
  const { projectKey, config } = req.payload;
  try {
    await storage.set(`sprintflow-config:${projectKey}`, config);
    return { ok: true };
  } catch (err) {
    console.error('[SprintFlow] saveConfig failed:', err);
    return { ok: false };
  }
});

resolver.define('loadQuarters', async (req) => {
  const { projectKey } = req.payload;
  try {
    return await storage.get(`sprintflow-quarters:${projectKey}`) ?? null;
  } catch (err) {
    console.error('[SprintFlow] loadQuarters failed:', err);
    return null;
  }
});

resolver.define('saveQuarters', async (req) => {
  const { projectKey, quarters } = req.payload;
  try {
    await storage.set(`sprintflow-quarters:${projectKey}`, quarters);
    return { ok: true };
  } catch (err) {
    console.error('[SprintFlow] saveQuarters failed:', err);
    return { ok: false };
  }
});

// ─── Jira Data (v2) ───────────────────────────────────────────────────────────

const STORY_ISSUE_TYPES = new Set(['Story', 'Bug', 'Spike']);

function mapIssue(issue) {
  // customfield_10020 is the Sprint field — an array of sprint objects.
  // More than one sprint means the issue rolled over from a prior sprint.
  const sprintField = issue.fields?.customfield_10020;
  const isRollover = Array.isArray(sprintField) && sprintField.length > 1;
  return {
    issueKey: issue.key,
    summary: issue.fields.summary ?? '',
    storyPoints: issue.fields.customfield_10032 ?? 0,
    startDay: 1,
    rollover: isRollover,
    override: false,
    overrideCells: [],
    dependencies: [],
  };
}

function computeSprintMeta(sprint) {
  const start = sprint.startDate ? new Date(sprint.startDate) : null;
  const end = sprint.endDate ? new Date(sprint.endDate) : null;
  let sprintLength = 10;
  let sprintStartDay = 1;
  if (start && end) {
    let count = 0;
    const cur = new Date(start);
    while (cur < end) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    sprintLength = Math.max(1, count);
    sprintStartDay = start.getDay() === 0 ? 1 : start.getDay();
  }
  return { sprintLength, sprintStartDay };
}

resolver.define('getSprintList', async (req) => {
  const { boardId, projectKey } = req.payload;

  // Fetch all active/future sprints for the board
  const boardRes = await api.asApp().requestJira(
    route`/rest/agile/1.0/board/${boardId}/sprint?state=active,future&maxResults=50`,
  );
  const boardData = await boardRes.json();
  const boardSprints = boardData.values ?? [];

  if (boardSprints.length === 0) return [];

  // Filter in parallel: only keep sprints that have at least one plannable issue on THIS board+project.
  // Using the board endpoint ensures we only see issues the board's filter exposes (team-scoped).
  const checks = await Promise.all(
    boardSprints.map(async (sprint) => {
      try {
        const checkRes = await api.asApp().requestJira(
          route`/rest/agile/1.0/board/${boardId}/issue?jql=sprint=${sprint.id} AND project=${projectKey}&maxResults=10&fields=issuetype`,
        );
        const checkData = await checkRes.json();
        const hasPlannableIssue = (checkData.issues ?? []).some((i) =>
          STORY_ISSUE_TYPES.has(i.fields?.issuetype?.name),
        );
        return hasPlannableIssue ? sprint : null;
      } catch {
        return null;
      }
    }),
  );

  const sprints = checks
    .filter(Boolean)
    .map((sprint) => ({
      id: sprint.id,
      name: sprint.name,
      state: sprint.state,
      ...computeSprintMeta(sprint),
    }));

  console.log(
    `[SprintFlow] getSprintList v2: ${sprints.length}/${boardSprints.length} sprints contain ${projectKey} issues`,
  );
  return sprints;
});

resolver.define('getSprintIssues', async (req) => {
  const { sprintId, boardId, projectKey } = req.payload;
  // Use the board endpoint — its filter configuration is already scoped to this team.
  // The program sprint contains issues from many SATH sub-teams; the board isolates ours.
  // customfield_10020 (Sprint field) is fetched to auto-detect rollover (multi-sprint) issues.
  const res = await api.asApp().requestJira(
    route`/rest/agile/1.0/board/${boardId}/issue?jql=sprint=${sprintId} AND project=${projectKey}&fields=summary,customfield_10032,customfield_10020,issuetype&maxResults=100`,
  );
  const data = await res.json();
  const allIssues = data.issues ?? [];

  // Only plan Stories, Bugs, and Spikes — sub-tasks and epics are not sprint planning units.
  const issues = allIssues.filter((i) => STORY_ISSUE_TYPES.has(i.fields?.issuetype?.name));

  console.log(
    `[SprintFlow] getSprintIssues: ${issues.length}/${allIssues.length} board issues for sprint ${sprintId} in project ${projectKey}`,
  );
  return issues.map(mapIssue);
});

resolver.define('getTeamMembers', async (req) => {
  const { boardId, projectKey } = req.payload;

  // Step 1: Read team name + ID from customfield_10001 on a project-scoped issue.
  // Scoping to the project ensures we read the right team even on multi-project boards.
  let teamName = projectKey;
  let teamId = null;
  try {
    const issueRes = await api.asApp().requestJira(
      route`/rest/agile/1.0/board/${boardId}/issue?jql=project=${projectKey}&fields=customfield_10001&maxResults=1`,
    );
    const issueData = await issueRes.json();
    const teamField = issueData.issues?.[0]?.fields?.customfield_10001;
    if (teamField?.name) teamName = teamField.name;
    if (teamField?.id) teamId = teamField.id;
  } catch (err) {
    console.warn('[SprintFlow] failed to read customfield_10001:', err);
  }

  // Step 2: Fetch all project-assignable users (gives us display names).
  const usersRes = await api.asApp().requestJira(
    route`/rest/api/3/user/assignable/search?project=${projectKey}&maxResults=200`,
  );
  const allUsers = await usersRes.json();
  const assignableMap = new Map(
    Array.isArray(allUsers)
      ? allUsers.filter((u) => u.active !== false).map((u) => [u.accountId, u.displayName])
      : [],
  );

  // Step 3: If we have a teamId, call the Atlassian Teams API to get the exact member list
  // and filter assignable users to only those on the team.
  if (teamId) {
    try {
      const membersRes = await api.asApp().requestJira(
        route`/gateway/api/public/teams/v1/teams/${teamId}/members`,
      );
      const membersData = await membersRes.json();
      console.log('[SprintFlow] Teams API status:', membersRes.status);
      console.log('[SprintFlow] Teams API sample:', JSON.stringify(membersData).slice(0, 400));

      const entities = membersData.entities ?? membersData.members ?? membersData.results ?? [];
      if (entities.length > 0) {
        const members = entities
          .map((e) => {
            const accountId = e.accountId ?? e.memberId ?? e.id;
            const name = assignableMap.get(accountId) ?? e.displayName ?? accountId;
            return accountId ? { id: accountId, name, role: 'dev' } : null;
          })
          .filter(Boolean);
        if (members.length > 0) {
          console.log(`[SprintFlow] returning ${members.length} team members from Teams API`);
          return { teamName, teamId, members };
        }
      }
    } catch (err) {
      console.warn('[SprintFlow] Teams API failed, falling back to project assignees:', err);
    }
  }

  // Fallback: fetch board issues for this project, filter client-side by team field, collect unique assignees.
  // The Atlassian Teams field type does not support JQL filtering, so we match on customfield_10001.name directly.
  if (teamName !== projectKey) {
    try {
      const boardIssuesRes = await api.asApp().requestJira(
        route`/rest/agile/1.0/board/${boardId}/issue?jql=project=${projectKey}&fields=customfield_10001,assignee,issuetype&maxResults=200`,
      );
      const boardIssuesData = await boardIssuesRes.json();
      const seen = new Set();
      const members = [];
      for (const issue of boardIssuesData.issues ?? []) {
        if (!STORY_ISSUE_TYPES.has(issue.fields?.issuetype?.name)) continue;
        const tf = issue.fields?.customfield_10001;
        const teams = Array.isArray(tf) ? tf : tf ? [tf] : [];
        if (!teams.some((t) => t?.name === teamName || t?.title === teamName)) continue;
        const assignee = issue.fields?.assignee;
        if (assignee && !seen.has(assignee.accountId)) {
          seen.add(assignee.accountId);
          const name = assignableMap.get(assignee.accountId) ?? assignee.displayName ?? assignee.accountId;
          members.push({ id: assignee.accountId, name, role: 'dev' });
        }
      }
      if (members.length > 0) {
        console.log(`[SprintFlow] returning ${members.length} members from team-scoped board issues`);
        return { teamName, teamId, members };
      }
    } catch (err) {
      console.warn('[SprintFlow] team-scoped board issue search failed:', err);
    }
  }

  // Final fallback: all project assignees.
  const members = [...assignableMap.entries()].map(([id, name]) => ({ id, name, role: 'dev' }));
  console.log(`[SprintFlow] returning ${members.length} members from project assignees (final fallback)`);
  return { teamName, teamId, members };
});

resolver.define('ping', async () => ({ ok: true, build: 'v2' }));

resolver.define('getBoardStatuses', async (req) => {
  const { boardId, projectKey } = req.payload;

  // Fetch board column config (gives status IDs in board column order) + project statuses (gives names)
  const [configRes, statusRes] = await Promise.all([
    api.asApp().requestJira(route`/rest/agile/1.0/board/${boardId}/configuration`),
    api.asApp().requestJira(route`/rest/api/3/project/${projectKey}/statuses`),
  ]);
  const configData = await configRes.json();
  const statusData = await statusRes.json();

  // Build id -> { id, name, category } from project statuses
  const statusById = new Map();
  for (const issueType of Array.isArray(statusData) ? statusData : []) {
    for (const s of issueType.statuses ?? []) {
      if (!statusById.has(s.id)) {
        statusById.set(s.id, { id: s.id, name: s.name, category: s.statusCategory?.key });
      }
    }
  }

  // Walk board columns in order; keep only in-progress category (excludes To Do + Done)
  const result = [];
  const seen = new Set();
  for (const col of configData.columnConfig?.columns ?? []) {
    for (const s of col.statuses ?? []) {
      const status = statusById.get(s.id);
      if (status && !seen.has(s.id) && status.category === 'indeterminate') {
        result.push({ id: status.id, name: status.name });
        seen.add(s.id);
      }
    }
  }

  // Fallback: all in-progress statuses from project if board config yielded nothing
  if (result.length === 0) {
    for (const [, s] of statusById) {
      if (s.category === 'indeterminate') result.push({ id: s.id, name: s.name });
    }
  }

  console.log(`[SprintFlow] getBoardStatuses v2: ${result.length} in-progress statuses`);
  return result;
});

resolver.define('getCycleTimes', async (req) => {
  const { projectKey, teamId, daysBack } = req.payload;
  if (!projectKey || !teamId) return null;

  const days = daysBack ?? 60;

  // Team-scoped, complete resolutions only, story-pointed issues only.
  // "Team[Team]" must be compared against the team's ID, unquoted — comparing
  // against the display name as a quoted string literal matches 0 issues.
  const jql = `project = ${projectKey} AND "Team[Team]" = ${teamId} AND status = Closed AND resolution = Complete AND "Story Points" is not EMPTY AND updated >= "-${days}d" ORDER BY updated DESC`;

  // asUser() so the logged-in user's project permissions apply.
  // /rest/api/3/search was removed by Atlassian; the replacement is POST-based.
  const searchRes = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jql,
      fields: ['customfield_10032'],
      expand: 'changelog',
      maxResults: 200,
    }),
  });
  const searchData = await searchRes.json();

  if (!searchData.issues?.length) {
    console.log(`[SprintFlow] getCycleTimes: no issues found (HTTP ${searchRes.status}) JQL: ${jql}`);
    if (searchData.errorMessages?.length || Object.keys(searchData.errors ?? {}).length) {
      console.error('[SprintFlow] getCycleTimes error body:', JSON.stringify(searchData).slice(0, 500));
    }
    return null;
  }

  console.log(`[SprintFlow] getCycleTimes: ${searchData.issues.length} issues for team ID "${teamId}"`);

  // SP -> statusName -> [days] accumulated across all issues
  const buckets = {};

  for (const issue of searchData.issues) {
    const sp = issue.fields?.customfield_10032;
    if (!sp) continue;

    // Sort changelog chronologically; compute cumulative time in each status
    const histories = [...(issue.changelog?.histories ?? [])].sort(
      (a, b) => new Date(a.created) - new Date(b.created),
    );

    const statusTimings = {};
    let currentStatus = null;
    let lastTime = null;

    for (const history of histories) {
      for (const item of history.items ?? []) {
        if (item.field !== 'status') continue;
        const ts = new Date(history.created);
        if (currentStatus && lastTime) {
          const elapsed = (ts - lastTime) / 86400000;
          statusTimings[currentStatus] = (statusTimings[currentStatus] ?? 0) + elapsed;
        }
        currentStatus = item.toString;
        lastTime = ts;
      }
    }
    // Time after the last transition (issue is Closed) is intentionally not counted

    if (!buckets[sp]) buckets[sp] = {};
    for (const [statusName, elapsedDays] of Object.entries(statusTimings)) {
      if (!buckets[sp][statusName]) buckets[sp][statusName] = [];
      buckets[sp][statusName].push(elapsedDays);
    }
  }

  if (Object.keys(buckets).length === 0) {
    console.log('[SprintFlow] getCycleTimes: no status transition data found');
    return null;
  }

  // Average and round to nearest whole day
  const result = {};
  for (const [sp, statusArrays] of Object.entries(buckets)) {
    result[sp] = {};
    for (const [statusName, daysList] of Object.entries(statusArrays)) {
      const avg = Math.round(daysList.reduce((a, b) => a + b, 0) / daysList.length);
      if (avg > 0) result[sp][statusName] = avg;
    }
    console.log(`[SprintFlow] getCycleTimes: SP=${sp}`, JSON.stringify(result[sp]));
  }
  return result;
});

resolver.define('getBacklogEpics', async (req) => {
  const { projectKey, teamId } = req.payload;
  if (!projectKey) return [];

  // teamId falls back to projectKey when no real Team field is resolved (see getTeamMembers) —
  // only add the team filter when we have a real team ID, not that fallback placeholder.
  const jql = teamId && teamId !== projectKey
    ? `project = ${projectKey} AND issuetype = Epic AND "Team[Team]" = ${teamId} AND status NOT IN (Closed, Cancelled) ORDER BY summary ASC`
    : `project = ${projectKey} AND issuetype = Epic AND status NOT IN (Closed, Cancelled) ORDER BY summary ASC`;

  const res = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jql, fields: ['summary', 'customfield_10269'], maxResults: 100 }),
  });
  const data = await res.json();
  const issues = data.issues ?? [];

  console.log(`[SprintFlow] getBacklogEpics: ${issues.length} epics for project ${projectKey}`);
  return issues.map((i) => ({
    issueKey: i.key,
    summary: i.fields?.summary ?? i.key,
    suggestedSize: mapTshirtSize(i.fields?.customfield_10269),
  }));
});

// Matches the Epic's "T-Shirt Size" Jira field (customfield_10269, a select list) against
// SprintFlow's own T-shirt size scale. Returns undefined if the field is empty or holds a
// value SprintFlow doesn't recognize, so the frontend leaves the size selection untouched.
const TSHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'Jumbo'];
function mapTshirtSize(rawField) {
  const value = rawField?.value ?? rawField;
  if (typeof value !== 'string') return undefined;
  return TSHIRT_SIZES.find((s) => s.toLowerCase() === value.trim().toLowerCase());
}

export const handler = resolver.getDefinitions();
