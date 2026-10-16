import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const directory=await mkdtemp(join(tmpdir(),'labflow-api-'));
const port=45000+Math.floor(Math.random()*10000), base=`http://127.0.0.1:${port}`;
const env={...process.env,PORT:String(port),LABFLOW_DATA_DIR:directory,LABFLOW_URL:base,CODEX_BIN:resolve('tests/harness-fixture.mjs')};
const server=spawn(process.execPath,['--import','tsx','server/index.ts','--production'],{env,stdio:['ignore','pipe','pipe']});
let logs='';server.stderr.on('data',chunk=>logs+=chunk);
const client=new Client({name:'labflow-smoke',version:'1.0.0'});
async function api(path:string,body?:unknown,method?:string){
  const response=await fetch(base+'/api'+path,{method:method||(body===undefined?'GET':'POST'),headers:{Origin:base,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  assert.equal(response.ok,true,await response.clone().text());return response.json();
}
async function tool(name:string,args:Record<string,unknown>){
  const result=await client.callTool({name,arguments:args});assert.ok(!result.isError,JSON.stringify(result));
  return JSON.parse((result.content as {text:string}[])[0].text);
}
try {
  for(let attempt=0;attempt<50;attempt++) {
    try{if((await fetch(base+'/api/cases')).ok)break;}catch{}
    if(attempt===49)throw new Error('Test server did not start: '+logs);
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.equal((await api('/cases')).length,2);
  const status=await api('/agent');assert.equal(status.available,true);assert.equal(status.backend,'codex');
  assert.equal((await api('/agent/models'))[0].model,'test-fixture');
  assert.equal((await api('/agent/settings',{model:'test-fixture'},'PUT')).model,'test-fixture');
  assert.equal((await fetch(base+'/api/tasks',{method:'POST',headers:{Origin:'https://other.example','Content-Type':'application/json'},body:'{}'})).status,403);
  const task=await api('/tasks',{caseId:'wb',level:'order'});
  const graph=task.initial;graph.nodes[0].label='草稿恢复测试';
  graph.edges=[{id:'xy-edge__'+graph.nodes[0].id+'-'+graph.nodes[1].id,source:graph.nodes[0].id,target:graph.nodes[1].id,sourceHandle:'right',targetHandle:'left'}];
  assert.ok(graph.edges[0].id.length>80);
  await api('/tasks/'+task.id+'/draft',graph,'PUT');
  assert.deepEqual((await api('/tasks/'+task.id)).initial,graph);
  const transport=new StdioClientTransport({command:process.execPath,args:['server.mjs'],cwd:resolve('plugin'),env:Object.fromEntries(Object.entries(env).filter((entry):entry is [string,string]=>typeof entry[1]==='string'))});
  await client.connect(transport);
  const names=(await client.listTools()).tools.map(tool=>tool.name);
  assert.equal(names.length,8);
  const context=await tool('get_learning_context',{caseId:'wb'});
  assert.equal(context.latestTask.id,task.id);assert.equal(context.latestTask.reference,undefined);
  assert.equal(context.latestTask.initial.edges[0].sourceHandle,'right');
  assert.equal(context.latestTask.initial.edges[0].targetHandle,'left');
  const hint=await tool('request_hint',{taskId:task.id,level:1});assert.equal(hint.assisted,true);
  assert.equal((await api('/tasks',{caseId:'wb',level:'detail'})).assisted,true);
  await tool('save_note',{caseId:'wb',nodeId:'wb-block',text:'MCP test note'});
  assert.equal((await api('/notes/wb/wb-block')).text,'MCP test note');
  const reference=await tool('get_reference',{caseId:'wb'});
  const proposal=await tool('propose_refinement',{caseId:'wb',nodeId:'wb-block',revision:reference.revision,reason:'Integration test',patch:{summary:'Revised locally'}});
  assert.equal((await api('/cases/wb')).revision,reference.revision);
  assert.equal((await api('/proposals/'+proposal.id+'/accept',{})).revision,reference.revision+1);
  assert.equal((await api('/tasks/'+task.id)).revision,reference.revision);
  const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const media=await tool('upload_image',{data:pixel});assert.equal((await fetch(base+'/api/media/'+media.id)).headers.get('content-type'),'image/png');
  const exercise=await api('/tasks',{caseId:'jtc',level:'anomaly'});
  const submitted={nodes:[],edges:[],text:'First submission'};
  await api('/tasks/'+exercise.id+'/draft',submitted,'PUT');
  const job=await tool('check_current_answer',{taskId:exercise.id});
  const duplicate=await api('/tasks/'+exercise.id+'/check',submitted);assert.equal(job.id,duplicate.id);
  await api('/tasks/'+exercise.id+'/draft',{...submitted,text:'Edited after submission'},'PUT');
  let completed;
  for(let i=0;i<30;i++){completed=await tool('get_check_result',{jobId:job.id});if(completed.status!=='running')break;await new Promise(resolve=>setTimeout(resolve,100));}
  assert.equal(completed.status,'completed');assert.equal(completed.feedback.snapshotId,job.id);
  assert.ok(!JSON.stringify(completed).includes('PRIVATE'));
  assert.equal((await api('/tasks/'+exercise.id)).initial.text,'Edited after submission');
  assert.equal((await api('/jobs/'+job.id+'/cancel',{})).cancelled,false);
  assert.equal((await api('/jobs/'+job.id)).status,'completed');
  const review=await api('/tasks/'+exercise.id+'/review',{});
  assert.equal(review.assisted,true);assert.equal(review.snapshotId,job.id);
  assert.ok(!JSON.stringify(review).includes('PRIVATE FIXTURE'));
  const phase=await api('/tasks',{caseId:'wb',level:'detail',parentId:'wb-sample'});
  assert.equal(phase.parentId,'wb-sample');assert.equal(phase.initial.nodes.length,4);
  const firstQuestion=await api('/tasks',{caseId:'wb',level:'anomaly'});
  const nextQuestion=await api('/tasks',{caseId:'wb',level:'anomaly'});
  assert.notEqual(firstQuestion.questionId,nextQuestion.questionId);
  const checkOnly=await api('/chat',{caseId:'wb',taskId:nextQuestion.id,message:'封闭液和一抗稀释液可以通用吗？只说对不对，不解释。'});
  assert.equal(checkOnly.requestCheck,true);assert.ok(!checkOnly.text.includes('非特异性'));
  const noExplanation=await api('/chat',{caseId:'wb',taskId:nextQuestion.id,message:'封闭液和一抗稀释液有什么区别？不要解释概念，也不用给提示。'});
  assert.equal(noExplanation.helpLevel,(await api('/tasks/'+nextQuestion.id)).helpLevel);
  assert.ok(noExplanation.text.includes('不提供解释或提示'));assert.ok(!noExplanation.text.includes('非特异性'));
  const fallback=await api('/tasks',{caseId:'wb',level:'detail',generate:true});
  assert.equal(fallback.generation.source,'preset');
  const cancelTask=await api('/tasks',{caseId:'wb',level:'anomaly',freshRound:true});
  const cancelled=await api('/tasks/'+cancelTask.id+'/check',submitted);
  assert.equal((await api('/jobs/'+cancelled.id+'/cancel',{})).cancelled,true);
  await new Promise(resolve=>setTimeout(resolve,700));
  assert.equal((await api('/jobs/'+cancelled.id)).status,'cancelled');
  assert.equal((await api('/progress'))[`wb:${reference.revision+1}:wb-antibody:anomaly`],undefined);
  console.log('PASS: HTTP persistence, long edge IDs, cross-site guard, 8 MCP tools, hint state, notes, refinement, image upload, submission snapshots, duplicate checks/cancellation, model settings, phase selection, question rotation, review snapshot and generation fallback. Synthetic harness used only for transport/race checks.');
}finally{
  await client.close().catch(()=>{});server.kill('SIGTERM');
  await new Promise<void>(resolve=>{if(server.exitCode!==null)resolve();else server.once('exit',()=>resolve());});
  await rm(directory,{recursive:true,force:true});
}
