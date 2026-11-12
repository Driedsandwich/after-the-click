/* Run with: node --test tests/core.test.cjs (Node 18+; no packages). */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const html = fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const context = vm.createContext({URL});
vm.runInContext(source+'\nglobalThis.core=AfterClickCore; globalThis.psl=PSL_SOURCE;',context);
const core = (op,input) => JSON.parse(JSON.stringify(context.core(op,input)));
const defaults = {entry:'typed',details:['password'],accounts:['personal'],reuse:'yes',locked:false};
const answer = overrides => ({...defaults,...overrides});
const plan = overrides => core('plan',answer(overrides));
const stateOf = p => core('reconcile',{steps:p.steps});
const change = (state,command,id) => core('transition',{state,command,id});
const check = (text,dismissed=[]) => core('analyze',{text,dismissed});

test('normal: fake password demo has exactly the six ordered steps',()=>{
  const p=plan();assert.equal(p.ok,true);
  assert.deepEqual(p.steps.map(x=>x.id),['close','password','sessions','reused','protection','review']);
  assert.ok(p.steps.every(x=>x.action&&x.why&&x.source==='[source to verify]'));
  let state=stateOf(p);const seen=[];
  while(state.currentId){seen.push(state.currentId);state=change(state,'done');}
  assert.deepEqual(seen,p.steps.map(x=>x.id));
  assert.ok(Object.values(state.statuses).every(x=>x==='done'));
  const summary=core('summary',{answers:answer(),state,unknowns:p.unknowns,demo:true});
  assert.match(summary,/FICTIONAL DEMO/);assert.match(summary,/Device infection.*Unknown/);
  assert.equal((summary.match(/^DONE —/gm)||[]).length,6);
});
test('normal: second screen matches the selected desktop/mobile reference',()=>{
  const state=change(stateOf(plan()),'done');assert.equal(state.currentId,'password');assert.equal(state.statuses.close,'done');
  assert.equal(state.steps.find(x=>x.id===state.currentId).title,'Change the exposed password');
});
test('normal: skip, undo, reopen, and incomplete summaries are distinct',()=>{
  const p=plan(),initial=stateOf(p),skipped=change(initial,'skipped');
  assert.equal(initial.statuses.close,'pending');assert.equal(skipped.statuses.close,'skipped');
  const text=core('summary',{answers:answer(),state:skipped,unknowns:p.unknowns});
  assert.match(text,/SKIPPED — not completed — Close/);assert.match(text,/PENDING — Change/);
  assert.deepEqual(change(skipped,'undo').statuses,initial.statuses);
  const reopened=change(skipped,'reopen','close');assert.equal(reopened.currentId,'close');assert.equal(reopened.statuses.close,'pending');
  assert.equal(change(reopened,'undo').statuses.close,'skipped');
});
test('normal: bank, IT, code, and recovery precede password changes',()=>{
  const p=plan({details:['password','bank','code'],accounts:['school','work'],locked:true});
  assert.deepEqual(p.steps.slice(0,6).map(x=>x.id),['close','bank','it','code','recovery','password']);
  assert.match(p.steps[1].action,/number on your card/);assert.match(p.steps[2].action,/known school or work/);
});
test('normal: click-only and personal-info branches have applicable actions',()=>{
  const p=plan({entry:'clicked',details:['nothing'],reuse:'na'});
  assert.deepEqual(p.steps.map(x=>x.id),['close','device','review']);
  assert.match(p.steps[1].why,/cannot detect infection/);
  const p2=plan({details:['personal_info'],reuse:'na'});
  assert.ok(p2.steps.some(s=>s.id==='personal'));assert.ok(!p2.steps.some(s=>s.id==='password'));
});
test('normal: changed answers preserve only identical meanings and current step',()=>{
  let previous=change(change(stateOf(plan()),'done'),'done'); // current: sessions
  const next=core('reconcile',{previous,steps:plan({reuse:'no'}).steps});
  assert.equal(next.statuses.close,'done');assert.equal(next.statuses.password,'done');assert.equal(next.currentId,'sessions');
  assert.deepEqual(next.changes.removed,['Change reused passwords']);assert.equal(next.history.length,0);
  const scoped=core('reconcile',{previous,steps:plan({accounts:['work']}).steps});
  assert.equal(scoped.statuses.close,'done');assert.equal(scoped.statuses.password,'pending');
  assert.equal(scoped.currentId,'it');
  assert.ok(scoped.changes.reset.includes('Change password'));assert.ok(scoped.changes.added.includes('Contact your IT desk'));
});
test('normal: multiple URLs, user-info, ports, and demo domain are separated',()=>{
  const a=check('https://delivery.example.parcel-check.test/confirm https://name:secret'+String.fromCharCode(64)+'bank.example:8443/path?token=SECRET');
  assert.equal(a.status,'Strong caution');assert.equal(a.items.length,2);
  assert.equal(a.items[0].domain,'parcel-check.test');assert.equal(a.items[0].demo,true);
  assert.equal(a.items[1].host,'bank.example');assert.equal(a.items[1].port,'8443');
  assert.ok(a.items[1].flags.some(f=>f.code==='userinfo'));
  assert.doesNotMatch(JSON.stringify(a),/secret|SECRET|\/confirm|\/path/);
});
test('normal: bundled PSL handles multi-label, private, wildcard and exception rules',()=>{
  const cases=[['https://a.b.co.uk','b.co.uk'],['https://a.foo.github.io','foo.github.io'],['https://a.b.ck','a.b.ck'],['https://a.www.ck','www.ck'],['https://a.city.kawasaki.jp','city.kawasaki.jp'],['https://a.b.kawasaki.jp','a.b.kawasaki.jp']];
  for(const [url,domain] of cases)assert.equal(check(url).items[0].domain,domain,url);
});
test('normal: IP addresses, alternate IPv4 form, IPv6 and IDN receive evidence',()=>{
  for(const url of ['https://127.0.0.1/a','https://2130706433/a','https://[2001:db8::1]:443/a']){
    const a=check(url);assert.equal(a.status,'Strong caution');assert.equal(a.items[0].domain,null);assert.ok(a.items[0].flags.some(f=>f.code==='ip'));
  }
  const a=check('https://раypal.com');assert.ok(a.items[0].host.includes('xn--'));assert.ok(a.items[0].flags.some(f=>f.code==='idn'));
});
test('ambiguous: unknown answers remain Unknown and prioritize clarification',()=>{
  const p=plan({details:['unknown'],accounts:['unknown'],reuse:'na'});
  assert.equal(p.ok,true);assert.equal(p.status,'Unknown');
  assert.deepEqual(p.steps.map(x=>x.id),['close','clarify','device','review']);
  assert.ok(p.unknowns.some(x=>x.includes('Details shared')));
  const reused=plan({reuse:'unknown'});assert.ok(reused.steps.some(x=>x.id==='reused'));assert.ok(reused.unknowns.some(x=>x.includes('Password reuse')));
});
test('ambiguous: no flags is never a safe verdict; short links remain Unknown',()=>{
  assert.equal(check('https://example.com').status,'No flags found — not a safety verdict');
  assert.equal(check('https://bit.ly/fictional').status,'Unknown');
  assert.equal(check('https://unknown.notarealsuffix').status,'Unknown');
  assert.equal(check('https://co.uk').status,'Unknown');
  assert.equal(check('www.example.com').status,'Unknown');
  assert.equal(check('example.com').status,'Unknown');
});
test('ambiguous: a warning can be dismissed and restored without granting safety',()=>{
  const text='https://delivery.example.parcel-check.test/confirm',a=check(text),id=a.items[0].flags[0].id;
  const dismissed=check(text,[id]);assert.equal(dismissed.status,'Unknown');assert.deepEqual(dismissed.items[0].flags,a.items[0].flags);
  assert.equal(check(text).status,'Strong caution');
});
test('ambiguous: message size and URL count caps cannot produce a no-flags claim',()=>{
  assert.equal(check('a'.repeat(12001)).status,'Unknown');
  const many=check(Array.from({length:11},(_,i)=>'https://example.com/'+i).join(' '));
  assert.equal(many.items.length,10);assert.equal(many.status,'Unknown');assert.match(many.notes[0],/first 10/);
});
test('failure: malformed, unsupported, and ambiguous URL syntax is Unknown',()=>{
  for(const value of ['',null,42,'https://[broken','https://example.com:99999','ftp://example.com/file','javascript:alert(1)','https://exam_ple.com','https://example.com\\@evil.com','https://exa\u202emple.com']) {
    assert.equal(check(value).status,'Unknown',String(value));
  }
  assert.equal(check('https://example.com and https://').status,'Unknown');
});
test('failure: inconsistent or corrupt answers cannot create a reassuring plan',()=>{
  for(const a of [null,{},answer({details:{}}),answer({accounts:42}),answer({details:['password','nothing']}),answer({details:['unknown','bank']}),answer({accounts:['work','unknown']}),answer({details:['secret']}),answer({details:['password','password']}),answer({reuse:'na'}),answer({details:['nothing'],reuse:'yes'}),answer({locked:undefined})]){
    const p=core('plan',a);assert.equal(p.ok,false);assert.equal(p.status,'Unknown');assert.equal(p.steps.length,0);
  }
  assert.equal(core('unsupported').status,'Unknown');
});
test('failure: unrecognized transition cannot mark a step done',()=>{
  const s=stateOf(plan());assert.deepEqual(change(s,'done','nonexistent'),s);assert.deepEqual(change(s,'invented'),s);assert.deepEqual(change(s,'undo'),s);
});
test('normal: summary is categorical, contains uncertainty, and excludes extra input',()=>{
  const p=plan(),a={...answer(),password:'DO_NOT_COPY',message:'private message',url:'https://example.com/?token=SECRET'};
  const text=core('summary',{answers:a,state:stateOf(p),unknowns:p.unknowns,audience:'bank'});
  assert.match(text,/Prepared for: My bank/);assert.match(text,/Password reused: Yes/);
  assert.match(text,/PENDING/);assert.match(text,/Unknown/);assert.doesNotMatch(text,/DO_NOT_COPY|private message|SECRET/);
});
test('normal: determinism and no mutation of inputs across the whole demo',()=>{
  const a=answer(),before=JSON.stringify(a);assert.deepEqual(core('plan',a),core('plan',a));assert.equal(JSON.stringify(a),before);
  const p=plan(),s=stateOf(p),saved=JSON.stringify(s);change(s,'done');assert.equal(JSON.stringify(s),saved);
});
test('artifact: inline scripts parse; PSL matches local source snapshot',()=>{
  const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,2);
  scripts.forEach((s,i)=>assert.doesNotThrow(()=>new vm.Script(s[1],{filename:'inline-'+i+'.js'})));
  assert.equal(crypto.createHash('sha256').update(context.psl).digest('hex'),'10b0901b594a2827d150bb1bac73cb86d9e79a9a1376bdf190bcc5d6f164900e');
  assert.ok(context.psl.includes('===BEGIN PRIVATE DOMAINS==='));
});
test('artifact: no resource loads, navigation targets, storage, or network APIs in app code',()=>{
  const ui=html.match(/<script id="ui">([\s\S]*?)<\/script>/)[1];
  const noPSL=html.replace(/const PSL_SOURCE = .*;\n/,'').replace(/const PSL_LICENSE = .*;\n/,'');
  assert.doesNotMatch(noPSL,/<(?:script|link|img|iframe|audio|video)[^>]+(?:src|href)\s*=/i);
  assert.doesNotMatch(noPSL,/(?:fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie|window\.open|location\.href\s*=)/);
  const css=html.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert.doesNotMatch(css,/(?:@import|url\s*\()/i);
  assert.doesNotMatch(ui,/console\./);
  assert.match(html,/connect-src 'none'/);assert.match(html,/form-action 'none'/);
  assert.match(html,/Nothing leaves your device\. No sign-up\. No cost\./);
  assert.match(html,/This is a first-aid checklist, not a replacement for your bank, school IT desk, or the police\./);
});
test('artifact: specified text colors meet WCAG AA normal-text contrast',()=>{
  const linear=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;};
  const luminance=hex=>{const rgb=hex.match(/\w\w/g).map(x=>linear(parseInt(x,16)));return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};
  for(const ink of ['252A31','59616D','2457D6'])for(const bg of ['FFFFFF','F3F4F6'])assert.ok((luminance(bg)+.05)/(luminance(ink)+.05)>=4.5,ink+' on '+bg);
});
