#!/usr/bin/env node
import { open } from 'node:fs/promises';
import { invokeTool, CoreInputError } from './core.mjs';

const HELP = `After the Click (offline, fictional/redacted input only)
node cli.mjs plan --did <typed_password|typed_card|sent_id_photo|installed_file|clicked_only> --account <personal|school|work|not_sure> --reused <yes|no|not_sure> [--json]
node cli.mjs dissect --text <file|-> [--json]
Exit codes: 0 success, 2 invalid input, 3 input I/O failure, 1 internal failure.
The reused answer applies only to typed_password. Unknown is not a safety verdict.`;

async function readText(path) {
  let handle;
  try {
    if(path !== '-') {
      handle = await open(path, 'r');
      if(!(await handle.stat()).isFile()) throw new Error('Not a regular file');
    }
    const input = handle ? handle.createReadStream({autoClose:false}) : process.stdin;
    input.setEncoding('utf8');
    let text='';
    for await (const chunk of input) {
      text+=chunk;
      if(text.length>12000) throw new CoreInputError('Text exceeds the 12,000-character limit.');
    }
    return text;
  } catch(error) {
    if(error instanceof CoreInputError) throw error;
    const safe=new Error('Could not read the input text.'); safe.code='INPUT_IO'; throw safe;
  } finally { if(handle) await handle.close(); }
}

try {
  const args=process.argv.slice(2);
  if(args.length===1 && ['--help','-h'].includes(args[0])) console.log(HELP);
  else {
    const command=args.shift(), options={};
    if(!['plan','dissect'].includes(command)) throw new CoreInputError('Choose plan or dissect; see --help.');
    const allowed=command==='plan'?['did','account','reused']:['text'];
    let json=false;
    while(args.length) {
      const arg=args.shift();
      if(arg==='--json' && !json) {json=true;continue;}
      const key=arg.startsWith('--')?arg.slice(2):'';
      if(!allowed.includes(key)||Object.hasOwn(options,key)||!args.length||args[0].startsWith('--')) throw new CoreInputError('Invalid, missing, or repeated option.');
      options[key]=args.shift();
    }
    if(allowed.some(key=>!Object.hasOwn(options,key))) throw new CoreInputError('Missing required options.');
    const result=command==='plan'?invokeTool('first_aid_plan',options):invokeTool('dissect_links',{text:await readText(options.text)});
    if(json) console.log(JSON.stringify(result));
    else if(command==='plan') console.log([result.status,...result.steps.map((s,i)=>`${i+1}. ${s.title}\n   ${s.condition}\n   ${s.action}\n   ${s.why}\n   ${s.source}`),'',...result.unknowns].join('\n'));
    else console.log(JSON.stringify(result,null,2));
  }
} catch(error) {
  const code=error instanceof CoreInputError?'INVALID_INPUT':error.code==='INPUT_IO'?'INPUT_IO':'INTERNAL_ERROR';
  console.log(JSON.stringify({error:{code,message:code==='INTERNAL_ERROR'?'The operation could not be completed.':error.message}}));
  process.exitCode=code==='INVALID_INPUT'?2:code==='INPUT_IO'?3:1;
}
