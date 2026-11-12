#!/usr/bin/env node
// Local stdio MCP subset: initialization, ping, tools/list, tools/call.
// No dependencies, network, persistence, subscriptions, or server-initiated requests.
import { once } from 'node:events';
import { TOOL_DEFINITIONS, invokeTool, CoreInputError } from '../core.mjs';
const VERSION='2025-11-25';
const MAX_LINE=131072;
let phase='new';
const object=value=>value!==null && typeof value==='object' && !Array.isArray(value);
const rpcError=(id,code,message)=>({jsonrpc:'2.0',id,error:{code,message}});
const result=(id,value)=>({jsonrpc:'2.0',id,result:value});
function handle(line) {
  let message;
  try { message=JSON.parse(line); } catch { return rpcError(null,-32700,'Parse error.'); }
  if(!object(message)||message.jsonrpc!=='2.0'||typeof message.method!=='string'||
      (Object.hasOwn(message,'id')&&typeof message.id!=='string'&&!(typeof message.id==='number'&&Number.isInteger(message.id)))) return rpcError(null,-32600,'Invalid request.');
  const {id,method,params}=message;
  if(!Object.hasOwn(message,'id')) {
    if(method==='notifications/initialized' && phase==='negotiated') phase='ready';
    return null;
  }
  if(params!==undefined&&!object(params)) return rpcError(id,-32602,'Parameters must be an object.');
  if(method==='ping') return result(id,{});
  if(method==='initialize') {
    if(phase!=='new') return rpcError(id,-32600,'Already initialized.');
    if(!params||typeof params.protocolVersion!=='string'||!object(params.capabilities)||!object(params.clientInfo)||typeof params.clientInfo.name!=='string'||typeof params.clientInfo.version!=='string') return rpcError(id,-32602,'Invalid initialization parameters.');
    phase='negotiated';
    return result(id,{protocolVersion:VERSION,capabilities:{tools:{}},serverInfo:{name:'after-the-click',version:'1.0.0'}});
  }
  if(phase!=='ready') return rpcError(id,-32600,'Initialize the session before using tools.');
  if(method==='tools/list') {
    if(params&&Object.keys(params).some(key=>key!=='_meta')) return rpcError(id,-32602,'This server does not paginate tools.');
    return result(id,{tools:TOOL_DEFINITIONS});
  }
  if(method==='tools/call') {
    if(!params||!TOOL_DEFINITIONS.some(x=>x.name===params.name)) return rpcError(id,-32602,'Unknown or missing tool name.');
    try {
      const value=invokeTool(params.name,params.arguments);
      return result(id,{content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value,isError:false});
    } catch(error) {
      const value={error:{code:error instanceof CoreInputError?'INVALID_INPUT':'INTERNAL_ERROR',message:error instanceof CoreInputError?error.message:'The operation could not be completed.'}};
      return result(id,{content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value,isError:true});
    }
  }
  return rpcError(id,-32601,'Method not found.');
}
async function emit(message) {
  if(message&&!process.stdout.write(JSON.stringify(message)+'\n')) await once(process.stdout,'drain');
}
process.stdout.on('error',()=>process.exit(1));
process.stdin.setEncoding('utf8');
let pending='',discarding=false;
try {
  for await(const chunk of process.stdin) {
    let offset=0;
    while(offset<chunk.length) {
      const newline=chunk.indexOf('\n',offset);
      const end=newline===-1?chunk.length:newline;
      if(!discarding) {
        if(pending.length+end-offset>MAX_LINE) {
          pending='';discarding=true;
          await emit(rpcError(null,-32600,'Message exceeds the 131,072-character transport limit.'));
        } else pending+=chunk.slice(offset,end);
      }
      if(newline!==-1) {
        if(!discarding) await emit(handle(pending));
        pending='';discarding=false;
      }
      offset=end+1;
    }
  }
  if(pending&&!discarding) await emit(rpcError(null,-32700,'Incomplete message: expected a newline before end of input.'));
} catch {
  // No input contents or stack traces are logged.
  process.exitCode=1;
}
