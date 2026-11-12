/* Minimal DOM boundary doubles. This tests app event wiring, NOT browser layout,
   native focus/clipboard permissions, an accessibility tree, or real DOM parsing. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
const decode=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');

function harness(clipboard){
  let root;
  class Element{
    constructor(tag='div',attrs={}){this.tag=tag;Object.assign(this,attrs);this.children=[];this.listeners={};this.textContent='';this.value=this.value||'';this._html='';}
    set innerHTML(value){
      this._html=value;this.children=[];
      for(const m of value.matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>/gi)){
        const attrs={};for(const a of m[2].matchAll(/([a-z][a-z0-9-]*)="([^"]*)"/gi))attrs[a[1]]=decode(a[2]);
        attrs.checked=/\bchecked\b/.test(m[2]);
        const node=new Element(m[1],attrs);
        if(m[1]==='textarea'){const remaining=value.slice(m.index+m[0].length);node.value=decode(remaining.slice(0,remaining.indexOf('</textarea>')));}
        this.children.push(node);
      }
    }
    get innerHTML(){return this._html;}
    all(){return this.children.flatMap(x=>[x,...x.all()]);}
    querySelectorAll(selector){
      return root.all().filter(x=>{
        if(selector.startsWith('#'))return x.id===selector.slice(1);
        const m=selector.match(/^\[name=["']?([a-z]+)["']?\](:checked)?$/);
        if(m)return x.name===m[1]&&(!m[2]||x.checked);
        const data=selector.match(/^\[data-value="([^"]+)"\]$/);
        if(data)return x['data-value']===data[1];
        return x.tag===selector;
      });
    }
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    addEventListener(type,fn){this.listeners[type]=fn;}
    setAttribute(name,value){this[name]=value;}
    focus(){this.focused=true;}
    select(){this.selected=true;}
  }
  root=new Element('main',{id:'main'});const live=new Element(),demo=new Element('button');
  const context=vm.createContext({URL,structuredClone,navigator:{clipboard},document:{getElementById:id=>({main:root,live,demo}[id])}});
  scripts.forEach(script=>vm.runInContext(script,context));
  const evaluate=s=>vm.runInContext(s,context);
  const click=(action,value)=>root.listeners.click({target:{closest:()=>({dataset:{action,value}})}});
  const select=(name,value)=>{
    const node=root.querySelectorAll('[name='+name+']').find(x=>x.value===value);
    assert.ok(node,'Expected input '+name+': '+value);node.checked=true;
    if(name==='reuse')root.querySelectorAll('[name=reuse]').forEach(x=>{if(x!==node)x.checked=false;});
    root.listeners.change({target:node});
  };
  const submit=()=>root.listeners.submit({preventDefault(){},target:{id:'questions'}});
  return {root,live,demo,evaluate,click,select,submit};
}

test('UI wiring: initial choices and one-button demo traverse all six screens to summary',()=>{
  const h=harness();assert.match(h.root.innerHTML,/I haven’t clicked yet/);assert.match(h.root.innerHTML,/I clicked the link/);assert.match(h.root.innerHTML,/I typed in my details/);
  h.demo.listeners.click();assert.match(h.root.innerHTML,/Step 1 of 6/);
  h.click('done');assert.match(h.root.innerHTML,/Step 2 of 6/);assert.match(h.root.innerHTML,/Change the exposed password/);
  for(let i=0;i<5;i++)h.click('done');
  assert.equal(h.evaluate('app.screen'),'summary');assert.match(h.root.innerHTML,/0 pending · 0 skipped/);
  assert.match(h.root.querySelector('#summary-text').value,/FICTIONAL DEMO/);
});
test('UI wiring: three questions validate, enforce exclusive choices, and create a plan',()=>{
  const h=harness();h.click('choose','clicked');h.submit();assert.match(h.root.querySelector('#form-error').textContent,/Choose valid/);
  h.select('details','bank');h.select('details','nothing');assert.equal(h.evaluate('app.draft.details.join()'),'nothing');
  h.select('details','password');assert.equal(h.evaluate('app.draft.details.join()'),'password');
  h.select('accounts','unknown');h.select('accounts','school');assert.equal(h.evaluate('app.draft.accounts.join()'),'school');
  h.select('reuse','yes');h.submit();assert.equal(h.evaluate('app.screen'),'plan');
  assert.equal(h.evaluate('app.state.steps[1].id'),'password');
  assert.equal(h.evaluate('app.state.steps.map(x=>x.id).join()'),'bank-conditional,password,recovery,reused,protection,report');
});
test('UI wiring: skip/undo, answer edit/cancel, and new bank priority preserve relevant progress',()=>{
  const h=harness();h.demo.listeners.click();h.click('skip');assert.match(h.root.innerHTML,/was skipped, not completed/);
  h.click('undo');assert.equal(h.evaluate('app.state.currentId'),'bank-conditional');h.click('done');h.click('done');
  h.click('edit');h.select('details','bank');h.click('cancel-answers');assert.equal(h.evaluate('app.answers.details.join()'),'password');
  h.click('edit');h.select('details','bank');h.submit();
  assert.equal(h.evaluate('app.state.currentId'),'bank');assert.equal(h.evaluate('app.state.statuses.password'),'done');
  assert.match(h.root.innerHTML,/4 added; 1 removed; 0 reset because their context changed/);assert.match(h.root.innerHTML,/Now showing: Contact your bank/);
});
test('UI wiring: unchecked password switches reuse to Not applicable',()=>{
  const h=harness();h.click('choose','typed');h.select('details','password');h.select('reuse','yes');h.select('details','nothing');
  assert.equal(h.evaluate('app.draft.reuse'),'na');h.select('accounts','personal');h.submit();
  assert.equal(h.evaluate('app.screen'),'plan');assert.equal(h.evaluate('app.state.steps.some(x=>x.id==="password")'),false);
});
test('UI wiring: checker sample, dismissal, and restoration retain explanations',()=>{
  const h=harness();h.click('choose','notclicked');h.click('example-message');
  assert.match(h.root.querySelector('#check-results').innerHTML,/parcel-check.test/);
  const id=h.evaluate('app.analysis.items[0].flags[0].id');h.click('dismiss',id);
  assert.equal(h.evaluate('app.analysis.status'),'Unknown');assert.match(h.root.querySelector('#check-results').innerHTML,/Dismissed by you/);
  h.click('dismiss',id);assert.equal(h.evaluate('app.analysis.status'),'Strong caution');
});
test('UI wiring: pasted markup is escaped, changed text invalidates old results, clear removes state',()=>{
  const h=harness();h.click('choose','notclicked');
  h.evaluate('app.message="</textarea><img src=x onerror=alert(1)> https://example.com"; renderChecker();');
  assert.doesNotMatch(h.root.innerHTML,/<img src=x/);assert.match(h.root.innerHTML,/&lt;img src=x/);
  h.click('check');assert.ok(h.evaluate('app.analysis'));
  const field=h.root.querySelector('#message');field.value='new message';h.root.listeners.input({target:field});assert.equal(h.evaluate('app.analysis'),null);
  h.click('clear');assert.equal(h.evaluate('app.message'),'');assert.equal(h.evaluate('app.state'),null);assert.match(h.live.textContent,/Session cleared/);
});
test('UI wiring: unavailable or rejected clipboard selects text; successful copy reports only copying',async()=>{
  for(const clipboard of [undefined,{writeText:async()=>{throw Error('Denied');}}]){
    const h=harness(clipboard);h.demo.listeners.click();h.click('summary');await h.evaluate('copySummary()');
    assert.equal(h.root.querySelector('#summary-text').selected,true);assert.match(h.root.querySelector('#copy-status').textContent,/Automatic copy is unavailable/);
  }
  let copied='';const h=harness({writeText:async text=>{copied=text;}});h.demo.listeners.click();h.click('summary');await h.evaluate('copySummary()');
  assert.match(copied,/FIRST-AID SUMMARY/);assert.match(h.root.querySelector('#copy-status').textContent,/Nothing was sent/);
});
