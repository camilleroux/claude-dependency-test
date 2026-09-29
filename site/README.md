# Claude Dependency Test: share site

The public side of the test: a landing page, the online lab reports published by the plugin, preview images and README badges. Plain Vercel functions, no framework. The only dependency is `@vercel/og` for preview images.

| Route | What it does |
| --- | --- |
| `/` | Landing page: pitch, install commands, stages, archetypes, scoring rules, privacy, FAQ. |
| `POST /api/diagnoses` | Publishes a report. Returns `{ slug, url, token }`. |
| `PUT`/`DELETE /api/diagnoses/:slug` | Updates or deletes it (`Authorization: Bearer <token>`). |
| `/case/:slug` | The online lab report: card, vital signs, symptom panel, charts, share buttons, "your turn" install call-to-action. `/case/demo` is a built-in example. |
| `/og/:slug` | 1200×630 PNG preview that mirrors the card, so unfurls on X, LinkedIn, Slack and Discord show the actual score. |
| `/badge/:slug` | Shields-style SVG badge that always shows the latest published score. |
| `/r?s=…`, `/og?s=…`, `/badge?s=…&st=…` | Stateless fallbacks: the card lives in the URL. Used when the plugin runs with `--no-publish` or can't reach the site. |

**What the API accepts.** Every write goes through `sanitizeReport()` from `public/card.js`, the same module the plugin uses: numbers, dates and fixed enum values only, 16 KB max. The delete token is stored as a SHA-256 hash. Writes are limited to 30 per hour per network (keyed on a salted hash of the IP that expires after an hour). Reports expire after 365 days without an update. `/privacy` explains all of it to users.

`public/card.js` and `public/scoring.json` are copies of the plugin's files, made by `npm run sync` (also the Vercel build command). A test fails if they drift.

## Run locally

```bash
cd site
npm install
npm run dev        # http://localhost:8787, no Vercel account needed
```

Without storage credentials, the dev server keeps published reports in memory. To publish from the plugin to it: `CDT_SHARE_BASE_URL=http://localhost:8787 node ../plugins/claude-dependency-test/scripts/diagnose.mjs`.

## Deploy

1. Import the repo in Vercel with **Root Directory = `site`**. `vercel.json` sets the build command, output directory and rewrites.
2. Add storage: in the Vercel project, **Storage → Marketplace → Upstash for Redis**, connected to the project. It sets `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or set `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` yourself). Without them, the API answers 503 and the plugin falls back to stateless links.
3. Set your domain, then use it as `share.baseUrl` in `plugins/claude-dependency-test/config/scoring.json` (and in the plugin's `homepage`).
4. Replace `camilleroux/claude-dependency-test` in `public/site-config.js`, `public/privacy.html` and the root README with the real GitHub repo.
5. Set `CDT_IP_SALT` to a long random string (e.g. `openssl rand -hex 32`) so rate-limit keys can't be reversed into IP addresses.

### GDPR checklist before launch

- [ ] Fill in the publisher's name and a contact email in `public/privacy.html` (a French publisher also needs these legal notices under the LCEN).
- [ ] Create the Upstash database in an **EU region** (e.g. Frankfurt or Ireland).
- [ ] Accept Vercel's and Upstash's data processing agreements (DPA) in their dashboards.
- [ ] Keep Vercel runtime log retention at the minimum. Web Analytics is enabled (cookieless, case ids redacted by `public/va.js`) and described in the privacy policy.
- [ ] Answer deletion requests sent by email (for people who lost the machine holding their token): `DEL cdt:report:<slug>` in the Upstash console.

## How it spreads

The loop: **run the test → get a card worth posting → the post unfurls with your score → a viewer lands on `/case/<id>` → "Think you're less addicted? Prove it." → three copy-paste commands → they run the test.**

What's built in:

- **One command, one link.** Like ccwrapped, the test ends with your report already online and open in your browser. Nothing to set up, nothing to upload by hand.
- **The score is the preview.** Each report gets its own OG image with the exact score, stage and archetype, so the post works even if nobody clicks.
- **A page worth scrolling.** Vital signs, symptom panel and charts give people something to compare beyond the headline number.
- **A number, a stage and a label.** "73/100, Stage 4: Chronic, The Night Owl" is easy to compare and brag about. Eight archetypes make people post to show which one they got.
- **Zero-friction sharing.** From the online report, the local copy and `/r`: Save as PNG, copy image (paste straight into Slack or LinkedIn), native share sheet on mobile, X, LinkedIn, Bluesky and Mastodon intents with pre-written text.
- **Every result page recruits.** `/case/<id>` and `/r` end with the install commands and a challenge, not a dead end.
- **Persistent exposure.** The README badge follows the online report, so it stays current every time you re-run the test, and links back to it from GitHub profiles and repos.
- **Trust as a feature.** "Computed locally" is on the card itself, the server refuses anything but numbers, and `--unpublish` deletes the page. That removes the main reason developers hesitate to share usage data.
- **The terminal starts with the link.** `/claude-dependency-test:diagnose` leads with the online URL, so sharing is one click away from the moment of surprise.

Launch ideas (not built):

- **Seed the archetype gallery**: post 8 cards, one per archetype, and ask "which one are you?".
- **Launch threads** on X, Bluesky and r/ClaudeAI with your own card and the honest scoring table (people love arguing about thresholds).
- **Show HN** framed on privacy: "a wrapped-style stat that never reads your prompts".
- **Team leaderboards** (opt-in, later): a `?team=` param that aggregates only shared links, never raw data.
- **Seasonal re-runs**: "Stage 5 club" at the end of each month. Transcripts rotate every 30 days, so the score naturally changes.
