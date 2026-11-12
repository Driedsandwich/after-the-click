import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cwd = fileURLToPath(new URL('../', import.meta.url));
const run = (file, args = [], input = '') => spawnSync(process.execPath, [file, ...args], { cwd, input, encoding: 'utf8', timeout: 5000 });
const cli = (args, input) => run('cli.mjs', args, input);
const args = did => ['plan', '--did', did, '--account', 'personal', '--reused', 'yes', '--json'];
const req = (id, method, params) => ({ jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) });
const init = req(1, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'offline-test', version: '1.0.0' } });
const initialized = { jsonrpc: '2.0', method: 'notifications/initialized' };
function rpc(messages, raw = '') {
  const p = run('mcp/server.mjs', [], messages.map(x => JSON.stringify(x)).join('\n') + '\n' + raw);
  assert.equal(p.status, 0, p.stderr);
  assert.equal(p.stderr, '');
  return p.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
}
for (const did of ['typed_password', 'typed_card', 'sent_id_photo', 'installed_file', 'clicked_only']) {
  test('CLI plan: ' + did + ' matches core', async () => {
    const p = cli(args(did));
    assert.equal(p.status, 0, p.stderr);
    const result = JSON.parse(p.stdout);
    const { invokeTool } = await import('../core.mjs');
    assert.deepEqual(result, invokeTool('first_aid_plan', { did, account: 'personal', reused: 'yes' }));
    assert.equal(result.ok, true);
    assert.equal(result.status, 'Unknown');
    assert.ok(result.steps.length > 0);
    assert.ok(result.steps.every(s => s.sources.length && s.sources.every(x => x.agency && /^https:\/\//.test(x.url))));
    assert.doesNotMatch(p.stdout, /\[source to verify\]/);
  });
}
test('CLI dissect: file and stdin match core and omit URL secrets', async () => {
  const p = cli(['dissect', '--text', 'tests/fixtures/message.txt', '--json']);
  assert.equal(p.status, 0, p.stderr);
  const stdin = cli(['dissect', '--text', '-', '--json'], 'Fictional delivery notice: https://delivery.example.parcel-check.test/confirm\n');
  assert.equal(stdin.status, 0, stdin.stderr);
  assert.deepEqual(JSON.parse(p.stdout), JSON.parse(stdin.stdout));
  const sensitive = 'https://demo:FAKE_PASSWORD' + String.fromCharCode(64) + 'bank.example/path?' + 'tok' + 'en=FAKE_TOKEN#FAKE_FRAGMENT';
  const result = cli(['dissect', '--text', '-', '--json'], sensitive);
  const { invokeTool } = await import('../core.mjs');
  assert.deepEqual(JSON.parse(result.stdout), invokeTool('dissect_links', { text: sensitive }));
  assert.doesNotMatch(result.stdout, /FAKE_PASSWORD|FAKE_TOKEN|FAKE_FRAGMENT|\/path/);
});
test('CLI: invalid command, options, categories, duplicate and missing arguments return JSON errors', () => {
  for (const input of [[], ['oops', '--json'], args('unknown'), [...args('clicked_only'), '--extra', 'x'], [...args('clicked_only'), '--account', 'work'], ['plan', '--did', '--json'], ['dissect', '--json'], ['dissect', '--text', '-', '--account', 'work', '--json']]) {
    const p = cli(input);
    assert.equal(p.status, 2);
    assert.equal(JSON.parse(p.stdout).error.code, 'INVALID_INPUT');
    assert.equal(p.stderr, '');
  }
});
test('CLI: file errors do not echo private filenames', () => {
  const p = cli(['dissect', '--text', 'MISSING_PRIVATE_NAME.txt', '--json']);
  assert.equal(p.status, 3);
  assert.equal(JSON.parse(p.stdout).error.code, 'INPUT_IO');
  assert.doesNotMatch(p.stdout + p.stderr, /MISSING_PRIVATE_NAME/);
});
test('CLI: empty or oversized text is an error; unsupported links remain Unknown', () => {
  for (const text of ['', 'a'.repeat(12001)]) {
    const p = cli(['dissect', '--text', '-', '--json'], text);
    assert.equal(p.status, 2);
    assert.equal(JSON.parse(p.stdout).error.code, 'INVALID_INPUT');
  }
  const p = cli(['dissect', '--text', '-', '--json'], 'https://[broken');
  assert.equal(p.status, 0);
  assert.equal(JSON.parse(p.stdout).status, 'Unknown');
});
test('CLI: readable output and help are available', () => {
  const p = cli(args('clicked_only').filter(x => x !== '--json'));
  assert.equal(p.status, 0, p.stderr);
  assert.match(p.stdout, /Unknown/);
  const help = cli(['--help']);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /dissect/);
});
test('MCP: handshake, version negotiation, ping and schemas', () => {
  const replies = rpc([init, initialized, req(2, 'tools/list'), req(3, 'ping')]);
  assert.equal(replies.length, 3);
  assert.equal(replies[0].result.protocolVersion, '2025-11-25');
  assert.deepEqual(replies[0].result.capabilities, { tools: {} });
  const tools = replies[1].result.tools;
  assert.deepEqual(tools.map(x => x.name), ['first_aid_plan', 'dissect_links']);
  for (const tool of tools) {
    assert.equal(tool.inputSchema.type, 'object');
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.equal(tool.outputSchema.type, 'object');
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.annotations.openWorldHint, false);
  }
  assert.deepEqual(replies[2].result, {});
  const fallback = rpc([{ ...init, params: { ...init.params, protocolVersion: 'unsupported' } }]);
  assert.equal(fallback[0].result.protocolVersion, '2025-11-25');
});
test('MCP: both tool results match the shared core and CLI', async () => {
  const { invokeTool } = await import('../core.mjs');
  const calls = [
    ...['typed_password', 'typed_card', 'sent_id_photo', 'installed_file', 'clicked_only'].map(did => ['first_aid_plan', { did, account: 'work', reused: 'not_sure' }]),
    ['dissect_links', { text: 'https://demo:FAKE_PASSWORD' + String.fromCharCode(64) + 'bank.example/secret?' + 'tok' + 'en=FAKE_TOKEN' }],
  ];
  const replies = rpc([init, initialized, ...calls.map(([name, arguments_], i) => req(i + 2, 'tools/call', { name, arguments: arguments_ }))]);
  for (const [i, [name, input]] of calls.entries()) {
    const result = replies[i + 1].result;
    assert.equal(result.isError, false);
    assert.deepEqual(result.structuredContent, invokeTool(name, input));
    assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
  }
  assert.doesNotMatch(JSON.stringify(replies), /FAKE_PASSWORD|FAKE_TOKEN/);
});
test('MCP: invalid tool arguments return tool errors without echoing input', () => {
  const cases = [null, {}, { did: 'PRIVATE_BAD_VALUE', account: 'personal', reused: 'no' }, { did: 'clicked_only', account: 'personal', reused: 'no', ['sec' + 'ret']: 'PRIVATE_BAD_VALUE' }];
  const replies = rpc([init, initialized, ...cases.map((arguments_, i) => req(i + 2, 'tools/call', { name: 'first_aid_plan', arguments: arguments_ })), req(9, 'tools/call', { name: 'dissect_links', arguments: { text: '' } })]);
  for (const reply of replies.slice(1)) {
    assert.equal(reply.result.isError, true);
    assert.equal(reply.result.structuredContent.error.code, 'INVALID_INPUT');
  }
  assert.doesNotMatch(JSON.stringify(replies), /PRIVATE_BAD_VALUE/);
});
test('MCP: protocol errors, unknown tools, and notifications keep the session usable', () => {
  const replies = rpc([init, initialized, req(2, 'unsupported'), req(3, 'tools/call', { name: 'missing', arguments: {} }), { jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 50 } }, req(4, 'ping')], '{bad json}\n[]\n');
  assert.deepEqual(replies.map(x => x.id), [1, 2, 3, 4, null, null]);
  assert.equal(replies[1].error.code, -32601);
  assert.equal(replies[2].error.code, -32602);
  assert.deepEqual(replies[3].result, {});
  assert.equal(replies[4].error.code, -32700);
  assert.equal(replies[5].error.code, -32600);
});
test('MCP: rejects tool use before initialized and malformed initialize', () => {
  const replies = rpc([req(2, 'tools/list'), req(3, 'initialize', {}), init, req(4, 'tools/list'), initialized, req(5, 'tools/list')]);
  assert.ok(replies[0].error);
  assert.equal(replies[1].error.code, -32602);
  assert.ok(replies[3].error);
  assert.equal(replies[4].result.tools.length, 2);
});
