---
name: diagnose
description: Run the Claude Dependency Test. Computes a 0-100 Claude dependency score from local Claude Code transcripts, then publishes an online lab report (aggregate numbers only) with a shareable card.
argument-hint: "[--no-publish] [--unpublish] [--new-link] [--tz Europe/Paris] [--days 30]"
disable-model-invocation: true
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/diagnose.mjs *)
disallowed-tools: Read Grep Glob
---

# Claude Dependency Test

The diagnostic script has already run on this machine. It computed everything locally, then published the aggregate report and opened it in the browser. Its output is below:

```json
!`node ${CLAUDE_PLUGIN_ROOT}/scripts/diagnose.mjs --json --open`
```

## Rules

- The JSON above is your only source. Never open, read, grep or summarize files under `~/.claude/projects` or any transcript, and never recompute or "correct" a number. The script is deterministic; you only present it.
- If the user passed arguments (`$ARGUMENTS`), ignore the block above: run `node ${CLAUDE_PLUGIN_ROOT}/scripts/diagnose.mjs --json --open $ARGUMENTS` with the Bash tool and use that output. Do the same if the block is empty or shows the literal command instead of JSON. If `node` is missing, tell the user the test needs Node.js 18+ and stop.
- If the JSON has `"unpublished"`, just confirm in one or two sentences what was deleted (or that there was nothing to delete) and stop.
- If the JSON has `"error": "insufficient_data"`, relay its `message` kindly and stop.
- Write your whole reply in English, including headings and labels, even if the conversation, CLAUDE.md or the user's language settings use another language. The bulletin, the card and the online page are English, and your reply has to match them.

## Output format

1. First line: if `published` exists, `Your case file is online: <published.url>` (add "(updated, same link as before)" when `published.updated` is true). Otherwise `Your lab results are ready (not published).`
2. Print the `bulletin` field verbatim inside a fenced code block (no language tag). Do not reformat it.
3. `### Medical opinion`: 2-3 sentences written as a deadpan, kind doctor, based only on the JSON: the stage, the diagnosis (`archetype.name`, `archetype.code`, `archetype.tagline`) and one or two standout symptoms. Light, warm, never guilt-inducing, no real health advice, no lecture about screen time. Never criticize or joke about *when* the person works (nights, weekends, early mornings): the humor is about excess, meaning long sessions, streaks, hours per week, prompt volume, subagents. End with a playful *prescription* in italics.
4. `### Chart notes`: 5-7 short bullets written like a doctor's notes in a patient file, with real numbers from the JSON, fun but exact. If the JSON has a `rank` object, the first bullet states it verbatim with its `text` and `total` (for example "More addicted than 72% of patients, out of 214 diagnosed"). Then open with the most spectacular findings: the `headlines` array is already ranked from most to least impressive, use its first 3 (each has a `line` you can rephrase). Then prompts, sessions and active hours over `window.days` days since `window.startDay`, and any other striking number from `usage` (words written by Claude ≈ `outputTokens` × 0.75, shell commands `toolCalls.Bash`, subagents, interruptions, context compactions, longest solo run `longestTurnMinutes`, projects) and from `extras` (current streak, longest session, busiest day, model mix). One light joke per bullet at most; never invent a number or round it differently from the bulletin.
5. If any `breakdown` item has `"available": false`, one short line naming the symptoms that could not be measured and saying the score was renormalized.
6. `### Spread the diagnosis`: keep it short, social networks first.
   - One enthusiastic line inviting the user to post their diagnosis and challenge friends ("Think your teammates are less addicted? Send them the test.").
   - `**Share on:** [X](<share.intents.x>) · [LinkedIn](<share.intents.linkedin>) · [Bluesky](<share.intents.bluesky>) · [Mastodon](<share.intents.mastodon>)` (each link opens a post already filled with the text and the link).
   - `**Your case file:** <share.url>`
   - One last small line: `More: [README badge](<share.badge>) · offline card with Save as PNG: <reportPath>`.
7. If `follow` is not empty: `**Follow the doctor** for new symptoms and features:` then the accounts as links on one line, e.g. `[X @handle](url) · [Bluesky @handle](url)`. Then, if `author.url` exists: `Made by [<author.name>](<author.url>).`
8. `**Doctor–patient confidentiality:**` one or two lines:
   - If published: "The case file holds aggregate numbers only (score, symptoms, activity counts, tool and token totals, model mix), and anyone with the link can see it. No prompts, code, file paths or project names were sent. Re-running updates the same link; `/claude-dependency-test:diagnose --unpublish` deletes it, `--no-publish` keeps everything offline. Details: https://<share.siteLabel>/privacy."
   - If `publishError` exists: say publishing failed with that reason, that nothing was uploaded, and that the share link carries the card in its URL.
   - If neither exists: "Everything stayed on your machine."
9. End with: `_Not an actual medical diagnosis._`
