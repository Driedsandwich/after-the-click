import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import vm from 'node:vm';
import { AfterClickCore, invokeTool, TOOL_DEFINITIONS, PSL_SOURCE } from '../core.mjs';
const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');
const html=read('index.html');
const hash=s=>createHash('sha256').update(s).digest('hex');
const make=overrides=>({entry:'typed',details:['password'],accounts:['personal'],reuse:'yes',locked:false,...overrides});
const call=did=>invokeTool('first_aid_plan',{did,account:'personal',reused:'yes'});

test('build: embedded core is exact generated module; rerunning build is idempotent',()=>{
  const expected=read('core.mjs').replace(/^export \{[^}]+\};\s*$/gm,'').trimEnd().replace(/<\/script/gi,'<\\/script');
  assert.equal(html.match(/<!-- core:start -->\n<script id="core">\n([\s\S]*?)\n<\/script>\n<!-- core:end -->/)[1],expected);
  const run=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:root,encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  assert.equal(read('index.html'),html);
});
test('artifact: original PSL, license declaration and stylesheet are unchanged',()=>{
  assert.equal(hash(PSL_SOURCE),'10b0901b594a2827d150bb1bac73cb86d9e79a9a1376bdf190bcc5d6f164900e');
  assert.equal(hash(read('core.mjs').match(/const PSL_LICENSE = .*;\n/)[0]),'656d0739f8cc4a4fd67b900f5a6a45852d07d94a73d0d2c51ca98a2c50f95750');
  assert.equal(hash(html.match(/<style>([\s\S]*?)<\/style>/)[1]),'c30d800c02539b597ef6ed42b78d20dc44f56d04daa1439ea315c0035dd91ddc');
});
test('artifact: no provisional source markers and small escaped source display',()=>{
  for(const file of ['index.html','core.mjs','cli.mjs','mcp/server.mjs']) assert.doesNotMatch(read(file),/\[source to verify\]/);
  assert.match(html,/class="source" style="overflow-wrap:anywhere"/);
  assert.match(html,/esc\(x.agency\)/);
  assert.match(html,/esc\(x.url\)/);
  assert.match(html,/\.tag \.source\{font-size:14px/);
  assert.match(html,/i===st.steps.length-1\?'Done, view summary':'Done, next'/);
});
test('guidance: password conditions and editorial order are explicit',()=>{
  const p=call('typed_password');
  assert.deepEqual(p.steps.map(x=>x.id),['bank-conditional','password','recovery','reused','protection','report']);
  assert.match(p.steps[0].condition,/Only if banking/);
  assert.match(p.steps[1].condition,/If you can sign in/);
  assert.match(p.steps[2].condition,/If you cannot sign in/);
  assert.match(p.steps[3].why,/immediately/);
  assert.ok(p.unknowns.some(x=>x.includes('editorial')));
  assert.ok(p.unknowns.some(x=>x.includes('combined order')));
  const noReuse=invokeTool('first_aid_plan',{did:'typed_password',account:'personal',reused:'no'});
  assert.ok(!noReuse.steps.some(x=>x.id==='reused'));
});
test('guidance: click-only does not mandate bank contact or antivirus',()=>{
  const p=call('clicked_only');
  assert.deepEqual(p.steps.map(x=>x.id),['alerts','close']);
  assert.match(p.steps[0].condition,/nothing was entered, downloaded, or installed/);
  assert.match(p.steps[1].condition,/Only if a fake warning/);
});
test('guidance: card contact precedes monitoring; refunds are conditional',()=>{
  const p=call('typed_card');
  assert.equal(p.steps[0].id,'bank');
  assert.match(p.steps[1].why,/same contact/);
  assert.match(p.steps.at(-1).condition,/Only if a fraudulent/);
  assert.match(p.steps.at(-1).why,/not guaranteed/);
});
test('guidance: identity documents do not select country-specific programs',()=>{
  const p=call('sent_id_photo');
  assert.match(p.steps[0].action,/differ by country/);
  assert.doesNotMatch(JSON.stringify(p),/IDCARE|JICC|\bCIC\b|\bKSC\b|IdentityTheft|credit-report ban/);
  assert.ok(p.unknowns.some(x=>x.includes('Country')));
});
test('guidance: installed-file response distinguishes access and unavailable scans',()=>{
  const p=call('installed_file');
  assert.deepEqual(p.steps.map(x=>x.id),['update','scan','remove','reset','technician']);
  assert.match(p.steps[0].condition,/If someone accessed/);
  assert.match(p.steps[1].condition,/If suitable antivirus/);
  assert.match(p.steps[4].why,/do not need to finish an unavailable scan/);
  assert.ok(p.unknowns.some(x=>x.includes('download-only')));
});
test('core: browser and Node share every categorical combination and preserve input',()=>{
  const context=vm.createContext({URL});
  vm.runInContext(html.match(/<script id="core">([\s\S]*?)<\/script>/)[1]+'\nglobalThis.invoke=invokeTool;',context);
  for(const did of TOOL_DEFINITIONS[0].inputSchema.properties.did.enum) for(const account of ['personal','school','work','not_sure']) for(const reused of ['yes','no','not_sure']) {
    const args={did,account,reused},saved=JSON.stringify(args);
    assert.deepEqual(JSON.parse(JSON.stringify(context.invoke('first_aid_plan',args))),invokeTool('first_aid_plan',args));
    assert.equal(JSON.stringify(args),saved);
  }
  assert.deepEqual(AfterClickCore('plan',make()),call('typed_password'));
  assert.deepEqual(AfterClickCore('plan',make({entry:'clicked',details:['nothing'],reuse:'na'})),call('clicked_only'));
});
test('state: sourced guidance supports skip, undo, reconcile, completion and summary',()=>{
  const answers=make(),p=AfterClickCore('plan',answers);
  let state=AfterClickCore('reconcile',{steps:p.steps});
  const initial=structuredClone(state);
  state=AfterClickCore('transition',{state,command:'skipped'});
  assert.equal(state.statuses['bank-conditional'],'skipped');
  state=AfterClickCore('transition',{state,command:'undo'});
  assert.deepEqual(state,initial);
  state=AfterClickCore('transition',{state,command:'done'});
  const fewer=AfterClickCore('plan',make({reuse:'no'}));
  state=AfterClickCore('reconcile',{previous:state,steps:fewer.steps});
  assert.equal(state.statuses['bank-conditional'],'done');
  assert.deepEqual(state.changes.removed,['Change reused passwords']);
  const bank=AfterClickCore('plan',make({details:['password','bank']}));
  const changed=AfterClickCore('reconcile',{previous:state,steps:bank.steps});
  assert.equal(changed.currentId,'bank');
  assert.ok(changed.changes.added.includes('Contact your bank now'));
  while(state.currentId) state=AfterClickCore('transition',{state,command:'done'});
  assert.ok(Object.values(state.statuses).every(x=>x==='done'));
  const summary=AfterClickCore('summary',{answers,state,unknowns:p.unknowns,demo:true});
  assert.match(summary,/FICTIONAL DEMO/);
  assert.match(summary,/does not confirm safety/);
});
// A small validator for the JSON Schema keywords used in our advertised schemas.
function accepts(schema,value) {
  if(schema.oneOf&&schema.oneOf.filter(s=>accepts(s,value)).length!==1) return false;
  if(Object.hasOwn(schema,'const')&&value!==schema.const) return false;
  if(schema.enum&&!schema.enum.includes(value)) return false;
  const type=Array.isArray(value)?'array':value===null?'null':typeof value;
  if(schema.type&&![schema.type].flat().some(t=>t===type||(t==='integer'&&Number.isInteger(value)))) return false;
  if(type==='object') {
    if(schema.required?.some(k=>!Object.hasOwn(value,k))) return false;
    if(schema.additionalProperties===false&&Object.keys(value).some(k=>!Object.hasOwn(schema.properties,k))) return false;
    if(Object.entries(schema.properties||{}).some(([k,s])=>Object.hasOwn(value,k)&&!accepts(s,value[k]))) return false;
  }
  if(type==='array'&&((schema.minItems&&value.length<schema.minItems)||(schema.maxItems&&value.length>schema.maxItems)||value.some(x=>!accepts(schema.items,x)))) return false;
  return true;
}
test('schemas: every scenario and analysis result meets its published output schema',()=>{
  for(const did of TOOL_DEFINITIONS[0].inputSchema.properties.did.enum) assert.ok(accepts(TOOL_DEFINITIONS[0].outputSchema,call(did)),did);
  for(const text of ['https://bank.example','https://[broken','https://demo:fake@127.0.0.1:8888/path','http://delivery.example.parcel-check.test','www.example.test']) assert.ok(accepts(TOOL_DEFINITIONS[1].outputSchema,invokeTool('dissect_links',{text})),text);
  for(const tool of TOOL_DEFINITIONS) assert.ok(accepts(tool.outputSchema,{error:{code:'INVALID_INPUT',message:'Invalid input.'}}));
});
test('runtime: no network modules or APIs; pure core has no platform imports or DOM access',()=>{
  const source=read('core.mjs').replace(/const PSL_(?:SOURCE|LICENSE) = .*;\n/g,'');
  const codeOnly=source.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g,'""');
  assert.doesNotMatch(codeOnly,/^\s*import\b|\b(?:document|window|process)\s*[.\[]/m);
  for(const file of ['core.mjs','cli.mjs','mcp/server.mjs']) {
    const code=read(file).replace(/const PSL_(?:SOURCE|LICENSE) = .*;\n/g,'');
    assert.doesNotMatch(code,/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\b|node:(?:http|https|net|tls|dns|child_process)/);
  }
});
test('MCP: oversized frames and truncated EOF produce bounded protocol errors',()=>{
  const input='x'.repeat(140000)+'\n'+JSON.stringify({jsonrpc:'2.0',id:7,method:'ping'})+'\n'+JSON.stringify({jsonrpc:'2.0',id:8,method:'ping'});
  const p=spawnSync(process.execPath,['mcp/server.mjs'],{cwd:root,input,encoding:'utf8',timeout:5000});
  assert.equal(p.status,0,p.stderr);
  const responses=p.stdout.trim().split('\n').map(x=>JSON.parse(x));
  assert.equal(responses.length,3);
  assert.equal(responses[0].error.code,-32600);
  assert.deepEqual(responses[1],{jsonrpc:'2.0',id:7,result:{}});
  assert.equal(responses[2].error.code,-32700);
});
test('MCP: responds on a live pipe with split UTF-8 frames before EOF',async(t)=>{
  const child=spawn(process.execPath,['mcp/server.mjs'],{cwd:root,stdio:['pipe','pipe','pipe']});
  t.after(()=>child.kill());
  let pending='',queue=[],waiters=[];
  child.stdout.setEncoding('utf8');
  child.stdout.on('data',chunk=>{
    pending+=chunk;
    while(pending.includes('\n')) {
      const end=pending.indexOf('\n'),value=JSON.parse(pending.slice(0,end));pending=pending.slice(end+1);
      if(waiters.length)waiters.shift()(value);else queue.push(value);
    }
  });
  const next=()=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('No live MCP response')),3000);
    const done=value=>{clearTimeout(timer);resolve(value);};
    if(queue.length)done(queue.shift());else waiters.push(done);
  });
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'test',version:'1'}}})+'\n');
  assert.equal((await next()).id,1);
  child.stdin.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
  const bytes=Buffer.from(JSON.stringify({jsonrpc:'2.0',id:'日本語',method:'tools/call',params:{name:'dissect_links',arguments:{text:'Fictional https://bank.example'}}})+'\n');
  for(const byte of bytes)child.stdin.write(Buffer.from([byte]));
  const response=await next();
  assert.equal(response.id,'日本語');
  assert.equal(response.result.isError,false);
  child.stdin.end();
  const [code]=await once(child,'close');
  assert.equal(code,0);
});
