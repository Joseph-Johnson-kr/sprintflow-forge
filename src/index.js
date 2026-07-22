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
    type: issue.fields?.issuetype?.name,
    storyPoints: issue.fields.customfield_10032 ?? 0,
    startDay: 1,
    rollover: isRollover,
    override: false,
    overrideCells: [],
    dependencies: [],
    blockedByIssueKeys: mapBlockedByKeys(issue.fields?.issuelinks),
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
    route`/rest/agile/1.0/board/${boardId}/issue?jql=sprint=${sprintId} AND project=${projectKey}&fields=summary,customfield_10032,customfield_10020,issuetype,issuelinks&maxResults=100`,
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
    body: JSON.stringify({
      jql,
      fields: ['summary', 'customfield_10269', 'customfield_10212', 'issuelinks'],
      maxResults: 100,
    }),
  });
  const data = await res.json();
  const issues = data.issues ?? [];

  console.log(`[SprintFlow] getBacklogEpics: ${issues.length} epics for project ${projectKey}`);
  return issues.map((i) => ({
    issueKey: i.key,
    summary: i.fields?.summary ?? i.key,
    suggestedSize: mapTshirtSize(i.fields?.customfield_10269),
    planningVersions: mapPlanningVersions(i.fields?.customfield_10212),
    blockedByIssueKeys: mapBlockedByKeys(i.fields?.issuelinks),
  }));
});

// A "Blocks"-type link entry with an `inwardIssue` (not `outwardIssue`) means the queried
// issue is the outward/blocked side, and inwardIssue is a blocker of it.
function mapBlockedByKeys(issuelinks) {
  return (Array.isArray(issuelinks) ? issuelinks : [])
    .filter((l) => l.type?.name === 'Blocks' && l.inwardIssue)
    .map((l) => l.inwardIssue.key)
    .filter((k) => typeof k === 'string');
}

// Matches the Epic's "T-Shirt Size" Jira field (customfield_10269, a select list) against
// SprintFlow's own T-shirt size scale. Returns undefined if the field is empty or holds a
// value SprintFlow doesn't recognize, so the frontend leaves the size selection untouched.
const TSHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'Jumbo'];
function mapTshirtSize(rawField) {
  const value = rawField?.value ?? rawField;
  if (typeof value !== 'string') return undefined;
  return TSHIRT_SIZES.find((s) => s.toLowerCase() === value.trim().toLowerCase());
}

// customfield_10212 ("Planning Version") is multi-valued — normalize to an array
// regardless of whether Jira returns a single object, an array, or null/undefined.
function mapPlanningVersions(raw) {
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return arr.map((v) => v?.value ?? v?.name ?? v).filter((v) => typeof v === 'string');
}

resolver.define('getQuarterOptions', async (req) => {
  const { projectKey } = req.payload;
  if (!projectKey) return [];

  const statusRes = await api.asApp().requestJira(route`/rest/api/3/project/${projectKey}/statuses`);
  const statusData = await statusRes.json();
  const epicType = (Array.isArray(statusData) ? statusData : []).find((t) => t.name === 'Epic');
  if (!epicType) return [];

  // asUser() so the logged-in user's project permissions apply — issue/createmeta
  // is scoped to what fields the acting user can set on create, and returns an
  // empty field list under app auth.
  const metaRes = await api.asUser().requestJira(
    route`/rest/api/3/issue/createmeta/${projectKey}/issuetypes/${epicType.id}?maxResults=200`,
  );
  const metaData = await metaRes.json();
  // This endpoint's actual response nests fields under "fields", not "values" as the
  // Jira REST API docs describe for this route.
  const field = (metaData.fields ?? []).find((f) => f.fieldId === 'customfield_10212');

  const options = [];
  for (const v of field?.allowedValues ?? []) {
    const label = v.name ?? v.value;
    if (typeof label !== 'string') continue;
    const match = label.trim().match(/^(\d{4})(Q[1-4])$/);
    if (!match) continue;
    options.push({ id: v.id, value: match[0], year: Number(match[1]), quarter: match[2] });
  }
  options.sort((a, b) => a.year - b.year || a.quarter.localeCompare(b.quarter));
  console.log(`[SprintFlow] getQuarterOptions: ${options.length} Planning Version options`);
  return options;
});

resolver.define('updateEpicPlanningVersion', async (req) => {
  const { issueKey, optionId, mode } = req.payload;
  if (!issueKey || !optionId) return { ok: false };
  const op = mode === 'remove' ? { remove: { id: optionId } } : { add: { id: optionId } };
  const res = await api.asUser().requestJira(route`/rest/api/3/issue/${issueKey}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ update: { customfield_10212: [op] } }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[SprintFlow] updateEpicPlanningVersion failed (${res.status}):`, body.slice(0, 500));
  }
  return { ok: res.ok };
});

// Sprint field is an array of sprint objects (multiple entries mean rollover); only the
// last entry reflects what the issue is currently planned for.
function mapSprintNames(sprintField) {
  return (Array.isArray(sprintField) ? sprintField : [])
    .map((s) => s?.name)
    .filter((n) => typeof n === 'string');
}

function mapDependencyCandidate(i) {
  return {
    issueKey: i.key,
    summary: i.fields?.summary ?? i.key,
    projectKey: i.fields?.project?.key,
    teamName: i.fields?.customfield_10001?.name ?? i.fields?.customfield_10001?.value ?? null,
    suggestedSize: mapTshirtSize(i.fields?.customfield_10269),
    planningVersions: mapPlanningVersions(i.fields?.customfield_10212),
    storyPoints: typeof i.fields?.customfield_10032 === 'number' ? i.fields.customfield_10032 : undefined,
    sprintNames: mapSprintNames(i.fields?.customfield_10020),
  };
}

const DEPENDENCY_CANDIDATE_FIELDS = [
  'summary',
  'project',
  'customfield_10001',
  'customfield_10269',
  'customfield_10212',
  'customfield_10032',
  'customfield_10020',
];

resolver.define('searchDependencyCandidates', async (req) => {
  const { query, excludeIssueKey, issueTypes } = req.payload;
  if (!query || query.trim().length < 2) return [];
  const escaped = query.trim().replace(/"/g, '\\"');
  const types = Array.isArray(issueTypes) && issueTypes.length > 0 ? issueTypes : ['Epic'];
  const typeClause = `issuetype in (${types.map((t) => `"${t}"`).join(',')})`;
  const jql = `${typeClause} AND (summary ~ "${escaped}*" OR key = "${escaped}") ORDER BY updated DESC`;

  const res = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jql, fields: DEPENDENCY_CANDIDATE_FIELDS, maxResults: 20 }),
  });
  const data = await res.json();
  return (data.issues ?? [])
    .filter((i) => i.key !== excludeIssueKey)
    .map(mapDependencyCandidate);
});

async function fetchDependencyCandidatesByKeys(issueKeys) {
  const keys = [...new Set(issueKeys ?? [])].filter(Boolean);
  if (!keys.length) return [];
  const jql = `key in (${keys.map((k) => `"${k}"`).join(',')})`;

  const res = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jql, fields: DEPENDENCY_CANDIDATE_FIELDS, maxResults: keys.length }),
  });
  const data = await res.json();
  return (data.issues ?? []).map(mapDependencyCandidate);
}

resolver.define('getIssuesByKeys', async (req) => {
  return fetchDependencyCandidatesByKeys(req.payload?.issueKeys);
});

resolver.define('updateDependencyLink', async (req) => {
  const { blockedIssueKey, blockerIssueKey, mode } = req.payload;
  if (!blockedIssueKey || !blockerIssueKey) return { ok: false };

  if (mode === 'remove') {
    const res = await api.asUser().requestJira(
      route`/rest/api/3/issue/${blockedIssueKey}?fields=issuelinks`,
    );
    const data = await res.json();
    const link = (data.fields?.issuelinks ?? []).find(
      (l) => l.type?.name === 'Blocks' && l.inwardIssue?.key === blockerIssueKey,
    );
    if (!link) return { ok: true }; // already gone
    const delRes = await api.asUser().requestJira(route`/rest/api/3/issueLink/${link.id}`, {
      method: 'DELETE',
    });
    if (!delRes.ok) {
      console.error(`[SprintFlow] updateDependencyLink remove failed (${delRes.status})`);
    }
    return { ok: delRes.ok };
  }

  const res = await api.asUser().requestJira(route`/rest/api/3/issueLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: { name: 'Blocks' },
      inwardIssue: { key: blockerIssueKey },
      outwardIssue: { key: blockedIssueKey },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[SprintFlow] updateDependencyLink add failed (${res.status}):`, body.slice(0, 500));
  }
  return { ok: res.ok };
});

resolver.define('updateRelatesLink', async (req) => {
  const { issueKeyA, issueKeyB, mode } = req.payload;
  if (!issueKeyA || !issueKeyB) return { ok: false };

  if (mode === 'remove') {
    const res = await api.asUser().requestJira(
      route`/rest/api/3/issue/${issueKeyA}?fields=issuelinks`,
    );
    const data = await res.json();
    const link = (data.fields?.issuelinks ?? []).find(
      (l) =>
        l.type?.name === 'Relates' &&
        (l.inwardIssue?.key === issueKeyB || l.outwardIssue?.key === issueKeyB),
    );
    if (!link) return { ok: true }; // already gone
    const delRes = await api.asUser().requestJira(route`/rest/api/3/issueLink/${link.id}`, {
      method: 'DELETE',
    });
    if (!delRes.ok) {
      console.error(`[SprintFlow] updateRelatesLink remove failed (${delRes.status})`);
    }
    return { ok: delRes.ok };
  }

  const res = await api.asUser().requestJira(route`/rest/api/3/issueLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: { name: 'Relates' },
      inwardIssue: { key: issueKeyA },
      outwardIssue: { key: issueKeyB },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[SprintFlow] updateRelatesLink add failed (${res.status}):`, body.slice(0, 500));
  }
  return { ok: res.ok };
});

resolver.define('getBacklogAssistantData', async (req) => {
  const { projectKey, teamId } = req.payload;
  if (!projectKey) return { issues: [], edges: [], truncated: false };

  // teamId falls back to projectKey when no real Team field is resolved (see getTeamMembers) —
  // only add the team filter when we have a real team ID, not that fallback placeholder.
  const jql = teamId && teamId !== projectKey
    ? `project = ${projectKey} AND issuetype != Sub-task AND "Team[Team]" = ${teamId} ORDER BY key ASC`
    : `project = ${projectKey} AND issuetype != Sub-task ORDER BY key ASC`;
  const res = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jql,
      fields: [
        'summary',
        'issuetype',
        'status',
        'priority',
        'assignee',
        'customfield_10032',
        'customfield_10020',
        'parent',
        'issuelinks',
      ],
      maxResults: 200,
    }),
  });
  const data = await res.json();
  const rawIssues = data.issues ?? [];

  const issues = rawIssues.map((i) => {
    const parent = i.fields?.parent;
    // Approximates the CSV's literal "Epic Name" field: the parent's own summary, only when the parent is an Epic.
    const parentIsEpic = parent?.fields?.issuetype?.name === 'Epic';
    const sprintNames = mapSprintNames(i.fields?.customfield_10020);
    return {
      key: i.key,
      summary: i.fields?.summary ?? '',
      type: i.fields?.issuetype?.name ?? '',
      status: i.fields?.status?.name ?? '',
      priority: i.fields?.priority?.name ?? '',
      assignee: i.fields?.assignee?.displayName ?? '',
      storyPoints: i.fields?.customfield_10032 != null ? String(i.fields.customfield_10032) : '',
      sprint: sprintNames.length ? sprintNames[sprintNames.length - 1] : '',
      parentKey: parent?.key ?? '',
      parentSummary: parent?.fields?.summary ?? '',
      epicName: parentIsEpic ? parent?.fields?.summary ?? '' : '',
    };
  });

  const localKeys = new Set(rawIssues.map((i) => i.key));
  const edgeSet = new Set();
  const edges = [];
  const externalKeys = new Set();

  for (const i of rawIssues) {
    for (const link of i.fields?.issuelinks ?? []) {
      if (link.type?.name === 'Blocks') {
        // inwardIssue on i means i is the blocked side (the inward issue is the blocker);
        // outwardIssue on i means i is the blocker (the outward issue is blocked). Both must
        // be checked — an external blocked issue never gets fetched to supply its own inward entry.
        let from;
        let to;
        if (link.inwardIssue) {
          from = link.inwardIssue.key;
          to = i.key;
        } else if (link.outwardIssue) {
          from = i.key;
          to = link.outwardIssue.key;
        } else {
          continue;
        }
        if (from === to) continue;
        const id = `blocks:${from}->${to}`;
        if (edgeSet.has(id)) continue;
        edgeSet.add(id);
        edges.push({ id, from, to, type: 'blocks' });
        if (!localKeys.has(from)) externalKeys.add(from);
        if (!localKeys.has(to)) externalKeys.add(to);
      } else if (link.type?.name === 'Relates' && (link.inwardIssue || link.outwardIssue)) {
        const other = (link.inwardIssue ?? link.outwardIssue).key;
        if (other === i.key) continue;
        const [a, b] = [i.key, other].sort();
        const id = `relates:${a}->${b}`;
        if (edgeSet.has(id)) continue;
        edgeSet.add(id);
        edges.push({ id, from: a, to: b, type: 'relates' });
        if (!localKeys.has(other)) externalKeys.add(other);
      }
    }
  }

  const externalIssues = externalKeys.size ? await fetchDependencyCandidatesByKeys([...externalKeys]) : [];

  const truncated = typeof data.total === 'number' ? rawIssues.length < data.total : false;

  console.log(
    `[SprintFlow] getBacklogAssistantData: ${issues.length} issues, ${edges.length} edges, ` +
      `${externalIssues.length} external issues for project ${projectKey}`,
  );
  return { issues, edges, externalIssues, truncated };
});

resolver.define('loadBacklogAssistantSession', async (req) => {
  const { projectKey } = req.payload;
  if (!projectKey) return null;
  try {
    const session = await storage.get(`backlog-assistant-session:${projectKey}`);
    return session ?? null;
  } catch (err) {
    console.error('[SprintFlow] loadBacklogAssistantSession failed:', err);
    return null;
  }
});

resolver.define('saveBacklogAssistantSession', async (req) => {
  const { projectKey, session } = req.payload;
  if (!projectKey) return { ok: false };
  try {
    await storage.set(`backlog-assistant-session:${projectKey}`, session);
    return { ok: true };
  } catch (err) {
    console.error('[SprintFlow] saveBacklogAssistantSession failed:', err);
    return { ok: false };
  }
});

resolver.define('getEpicStatuses', async (req) => {
  const { projectKey } = req.payload;

  const statusRes = await api.asApp().requestJira(route`/rest/api/3/project/${projectKey}/statuses`);
  const statusData = await statusRes.json();

  const epicStatuses = (Array.isArray(statusData) ? statusData : []).find(
    (issueType) => issueType.name === 'Epic',
  );

  const all = epicStatuses?.statuses ?? [];
  let result = all
    .filter((s) => s.statusCategory?.key === 'indeterminate')
    .map((s) => ({ id: s.id, name: s.name }));

  // Fallback: no in-progress-category statuses found — return everything so the UI isn't empty
  if (result.length === 0) {
    result = all.map((s) => ({ id: s.id, name: s.name }));
  }

  console.log(`[SprintFlow] getEpicStatuses: ${result.length} Epic workflow statuses`);
  return result;
});

// Fixed calendar-quarter boundaries — Epic quarters (`Quarter` in quarter.ts) carry no stored
// calendar dates today, so the Epic cycle-time lookback uses this convention instead.
function calendarQuarterRange(year, quarter) {
  const ranges = {
    Q1: ['01-01', '03-31'],
    Q2: ['04-01', '06-30'],
    Q3: ['07-01', '09-30'],
    Q4: ['10-01', '12-31'],
  };
  const [startMD, endMD] = ranges[quarter] ?? ranges.Q1;
  return { start: `${year}-${startMD}`, end: `${year}-${endMD}` };
}

resolver.define('getEpicCycleTimes', async (req) => {
  const { projectKey, teamId, year, quarter } = req.payload;
  if (!projectKey) return null;

  const { start, end } = calendarQuarterRange(year, quarter);

  const jql =
    teamId && teamId !== projectKey
      ? `project = ${projectKey} AND issuetype = Epic AND "Team[Team]" = ${teamId} AND statusCategory = Done AND updated >= "${start}" AND updated <= "${end}" ORDER BY updated DESC`
      : `project = ${projectKey} AND issuetype = Epic AND statusCategory = Done AND updated >= "${start}" AND updated <= "${end}" ORDER BY updated DESC`;

  const searchRes = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jql,
      fields: ['customfield_10269'],
      expand: 'changelog',
      maxResults: 200,
    }),
  });
  const searchData = await searchRes.json();

  if (!searchData.issues?.length) {
    console.log(`[SprintFlow] getEpicCycleTimes: no epics found (HTTP ${searchRes.status}) JQL: ${jql}`);
    if (searchData.errorMessages?.length || Object.keys(searchData.errors ?? {}).length) {
      console.error('[SprintFlow] getEpicCycleTimes error body:', JSON.stringify(searchData).slice(0, 500));
    }
    return null;
  }

  console.log(`[SprintFlow] getEpicCycleTimes: ${searchData.issues.length} epics for ${quarter} ${year}`);

  // T-shirt size -> statusName -> [days] accumulated across all epics
  const buckets = {};

  for (const issue of searchData.issues) {
    const size = mapTshirtSize(issue.fields?.customfield_10269);
    if (!size) continue;

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
    // Time after the last transition (epic is Done) is intentionally not counted

    if (!buckets[size]) buckets[size] = {};
    for (const [statusName, elapsedDays] of Object.entries(statusTimings)) {
      if (!buckets[size][statusName]) buckets[size][statusName] = [];
      buckets[size][statusName].push(elapsedDays);
    }
  }

  if (Object.keys(buckets).length === 0) {
    console.log('[SprintFlow] getEpicCycleTimes: no status transition data found');
    return null;
  }

  const result = {};
  for (const [size, statusArrays] of Object.entries(buckets)) {
    result[size] = {};
    for (const [statusName, daysList] of Object.entries(statusArrays)) {
      const avg = Math.round(daysList.reduce((a, b) => a + b, 0) / daysList.length);
      if (avg > 0) result[size][statusName] = avg;
    }
    console.log(`[SprintFlow] getEpicCycleTimes: size=${size}`, JSON.stringify(result[size]));
  }
  return result;
});

export const handler = resolver.getDefinitions();
