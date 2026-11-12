# After the Click

**You clicked a suspicious link — what should you do in the next 10 minutes?**

After the Click is an offline first-aid checklist and link-text inspector for a student hackathon. It uses categories, never requests passwords or account numbers, and shows uncertainty rather than declaring a link or device safe. Use fictional data for demonstrations.

**Status: prototype.** All 57 tests pass (`npm test`), including the CLI/MCP contract tests and nine earlier tests that were updated to the agency-sourced guidance (no tests were removed). See [IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md) and [TEST_UPDATES.md](TEST_UPDATES.md).

This is a first-aid checklist, not a replacement for your bank, school IT desk, or the police. Step wording and conditions come from public guidance by government agencies (UK NCSC, US FTC, US CISA, Japan IPA, Japan National Police Agency, Australia Scamwatch and Moneysmart, EU ENISA). Each quoted line was checked against the original page on November 13, 2026; a page whose text could not be retrieved is not used. Step numbers are editorial presentation order, not one sequence agreed by all agencies. Multiple simultaneous incidents do not have a complete verified combined order in the supplied material.

## Try it and build

Open the committed `index.html` and press **Try fake delivery demo**. It works as one local file with no external resources, installation, or server.

Node 22 is required for development and the agent interfaces. No package installation is needed; there are no dependencies.

```sh
npm run build
npm test
# Equivalent without npm:
node scripts/build.mjs
node --test tests/*.test.cjs tests/*.test.mjs
```

`core.mjs` is the sole source of calculations, guidance, tool argument validation, and tool schemas. It is pure JavaScript with no DOM, filesystem, network, or environment access. `scripts/build.mjs` removes its explicit export list and embeds the same code between `<!-- core:start -->` and `<!-- core:end -->` in `index.html`. The build preserves everything outside those markers. Commit the rebuilt HTML whenever the core changes. Tests check the generated block for exact equality, build repeatability, and Node/browser-core result parity.

The browser keeps the existing question flow, controls, styling, and summary interactions. Guidance text, sources, conditional steps, and step counts now reflect the supplied table. The final-step button uses the actual final step so its existing **Done, view summary** label remains available. No new browser questions were added: the browser cannot distinguish downloading, installation, or remote access, and cannot specifically select an identity-document photo. Those limitations are explicit in guidance. CLI/MCP have the requested incident categories.

## CLI usage

```sh
node cli.mjs plan --did typed_password --account personal --reused yes --json
node cli.mjs plan --did installed_file --account school --reused not_sure --json
node cli.mjs dissect --text tests/fixtures/message.txt --json
cat tests/fixtures/message.txt | node cli.mjs dissect --text - --json
node cli.mjs --help
```

All three plan options are required:

| Option | Allowed values |
| --- | --- |
| `--did` | `typed_password`, `typed_card`, `sent_id_photo`, `installed_file`, `clicked_only` |
| `--account` | `personal`, `school`, `work`, `not_sure` |
| `--reused` | `yes`, `no`, `not_sure` |

`--reused` affects only `typed_password`; other incidents treat reuse as not applicable. Account categories provide context and uncertainty; the supplied table does not establish an organization-specific response sequence. Login access is unknown through these interfaces, so password-change and account-recovery steps have explicit, alternative conditions.

`dissect --text` reads a UTF-8 regular file or stdin (`-`). Text must be nonblank and at most 12,000 JavaScript string units. At most 10 distinct URLs are inspected. Malformed or unsupported URLs are successful analyses with uncertainty, not argument errors. File reads are bounded; the tool does not open URLs mentioned in the input.

With `--json`, stdout contains one JSON object using the success shapes below. Without it, plans use readable text and link results use indented JSON. Errors always use JSON on stdout, including without `--json`:

```json
{"error":{"code":"INVALID_INPUT","message":"Missing required options."}}
```

| Exit code | Meaning |
| --- | --- |
| 0 | Successful plan, analysis, or help |
| 2 | `INVALID_INPUT`: command, arguments, categories, empty/oversized text |
| 3 | `INPUT_IO`: text could not be read |
| 1 | `INTERNAL_ERROR`: operation could not be completed |

Unknown/duplicate options and extra arguments are rejected. Errors do not echo input text, private filenames, or stack traces.

## MCP usage

Run a local subprocess using Node 22:

```sh
node mcp/server.mjs
```

For a client that accepts `mcpServers` configuration, substitute your local absolute path:

```json
{
  "mcpServers": {
    "after-the-click": {
      "command": "node",
      "args": ["/absolute/path/to/after-the-click/mcp/server.mjs"]
    }
  }
}
```

The server implements the local stdio subset of MCP protocol `2025-11-25`: `initialize`, `notifications/initialized`, `ping`, `tools/list`, and `tools/call`. It uses newline-delimited UTF-8 JSON-RPC 2.0; stdout contains protocol messages only. Initialize first, then send the initialized notification. An unsupported requested version receives the supported version; the client decides whether it can continue. EOF ends the server; normal shutdown needs no special request. There is no listening port, SDK dependency, automatic log, telemetry, remote service, resource subscription, or model invocation.

Implementation references: official MCP [stdio transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports), [lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle), and [tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools).

A minimal exchange sends these lines in order (wait for initialization response before sending subsequent requests):

```jsonl
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"local-demo","version":"1.0.0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"first_aid_plan","arguments":{"did":"clicked_only","account":"personal","reused":"no"}}}
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"dissect_links","arguments":{"text":"Fictional notice: https://delivery.example.parcel-check.test/confirm"}}}
```

### Tools and input shapes

Both input objects reject extra properties. Exact JSON Schemas are returned by `tools/list` and exported as `TOOL_DEFINITIONS` from `core.mjs`.

| Tool | Required input | Output |
| --- | --- | --- |
| `first_aid_plan` | `{ "did": <CLI incident enum>, "account": <CLI account enum>, "reused": <CLI reuse enum> }` | Plan object below |
| `dissect_links` | `{ "text": <nonblank string, maximum 12000 UTF-16 units> }` | Analysis object below |

### Output shapes

Plan success:

```text
{
  ok: true,
  status: "Unknown",
  steps: [{
    id: string, title: string, short: string,
    action: string, why: string, condition: string,
    signature: string,
    source: string,
    sources: [{agency: string, url: string}]
  }],
  unknowns: string[],
  errors: []
}
```

`source` is a plain-text rendering of `sources`. Conditions are essential parts of the guidance. IDs/signatures support local checklist state, not a guarantee about a required clinical or official sequence. A `sent_id_photo` plan explains that support differs by country; it does not recommend a country-specific service without a country selection. `installed_file` distinguishes device access from downloading and makes scan availability explicit. It does not prescribe OS-specific recovery or resetting a device without those conditions.

Link analysis success:

```text
{
  status: "Strong caution" | "No flags found — not a safety verdict" | "Unknown",
  items: [{
    id: integer, host: string, domain: string | null, port: string | null,
    flags: [{id: string, code: string, reason: string}],
    unknowns: string[], demo: boolean
  }],
  notes: string[]
}
```

MCP wraps successes as `{content:[{type:"text",text:<JSON string>}],structuredContent:<same object>,isError:false}`. Tool argument errors use the same wrapper with `isError:true` and `{error:{code:"INVALID_INPUT",message:string}}`; unexpected tool failures use `INTERNAL_ERROR`. Output schemas include that error alternative.

Protocol errors use JSON-RPC `error`: `-32700` for invalid JSON/incomplete EOF, `-32600` for invalid requests, lifecycle misuse, or oversized frames, `-32601` for unsupported methods, and `-32602` for invalid method parameters or unknown tool names. Notifications receive no response. Frames above 131,072 decoded characters are discarded through the next newline, then processing can continue. JSON-RPC batches and pagination are not supported.

## Privacy and limits

- Runtime code never makes network requests. Source URLs are displayed as text; they are not fetched or opened. There are no CDN resources, fonts, analytics, secrets, or credentials.
- The browser keeps inputs in tab memory. CLI/MCP retain no history and return only to their local caller. An agent client can retain or forward what it receives; its behavior is outside this server. Demonstrate with fictional data only.
- Link results omit user-info credentials, URL paths, queries, and fragments. Hostnames themselves can contain identifiers; input is not a general-purpose anonymization service. Remove personal information before use.
- Offline structure checks cannot confirm ownership, follow redirects, detect infection, contact banks, change passwords, refund payments, or guarantee safety. Marking a checklist step done records only a user's report.
- Guidance uses only the supplied table. Country-specific identity programs and unverified specialist sequences are not presented as worldwide instructions. No phone numbers are included. A single incident category does not imply that other exposures did not occur.

## Work produced within October 17 – November 22, 2026

The following work was done in this session on **November 13, 2026**, within the build window:

- Extracted the existing core and unmodified PSL/license snapshot into `core.mjs`; added deterministic embedding and committed the generated standalone page.
- Wrote and ran 15 CLI/MCP tests before implementing the interfaces. All 15 failed because the interfaces did not exist. The existing 28 tests passed at that point.
- Added the offline CLI and dependency-free stdio MCP server, shared validation, advertised input/output schemas, and bounded input handling.
- Replaced provisional guidance with conditional, attributed material from the owner's supplied table; preserved CSS and existing control wording and layout.
- Added 14 supplementary checks after implementation for guidance, build parity, PSL/license/CSS preservation, state transitions, schemas, no network APIs, and streaming protocol behavior.
- Updated the expectations of nine earlier tests that still described the provisional steps, keeping what each test checks (no tests removed; assertions increased). Full suite: 57/57 pass on Node 22.

The first prototype was built on November 12, 2026, within the build window. Unit-level UI checks use DOM doubles; separate browser walkthroughs (headless Chromium at desktop and mobile widths, sample flow end to end, no network requests observed) were run during review. No real accounts, live MCP client integrations, or external services were used.

## Credits and AI assistance

- Original prototype credit, preserved from the supplied README: prototype code and tests were generated with OpenAI Codex from written specifications and design mockups; planning, review, and browser testing used Anthropic Claude.
- This November 13 extension, tests, documentation, and source-table adaptation were AI-assisted with OpenAI Codex. Agency wording and verification dates were supplied by the owner. The guidance wording will be reviewed again before submission. No AI model runs inside this app.
- Includes the Public Suffix List (© 2010–2026 PSL maintainers), Mozilla Public License 2.0. Its rule lines and license text are unchanged in `core.mjs` and the generated `index.html`; contributor comment lines were removed to keep the file small, and a checksum test pins the embedded copy. Snapshot: Debian publicsuffix 20260129.1928-1.
- Sample messages are fictional; demo domains use reserved `.test` / `.example` names. Some inherited unit tests contain public domain names strictly as offline parser inputs; they are never contacted.
