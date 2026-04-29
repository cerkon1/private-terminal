# PROGRESS Archive

Pruned session entries from the live progress log live here. The live log is `../PROGRESS.md`.

## Why archive

PROGRESS.md is a session-by-session timeline. It grows linearly; without pruning, the live log eventually drowns the active context. The archive preserves history without bloating what session-start has to read.

## Convention

- **Filename:** `YYYY-MM-DD_<descriptive_slug>.md` — date is when the archive file was created (not when the underlying sessions occurred). Date prefix means archives sort chronologically in directory listings.
- **Header schema** (every archive starts with this block):
  - `**Archived on:**` — date this file was created
  - `**Source commit:**` — git hash of the live PROGRESS.md state at the time of pruning, so the original full file can always be retrieved with `git show <hash>:.projects/00_tracking/PROGRESS.md`
  - `**Sessions covered:**` — explicit range (e.g. `S1 (2026-04-23) through S13 (2026-04-26)`)
  - `**Time span:**` — what was happening during these sessions in one phrase
  - `**Reason for archive:**` — what triggered the prune (release, log length, milestone closure)
  - `**Where the live log resumes:**` — pointer back to PROGRESS.md from the next un-archived session
- **Body** is the verbatim pruned content with section headers preserved. Don't re-paragraph or summarize — readers come here for the original record.
- **Archives are immutable.** Once written, don't edit. If a fact in an archive turns out wrong, fix it in MEMORY.md or LESSONS.md (which are living docs); leave the archive as the historical record of what was believed at the time. New archives appended as PROGRESS.md grows.

## When to prune

Triggered by either:
- A major release ships (natural cut point — everything before the release becomes "shipped history").
- Live log exceeds ~30 sessions OR ~1000 lines (whichever comes first).

Aim to keep the live log focused on current and recent (last 2–3 sessions of) context. Older history → archive.

## What stays in the live log after a prune

- `## Current Focus` — always live.
- The most recent ~2–3 session entries (so a new session has continuity context without lookup).
- `## Discovered (future tasks)` — always live; this is forward-looking, not a session record.
- Pointer block to the new archive file.

## How to prune (recipe)

Pruning is a **single Python pass** — never re-read PROGRESS.md in chunks to hand-assemble Write payloads. The cost driver of prune-by-Read-and-Write is shipping ~25K tokens through the LLM; shell does line-range slicing in <1s without that cost.

The pattern:
1. **Decide the cut session.** Which `### S{N}` is the *first one to archive*? (Everything from there back to S1 goes to the archive; everything after stays live.)
2. **Pick a slug + reason.** Filename will be `YYYY-MM-DD_<slug>.md`; reason is one phrase ("post-RC1 ship", "v1.0 final shipped", "log exceeded 1000 lines").
3. **Write the archive file by hand first** with the credible header (Archived on / Source commit / Sessions covered / Time span / Reason / Where live log resumes). Body is filled by the script in step 5.
4. **Sanity-anchor the cut points** by line number AND by content. If asserts pass, you have the right line numbers; if they fail, the file shifted since you last read it — investigate before mutating.
5. **Run a single Python pass** that:
   - Asserts the anchors.
   - Slices `lines[archive_start:archive_end]` into the archive file (after the header you wrote in step 3).
   - Replaces the same slice in PROGRESS.md with a pointer block.
   - Writes both files atomically (Python's open-write is atomic enough for local-file ops; no partial-state risk if interrupted between writes because each write is one syscall).
6. **Verify** the seam in PROGRESS.md (read 10 lines around the cut), grep for surviving session headers, and confirm line count dropped as expected.
7. **Update this README's Files table** with the new archive entry.
8. **Commit** — `docs: prune PROGRESS.md (S{X}–S{Y} archived)`.

### Python template

Replace every `# REPLACE` line per prune. Don't carry over irrelevant cleanup (title rewrites, etc.) — those belong in their own commit.

```python
import io
PROGRESS = '.projects/00_tracking/PROGRESS.md'
ARCHIVE = '.projects/00_tracking/archive/YYYY-MM-DD_slug.md'  # REPLACE filename

with io.open(PROGRESS, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Anchor asserts — REPLACE both the line indices and the expected prefixes
# These guard against silent off-by-N if PROGRESS.md was edited since you last read it.
assert lines[0].startswith('# Progress Log'), 'header line shifted'
assert lines[KEEP_END_IDX - 1].strip() == '---',           f'expected --- at last-kept line'   # REPLACE
assert lines[ARCHIVE_START_IDX].startswith('### S{X}'),     f'cut session shifted'              # REPLACE
assert lines[ARCHIVE_END_IDX - 1].strip() == '---',         f'expected --- at last-archived'    # REPLACE
assert lines[ARCHIVE_END_IDX + 1].startswith('## Discovered'), 'Discovered shifted'             # may need adjusting

POINTER = (
    '\n'
    '## Archived\n'
    '\n'
    'Sessions S{X}–S{Y} archived at [`archive/YYYY-MM-DD_slug.md`](archive/YYYY-MM-DD_slug.md). '   # REPLACE
    'See [`archive/README.md`](archive/README.md) for the archive convention.\n'
    '\n'
    '---\n'
)

# Append archived slice to the pre-written header
with io.open(ARCHIVE, 'a', encoding='utf-8', newline='\n') as f:
    f.writelines(lines[ARCHIVE_START_IDX:ARCHIVE_END_IDX])  # REPLACE indices

# Rewrite live PROGRESS.md
new_lines = lines[:KEEP_END_IDX] + [POINTER] + lines[ARCHIVE_END_IDX:]    # REPLACE
with io.open(PROGRESS, 'w', encoding='utf-8', newline='\n') as f:
    f.writelines(new_lines)

print(f'Old: {len(lines)} lines. New: {len(new_lines) + POINTER.count(chr(10)) - 1} lines.')
```

### Index-numbering trap

Python `readlines()` is 0-indexed; file viewers (Read tool, editors) are 1-indexed. Convention for the variables above: `KEEP_END_IDX` is the *Python slice end* (exclusive) of the kept-prefix. So if the last kept file-line is line 115, `KEEP_END_IDX = 115` (slice `lines[:115]` includes lines[0]..lines[114] = file lines 1–115). Same for `ARCHIVE_START_IDX` / `ARCHIVE_END_IDX`. Don't mix the two number bases — pick one, stick with it.

### What this recipe deliberately does NOT do

- **Does not auto-detect cut points.** Cut decisions are judgment calls (which session boundary, what to archive). Hand-pick them; the asserts catch typos.
- **Does not bundle unrelated cleanup.** If PROGRESS.md needs a title fix or stale-path rewrite, that's a separate commit. Prune commits should be mechanical and reviewable as "did the right slice land in the right places."
- **Does not exist as a script file.** A reusable script for an action that runs ~2–3×/year is more maintenance than the 30 lines above. Adapt the template at use time.

## Files

| File | Sessions | Time span | Headline |
|---|---|---|---|
| [2026-04-29_v1_0_build_arc.md](2026-04-29_v1_0_build_arc.md) | S1–S13 | 2026-04-24 → 2026-04-26 | Inception → v1.0.0-rc.1 ship. Full v1.0 build (M1–M8), M8.5 Maintenance, M8.6 Polish, S12 release-blocker pass, S13 manage-watchlist refactor + RC.1 packaging. |
