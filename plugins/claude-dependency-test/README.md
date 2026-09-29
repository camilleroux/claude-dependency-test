# Claude Dependency Test

**How addicted to Claude are you?**

Turns your local Claude Code usage into a dependency score out of 100, a (fake) medical diagnosis and a shareable patient chart: active hours, streaks, subagents, words written by Claude, model mix.

```bash
npx claude-dependency-test
```

Or as a Claude Code plugin, where Claude also writes you a medical opinion:

```
/plugin marketplace add camilleroux/claude-dependency-test
/plugin install claude-dependency-test@claude-dependency-test
/claude-dependency-test:diagnose
```

Requires Node.js 18+. No dependencies.

## Privacy

- **Computed on your machine.** The script reads your Claude Code transcripts (`~/.claude/projects`, or `$CLAUDE_CONFIG_DIR/projects`) and uses only timestamps, message types, model names, tool names, token counts and error markers. It never reads or sends the text of your prompts or of Claude's answers, your code, file paths or project names.
- **What gets published.** By default, the aggregate report (numbers and fixed labels only: score, symptoms, activity counts, tool and token totals, model mix) is sent to `https://dependency.camilleroux.com` so you get a shareable page. The server rejects anything that isn't a number, a date or a known label.
- **Your choice.** `--no-publish` keeps everything offline. `--unpublish` deletes your page. Re-running updates the same link.

Full details: [privacy policy](https://dependency.camilleroux.com/privacy) and the [main README](https://github.com/camilleroux/claude-dependency-test#privacy).

## Options

| Option | Effect |
| --- | --- |
| `--no-publish` | Stay offline: nothing is sent. |
| `--unpublish` | Delete your online report. |
| `--new-link` | Publish to a new link instead of updating yours. |
| `--no-open` | Don't open the report in your browser. |
| `--tz <zone>` | Time zone for hours and days, e.g. `Europe/Paris`. |
| `--days <n>` | Only look at the last `n` days. |
| `--json` | Print the aggregates as JSON. |

Not an actual medical diagnosis. Unofficial, not affiliated with Anthropic. Made by [Camille Roux](https://www.camilleroux.com/?ref=claude-dependency-test).
