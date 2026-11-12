# Implementation and resolved legacy expectations

Date: 2026-11-13. Runtime for this test update: Node v26.13.0; historical implementation validation used Node v22.23.4.

The requested core extraction, generated standalone HTML, CLI, local MCP server, package scripts, English documentation, source attribution, and AI disclosure are implemented. There are no new dependencies. No browser tools, publishing, push, or external application writes were used.

The owner authorized updating the nine legacy tests whose expectations described provisional guidance. Only those test cases and the accompanying documentation were changed. `core.mjs`, `index.html`, the build script, and all other application files remain unchanged. No tests were removed, skipped, or emptied.

## Resolved legacy failures（解消した）

All nine failures in the former “Unchanged legacy failures” section are resolved. Expected IDs, order, counts, titles, and citations now describe the supplied sourced plan. The original behavior checks remain: conditional bank contact before password changes, immediate reused-password changes, distinct skip/undo/reopen/incomplete states, completion retained only for identical meanings, Unknown without reassurance, question validation and exclusive choices, progress retained when earlier bank steps are added, and “Change the exposed password” on the second demo screen.

`TEST_UPDATES.md` records each of the nine changes in one row. The obsolete bank/IT/code/recovery test name was updated to describe the sourced priority and alternative conditions it now checks; its mixed-exposure input remains unchanged. Agency names and URLs are asserted against literal expectations, without fetching them.

Validation: `npm test` passes all 57 tests (57 pass, 0 fail, 0 skipped). This includes all 28 legacy cases, the 15 interface tests, and the 14 supplementary tests. The build idempotence check runs within that suite; `core.mjs` and `index.html` remain byte-for-byte identical to the supplied snapshot.

## Guidance limits

- Agency URLs and wording come from the table supplied by the owner, marked checked on 2026-11-13. They were not independently re-fetched during this implementation. MCP protocol documentation was consulted separately.
- Conditional bank contact is not mandatory for a password-only exposure. Password change and recovery are alternative conditions. Reused-password changes are immediate, rather than deferred until recovery of another account.
- Card refunds apply only to an actual fraudulent payment/charge and are not guaranteed. Transaction checking can happen in the initial issuer contact; statement monitoring is ongoing.
- Without a country selection, identity-document exposure produces the country-limitation statement, not national programs or phone numbers.
- Downloading, running, installing, and remote access differ. The installed-file category preserves uncertainty and conditions; no OS-specific reset instructions are generalized.
- The existing browser inputs cannot explicitly select installation or identity-document photos. Those additional categories are available through CLI/MCP; browser questions were not expanded.
- Multi-exposure combinations have no fully verified merged sequence in the supplied table. Read all conditions; a displayed ordinal does not establish a mandatory order across agencies.

## What was not verified or completed

- The legacy-test acceptance issue is resolved by the explicitly authorized expectation updates above.
- No real browser rendering, accessibility tree, clipboard permissions, or visual-reference comparison was performed, per the restriction on browser tools. The inherited DOM-double tests are narrower than browser tests.
- No real MCP application was configured. Protocol behavior was exercised using local subprocesses, including a live streaming pipe and initialization negotiation.
- No real incident, account, payment, malware scan, or recovery operation was performed. The app only produces information.
- No full external MCP conformance suite was run. This server intentionally implements the advertised stdio tools subset, with one protocol version and no pagination or subscriptions.

## Evidence

`RESULTS_BEFORE.txt` and `RESULTS_AFTER.txt` are preserved historical records from the earlier implementation; their failing counts are not the current result. For this update, `TEST_RESULTS_BEFORE.txt` in the requested output folder records 57 tests, 48 pass, 9 fail. `TEST_RESULTS_AFTER.txt` in that folder records the final `npm test` run with 57 pass, 0 fail, 0 skipped and exit code 0. No external source verification was performed during this test-only update.

## Delivery repository

The requested output folder contains `repo/`, a local clone of the supplied repository with the test and documentation changes committed. The source repository's Git metadata was not modified. No network clone, push, publication, browser tool, or external message was used. The commit uses the explicit AI author `OpenAI Codex <codex@example.invalid>` rather than an assumed human identity.
