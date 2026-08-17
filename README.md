# ✍️ Homework for Life

A private journal site built from a Notion "Story" database — one storyworthy moment per day.

**Live:** https://gaurabghosh.github.io/homework-for-life/

- **Raw Data** — every entry, grouped by month, searchable
- **Monthly Summary** — themed, bulleted recaps with a month picker
- **Analytics** — date-range zoom, sentiment over time, theme mix, topics and streaks

## Stack

React 19 + Framer Motion + Tailwind CSS v4, loaded as ES modules from a CDN — no bundler
and no install step. `app.js` is compiled from `app.jsx` (JSX → ESM) and committed directly.

To rebuild after editing the source:

```bash
tsc --allowJs --jsx react-jsx --target es2022 --module es2022 \
    --moduleResolution bundler --outDir . app.jsx
```

## Privacy

Entries are **not** stored in this repo in plaintext. `data.enc.json` is encrypted with
AES-256-GCM (key derived from the passcode via PBKDF2-SHA256, 310k iterations). Decryption
happens entirely in the browser and the passcode is never persisted — every page load asks
for it again.

## Updating the data

1. Edit `data.plain.json` locally (it is git-ignored and never committed)
2. `node encrypt.js "<passcode>"`
3. Commit the regenerated `data.enc.json` and push — the site updates a minute later

A scheduled task refreshes this weekly from Notion.
