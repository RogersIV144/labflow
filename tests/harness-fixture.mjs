#!/usr/bin/env node
// Synthetic transport fixture, used only by the isolated integration test.
// This is never used by the application as a fallback grader.
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
const pending=new Map();
const send=value=>process.stdout.write(JSON.stringify(value)+'\n');
createInterface({input:process.stdin}).on('line',line=>{
  const request=JSON.parse(line), {id,method,params}=request;
  if(id==null)return;
  if(method==='thread/start' && process.env.LABFLOW_FIXTURE_THREAD_ERROR) {
    send({id,error:{message:'Fixture thread start failed'}});return;
  }
  let result={};
  if(method==='model/list')result={data:[{model:'test-fixture',isDefault:true}]};
  if(method==='account/read')result={account:{type:'fixture'}};
  if(method==='thread/start')result={thread:{id:randomUUID()}};
  if(method==='turn/start'){
    const turnId=randomUUID();result={turn:{id:turnId}};
    pending.set(turnId,setTimeout(()=>{
      send({method:'item/completed',params:{threadId:params.threadId,item:{type:'agentMessage',text:JSON.stringify({verdict:'correct',detail:'PRIVATE FIXTURE DIAGNOSIS',focusIndex:0})}}});
      send({method:'turn/completed',params:{threadId:params.threadId,turn:{id:turnId,status:'completed'}}});pending.delete(turnId);
    },Number(process.env.LABFLOW_FIXTURE_DELAY_MS)||500));
  }
  if(method==='turn/interrupt'){clearTimeout(pending.get(params.turnId));pending.delete(params.turnId);}
  send({id,result});
});
