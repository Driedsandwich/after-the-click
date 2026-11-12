# Implementation and remaining acceptance conflict

Date: 2026-11-13. Runtime used for recorded validation: Node v22.23.4.

The requested core extraction, generated standalone HTML, CLI, local MCP server, package scripts, English documentation, source attribution, and AI disclosure are implemented. There are no new dependencies. No browser tools, publishing, push, or external application writes were used.

The old tests are byte-for-byte unchanged. The owner was asked whether conflicting guidance expectations could be revised; no answer had arrived when this artifact was prepared. The original prohibition on changing existing tests therefore remains in force. All existing tests remain included in `npm test`; failures have not been hidden or converted to skips. This work is not claimed to meet the requirement that every old test stay green.

## Why the requirements conflict

`tests/core.test.cjs` requires every demo step's `source` to equal the old provisional marker. It also requires the old six IDs (`close`, `password`, `sessions`, `reused`, `protection`, `review`). Replacing that marker with actual agency citations cannot satisfy that equality. Other old assertions require advice or sequencing absent from the supplied table, such as a general IT/code sequence and universal session-signout instructions.

The replacement uses only the supplied table, with explicit alternative conditions and national limitations. It does not pretend that unsupported older wording has a verified source. The original six-screen password demo still has six steps, but their guidance and IDs differ. General flow, controls, original CSS, and button wording remain. A final-step condition and dynamic demo announcement were adjusted to reflect the sourced steps without changing the controls.

## Unchanged legacy failures

| Test | Conflicting old expectation |
| --- | --- |
| normal: fake password demo has exactly the six ordered steps | Old six IDs and provisional source marker |
| normal: second screen matches the selected desktop/mobile reference | First completed step must have the old `close` ID; password still appears second |
| normal: skip, undo, reopen, and incomplete summaries are distinct | Old `close` ID/title in state and summary |
| normal: bank, IT, code, and recovery precede password changes | Old combined order and wording, including unverified support-route details |
| normal: click-only and personal-info branches have applicable actions | Old universal `close`, `device`, `review` sequence |
| normal: changed answers preserve only identical meanings and current step | Old `sessions` and `it` steps and their priority |
| ambiguous: unknown answers remain Unknown and prioritize clarification | Old four-step sequence for unspecified exposure |
| UI wiring: three questions validate, enforce exclusive choices, and create a plan | Old `it` and `device` steps |
| UI wiring: skip/undo, answer edit/cancel, and new bank priority preserve relevant progress | Old `close` state and exactly one added bank step |

The other 19 old tests pass. The 15 tests written before interface implementation now pass. Fourteen supplementary tests verify the replacement guidance, equivalent browser/Node outputs for all 60 categorical combinations, current state transitions, JSON output schemas, bounded streaming messages, and artifact preservation.

## Guidance limits

- Agency URLs and wording come from the table supplied by the owner, marked checked on 2026-11-13. They were not independently re-fetched during this implementation. MCP protocol documentation was consulted separately.
- Conditional bank contact is not mandatory for a password-only exposure. Password change and recovery are alternative conditions. Reused-password changes are immediate, rather than deferred until recovery of another account.
- Card refunds apply only to an actual fraudulent payment/charge and are not guaranteed. Transaction checking can happen in the initial issuer contact; statement monitoring is ongoing.
- Without a country selection, identity-document exposure produces the country-limitation statement, not national programs or phone numbers.
- Downloading, running, installing, and remote access differ. The installed-file category preserves uncertainty and conditions; no OS-specific reset instructions are generalized.
- The existing browser inputs cannot explicitly select installation or identity-document photos. Those additional categories are available through CLI/MCP; browser questions were not expanded.
- Multi-exposure combinations have no fully verified merged sequence in the supplied table. Read all conditions; a displayed ordinal does not establish a mandatory order across agencies.

## What was not verified or completed

- All-old-tests-green acceptance is unresolved for the reasons above. No test-update authorization was assumed.
- No real browser rendering, accessibility tree, clipboard permissions, or visual-reference comparison was performed, per the restriction on browser tools. The inherited DOM-double tests are narrower than browser tests.
- No real MCP application was configured. Protocol behavior was exercised using local subprocesses, including a live streaming pipe and initialization negotiation.
- No real incident, account, payment, malware scan, or recovery operation was performed. The app only produces information.
- No full external MCP conformance suite was run. This server intentionally implements the advertised stdio tools subset, with one protocol version and no pagination or subscriptions.

## Evidence

`RESULTS_BEFORE.txt` contains the genuine pre-implementation run: existing 28/28 pass, new interface 0/15 pass (15 expected failures). `RESULTS_AFTER.txt` contains the final full run and its nonzero exit code: 57 tests, 48 pass, 9 fail. The extra 14 checks were written after implementation and are not represented as pre-implementation tests.

## Delivery repository

The original workspace `.git` is mounted read-only: creating its `index.lock` failed. A local clone was created under the requested output folder and the completed files were copied there for committing. The original Git metadata and permissions were not modified. The deliverable repository contains the original baseline commit plus the new implementation commit; no network clone or push was used. Because no Git author was configured, the implementation commit uses the explicit AI author `OpenAI Codex <codex@example.invalid>`, not an assumed human identity.
