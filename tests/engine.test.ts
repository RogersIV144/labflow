import { describe, it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTask, Engine, projectTask, publicFeedback, structuralFindings } from '../server/engine';
import { seedCases } from '../server/cases';

describe('training disclosure boundary',()=>{
  it('does not send reference, mapping, hidden names or diagnostics in a task',()=>{
    const task=createTask(seedCases[0],'detail');const view=projectTask(task);
    expect(Object.keys(view)).not.toContain('reference');expect(Object.keys(view)).not.toContain('mapping');
    for(const id of task.masked) expect(view.initial.nodes.find(n=>task.mapping[n.id]===id)?.label).toBe('');
    expect(JSON.stringify(view)).not.toContain('wb-block');
  });
  it('starts full reconstruction without revealing slots, count, edges, or image clues',()=>{
    const view=projectTask(createTask(seedCases[0],'rebuild'));
    expect(view.initial.nodes).toEqual([]);expect(view.initial.edges).toEqual([]);expect(view.media).toEqual([]);
  });
  it('publishes only a verdict even when the model produces detailed errors',()=>{
    const task=createTask(seedCases[0],'detail');
    const result=publicFeedback(task,{verdict:'incorrect',detail:'SECRET ERROR NODE AND REASON',source:'codex'},'snapshot','now');
    expect(result.message).toBe('有错误');expect(JSON.stringify(result)).not.toContain('SECRET');expect(Object.keys(result)).not.toContain('detail');
  });
  it('explains an unresolved check without exposing a diagnosis or giving independent credit',async()=>{
    const directory=await mkdtemp(join(tmpdir(),'labflow-degraded-'));
    try {
      const engine=new Engine(directory);await engine.init();const task=await engine.newTask('wb','rebuild',true);
      const feedback=await engine.record(task.id,{verdict:'uncertain',detail:'PRIVATE ANSWER',source:'rule',degraded:true},'s','now');
      expect(feedback).toMatchObject({verdict:'uncertain',degraded:true,assisted:false,helpLevel:0});
      expect(feedback.message).toContain('AI 未完成判定');
      expect(JSON.stringify(feedback)).not.toContain('PRIVATE');
      expect(engine.progress()[`wb:${seedCases[0].revision}:wb-antibody:rebuild`].independent).toEqual([]);
    }finally{await rm(directory,{recursive:true,force:true});}
  });
});
describe('graph semantics',()=>{
  it('ignores layout coordinates, distinguishes repeated washing nodes, and checks directed order',()=>{
    const task=createTask(seedCases[0],'order');const ids=task.expected.map(s=>Object.keys(task.mapping).find(id=>task.mapping[id]===s.id)!);
    const answer={...task.initial,edges:ids.slice(1).map((id,i)=>({id:String(i),source:ids[i],target:id}))};
    expect(task.expected.filter(s=>s.title==='洗膜')).toHaveLength(2);
    expect(structuralFindings(task,answer)).toEqual([]);
    answer.nodes[0].position={x:-900,y:5000};expect(structuralFindings(task,answer)).toEqual([]);
    answer.edges[0]={...answer.edges[0],source:ids[1],target:ids[0]};expect(structuralFindings(task,answer).length).toBeGreaterThan(0);
  });
  it('finds wrong image assignments instead of trusting an explanatory answer',()=>{
    const task=createTask(seedCases[0],'images');const answer=structuredClone(task.initial);
    answer.text='所有图片都已正确归位。';expect(structuralFindings(task,answer)).toContain('图片归属与参考不符');
  });
  it('accepts visually identical washing cards in either valid washing position',()=>{
    const task=createTask(seedCases[0],'order');
    const ids=task.expected.map(s=>Object.keys(task.mapping).find(id=>task.mapping[id]===s.id)!);
    [ids[2],ids[4]]=[ids[4],ids[2]];
    const answer={...task.initial,edges:ids.slice(1).map((id,i)=>({id:String(i),source:ids[i],target:id}))};
    expect(structuralFindings(task,answer)).toEqual([]);
    answer.nodes=answer.nodes.filter(n=>n.id!==ids[4]);
    expect(structuralFindings(task,answer)).toContain('步骤数量与参考不符');
  });
});
describe('durable evidence and references',()=>{
  it('credits the submitted snapshot even if help is requested while checking',async()=>{
    const directory=await mkdtemp(join(tmpdir(),'labflow-test-'));
    try {
      const engine=new Engine(directory);await engine.init();const task=await engine.newTask('wb','detail');
      const submittedHelp={assisted:task.assisted,helpLevel:task.helpLevel};await engine.hint(task.id,1);
      const feedback=await engine.record(task.id,{verdict:'correct',detail:'ok',source:'codex'},'s','now',submittedHelp);
      expect(feedback.assisted).toBe(false);expect(engine.task(task.id).assisted).toBe(true);
      expect(engine.progress()[`wb:${seedCases[0].revision}:wb-antibody:detail`].independent).toHaveLength(1);
    }finally{await rm(directory,{recursive:true,force:true});}
  });
  it('carries answer exposure across modes and resets only for an explicit fresh round',async()=>{
    const directory=await mkdtemp(join(tmpdir(),'labflow-test-'));
    try {
      const engine=new Engine(directory);await engine.init();
      const first=await engine.newTask('wb','rebuild');await engine.hint(first.id,3);
      const other=await engine.newTask('wb','detail');expect(other.assisted).toBe(true);
      await engine.record(other.id,{verdict:'correct',detail:'ok',source:'codex'},'s','now');
      expect(engine.progress()[`wb:${seedCases[0].revision}:wb-antibody:detail`].independent).toEqual([]);
      const fresh=await engine.newTask('wb','detail',true);expect(fresh.assisted).toBe(false);
      const reloaded=new Engine(directory);await reloaded.init();expect(reloaded.task(fresh.id).assisted).toBe(false);
    }finally{await rm(directory,{recursive:true,force:true});}
  });
  it('specific hints identify only one focus, never echo a complete private diagnosis',async()=>{
    const directory=await mkdtemp(join(tmpdir(),'labflow-test-'));
    try {
      const engine=new Engine(directory);await engine.init();const task=await engine.newTask('wb','rebuild');
      await engine.record(task.id,{verdict:'incorrect',detail:'PRIVATE COMPLETE ORDER: all five steps and all edges',focusIndex:1,source:'codex'},'s','now');
      await engine.hint(task.id,1);const hint=await engine.hint(task.id,2);
      expect(hint.text).toContain('一抗孵育');expect(hint.text).not.toContain('PRIVATE');expect(hint.text).not.toContain('二抗孵育');
    }finally{await rm(directory,{recursive:true,force:true});}
  });
  it('does not escalate after failures; hints stay aided across reload and cannot earn independent credit',async()=>{
    const directory=await mkdtemp(join(tmpdir(),'labflow-test-'));
    try {
      const engine=new Engine(directory);await engine.init();const task=await engine.newTask('wb','detail');
      for(let i=0;i<3;i++)await engine.record(task.id,{verdict:'incorrect',detail:'first node',source:'codex'},'s'+i,'now');
      expect(engine.task(task.id).helpLevel).toBe(0);
      const hint=await engine.hint(task.id,1);expect(hint.text).not.toContain('first node');
      const resumed=new Engine(directory);await resumed.init();expect(resumed.task(task.id).assisted).toBe(true);
      await resumed.record(task.id,{verdict:'correct',detail:'ok',source:'codex'},'done','now');
      expect(resumed.progress()[`wb:${seedCases[0].revision}:wb-antibody:detail`].independent).toEqual([]);expect(resumed.progress()[`wb:${seedCases[0].revision}:wb-antibody:detail`].aided).toBe(1);
    } finally {await rm(directory,{recursive:true,force:true});}
  });
  it('keeps old exercises tied to the original reference and rejects conflicting edits',async()=>{
    const directory=await mkdtemp(join(tmpdir(),'labflow-test-'));
    try {
      const engine=new Engine(directory);await engine.init();const task=await engine.newTask('wb','detail');
      await engine.refine('wb','wb-block',seedCases[0].revision,{summary:'User refined reference'});
      expect(engine.getCase('wb').revision).toBe(seedCases[0].revision+1);expect(engine.task(task.id).reference.revision).toBe(seedCases[0].revision);
      expect(engine.task(task.id).expected[0].summary).not.toBe('User refined reference');
      await expect(engine.refine('wb','wb-block',seedCases[0].revision,{summary:'stale overwrite'})).rejects.toThrow('版本');
    } finally {await rm(directory,{recursive:true,force:true});}
  });
});
