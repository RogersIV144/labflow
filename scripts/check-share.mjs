import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const version=JSON.parse(await readFile('package.json','utf8')).version;
const directory=await mkdtemp(join(tmpdir(),'labflow-package-test-'));
const archive=resolve(`releases/LabFlow-${version}-team.zip`);
const entries=execFileSync('unzip',['-Z1',archive],{encoding:'utf8'}).split('\n');
assert.ok(!entries.some(file=>/(^|\/)(\.labflow|\.git|node_modules|auth\.json|agent-mcp-config\.json)(\/|$)/.test(file)));
execFileSync('unzip',['-q',archive,'-d',directory]);
const root=join(directory,`LabFlow-${version}-team`), port=46000+Math.floor(Math.random()*5000),url=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['start.mjs','--no-open'],{cwd:root,env:{...process.env,NODE_PATH:'',PORT:String(port),CODEX_BIN:join(directory,'not-installed-codex')},stdio:['ignore','pipe','pipe']});
let output='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);
const client=new Client({name:'share-package-test',version:'1.0.0'});
try {
  for(let i=0;i<50;i++){
    try{if((await fetch(url+'/api/cases')).ok)break;}catch{}
    if(i===49)throw new Error(output);await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.equal((await (await fetch(url+'/api/cases')).json()).length,2);
  assert.ok((await (await fetch(url)).text()).includes('LabFlow'));
  const status=await (await fetch(url+'/api/agent')).json();assert.equal(status.available,false);
  const created=await fetch(url+'/api/tasks',{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify({caseId:'wb',level:'rebuild'})});
  assert.ok(created.ok);const task=await created.json();assert.deepEqual(task.initial.nodes,[]);
  const post=async(path,body)=>{const response=await fetch(url+'/api'+path,{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.ok(response.ok);return response.json();};
  async function check(id,answer){const job=await post('/tasks/'+id+'/check',answer);for(let i=0;i<50;i++){const result=await(await fetch(url+'/api/jobs/'+job.id)).json();if(result.status!=='running')return result;await new Promise(r=>setTimeout(r,50));}throw new Error('offline check timed out');}
  const blank=await check(task.id,task.initial);assert.equal(blank.status,'completed');assert.equal(blank.feedback.source,'rule');assert.equal(blank.feedback.verdict,'incorrect');
  const reference=await(await fetch(url+'/api/cases/wb')).json();
  const detail=await post('/tasks',{caseId:'wb',level:'detail',parentId:'wb-sample'});
  detail.initial.nodes.forEach((node,i)=>node.label=reference.steps.filter(s=>s.parentId==='wb-sample')[i].title);
  const correct=await check(detail.id,detail.initial);assert.equal(correct.feedback.source,'rule');assert.equal(correct.feedback.verdict,'correct');
  const question=await post('/tasks',{caseId:'wb',level:'anomaly'});
  const subjective=await check(question.id,{nodes:[],edges:[],text:'这个解释需要语义判断'});assert.equal(subjective.status,'completed');assert.equal(subjective.feedback.source,'rule');assert.equal(subjective.feedback.verdict,'uncertain');
  const config=JSON.parse(await readFile(join(root,'agent-mcp-config.json'),'utf8')).mcpServers.labflow;
  assert.equal(config.env.LABFLOW_URL,url);
  await client.connect(new StdioClientTransport({...config,env:{...process.env,...config.env,NODE_PATH:''}}));
  assert.equal((await client.listTools()).tools.length,8);
  const context=await client.callTool({name:'get_learning_context',arguments:{caseId:'wb'}});
  assert.ok(!context.isError);assert.equal(JSON.parse(context.content[0].text).latestTask.id,question.id);
  for(const file of ['server/app.mjs','server/mcp.mjs','START-HERE.txt','plugin/.mcp.json']){
    const text=await readFile(join(root,file),'utf8');assert.ok(!text.includes('/Users/zeng'));assert.ok(!/github_pat_[A-Za-z0-9_]+/.test(text));
  }
  assert.ok(!(await readdir(root)).includes('node_modules'));
  console.log('PASS: extracted ZIP runs without node_modules; offline correct/incorrect/uncertain rules, UI/API, generated MCP config and 8 bundled tools verified; personal runtime files excluded.');
}finally{
  await client.close().catch(()=>{});child.kill('SIGTERM');
  await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve);});
  await rm(directory,{recursive:true,force:true});
}
