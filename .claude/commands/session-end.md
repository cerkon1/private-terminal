---
description: End-of-session updates — clean up, update PROGRESS.md, DESIGN.md, MEMORY.md (under .projects/) with session work
allowed-tools: Read, Edit, Write, Bash, Glob, Grep
---

# Session End

Perform end-of-session bookkeeping. Read current state, then update tracking files so the next session starts from a clean, honest snapshot.

## Step 1: Determine session number

Read `.projects/00_tracking/PROGRESS.md`. Find the most recent `### S{N}` session header. This session is `S{N+1}` (unless this session was a continuation of the prior one — in which case append to it, don't create a new heading).

## Step 2: Clean-up pass (before documenting)

Run these checks. Report findings in the summary.

1. **Stray files** — Glob for `*.bak`, `*.tmp`, `*.orig`, `*-debug.*`, `scratch.*`. If found, ask the user whether to delete.
2. **Debug artifacts** — Grep for `console.log`, `dbg!`, `eprintln!("DEBUG`, `TODO: remove`, `FIXME: delete`. If found, flag for user review.
3. **Uncommitted changes** — If git is initialized: `git status`. Report modified/untracked files. Do NOT auto-commit; report and let user decide.
4. **Schema-migration consistency** — If `src-tauri/src/db/schema.rs` was modified, confirm a matching migration or init-path handles upgrade from prior version.
5. **Seed-data drift** — If `sector_groups`, `watchlist_tickers`, `fred_series`, `news_feeds`, or `indicators` seed content changed, flag for `MEMORY.md` mention under "Ticker decisions" or similar.

## Step 3: Update `.projects/00_tracking/PROGRESS.md`

1. **Current Focus** — rewrite to reflect state at end of session. Point to the next milestone or blocker.
2. **New session entry** under `## Sessions`:
   - Header: `### S{N} — {concise-topic} ({YYYY-MM-DD})`
   - Subsections as needed: "What changed", "Decisions", "Artifacts produced", "Next session". Match the style of existing S1 entry.
   - Be dense and code-anchored. Reference specific files/symbols/kwargs. No narrative prose.
3. **Discovered (future tasks)** — append any out-of-scope items surfaced during the session.

## Step 4: Update `.projects/01_initial_design/DESIGN.md` (if architecture changed)

Only touch DESIGN.md if a durable architectural decision was made or reversed this session:
- New indicator added to the registry → update First-four-indicators list or M6 scope.
- Schema table added/modified → update SQLite Schema section.
- Chart library, data source, or navigation-model changed → update relevant section + bump sketch version (`v0.N`).
- Open question resolved → move from "Open Questions" to "Resolved".
- Milestone reshaped → update Milestones table + summary.

Do NOT touch DESIGN.md for routine implementation work that matches the existing spec.

## Step 5: Update `.projects/00_tracking/memory/MEMORY.md`

1. **Project Status** line — reflect the end-of-session state (milestone complete, in progress, blocked).
2. **Project-Specific Decisions** — add any new durable decisions made this session. Never duplicate an existing one; update in place if a prior decision was refined.
3. **Reconcile Open Questions** — for every item still listed as open, check whether this session answered it. Move resolved items to the "Resolved" list.
4. **Reference Repos** — if a new external repo or resource became load-bearing, add it with a clear path and purpose.
5. **Stale to-do removal** — if any memory item is now outdated or wrong, correct it or delete it. Do not leave stale content.

## Step 6: LESSONS.md (create first time if needed)

If a durable technical gotcha was discovered — something future-me would want to know before touching a subsystem — either create `.projects/00_tracking/LESSONS.md` (if it doesn't exist) or append to it. Format: `| ID | Gotcha | Session | Detail |` rows grouped by subsystem (DB, IPC, Indicators, ECharts, etc.).

If no gotchas, skip this step entirely.

## Step 7: Summary output

Report concisely:
- **PROGRESS.md:** S{N} entry added, current focus updated to [state]
- **DESIGN.md:** [version bumped to v0.N with changes] OR "no changes"
- **MEMORY.md:** [decisions added / questions resolved / stale items removed]
- **LESSONS.md:** [entries added] OR "no new gotchas"
- **Clean-up findings:** [stray files / debug artifacts / uncommitted changes — or "clean"]
- **Next session entry point:** [milestone + what to do first]

## Rules

- **Don't auto-commit.** Report git status; user decides.
- **Don't delete files without asking.** Flag stray files and wait.
- **Match existing doc style.** Dense, code-anchored bullets. No narrative or marketing prose.
- **Be honest about what wasn't done.** If a milestone was scoped to five tasks and three landed, say so — don't soften. Leave the other two as "remaining" in PROGRESS.md under the milestone.
