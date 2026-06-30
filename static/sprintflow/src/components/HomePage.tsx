import { useState } from 'react';

type Tab = 'start' | 'quarter' | 'sprint';

function GettingStartedContent() {
  return (
    <div className="p-10 max-w-3xl">
      <section className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">Getting Started</h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          SprintFlow is a browser-only tool — all data lives in your browser's local storage.
          Nothing is sent to a server. Use the export/import steps below to back up your work
          and move it between machines.
        </p>
      </section>

      <hr className="border-slate-200 mb-8" />

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-6">How To</h2>
        <ol className="space-y-8 text-sm text-slate-700 leading-relaxed">

          <li className="flex gap-4">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 text-white text-xs flex items-center justify-center font-semibold mt-0.5">1</span>
            <div className="space-y-2">
              <p className="font-semibold text-slate-900">Add a New Team</p>
              <p>
                In the left sidebar, click <strong>+ Add</strong> next to the Teams heading. A new
                team named "New Team" will appear. Double-click the name in the sidebar to rename
                it, or hover over it and click the pencil icon.
              </p>
              <p>
                Each team maintains its own independent configuration, backlog, and forecast —
                switch between teams at any time using the sidebar.
              </p>
              <p>
                Alternatively, if you have a previously saved backup, click{' '}
                <strong>↑ Import</strong> in the sidebar to restore a team from a{' '}
                <code className="text-xs bg-slate-100 px-1 rounded">sprintflow-*.json</code> file
                instead of starting from scratch (see step 4).
              </p>
            </div>
          </li>

          <li className="flex gap-4">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 text-white text-xs flex items-center justify-center font-semibold mt-0.5">2</span>
            <div className="space-y-3">
              <p className="font-semibold text-slate-900">Configure the Team — Config Tab</p>
              <p>
                Select the team and click <strong>Config</strong> in the sidebar view switcher.
                Set the following:
              </p>
              <ul className="space-y-3 pl-1">
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong>Sprint Start Day</strong> — choose the weekday your sprint begins
                    (Monday through Friday). This drives the day-of-week column labels in the
                    Flow Grid.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong>Sprint Length</strong> — number of working days in the sprint
                    (e.g., 10 for a two-week sprint).
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <div className="space-y-1">
                    <span>
                      <strong>Team Members</strong> — add each person on your team with a role:
                    </span>
                    <ul className="mt-1 space-y-1 pl-4 text-slate-600">
                      <li><strong>Dev</strong> — contributes to developer headcount</li>
                      <li><strong>QA</strong> — contributes to QA headcount</li>
                      <li><strong>Both</strong> — counts toward both</li>
                    </ul>
                    <p className="mt-1">
                      This list is the single source of truth for the team.
                      Dev and QA capacity on the Sprint tab are derived automatically from
                      member roles — no separate headcount entry is needed. Member names also
                      carry through to Quarter Forecast for absence planning.
                      Double-click a name in the table to rename it.
                    </p>
                  </div>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong>Cycle Times</strong> — for each story-point bucket your team uses
                    (e.g., 1, 2, 3, 5, 8, 13), enter the average number of{' '}
                    <strong>Dev days</strong> and <strong>QA days</strong> a story at that size
                    takes to complete. These are historical averages — the more accurate they
                    are, the more reliable the Sprint Forecast.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong>Default Capacity</strong> — shown as read-only counts derived from
                    your team members' roles above. If your developers also perform testing,
                    check <strong>"Developers are also QAs"</strong>; the Sprint Forecast will
                    then calculate QA load against developer capacity rather than a separate
                    QA headcount.
                  </span>
                </li>
              </ul>
            </div>
          </li>

          <li className="flex gap-4">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 text-white text-xs flex items-center justify-center font-semibold mt-0.5">3</span>
            <div className="space-y-3">
              <p className="font-semibold text-slate-900">Export Your Team Configuration</p>
              <p>
                Once your team is configured, click <strong>↓ Export Team</strong> in the
                Config tab header. The export includes everything:{' '}
                Config settings, Team Members, Sprint Backlog, and all Quarter Forecast data
                for that team.
              </p>
              <ul className="space-y-2 pl-1">
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong>Chrome / Edge</strong> — on the first export you'll be asked to
                    pick a folder. SprintFlow remembers this folder and writes subsequent exports
                    there automatically — no navigation required. The browser may ask you to
                    re-confirm folder access after closing and reopening.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong>Firefox / Safari</strong> — the file downloads to your browser's
                    default download location.
                  </span>
                </li>
              </ul>
              <p>
                The backup file is named{' '}
                <code className="text-xs bg-slate-100 px-1 rounded">sprintflow-TeamName.json</code>.
                Re-export at any time to overwrite the previous backup with the latest state.
              </p>
            </div>
          </li>

          <li className="flex gap-4">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 text-white text-xs flex items-center justify-center font-semibold mt-0.5">4</span>
            <div className="space-y-3">
              <p className="font-semibold text-slate-900">Import a Team Configuration</p>
              <p>
                In the sidebar, click <strong>↑ Import</strong> next to the Teams heading, then
                pick your{' '}
                <code className="text-xs bg-slate-100 px-1 rounded">sprintflow-*.json</code> file.
                The team — including all Config, Members, Backlog, and Quarter Forecast data —
                will be restored and selected automatically.
              </p>
              <ul className="space-y-2 pl-1">
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <div>
                    <strong>Duplicate team names</strong> — importing always creates a new team
                    entry, even if a team with the same name already exists. You will end up with
                    two teams of the same name. Delete the old one from the sidebar once you've
                    confirmed the import is correct.
                  </div>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <div>
                    <strong>Finding your backup file (Chrome / Edge)</strong> — after your first
                    export, the file picker opens in the same folder you picked for export,
                    so you won't need to navigate to find the file.
                  </div>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <div>
                    <strong>Finding your backup file (Firefox / Safari)</strong> — check your
                    browser's downloads folder or wherever your browser saves files by default.
                  </div>
                </li>
              </ul>
            </div>
          </li>

        </ol>
      </section>
    </div>
  );
}

function QuarterContent() {
  return (
    <div className="p-10 max-w-3xl">
      <section className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 mb-4">Overview</h1>
        <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
          <p>
            The <strong>Quarter Forecast</strong> extends SprintFlow to the quarterly level,
            helping Agile teams answer the question:{' '}
            <em>how many Epics can we realistically commit to this quarter?</em>
          </p>
          <p>
            Where sprint forecasting uses cycle time to model daily flow, quarter forecasting uses{' '}
            <strong>T-shirt sizing</strong> — a relative estimation approach applied at the Epic
            level — to model how work will consume team capacity across an entire quarter.
            The unit of capacity is <strong>developer-days per sprint</strong>, adjusted for
            individual team member absences.
          </p>
          <p>By combining:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>T-shirt sized Epics with historical sprint durations (XS through XL)</li>
            <li>Per-member capacity with sprint-level absence planning</li>
            <li>Developer allocation per Epic and dependency ordering</li>
          </ul>
          <p>
            …the system generates a{' '}
            <strong>sprint-by-sprint schedule of Epic delivery</strong>, surfacing capacity
            overruns and scheduling conflicts <em>before the quarter begins</em>.
          </p>
        </div>
      </section>

      <hr className="border-slate-200 mb-8" />

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Goals</h2>
        <ul className="space-y-2 text-sm text-slate-700 leading-relaxed">
          <li className="flex gap-2">
            <span className="text-slate-400 shrink-0">•</span>
            <span>
              Apply <strong>relative estimation</strong> (T-shirt sizing) at the quarterly level,
              the same way story points apply it at the sprint level
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-slate-400 shrink-0">•</span>
            <span>
              Visualize <strong>which Epics fit within quarterly capacity</strong> and which
              overflow — before commitments are made
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-slate-400 shrink-0">•</span>
            <span>
              Surface the <strong>impact of individual absences</strong> on delivery — a
              two-week vacation is significant at the quarterly level and should be visible
              during planning
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-slate-400 shrink-0">•</span>
            <span>
              Respect <strong>Epic dependencies</strong> — automatically schedule dependent
              Epics after the Epics they rely on complete
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-slate-400 shrink-0">•</span>
            <span>
              Enable teams to make <strong>confident, data-backed quarterly commitments</strong>{' '}
              rather than relying on intuition during planning sessions
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-slate-400 shrink-0">•</span>
            <span>
              Track <strong>risks per Epic</strong> so they remain visible alongside the
              planning forecast, not buried in a separate document
            </span>
          </li>
        </ul>
      </section>

      <hr className="border-slate-200 mb-8" />

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Success looks like:</h2>
        <ul className="space-y-2 text-sm text-slate-700 leading-relaxed">
          <li className="flex gap-2">
            <span className="text-slate-400 shrink-0">•</span>
            <span>
              Teams enter each quarter with a <strong>capacity-grounded Epic commitment</strong>,
              not a wish list shaped by what feels ambitious in the room
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-slate-400 shrink-0">•</span>
            <span>
              Planned absences are visible and <strong>already factored in</strong> before
              the planning conversation — not discovered mid-quarter
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-slate-400 shrink-0">•</span>
            <span>
              Overflow Epics are <strong>deferred proactively</strong> during planning rather
              than dropped reactively when the quarter runs out of capacity
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-slate-400 shrink-0">•</span>
            <span>
              Epic ordering reflects <strong>dependency constraints</strong>, eliminating
              bottlenecks caused by starting dependent work before prerequisites are done
            </span>
          </li>
        </ul>
      </section>

      <hr className="border-slate-200 mb-8" />

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-6">How To</h2>
        <ol className="space-y-8 text-sm text-slate-700 leading-relaxed">

          <li className="flex gap-4">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-700 text-white text-xs flex items-center justify-center font-semibold mt-0.5">1</span>
            <div className="space-y-2">
              <p className="font-semibold text-slate-900">Open Quarter Forecast</p>
              <p>
                Select a team in the sidebar, then click <strong>Quarter Forecast</strong> in
                the view switcher. Each team maintains its own set of quarters independently
                from its sprint configuration.
              </p>
            </div>
          </li>

          <li className="flex gap-4">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-700 text-white text-xs flex items-center justify-center font-semibold mt-0.5">2</span>
            <div className="space-y-3">
              <p className="font-semibold text-slate-900">Add a Quarter</p>
              <p>
                Click <strong>+ Add Quarter</strong>, select the quarter name (Q1–Q4) and year,
                then click Add. The sprint count defaults automatically:
              </p>
              <ul className="space-y-1 pl-1">
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span><strong>Q1 → 8 sprints</strong> (longer quarter at this company)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span><strong>Q2, Q3, Q4 → 6 sprints</strong></span>
                </li>
              </ul>
              <p>
                The sprint count field is editable — adjust it for holidays, company shutdowns,
                or any other quarter-specific variation.
              </p>
            </div>
          </li>

          <li className="flex gap-4">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-700 text-white text-xs flex items-center justify-center font-semibold mt-0.5">3</span>
            <div className="space-y-3">
              <p className="font-semibold text-slate-900">Enter Team Capacity</p>
              <p>
                In the <strong>Team Capacity</strong> section, team members are automatically
                pulled from your Config → Team Members list — no need to add them again here.
                For each member, enter the number of <strong>days absent</strong> in each
                sprint (0 = fully available, 10 = fully absent for a standard 2-week sprint).
                Absences are highlighted in amber.
              </p>
              <p>
                To add, rename, or remove team members, go to the{' '}
                <strong>Config → Team Members</strong> section — changes will sync to all
                quarters for this team automatically.
              </p>
              <p>
                The <strong>Available Devs / Sprint</strong> row at the bottom of the table
                summarizes headcount per sprint — this is what the forecast engine uses to
                determine how many developer-days are available in each sprint after accounting
                for absences.
              </p>
            </div>
          </li>

          <li className="flex gap-4">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-700 text-white text-xs flex items-center justify-center font-semibold mt-0.5">4</span>
            <div className="space-y-3">
              <p className="font-semibold text-slate-900">Define Epics</p>
              <p>
                In the <strong>Epics</strong> section, add each Epic for the quarter. For each
                Epic, set:
              </p>
              <ul className="space-y-3 pl-1">
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong>Title</strong> — a short description of the Epic or Key Result
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong>T-shirt size</strong> — the relative estimate of duration, based
                    on your team's historical data:
                    <ul className="mt-1 space-y-0.5 pl-4">
                      <li>XS = 5 days &nbsp;·&nbsp; S = 1 sprint &nbsp;·&nbsp; M = 2 sprints</li>
                      <li>L = 3 sprints &nbsp;·&nbsp; XL = 6 sprints</li>
                    </ul>
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong>Devs</strong> — how many developers are allocated to this Epic
                    while it is active. If 5 devs are on the team and 3 are assigned here,
                    the remaining 2 are available for parallel Epics during those sprints.
                  </span>
                </li>
              </ul>
              <p>
                Use the <strong>▲ / ▼</strong> buttons to reorder Epics — the forecast
                schedules them in this order (respecting dependencies), so higher-priority
                Epics should appear first.
              </p>
            </div>
          </li>

          <li className="flex gap-4">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-700 text-white text-xs flex items-center justify-center font-semibold mt-0.5">5</span>
            <div className="space-y-3">
              <p className="font-semibold text-slate-900">Add Risks and Dependencies</p>
              <p>
                Each Epic row has two optional panels:
              </p>
              <ul className="space-y-2 pl-1">
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong>Risks</strong> — click <strong>+ Risk</strong> on any Epic to add
                    a risk with a description and severity level (Low / Medium / High). The
                    badge on the Epic row shows the count and highest severity at a glance.
                    High-risk Epics are also flagged with a <strong className="text-red-600">!</strong>{' '}
                    indicator in the Forecast Grid.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong>Dependencies</strong> — click <strong>+ Dep</strong> to mark which
                    other Epics must complete before this one can start. The forecast engine
                    automatically schedules dependent Epics after their prerequisites finish.
                  </span>
                </li>
              </ul>
            </div>
          </li>

          <li className="flex gap-4">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-700 text-white text-xs flex items-center justify-center font-semibold mt-0.5">6</span>
            <div className="space-y-3">
              <p className="font-semibold text-slate-900">Read the Forecast Grid</p>
              <p>
                The <strong>Forecast</strong> section is the core output. Each row is an Epic;
                each column is a sprint in the quarter. Color-coded cells show when each Epic
                is active:
              </p>
              <ul className="space-y-2 pl-1">
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong>Colored block</strong> — the Epic is active in that sprint. The
                    color and label reflect its T-shirt size (XS through XL).
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong className="text-red-700">OVERFLOW</strong> — the Epic could not be
                    scheduled within the quarter's capacity. A summary at the bottom lists all
                    overflow Epics. Consider deferring them, reducing their size, or reducing
                    another Epic's dev allocation to free capacity.
                  </span>
                </li>
              </ul>
              <p className="font-medium text-slate-800 mt-2">Capacity rows — what to look for:</p>
              <ul className="space-y-2 pl-1">
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong>Avail Dev-Days</strong> — total developer-days available in each
                    sprint after subtracting absences. A sprint where a key member is out will
                    show a lower number here.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong>Used Dev-Days</strong> — developer-days consumed by scheduled Epics
                    in that sprint.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong>Utilization</strong> — used divided by available, color-coded:{' '}
                    <strong className="text-emerald-700">green (≤ 80%)</strong> is healthy,{' '}
                    <strong className="text-amber-700">amber (≤ 100%)</strong> is tight but
                    feasible, and{' '}
                    <strong className="text-red-700">red (&gt; 100%)</strong> means the Epic
                    engine could not schedule work into that sprint. Sprints showing{' '}
                    <strong>—</strong> have no team members entered yet.
                  </span>
                </li>
              </ul>
            </div>
          </li>

        </ol>
      </section>
    </div>
  );
}

function SprintContent() {
  return (
    <div className="p-10 max-w-3xl">
      <section className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 mb-4">Overview</h1>
        <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
          <p>
            This product is a <strong>Sprint Flow Forecasting Tool</strong> designed to enhance
            Agile Sprint Planning by visualizing how work is expected to flow through a sprint
            based on historical cycle time data and team capacity.
          </p>
          <p>
            The tool addresses a key gap in Scrum practices: while teams use velocity to estimate{' '}
            <em>how much</em> work they can complete, they lack visibility into{' '}
            <strong>how that work will flow over time</strong> and whether it aligns with{' '}
            <strong>daily team capacity constraints</strong>.
          </p>
          <p>By combining:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Story point-based cycle time averages</li>
            <li>Story-level start offsets</li>
            <li>Daily team capacity (developers and testers)</li>
          </ul>
          <p>
            …the system generates a{' '}
            <strong>day-by-day forecast of workflow states and capacity load</strong>, enabling
            teams to identify bottlenecks and unrealistic commitments{' '}
            <em>before the sprint begins</em>.
          </p>
        </div>
      </section>

      <hr className="border-slate-200 mb-8" />

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Goals</h2>
        <ul className="space-y-2 text-sm text-slate-700 leading-relaxed">
          <li className="flex gap-2">
            <span className="text-slate-400 shrink-0">•</span>
            <span>
              Provide a <strong>visual forecast of story progression</strong> across sprint days
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-slate-400 shrink-0">•</span>
            <span>
              Enable teams to <strong>validate sprint commitments against real capacity</strong>
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-slate-400 shrink-0">•</span>
            <span>
              Surface <strong>workflow bottlenecks early</strong> (e.g., Review/Test overload)
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-slate-400 shrink-0">•</span>
            <span>
              Maintain a{' '}
              <strong>Scrum-safe, non-prescriptive model</strong> (no assignments, no deadlines)
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-slate-400 shrink-0">•</span>
            <span>
              Allow <strong>rapid reuse each sprint</strong> via a template-driven workflow
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-slate-400 shrink-0">•</span>
            <span>
              Require <strong>minimal manual input</strong> (Jira export + capacity + optional
              start day)
            </span>
          </li>
        </ul>
      </section>

      <hr className="border-slate-200 mb-8" />

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Success looks like:</h2>
        <ul className="space-y-2 text-sm text-slate-700 leading-relaxed">
          <li className="flex gap-2">
            <span className="text-slate-400 shrink-0">•</span>
            <span>Teams adjust sprint scope based on forecast insights</span>
          </li>
          <li className="flex gap-2">
            <span className="text-slate-400 shrink-0">•</span>
            <span>Reduced mid-sprint bottlenecks</span>
          </li>
          <li className="flex gap-2">
            <span className="text-slate-400 shrink-0">•</span>
            <span>Increased predictability of flow (not just velocity)</span>
          </li>
        </ul>
      </section>

      <hr className="border-slate-200 mb-8" />

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">How To</h2>
        <p className="text-sm text-slate-500 mb-6">
          New here? See the <strong>Getting Started</strong> tab to add a team and configure it
          before working through these steps.
        </p>
        <ol className="space-y-8 text-sm text-slate-700 leading-relaxed">

          <li className="flex gap-4">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-semibold mt-0.5">1</span>
            <div className="space-y-3">
              <p className="font-semibold text-slate-900">Upload the Sprint Backlog — Sprint Tab</p>
              <p>
                Click <strong>Sprint</strong> in the sidebar view switcher, then use the file
                picker to upload a CSV exported from Jira (or any compatible tool). The CSV must
                include:
              </p>
              <ul className="space-y-2 pl-1">
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong>Issue Key</strong> (required) — unique story identifier
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong>Story Points</strong> (required) — must match a bucket in your
                    cycle time table; stories with unrecognized point values will be flagged
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong>Summary</strong> (optional) — story title displayed in the grid
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong>Rollover</strong> (optional) — set to <strong>Y</strong> for
                    stories carried over from a previous sprint; these are highlighted in red
                    in the Flow Grid for immediate visibility
                  </span>
                </li>
              </ul>
              <p>
                After upload, the <strong>Backlog table</strong> lists every story. You can
                toggle <strong>Rollover</strong> and adjust the <strong>Start Day</strong>{' '}
                for each story directly in the table — no re-upload required. Per-day capacity
                overrides (highlighted in amber) can also be entered directly in the Flow Grid
                to account for holidays, part-time availability, or planned leave.
              </p>
            </div>
          </li>

          <li className="flex gap-4">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-semibold mt-0.5">2</span>
            <div className="space-y-3">
              <p className="font-semibold text-slate-900">Read the Flow Grid</p>
              <p>
                The Flow Grid is the core output of the tool. Each row is a story; each column
                is a sprint day (labeled by day of week). Cells show the story's state for
                that day:
              </p>
              <ul className="space-y-2 pl-1">
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong className="text-blue-700">D</strong> (blue) — story is in active
                    development on that day
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong className="text-purple-700">Q</strong> (purple) — story is in QA /
                    testing on that day
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong className="text-emerald-700">✓</strong> (light green) — story is
                    complete for the remainder of the sprint
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong className="text-red-700">?</strong> (red) — story points have no
                    matching cycle time; add the bucket in Config to resolve
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong>Red story name cell</strong> — the story is flagged as a rollover
                    from the previous sprint
                  </span>
                </li>
              </ul>
              <p className="font-medium text-slate-800 mt-2">Summary rows — what to look for:</p>
              <ul className="space-y-2 pl-1">
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong>Dev / QA demand</strong> — how many stories are in that phase on
                    each day. Peaks reveal when the team will be most stretched.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong>Dev / QA capacity</strong> — editable per-day inputs. Defaults come
                    from the Config tab; override individual days (shown in amber) to reflect
                    actual availability such as holidays or planned leave.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>
                    <strong>Dev / QA load</strong> — demand divided by capacity for that day,
                    color-coded:{' '}
                    <strong className="text-emerald-700">green (≤ 1.0)</strong> is at or under
                    capacity,{' '}
                    <strong className="text-amber-700">amber (≤ 1.25)</strong> is a mild overload
                    worth monitoring, and{' '}
                    <strong className="text-red-700">red (&gt; 1.25)</strong> signals a
                    bottleneck that the team should address before the sprint starts.
                  </span>
                </li>
              </ul>
              <p className="font-medium text-slate-800 mt-2">Using Start Day to balance the forecast:</p>
              <p>
                Stories default to starting on Day 1. Use the <strong>Start Day</strong> field in
                the Backlog table to stagger when work begins — this spreads Dev and QA demand
                more evenly across the sprint. The goal is to keep load rows as green as possible
                throughout, with no single day showing a red spike in either Dev or QA load.
                When a red day appears, try incrementing the Start Day of one or more stories
                that land on that day until the load falls back into the green or amber range.
              </p>
            </div>
          </li>

        </ol>
      </section>
    </div>
  );
}

export default function HomePage() {
  const [tab, setTab] = useState<Tab>('start');

  return (
    <div className="flex flex-col h-full">
      {/* Tab header */}
      <div className="flex shrink-0 border-b border-slate-200">
        <button
          onClick={() => setTab('start')}
          className={`flex-1 px-6 py-4 text-left border-r border-slate-200 transition-colors ${
            tab === 'start' ? 'bg-slate-50' : 'hover:bg-slate-50'
          }`}
        >
          <h2 className={`text-lg font-semibold ${tab === 'start' ? 'text-slate-900' : 'text-slate-700'}`}>
            Getting Started
          </h2>
          <p className={`text-xs mt-0.5 ${tab === 'start' ? 'text-slate-500' : 'text-slate-400'}`}>
            Setup, export &amp; import
          </p>
        </button>
        <button
          onClick={() => setTab('quarter')}
          className={`flex-1 px-6 py-4 text-left border-r border-slate-200 transition-colors ${
            tab === 'quarter' ? 'bg-indigo-50' : 'hover:bg-slate-50'
          }`}
        >
          <h2 className={`text-lg font-semibold ${tab === 'quarter' ? 'text-indigo-900' : 'text-slate-900'}`}>
            Quarter Forecast
          </h2>
          <p className={`text-xs mt-0.5 ${tab === 'quarter' ? 'text-indigo-500' : 'text-slate-500'}`}>
            Epic capacity planning by sprint
          </p>
        </button>
        <button
          onClick={() => setTab('sprint')}
          className={`flex-1 px-6 py-4 text-left transition-colors ${
            tab === 'sprint' ? 'bg-slate-50' : 'hover:bg-slate-50'
          }`}
        >
          <h2 className={`text-lg font-semibold ${tab === 'sprint' ? 'text-slate-900' : 'text-slate-700'}`}>
            Sprint Forecast
          </h2>
          <p className={`text-xs mt-0.5 ${tab === 'sprint' ? 'text-slate-500' : 'text-slate-400'}`}>
            Day-by-day flow forecasting
          </p>
        </button>
      </div>

      {/* Tab content — key forces remount on tab change, resetting scroll to top */}
      <div key={tab} className="flex-1 overflow-auto">
        {tab === 'start' && <GettingStartedContent />}
        {tab === 'quarter' && <QuarterContent />}
        {tab === 'sprint' && <SprintContent />}
      </div>
    </div>
  );
}
