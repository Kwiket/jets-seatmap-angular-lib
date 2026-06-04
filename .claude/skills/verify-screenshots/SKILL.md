---
name: verify-screenshots
description: Verify that Playwright screenshot suites visually reflect their intended config override via LLM image analysis. Use when the user says "verify screenshots", "проверь скриншоты", "check screenshot suite", "did the <X> tests actually work", "did the override take effect", "validate visual changes", or after a Playwright run that green-passed but might have silently dropped a binding. Returns a per-test verdict report.
allowed-tools: Read, Glob, Bash(ls:*), Bash(find:*), Bash(stat:*), Bash(date:*), Write, Agent
---

# verify-screenshots

Playwright reports a green check the moment a screenshot was **produced**. It says nothing about whether the config override the test passed actually **reached the DOM**. This skill plugs that gap: it reads the spec source and each PNG, judges whether the visible content matches the spec's intent, and emits a structured report.

It exists because of a real bug class — example: `<sm-jets-tooltip>` shipped for months without `[colorTheme]` wiring, and every tooltip-color test stayed green while the override silently dropped.

## When to use

- After a Playwright run, before merging a PR that changes any `colorTheme` / visual-config field.
- When debugging a test that "passes" but the user suspects the feature is broken.
- When triaging which of dozens of screenshot tests actually exercises its target.
- When the user uses any of the trigger phrases listed in the frontmatter.

## Inputs the skill accepts

The skill is invoked with up to two positional args plus optional flags:

```
verify-screenshots [<specPath>] [<screenshotsDir>] [--batch N] [--report <path>]
```

- `<specPath>` — path to a `.spec.ts` file. If given, `screenshotsDir` defaults to `<dirname(spec)>/screenshots`.
- `<screenshotsDir>` — path to a directory of PNGs. If given alone, walk up one level and `Glob *.spec.ts` to find the spec.
- `--batch N` (optional) — override the default batch size of 6.
- `--report <path>` (optional) — override the default report location.
- Zero args — auto-discover, see workflow step 1.

## Workflow the coordinator follows

The coordinator is the main Claude agent reading this file. Each step below is mandatory.

### 1. Resolve inputs

If both args missing:

1. Run `find projects -type d -name screenshots` to enumerate candidate dirs.
2. Stat each (`stat -f %m -- <dir>` on macOS, `stat -c %Y` on Linux) and pick the most recently modified.
3. From that dir, walk up one level and `Glob *.spec.ts`. Pick the single match. If multiple, list them and ask the user.
4. Echo a one-line preview to the user: *"About to verify N screenshots in `<relative-dir>` against `<relative-spec>` in K batches of 6 — proceed?"* Wait for confirmation.

If only the spec path is given: derive the dir as `<dirname(spec)>/screenshots`.

If only the dir is given: walk up and find the sibling `.spec.ts`.

After resolution, assert both paths exist. If either is missing, stop and report the missing path.

### 2. Read the spec

Use the `Read` tool on the spec file. Keep its full text in your context — every analyzer prompt will need it.

### 3. Enumerate PNGs

Use `Glob` with pattern `<screenshotsDir>/*.png`. Exclude any prior `_verification-report.md` artefacts (they will not appear in the glob, but check anyway).

If the PNG list is empty, stop and tell the user the dir has no PNGs — they probably need to run Playwright first.

### 4. Batch

Chunk the PNG list into groups of 6 (or the `--batch` override). Justification for the default: a single subagent comfortably handles ~6 images plus the spec text plus its instructions without truncation; >8 raises mis-attribution risk between adjacent screenshots; <4 wastes parallel slots and inflates aggregation cost.

### 5. Fan out

In **one assistant message**, emit one `Agent` tool call per batch. Use `subagent_type: general-purpose`. The prompt for each call is the contents of `prompts/analyzer.md` (read it via `Read`) with the four placeholders replaced:

- `<<SPEC_PATH>>` — absolute path of the spec.
- `<<SPEC_TEXT>>` — the full text you read in step 2.
- `<<REPO_ROOT>>` — output of `git rev-parse --show-toplevel`.
- `<<PNG_PATHS>>` — newline-separated absolute paths of this batch's PNGs.

**Do not** use `TaskCreate` to fan out. Tasks are tracking artefacts; they do not dispatch subagents. The Agent tool's parallelism comes from emitting multiple tool-use blocks in one assistant message.

### 6. Aggregate

When all subagent calls return, parse their `json` fenced blocks. Each subagent returns an array of verdict objects (schema in `prompts/analyzer.md`). Concatenate. Sort by verdict severity in this order: `broken-screenshot`, `visible-but-wrong`, `not-visible`, `inconclusive`, `unmatched`, `visible-correct`. Within each severity bucket, sort by `test` ascending.

### 7. Write the report

Default location: `<screenshotsDir>/_verification-report.md`. Override with `--report`.

Use the format in the next section. Use `Write` (the tool, not Bash echo) to emit it.

### 8. One-line summary

After writing, print a single chat line to the user:

```
<A> ok · <B> not-visible · <C> visible-but-wrong · <D> inconclusive · <E> broken · <F> unmatched — report at <relative-path>
```

### 9. Gitignore suggestion

The first time you create `_verification-report.md` in a given dir, propose (do not execute) adding `_verification-report.md` to the suite's `.gitignore`. Show the diff line and let the user accept manually.

## Report format

```markdown
# Screenshot verification — <spec basename>

Generated: <ISO 8601 timestamp from `date -u +"%Y-%m-%dT%H:%M:%SZ"`>
Spec: <repo-relative path>
Screenshots dir: <repo-relative path>
Totals: <A> OK · <B> NOT-VISIBLE · <C> VISIBLE-BUT-WRONG · <D> INCONCLUSIVE · <E> BROKEN · <F> UNMATCHED

## Summary table

| Test | Verdict | Summary |
|---|---|---|
| <test name or PNG basename if unmatched> | <VERDICT> | <one-line summary> |
| ... |

## Failures

(Sections for every `not-visible`, `visible-but-wrong`, `broken-screenshot`. Omit this whole heading if all three buckets are empty.)

### <test name> — <VERDICT>

- Expected: <one sentence>
- Observed: <one sentence>
- Hypothesis: <one sentence about likely cause in lib code>
- Suggested next step: <concrete file/grep suggestion>

## Inconclusive

(One line per inconclusive case — `- <test> — <summary>`. Omit heading if none.)

## Unmatched PNGs

(List of basenames the analyzer could not bind to a test. Omit heading if none.)
```

Verdict labels in tables are uppercase words (`OK`, `NOT-VISIBLE`, `VISIBLE-BUT-WRONG`, `INCONCLUSIVE`, `BROKEN`, `UNMATCHED`). Map `visible-correct` → `OK` for table compactness; keep the long form in the JSON.

## What the skill does not do

- It does not edit source code. Failure hypotheses are advisory.
- It does not run Playwright. The user is responsible for refreshing screenshots first.
- It does not compare against a stored baseline PNG. The judgement is "does this match the spec's intent", not "has this changed vs. last commit".

## Verification

To validate that the skill itself works as designed, see `references/self-test.md`. Run that procedure after editing any prompt file under `prompts/`.
