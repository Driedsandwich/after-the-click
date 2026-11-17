# After the Click

**You clicked a suspicious link — what should you do in the next 10 minutes?**

After the Click is an offline first-aid checklist and link-text inspector for a student hackathon. It uses categories, never requests passwords or account numbers, and shows uncertainty rather than declaring a link or device safe. Use fictional data for demonstrations.

**Status: prototype.** All 59 tests pass (`npm test`), covering the shared core, CLI/MCP contracts, UI event handling, and build consistency. The suite passes on Node v22 and v26. UI tests use DOM doubles; they do not check browser layout, native clipboard permissions, or touch gestures. Test results: [before the copy-text change](RESULTS_BEFORE.txt) (57 pass, 1 fail) and [after](RESULTS_AFTER.txt) (58 pass, 0 fail).

This is a first-aid checklist, not a replacement for your bank, school IT desk, or the police. Step wording and conditions come from the public guidance listed below. Step numbers are editorial presentation order, not one sequence agreed by all agencies. The sources do not establish a complete combined order for multiple simultaneous incidents.

## Public guidance sources

- [UK National Cyber Security Centre (NCSC): phishing response and recovery](https://www.ncsc.gov.uk/section/respond-recover/phishing)
- [US Federal Trade Commission (FTC): what to do if you were scammed](https://consumer.ftc.gov/articles/what-do-if-you-were-scammed)
- [Japan Information-technology Promotion Agency (IPA): phishing guidance](https://www.ipa.go.jp/security/anshin/attention/2026/mgdayori20261026.html)
- [Japan IPA: fake security warnings](https://www.ipa.go.jp/security/anshin/attention/2018/mgdayori20180718.html)
- [Japan National Police Agency: phishing countermeasures](https://www.npa.go.jp/bureau/cyber/countermeasures/phishing.html)
- [Japan Consumer Affairs Agency: credit-card misuse precautions](https://www.caa.go.jp/policies/policy/consumer_policy/caution/caution_039)
- [Australia Scamwatch: what to do if you have been scammed](https://www.scamwatch.gov.au/stop-check-protect/what-to-do-if-youve-been-scammed)
- [Australia ASIC / Moneysmart: what to do if you have been scammed](https://moneysmart.gov.au/check-and-report-scams/what-to-do-if-youve-been-scammed)

## Try it and build

Open the committed `index.html` and press **Try fake delivery demo**. It works as one local file with no external resources, installation, or server.

Node 22 or newer is required for development and the agent interfaces. No package installation is needed; there are no dependencies.

```sh
npm run build
npm test
# Equivalent without npm:
node scripts/build.mjs
node --test tests/*.test.cjs tests/*.test.mjs
```

`core.mjs` is the sole source of calculations, guidance, tool argument validation, and tool schemas. It is pure JavaScript with no DOM, filesystem, network, or environment access. `scripts/build.mjs` removes its explicit export list and embeds the same code between `<!-- core:start -->` and `<!-- core:end -->` in `index.html`. The build preserves everything outside those markers. Commit the rebuilt HTML whenever the core changes. Tests check the generated block for exact equality, build repeatability, and Node/browser-core result parity.

The browser presents one checklist step per screen, with conditional guidance, source citations, and a summary. Its questions cannot distinguish downloading, installation, or remote access, and cannot specifically select an identity-document photo. Guidance explains those limitations. CLI/MCP support the incident categories listed below.

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

`--reused` affects only `typed_password`; other incidents treat reuse as not applicable. Account categories provide context and uncertainty; the public guidance sources do not establish an organization-specific response sequence. Login access is unknown through these interfaces, so password-change and account-recovery steps have explicit, alternative conditions.

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
- Guidance comes from the public agency sources listed above. Country-specific identity programs and specialist sequences without supporting guidance are not presented as worldwide instructions. No phone numbers are included. A single incident category does not imply that other exposures did not occur.

## Work produced within October 17 – November 22, 2026

- **November 12, 2026:** Created the first prototype.
- **November 13, 2026:** Added the shared core, CLI, local MCP server, and tests.
- **November 17, 2026:** Clarified manual summary-copy instructions for computers and phones, added a regression test, and updated the README.

All original work on After the Click was created within the hackathon period. The only pre-existing third-party material bundled in the app is the Public Suffix List snapshot described in Credits. The checklist draws on the public agency guidance linked above.

## Credits and AI assistance

- I used OpenAI Codex to generate code and tests, and Anthropic Claude for planning, review, and browser checks. I selected the project and its design direction from options explored with AI assistance. No AI model runs inside this app.
- Includes the Public Suffix List (© 2010–2026 PSL maintainers), Mozilla Public License 2.0. Its rule lines and license text are preserved in `core.mjs` and the generated `index.html`; contributor comment lines are omitted to keep the file small, and a checksum test pins the embedded copy. Snapshot: Debian publicsuffix 20260129.1928-1.
- Sample messages are fictional; demo domains use reserved `.test` / `.example` names. Some parser tests contain public domain names strictly as offline inputs; they are never contacted.
