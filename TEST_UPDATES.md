# Legacy test expectation updates

Exactly nine existing cases were updated; no cases were removed or skipped. Production code is unchanged. Citations below are checked against the supplied repository, without external communication.

| Original test | Update and preserved check |
| --- | --- |
| normal: fake password demo has exactly the six ordered steps | Expect `bank-conditional → password → recovery → reused → protection → report`; assert exact per-step agency/URL arrays and formatted citations instead of the placeholder; retain ordered traversal, all-done status, uncertainty, and exactly six DONE summary entries. |
| normal: second screen matches the selected desktop/mobile reference | Expect completed `bank-conditional` as the first step; retain `password` as the second step and the exact title `Change the exposed password`. |
| normal: skip, undo, reopen, and incomplete summaries are distinct | Replace `close` state/summary expectations with `bank-conditional` and `If you also shared banking details`; retain pending versus skipped, incomplete summary, undo restoration, reopen, and undo-after-reopen checks. |
| normal: bank, IT, code, and recovery precede password changes | Expect all nine sourced mixed-exposure IDs; check bank contact before password actions, conditional bank contact for password-only answers, change/recovery alternatives, immediate reuse changes without waiting for recovery, and explicit IT/code uncertainty; rename the test to describe these sourced rules. |
| normal: click-only and personal-info branches have applicable actions | Expect `alerts → close` with their narrow applicability and no safety guarantee, plus exactly `personal` titled `Support differs by country` for personal-information exposure; retain exclusion of password changes. |
| normal: changed answers preserve only identical meanings and current step | Expect unchanged completed `bank-conditional` and `password`, current `recovery`, removal of reuse guidance, and cleared undo history; changing account scope resets all six meanings to pending with `bank-conditional` current and no invented IT step. |
| ambiguous: unknown answers remain Unknown and prioritize clarification | Expect only `clarify`, titled `The applicable response is unknown`; retain `Unknown` status, details uncertainty, and reuse guidance/uncertainty when reuse is unknown. |
| UI wiring: three questions validate, enforce exclusive choices, and create a plan | Expect the exact six sourced IDs and second-step `password` instead of IT/device placeholders; retain invalid-submit, exclusive details/account choices, reuse selection, and plan creation checks. |
| UI wiring: skip/undo, answer edit/cancel, and new bank priority preserve relevant progress | Expect undo to return to `bank-conditional` and the update notice to report four additions, one removal, zero resets; retain skip notice, edit cancellation, new first `bank` step, completed password progress, and current-step announcement. |

Validation: `npm test` — 57 tests, 57 pass, 0 fail, 0 skipped. Browser rendering was not exercised; UI tests use the existing DOM doubles. `core.mjs` and `index.html` are unchanged.
