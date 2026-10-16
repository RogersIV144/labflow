import { describe,it,expect } from 'vitest';
import { mkdtemp,readFile,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTask,Engine,projectTask } from '../server/engine';
import { seedCases } from '../server/cases';
import { ruleAssessment } from '../server/rules';
import { detailedReview,focusedReply,generateExercise } from '../server/teaching';
import type { TutorBridge } from '../server/ai';

const wb=seedCases[0];
function bridge(outputs:unknown[]):TutorBridge {return {status:async()=>({available:true,backend:'codex',message:'test'}),models:async()=>[],run:async()=>{const result=outputs.shift();if(result instanceof Error)throw result;return result;},close(){}};}
function solved(task:ReturnType<typeof createTask>) {
  const answer=structuredClone(task.initial);
  answer.nodes.forEach(n=>n.label=task.expected.find(e=>e.id===task.mapping[n.id])!.title);
  const ids=task.expected.map(e=>answer.nodes.find(n=>task.mapping[n.id]===e.id)!.id);
  answer.edges=ids.slice(1).map((id,i)=>({id:String(i),source:ids[i],target:id}));
  return answer;
}
describe('issue iteration',()=>{
  it('covers phases and seven distinct WB scenarios without exposing grading rubrics',()=>{
    expect(wb.anomalies).toHaveLength(7);expect(new Set(wb.anomalies.map(q=>q.category)).size).toBeGreaterThanOrEqual(5);
    for(const parentId of wb.practiceParents)expect(createTask(wb,'detail',0,{parentId}).expected.every(n=>n.parentId===parentId)).toBe(true);
    expect(createTask(wb,'anomaly',0).prompt).not.toBe(createTask(wb,'anomaly',1).prompt);
    const task=createTask(wb,'anomaly');expect(JSON.stringify(projectTask(task))).not.toContain(task.question!.rubric);
    expect(()=>createTask(wb,'images',0,{parentId:'wb-sample'})).toThrow('暂未配图');
  });
  it('grades known graph answers locally, leaves subjective wording uncertain, detects missing edges',()=>{
    const task=createTask(wb,'detail');const answer=solved(task);
    expect(ruleAssessment(task,answer)).toMatchObject({source:'rule',verdict:'correct'});
    answer.nodes[0].label='blocking';expect(ruleAssessment(task,answer).verdict).toBe('correct');
    answer.nodes[0].label='先防止无关结合';expect(ruleAssessment(task,answer).verdict).toBe('uncertain');
    answer.edges=[];expect(ruleAssessment(task,answer).verdict).toBe('incorrect');
    const anomaly=createTask(wb,'anomaly');expect(ruleAssessment(anomaly,{nodes:[],edges:[],text:'我的解释'}).verdict).toBe('uncertain');
  });
  it('accepts a rebuilt graph and identical washing cards, rejects reverse edges',()=>{
    const task=createTask(wb,'rebuild');const answer={text:'',nodes:task.expected.map((n,i)=>({id:String(i),label:n.title,media:[],position:{x:0,y:0}})),edges:task.expected.slice(1).map((_,i)=>({id:String(i),source:String(i),target:String(i+1)}))};
    expect(ruleAssessment(task,answer).verdict).toBe('correct');
    answer.edges[0]={id:'0',source:'1',target:'0'};expect(ruleAssessment(task,answer).verdict).toBe('incorrect');
  });
  it('falls back from invalid AI masks and unverified scenarios; keeps authoritative rubric',async()=>{
    const invalid=await generateExercise(bridge([{masked:['outside','wb-block']}]),wb,'detail',0,{});
    expect(invalid.generation?.source).toBe('preset');
    const unverified=await generateExercise(bridge([{prompt:'这是新情境但引入未知事实并要求学习者解释为什么。'},{valid:false}]),wb,'anomaly',0,{});
    expect(unverified.generation?.source).toBe('preset');
    const verified=await generateExercise(bridge([{prompt:'面对当前题目中同学的建议，请你根据已有观察说明如何评价并给出理由。'},{valid:true}]),wb,'anomaly',0,{});
    expect(verified.question?.rubric).toBe(wb.anomalies[0].rubric);expect(verified.generation?.source).toBe('ai');
  });
  it('changes repeated masks and does not count a paraphrase as new independent evidence',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'labflow-variants-'));
    try {
      const engine=new Engine(dir);await engine.init();
      const options={masked:['wb-block','wb-primary']};
      const first=await engine.newTask('wb','detail',false,options),next=await engine.newTask('wb','detail',false,options);
      expect(engine.task(first.id).masked).not.toEqual(engine.task(next.id).masked);
      const original=createTask(wb,'anomaly',0),paraphrase=createTask(wb,'anomaly',0,{question:{...wb.anomalies[0],prompt:'同一题换了一种提问措辞'}});
      expect(paraphrase.fingerprint).toBe(original.fingerprint);
    } finally {await rm(dir,{recursive:true,force:true});}
  });
  it('prevents named hidden steps entering broad replies and rejects fabricated answer quotes',async()=>{
    const task=createTask(wb,'detail');
    expect(await focusedReply(bridge([{text:'先做封闭，再一抗孵育，然后洗膜。'}]),task,'提示一下','先思考阶段目标。',1)).toContain('未完成或未通过范围核对');
    const anomaly=createTask(wb,'anomaly',1);
    const fallback=await focusedReply(bridge([{text:'必须内参归一化、线性范围和独立重复。'},{valid:false}]),anomaly,'提示一下','先区分观察和结论。',1);
    expect(fallback).toContain('未完成或未通过范围核对');expect(fallback).not.toContain('必须内参归一化');
    task.lastSubmission=solved(task);task.lastSubmission.text='我写出的答案';task.lastFeedback={verdict:'incorrect',message:'有错误',source:'codex',helpLevel:0,assisted:false,snapshotId:'s',submittedAt:'now'};
    await expect(detailedReview(bridge([{text:'点评',annotations:[{quote:'我没有写过',kind:'incorrect',explanation:'原因',suggestion:'修正',source:task.expected[0].source}]}]),task)).rejects.toThrow('引用核对');
  });
  it('migrates old data with backup, preserving revisions, notes, and original task references',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'labflow-migrate-'));
    try {
      const engine=new Engine(dir);await engine.init();const old=await engine.newTask('wb','anomaly');
      await engine.saveNote('wb','wb-block','我的笔记');await engine.refine('wb','wb-block',wb.revision,{summary:'我的实操修订'});
      const path=join(dir,'state.json'),state=JSON.parse(await readFile(path,'utf8'));delete state.seedVersion;
      for(const c of state.cases){c.anomaly=c.anomalies[0];delete c.anomalies;delete c.practiceParents;}
      const task=state.tasks[old.id];task.reference.anomaly=task.reference.anomalies[0];delete task.reference.anomalies;delete task.reference.practiceParents;delete task.question;delete task.questionId;delete task.parentId;
      await writeFile(path,JSON.stringify(state));
      const migrated=new Engine(dir);await migrated.init();
      expect(migrated.getCase('wb').steps.find(n=>n.id==='wb-block')?.summary).toBe('我的实操修订');
      expect(migrated.note('wb','wb-block')).toBe('我的笔记');expect(migrated.getCase('wb').anomalies).toHaveLength(7);
      expect(migrated.task(old.id).revision).toBe(old.revision);expect(migrated.task(old.id).question?.prompt).toBe(old.prompt);
      expect(JSON.parse(await readFile(join(dir,'state.before-v0.2.json'),'utf8')).cases[0].anomaly).toBeDefined();
      const revision=migrated.getCase('wb').revision;await new Engine(dir).init();expect(migrated.getCase('wb').revision).toBe(revision);
    }finally{await rm(dir,{recursive:true,force:true});}
  });
});
