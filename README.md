# ✍🏼 Homework for Life

A private journal site built from a Notion "Story" database — one storyworthy moment per day.

- **Raw Data** — every entry, grouped by month, searchable
- **Monthly Summary** — themed, bulleted recaps with a month picker
- **Analytics** — themes, sentiment, topics, streaks and other patterns

## Privacy

Entries are **not** stored in this repo in plaintext. `data.enc.json` is encrypted with
AES-256-GCM (key derived from a passcode via PBKDF2-SHA256, 310k iterations). Decryption
happens entirely in the browser; the passcode is never sent anywhere.

## Updating the data

1. Edit `data.plain.json` locally (it is git-ignored)
2. `node scripts/encrypt.js "<passcode>"`
3. Commit the regenerated `data.enc.json` and push
