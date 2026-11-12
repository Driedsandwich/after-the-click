# After the Click

**You clicked a suspicious link — what should you do in the next 10 minutes?**

After the Click is a single-page, offline first-aid checklist. Choose what happened (*I haven't clicked yet* / *I clicked the link* / *I typed in my details*), answer three short questions using categories only, and get the next steps one at a time, each with a short "why now". At the end you can copy a summary to share with your bank or IT desk yourself — nothing is sent.

If you have not clicked yet, paste the message to see where its links really point (the registered domain is highlighted) and why a link may need caution.

- Asks for categories only — never passwords, codes, account numbers, or your name.
- Nothing leaves your device. No sign-up. No cost. Works offline.
- Results are "Strong caution", "No flags found — not a safety verdict", or "Unknown". It never says a link is safe.

> Status: prototype built for SafeSpace Hacks (build window October 17 – November 22, 2026). This is a first-aid checklist, not a replacement for your bank, school IT desk, or the police. Step wording is provisional and is being checked against public guidance from government agencies.

## Try it
Open `index.html` and press **Try fake delivery demo**.

## Tests
```
node --test tests/
```

## Credits and AI assistance
- Prototype code and tests were generated with OpenAI Codex from written specifications and design mockups; planning, review, and browser testing used Anthropic Claude.
- Includes the Public Suffix List (© 2010–2026 PSL maintainers), Mozilla Public License 2.0, embedded unchanged in `index.html` with its license text.
- All sample messages are fictional; domains use reserved `.test` / `.example` names.
