import { describe,it,expect } from 'vitest';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTask,Engine } from '../server/engine';
import { seedCases } from '../server/cases';
import { conceptReply,generateExercise,preciseHintUnavailable,requestTaskHint,singlePointHint } from '../server/teaching';
import { conceptScope,practiceChatGuard,requestedHelpLevel } from '../server/teaching-concepts';
import type { TutorBridge } from '../server/ai';

const wb=seedCases[0];
function bridge(outputs:unknown[],calls:string[]=[]):TutorBridge {
  return {status:async()=>({available:true,backend:'codex',message:'test'}),models:async()=>[],run:async(prompt)=>{
    calls.push(prompt);const value=outputs.shift();if(value instanceof Error)throw value;
    return typeof value==='function'?await value():value;
  },close(){}};
}
const text='处理组更亮，所以证明了转录上调。我们把同一样品连续曝光三次，就已有三个生物学重复。';
function submitted() {
  const task=createTask(wb,'anomaly',0,{anomalyId:'wb-brighter-treatment'});
  task.lastSubmission={nodes:[],edges:[],text};
  task.draft.text='这是尚未提交的新草稿';
  task.lastFeedback={verdict:'incorrect',message:'有错误',source:'codex',helpLevel:0,assisted:false,snapshotId:'snapshot-1',submittedAt:'now'};
  task.lastAssessment={verdict:'incorrect',detail:'PRIVATE: several mistakes',source:'codex'};
  return task;
}
function point(task=submitted()) {
  return {kind:'quote',quote:'所以证明了转录上调',focus:'从条带到转录的推断',reason:'条带信号没有直接测量转录过程，因而不足以支持这一推断。',source:task.question!.source!.split('；')[0]};
}

describe('bounded teaching',()=>{
  it('ties one precise quoted claim to the checked snapshot, never the edited draft or private diagnosis',async()=>{
    const task=submitted(),calls:string[]=[];
    const result=await singlePointHint(bridge([point(task),{valid:true}],calls),task);
    expect(result).toContain('原句：「所以证明了转录上调」');expect(result).toContain('原因：');
    expect(result).not.toContain('生物学重复');expect(result).not.toContain(task.question!.rubric);
    const prompt=JSON.parse(calls[0]);expect(prompt.submission).toBe(text);
    expect(calls.join('')).not.toContain(task.draft.text);expect(calls.join('')).not.toContain('PRIVATE');
  });
  it.each([
    ['fabricated quote',{quote:'用户从来没有写过的句子'}],
    ['wrong provenance',{source:'fabricated source'}],
    ['multiple sentences',{quote:text}],
    ['multiple reasons',{reason:'一处错误；另一处错误'}],
    ['answer-shaped extra field',{answer:'这里是整题答案'}]
  ])('rejects %s instead of presenting a generic precise hint',async(_name,patch)=>{
    expect(await singlePointHint(bridge([{...point(),...patch},{valid:true}]),submitted())).toBe(preciseHintUnavailable);
  });
  it('accepts one audited omission, rejects unsupported or over-disclosing feedback',async()=>{
    const missing={...point(),kind:'missing',quote:'',focus:'所用参照的有效性',reason:'没有说明参照是否适用于当前条件，比较结果的依据还不充分。'};
    const result=await singlePointHint(bridge([missing,{valid:true}]),submitted());
    expect(result).toContain('一处遗漏：所用参照的有效性');expect(result).not.toContain('生物学重复');
    expect(await singlePointHint(bridge([point(),{valid:false}]),submitted())).toBe(preciseHintUnavailable);
    expect(await singlePointHint(bridge([new Error('offline')]),submitted())).toBe(preciseHintUnavailable);
    const uncertain=submitted();uncertain.lastFeedback!.verdict='uncertain';const calls:string[]=[];
    expect(await singlePointHint(bridge([],calls),uncertain)).toContain('不能据此定位错误');expect(calls).toHaveLength(0);
  });
  it('caches one hint per checked submission and discards replies overtaken by a new check',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'labflow-specific-'));
    try {
      const engine=new Engine(dir);await engine.init();
      const created=await engine.newTask('wb','anomaly',true,{anomalyId:'wb-brighter-treatment'});
      const input=submitted();await engine.record(created.id,input.lastAssessment!,'s1','now',undefined,input.lastSubmission);
      await engine.hint(created.id,1);
      const calls:string[]=[];const tutor=bridge([point(input),{valid:true}],calls);
      const first=await requestTaskHint(engine,tutor,created.id,2);
      const second=await requestTaskHint(engine,tutor,created.id,2);
      expect(second).toEqual(first);expect(second.snapshotId).toBe('s1');expect(calls).toHaveLength(2);
      await engine.record(created.id,input.lastAssessment!,'s2','now',undefined,input.lastSubmission);
      let release!:(value:unknown)=>void,start!:()=>void;
      const started=new Promise<void>(resolve=>start=resolve);
      const pending=requestTaskHint(engine,bridge([()=>{start();return new Promise(resolve=>release=resolve);},{valid:true}]),created.id,2);
      await started;
      await engine.record(created.id,input.lastAssessment!,'s3','now',undefined,{nodes:[],edges:[],text:'新的已检查作答'});
      release(point(input));
      expect((await pending).text).toContain('检查结果在生成提示期间已更新');
      expect(engine.task(created.id).specificHint).toBeUndefined();
    }finally{await rm(dir,{recursive:true,force:true});}
  });
  it('answers the explicitly requested concept using only minimal current-reference excerpts',async()=>{
    const task=createTask(wb,'anomaly',0,{anomalyId:'wb-phospho-milk'}),calls:string[]=[];
    const message='封闭液和一抗稀释液是否需要分开核对？只解释概念，不给完整答案。';
    const scope=conceptScope(task,message)!;
    expect(scope.facts.join('')).toContain('分别遵循产品说明');
    const result=await conceptReply(bridge([{text:'需要分别核对。封闭处理针对膜的非特异性结合位点，一抗孵育则是让一抗与目标蛋白结合；两个用途分别遵循产品说明。'},{valid:true}],calls),task,message);
    expect(result.answered).toBe(true);expect(result.text).toContain('需要分别核对');expect(result.text).toContain('来源：');
    expect(result.text).not.toBe(task.question!.broad);expect(result.text).not.toContain(task.question!.rubric);
    expect(calls.join('')).not.toContain(task.question!.rubric);expect(calls.join('')).not.toContain('抗体浓度');
  });
  it('prioritizes correctness-only requests over concepts mentioned in the submitted claim',async()=>{
    const task=createTask(wb,'anomaly',0,{anomalyId:'wb-phospho-milk'}),calls:string[]=[];
    const message='我认为封闭液和一抗稀释液不用区分，这个答案是否正确？只检查对错';
    expect(practiceChatGuard(message)).toBe('check');expect(conceptScope(task,message)).toBeUndefined();
    expect(requestedHelpLevel('full',message,3)).toBe(0);
    expect((await conceptReply(bridge([],calls),task,message)).answered).toBe(false);expect(calls).toHaveLength(0);
  });
  it('honors an explicit prohibition on concept explanations without a model call',async()=>{
    const task=submitted(),calls:string[]=[];
    const message='封闭液和一抗稀释液有什么区别？不要解释概念，也不用给提示，只记录这个问题。';
    expect(practiceChatGuard(message)).toBe('no-explanation');expect(conceptScope(task,message)).toBeUndefined();
    expect(requestedHelpLevel('broad',message,3)).toBe(0);
    expect((await conceptReply(bridge([],calls),task,message)).answered).toBe(false);expect(calls).toHaveLength(0);
  });
  it('still permits the explicitly requested distinction while withholding the full answer',()=>{
    const task=submitted();
    const message='封闭液和一抗稀释液有什么区别？只解释这一点，不要给完整答案。';
    expect(practiceChatGuard(message)).toBeUndefined();expect(conceptScope(task,message)?.title).toBe('封闭液与一抗稀释液的不同用途');
    expect(requestedHelpLevel('full',message,3)).toBe(1);
    expect(practiceChatGuard('不要检查我的答案，只解释封闭液和一抗稀释液有什么区别？')).toBeUndefined();
  });
  it('labels rejected/unavailable concept generation and refuses an unscoped multi-concept answer',async()=>{
    const task=submitted(),message='什么是生物学重复，为什么重复曝光不算？';
    for(const outputs of [[{text:'归一化、线性范围、重复和推论边界都要写。'},{valid:false}],[new Error('offline')]]) {
      const result=await conceptReply(bridge(outputs),task,message);
      expect(result.text).toContain('AI 概念回复未完成或未通过范围核对');
      expect(result.text).toContain('独立生物学样本');expect(result.text).not.toContain('归一化、线性范围');
    }
    const calls:string[]=[];const refused=await conceptReply(bridge([],calls),task,'归一化、线性范围、生物重复分别是什么意思？');
    expect(refused.answered).toBe(false);expect(refused.text).toContain('只问一个具体概念');expect(calls).toHaveLength(0);
  });
  it.each(['不要完整答案','只解释概念，不给完整答案','无需提供完整答案','Please explain without a full answer'])('never upgrades a negated complete-answer request: %s',message=>{
    expect(requestedHelpLevel('full',message,3)).toBe(1);
    expect(requestedHelpLevel('concept',message,3)).toBe(0);
  });
  it('generates only a prompt, keeps the original rubric, and explicitly falls back on the same selected question',async()=>{
    const question=wb.anomalies.find(q=>q.id==='wb-phospho-milk')!,calls:string[]=[];
    const prompt='本次检测磷酸化蛋白，奶粉封闭后背景很高且尚未核对抗体说明书。组员坚持所有此类抗体必须换BSA且一定有效。请评价这项判断并说明下一步。';
    const options={anomalyId:question.id};
    const good=await generateExercise(bridge([{prompt},{valid:true}],calls),wb,'anomaly',6,options);
    expect(good.generation?.source).toBe('ai');expect(good.question?.id).toBe(question.id);expect(good.question?.rubric).toBe(question.rubric);
    expect(JSON.parse(calls[0]).instruction).toContain('Output ONLY prompt');
    const bad=await generateExercise(bridge([{prompt,rubric:'invented rubric'},{valid:true}]),wb,'anomaly',6,options);
    expect(bad.generation?.source).toBe('preset');expect(bad.generation?.message).toContain('未完成或未通过核对');expect(bad.anomalyId).toBe(question.id);
    const unsupported=await generateExercise(bridge([{prompt},{valid:false}]),wb,'anomaly',6,options);
    expect(unsupported.generation?.source).toBe('preset');expect(unsupported.anomalyId).toBe(question.id);
  });
  it('defaults AI variants to the active selected scenario while honoring an explicit selection',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'labflow-selected-'));
    try {
      const engine=new Engine(dir);await engine.init();
      await engine.newTask('wb','anomaly',false,{anomalyId:'wb-phospho-milk'});
      expect(engine.generationOptions('wb','anomaly',{}).anomalyId).toBe('wb-phospho-milk');
      expect(engine.generationOptions('wb','anomaly',{anomalyId:'wb-pvdf-no-signal'}).anomalyId).toBe('wb-pvdf-no-signal');
    }finally{await rm(dir,{recursive:true,force:true});}
  });
});
