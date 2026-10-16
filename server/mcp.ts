import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { z } from 'zod';

const root=process.env.LABFLOW_PROJECT_DIR || resolve(dirname(fileURLToPath(import.meta.url)),'..');
const base=process.env.LABFLOW_URL || 'http://127.0.0.1:4317';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw new Error('LabFlow MCP only connects to the local application');
async function request(path:string,body?:unknown,method?:string) {
  const token=(await readFile(resolve(root,process.env.LABFLOW_DATA_DIR || '.labflow','control-token'),'utf8')).trim();
  const result=await fetch(base+'/api'+path,{method:method||(body===undefined?'GET':'POST'),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await result.json();if(!result.ok)throw new Error(data.error||'Local app unavailable');return data;
}
const wrap=(fn:(args:any)=>Promise<unknown>)=>async(args:any)=>{try{return{content:[{type:'text' as const,text:JSON.stringify(await fn(args))}]};}catch(e){return{isError:true,content:[{type:'text' as const,text:(e as Error).message}]};}};
const server=new McpServer({name:'labflow',version:'0.2.1'});
server.tool('get_learning_context','Read the latest exercise, submitted draft, help level and progress. Contains no reference answers.',{caseId:z.enum(['wb','jtc'])},wrap(({caseId})=>request('/context/'+caseId)));
server.tool('get_reference','Read reference material for private evaluation or requested learning explanations. Do not expose hidden answers during recall practice.',{caseId:z.enum(['wb','jtc'])},wrap(({caseId})=>request('/cases/'+caseId)));
server.tool('check_current_answer','Check the saved draft using local rules, then the configured model for unresolved semantics. Returns a job ID and an explicit source; no automatic hints.',{taskId:z.string()},wrap(async({taskId})=>{const task=await request('/tasks/'+encodeURIComponent(taskId));return request('/tasks/'+encodeURIComponent(taskId)+'/check',task.initial);}));
server.tool('get_check_result','Read check status and public verdict. Does not reveal private diagnostics.',{jobId:z.string()},wrap(({jobId})=>request('/jobs/'+encodeURIComponent(jobId))));
server.tool('request_hint','Use only when the learner explicitly requests help. Level 1 broad direction, 2 specific diagnosis, 3 complete answer only explicitly requested.',{taskId:z.string(),level:z.number().int().min(1).max(3)},wrap(({taskId,level})=>request('/tasks/'+encodeURIComponent(taskId)+'/hint',{level})));
server.tool('save_note','Save a learner-requested personal note without changing reference answers.',{caseId:z.enum(['wb','jtc']),nodeId:z.string(),text:z.string().max(12000)},wrap(({caseId,nodeId,text})=>request('/notes/'+caseId+'/'+encodeURIComponent(nodeId),{text},'PUT')));
server.tool('upload_image','Store a learner-provided PNG/JPEG/WebP data URL locally. Returns an opaque media ID for an attachment proposal.',{data:z.string().max(8_000_000)},wrap(({data})=>request('/media',{data})));
server.tool('propose_refinement','Propose a sourced reference change or image attachment. The learner reviews and accepts it in the webpage; this tool does not apply it.',{caseId:z.enum(['wb','jtc']),nodeId:z.string(),revision:z.number().int(),reason:z.string().min(1),patch:z.object({title:z.string().optional(),summary:z.string().optional(),why:z.string().optional(),check:z.string().optional(),media:z.array(z.string()).optional()})},wrap(args=>request('/proposals',args)));
await server.connect(new StdioServerTransport());
