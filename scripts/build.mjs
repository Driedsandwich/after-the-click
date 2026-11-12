import { readFile, writeFile } from 'node:fs/promises';
import { Script } from 'node:vm';

const root = new URL('../', import.meta.url);
const source = await readFile(new URL('core.mjs', root), 'utf8');
const htmlPath = new URL('index.html', root);
const html = await readFile(htmlPath, 'utf8');
const start = '<!-- core:start -->';
const end = '<!-- core:end -->';
if (html.split(start).length !== 2 || html.split(end).length !== 2 || html.indexOf(start) >= html.indexOf(end)) {
  throw new Error('Expected exactly one ordered pair of core markers.');
}
// The module uses one explicit export list; the browser receives the same code.
const exports = source.match(/^export \{[^}]+\};\s*$/gm);
if (exports?.length !== 1) throw new Error('Expected one export list in core.mjs.');
const inline = source.replace(/^export \{[^}]+\};\s*$/gm, '').trimEnd().replace(/<\/script/gi, '<\\/script');
new Script(inline, { filename: 'generated-core.js' });
const output = html.slice(0, html.indexOf(start) + start.length) + '\n<script id="core">\n' + inline + '\n</script>\n' + html.slice(html.indexOf(end));
await writeFile(htmlPath, output);
console.log('Built index.html from core.mjs.');
