import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Anomaly, Answer, Assessment, Feedback, LabCase, Level, Progress, PublicTask, Step } from '../shared/types';
import { seedCases } from './cases';

export interface Task extends PublicTask {
  reference: LabCase; expected: Step[]; mapping: Record<string, string>; masked: string[];
  fingerprint: string; credited: boolean; draft: Answer; lastAssessment?: Assessment; lastFeedback?: Feedback;
  question?: Anomaly; lastSubmission?: Answer;
}
export interface TaskOptions { parentId?: string; anomalyId?: string; masked?: string[]; question?: Anomaly; generation?: PublicTask['generation'] }
interface Store {
  cases: LabCase[]; tasks: Record<string, Task>; progress: Progress;
  revisions: { caseId: string; revision: number; nodeId: string; before: Step; after: Step; at: string }[];
  notes: Record<string, string>;
  exposure: Record<string, number>;
  activeTasks: Record<string,string>;
  seedVersion?: number;
  proposals: { id:string; caseId:string; nodeId:string; revision:number; patch:Partial<Pick<Step,'title'|'summary'|'why'|'check'|'media'>>; reason:string }[];
}
const clone = <T>(value: T): T => structuredClone(value);
const shuffle = <T>(items: T[]): T[] => items.map(value => ({ value, key: Math.random() })).sort((a,b) => a.key - b.key).map(x => x.value);
export const verdictText = { correct: '正确', incorrect: '有错误', uncertain: '暂无法判断' };

export function projectTask(task: Task): PublicTask {
  return { id: task.id, caseId: task.caseId, revision: task.revision, level: task.level, prompt: task.prompt,
    initial: clone(task.draft), media: task.media, helpLevel: task.helpLevel, assisted: task.assisted,
    parentId: task.parentId, questionId: task.questionId, generation: task.generation };
}

export function createTask(reference: LabCase, level: Level, variant = 0, options: TaskOptions = {}): Task {
  const parentId = options.parentId || reference.practiceParent;
  if (!reference.practiceParents.includes(parentId)) throw new Error('该阶段暂不支持练习');
  const expected = reference.steps.filter(n => n.parentId === parentId);
  if (!expected.length) throw new Error('该阶段没有可练习步骤');
  if (level === 'images' && !expected.some(n => n.media.length)) throw new Error('该阶段暂未配图，请先在学习模式附上图片');
  const question = options.question || (options.anomalyId ? reference.anomalies.find(q => q.id === options.anomalyId) : reference.anomalies[variant % reference.anomalies.length]);
  if (!question) throw new Error('情境题不存在');
  const mapping: Record<string,string> = {};
  const masks = expected.length<=2?expected.map(node=>[node.id]):expected.flatMap((node,i) => expected.slice(i+1).map(other => [node.id,other.id]));
  const masked = level === 'detail' ? options.masked || masks[variant % masks.length] || [expected[0].id] : [];
  if (masked.some(id => !expected.some(n => n.id === id)) || new Set(masked).size !== masked.length) throw new Error('掩码不属于当前阶段');
  const base = expected.map((node, index) => {
    const id = randomUUID(); mapping[id] = node.id;
    return { id, label: masked.includes(node.id) ? '' : node.title, position: { x: index % 3 * 270, y: Math.floor(index / 3) * 180 }, media: [] as string[] };
  });
  const order = level === 'order' ? shuffle(base) : base;
  const nodes = level === 'rebuild' || level === 'anomaly' ? [] : order.map((node,i) => ({ ...node, position: { x: (i % 3) * 270, y: Math.floor(i / 3) * 180 } }));
  const edges = level === 'detail' || level === 'images' ? base.slice(1).map((node,i) => ({ id: randomUUID(), source: base[i].id, target: node.id })) : [];
  const initial = { nodes, edges, text: '' };
  const phase = reference.steps.find(n => n.id === parentId)!.title;
  const prompts: Record<Level,string> = {
    detail: `补全「${phase}」中隐藏的步骤名称。可以直接在图中填写。`,
    order: `为「${phase}」建立操作顺序。拖动卡片整理画布，再从连接点连线；位置本身不代表顺序。`,
    rebuild: `从空白重建「${phase}」。自己添加需要的步骤并连线，完成后提交检查。`,
    images: `把示意卡片拖到「${phase}」中对应的步骤。同一张卡片可以用于多个合适的步骤。`,
    anomaly: question.prompt
  };
  return {
    id: randomUUID(), caseId: reference.id, revision: reference.revision, level, prompt: prompts[level], initial,
    draft: clone(initial), media: level === 'images' ? shuffle([...new Set(expected.flatMap(n => n.media))]) : [],
    helpLevel: 0, assisted: false, reference: clone(reference), expected, mapping, masked, parentId,
    question: level === 'anomaly' ? clone(question) : undefined, questionId: level === 'anomaly' ? question.id : undefined,
    generation: options.generation || { source:'preset', message: level === 'anomaly' ? `预置题 · ${question.category}` : '预置练习 · 按当前阶段生成' },
    fingerprint: createHash('sha256').update(JSON.stringify([reference.id, reference.revision, parentId, level, [...masked].sort(), level==='anomaly'?question.id:order.map(n => mapping[n.id])])).digest('hex').slice(0,16),
    credited: false
  };
}

export function structuralFindings(task: Task, answer: Answer): string[] {
  const findings: string[] = [];
  const ids = answer.nodes.map(n => n.id);
  if (new Set(ids).size !== ids.length) findings.push('节点标识重复');
  if (answer.edges.some(e => !ids.includes(e.source) || !ids.includes(e.target))) findings.push('连线端点不存在');
  const adjacency = new Map(ids.map(id => [id, answer.edges.filter(e => e.source === id).map(e => e.target)]));
  const reachable = (from: string, to: string) => {
    const visited = new Set<string>(); const stack = [...(adjacency.get(from) || [])];
    while (stack.length) { const id = stack.pop()!; if (id === to) return true; if (!visited.has(id)) { visited.add(id); stack.push(...(adjacency.get(id) || [])); } }
    return false;
  };
  if (ids.some(id => reachable(id,id))) findings.push('当前线性阶段存在有向环');
  if (task.level !== 'anomaly' && answer.nodes.length !== task.expected.length) findings.push('步骤数量与参考不符');
  if (['order','detail','images'].includes(task.level)) {
    const expectedIds = task.expected.map(n => Object.keys(task.mapping).find(id => task.mapping[id] === n.id)!);
    if (expectedIds.some(id => !ids.includes(id)) || ids.some(id => !task.mapping[id])) findings.push('已有步骤被移除或出现额外步骤');
    // Two cards both labelled “洗膜” have no visible identity distinction. Accept
    // either card in either washing position, while still requiring both steps.
    const candidates = task.expected.map(step => expectedIds.filter(id =>
      task.expected.find(candidate => candidate.id === task.mapping[id])?.title === step.title));
    const fits = (index:number, path:string[]):boolean => index === candidates.length ||
      candidates[index].some(id => !path.includes(id) && ids.includes(id) &&
        (!index || reachable(path[index-1],id)) && fits(index+1,[...path,id]));
    if (!fits(0,[])) findings.push('存在未表达或颠倒的先后关系');
  }
  if (task.level === 'images') {
    for (const node of answer.nodes) {
      const expected = task.expected.find(s => s.id === task.mapping[node.id]);
      if (!expected) continue;
      if (expected.media.some(id => !node.media.includes(id)) || node.media.some(id => !expected.media.includes(id))) findings.push('图片归属与参考不符');
    }
  }
  return [...new Set(findings)];
}

export function publicFeedback(task: Task, assessment: Assessment, snapshotId: string, submittedAt: string): Feedback {
  // This allowlist is the boundary. Never spread internal assessments into API output.
  return { verdict: assessment.verdict, message: verdictText[assessment.verdict], source: assessment.source, helpLevel: task.helpLevel,
    assisted: task.assisted, snapshotId, submittedAt };
}

export class Engine {
  private state!: Store;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(readonly directory = resolve('.labflow')) {}
  async init() {
    await mkdir(this.directory, { recursive: true });
    try { this.state = JSON.parse(await readFile(resolve(this.directory,'state.json'), 'utf8')); }
    catch (error: any) {
      if (error.code !== 'ENOENT') throw new Error('学习数据无法读取，已停止写入以保留原文件');
      this.state = { cases: clone(seedCases), tasks: {}, progress: {}, revisions: [], notes: {}, proposals: [], exposure: {}, activeTasks: {}, seedVersion:2 };
      await this.save();
    }
    this.state.proposals ||= [];
    this.state.activeTasks ||= {};
    const migrateExposure = !this.state.exposure;
    this.state.exposure ||= {};
    if (!this.state.seedVersion) {
      // Keep an untouched backup before additive catalogue migration. Existing
      // exercises retain their submission-time reference, including old rubrics.
      await writeFile(resolve(this.directory,'state.before-v0.2.json'),JSON.stringify(this.state,null,2),{mode:0o600,flag:'wx'}).catch((error:any)=>{if(error.code!=='EEXIST')throw error;});
      for (const current of this.state.cases) {
        const seed=seedCases.find(c=>c.id===current.id); if(!seed)continue;
        const edited=new Set(this.state.revisions.filter(r=>r.caseId===current.id).map(r=>r.nodeId));
        current.steps=seed.steps.map(node=>edited.has(node.id)?current.steps.find(n=>n.id===node.id)||clone(node):clone(node))
          .concat(current.steps.filter(node=>!seed.steps.some(n=>n.id===node.id)));
        current.practiceParents=clone(seed.practiceParents); current.sequence=clone(seed.sequence);
        current.sources=[...new Set([...current.sources,...seed.sources])];
        current.caveats=[...new Set([...current.caveats,...seed.caveats])];
        current.anomalies=clone(seed.anomalies); delete (current as any).anomaly;
        current.revision=Math.max(current.revision+1,seed.revision);
      }
      this.state.seedVersion=2;
    }
    for(const task of Object.values(this.state.tasks)) {
      task.parentId ||= task.reference.practiceParent;
      task.reference.practiceParents ||= [task.reference.practiceParent];
      const old=(task.reference as any).anomaly;
      task.reference.anomalies ||= old?[{...old,id:'legacy',category:'原版情境'}]:[];
      if(task.level==='anomaly') { task.question ||= task.reference.anomalies[0]; task.questionId ||= task.question?.id; }
    }
    for (const task of Object.values(this.state.tasks)) if (migrateExposure && task.assisted) {
      const key = `${task.caseId}:${task.revision}`;
      this.state.exposure[key] = Math.max(this.state.exposure[key] || 0, task.helpLevel);
    }
    await this.save();
  }
  save() {
    const content = JSON.stringify(this.state, null, 2);
    const job = this.queue.catch(() => {}).then(async () => {
      const file = resolve(this.directory, 'state.json');
      await writeFile(file + '.tmp', content, { mode: 0o600 }); await rename(file + '.tmp', file);
    });
    this.queue = job; return job;
  }
  listCases() { return this.state.cases.map(({ id,title,subtitle,discipline,revision }) => ({ id,title,subtitle,discipline,revision })); }
  getCase(id: string) { const item = this.state.cases.find(c => c.id === id); if (!item) throw new Error('案例不存在'); return clone(item); }
  task(id: string) { const item = this.state.tasks[id]; if (!item) throw new Error('练习不存在'); const exposure=this.state.exposure[`${item.caseId}:${item.revision}`]||0; if(exposure){item.assisted=true;item.helpLevel=Math.max(item.helpLevel,exposure);} return item; }
  progress() { return clone(this.state.progress); }
  context(caseId:string) {
    const tasks=Object.values(this.state.tasks).filter(t=>t.caseId===caseId);
    const active=this.state.activeTasks[caseId] || tasks.at(-1)?.id;
    return {case:this.listCases().find(c=>c.id===caseId),latestTask:active?projectTask(this.task(active)):null,progress:this.progress()};
  }
  proposals(caseId:string) { return clone(this.state.proposals.filter(p=>p.caseId===caseId)); }
  async propose(caseId:string,nodeId:string,revision:number,patch:Store['proposals'][number]['patch'],reason:string) {
    const reference=this.getCase(caseId);
    if(reference.revision!==revision||!reference.steps.some(n=>n.id===nodeId))throw new Error('节点或参考版本已变更');
    const proposal={id:randomUUID(),caseId,nodeId,revision,patch,reason};this.state.proposals.push(proposal);await this.save();return proposal;
  }
  async acceptProposal(id:string) {
    const proposal=this.state.proposals.find(p=>p.id===id);if(!proposal)throw new Error('建议不存在');
    const result=await this.refine(proposal.caseId,proposal.nodeId,proposal.revision,proposal.patch);
    this.state.proposals=this.state.proposals.filter(p=>p.id!==id);await this.save();return result;
  }
  nextVariant(caseId:string,level:Level,parentId?:string) { return Object.values(this.state.tasks).filter(t=>t.caseId===caseId&&t.level===level&&(!parentId||t.parentId===parentId)).length; }
  async newTask(caseId: string, level: Level, freshRound = false, options:TaskOptions={}) {
    const parentId=options.parentId||this.getCase(caseId).practiceParent;
    const variant = this.nextVariant(caseId,level,parentId);
    const reference=this.getCase(caseId);
    let task = createTask(reference, level, variant,options);
    const previous=Object.values(this.state.tasks).filter(t=>t.caseId===caseId&&t.level===level&&t.parentId===parentId).at(-1);
    if(level==='detail'&&previous&&JSON.stringify([...task.masked].sort())===JSON.stringify([...previous.masked].sort())) {
      for(let offset=1;offset<=task.expected.length**2;offset++) {
        const candidate=createTask(reference,level,variant+offset,{...options,masked:undefined,generation:{source:'preset',message:'已切换到另一组掩码，评分依据保持不变。'}});
        if(JSON.stringify([...candidate.masked].sort())!==JSON.stringify([...previous.masked].sort())){task=candidate;break;}
      }
    }
    const key = `${caseId}:${task.revision}`;
    if (freshRound) this.state.exposure[key] = 0;
    task.helpLevel = this.state.exposure[key] || 0;
    task.assisted = task.helpLevel > 0;
    this.state.tasks[task.id] = task; this.state.activeTasks[caseId]=task.id; await this.save(); return projectTask(task);
  }
  async draft(id: string, answer: Answer) { const task=this.task(id);task.draft = clone(answer);this.state.activeTasks[task.caseId]=id; await this.save(); }
  async markAssisted(id: string, level: number) { const task = this.task(id); task.assisted = true; task.helpLevel = Math.max(task.helpLevel,level); this.state.exposure[`${task.caseId}:${task.revision}`] = task.helpLevel; await this.save(); }
  async hint(id: string, requested: number) {
    const task = this.task(id);
    if (requested < 1 || requested > 3) throw new Error('提示级别无效');
    if (requested === 2 && task.helpLevel < 1) throw new Error('先请求一个宽泛提示，或明确查看完整答案');
    await this.markAssisted(id, requested);
    const broad = task.level === 'anomaly' ? task.question!.broad
      : '先从这个阶段的整体目的出发，想想输入、输出以及各操作之间的依赖。暂时不用逐项纠错。';
    const full = task.level === 'anomaly' ? task.question!.rubric : task.expected.map((n,i) => `${i+1}. ${n.title}：${n.summary} 原因：${n.why}`).join('\n');
    const assessment = task.lastAssessment;
    const focus = task.expected[Math.max(0, Math.min(task.expected.length-1, assessment?.focusIndex || 0))];
    const specific = !assessment ? '这次还没有成功取得评价。请先完成一次检查；若检查遇到连接或限流问题，可以稍后重试。'
      : assessment.verdict === 'correct' ? '这次提交已正确。可以收起帮助，再独立重建一次。'
      : task.level === 'anomaly' ? '先检查你的结论是否有题目中的证据支持，以及有没有把一种可能原因当成唯一原因。再回看你写出的理由。'
      : `这次先检查「${focus.title}」这一处。它的目的：${focus.why} 检查点：${focus.check} 先处理这一处，其余流程留给你继续推敲。`;
    return { helpLevel: task.helpLevel, assisted: true, text: requested === 1 ? broad : requested === 3 ? full : specific };
  }
  async record(id: string, assessment: Assessment, snapshotId: string, submittedAt: string, helpAtSubmit?:{assisted:boolean;helpLevel:number}, submission?:Answer) {
    const task = this.task(id);
    task.lastAssessment = assessment;
    if(submission)task.lastSubmission=clone(submission);
    const feedback = publicFeedback(task, assessment, snapshotId, submittedAt);
    if(helpAtSubmit){feedback.assisted=helpAtSubmit.assisted;feedback.helpLevel=helpAtSubmit.helpLevel;}
    task.lastFeedback = feedback;
    const key = `${task.caseId}:${task.revision}:${task.parentId}:${task.level}`;
    const progress = this.state.progress[key] ||= { independent: [], aided: 0, seen: 0 };
    if (assessment.verdict === 'correct' && !task.credited) {
      if (feedback.assisted) progress.aided++;
      else if (!progress.independent.includes(task.fingerprint)) progress.independent.push(task.fingerprint);
      task.credited = true;
    }
    await this.save(); return feedback;
  }
  note(caseId: string, nodeId: string) { return this.state.notes[`${caseId}:${nodeId}`] || ''; }
  async saveNote(caseId: string, nodeId: string, note: string) { this.getCase(caseId); this.state.notes[`${caseId}:${nodeId}`] = note; await this.save(); }
  async refine(caseId: string, nodeId: string, version: number, patch: Partial<Pick<Step,'title'|'summary'|'why'|'check'|'media'>>) {
    const index = this.state.cases.findIndex(c => c.id === caseId);
    const current = this.state.cases[index];
    if (!current) throw new Error('案例不存在');
    if (current.revision !== version) throw new Error('参考版本已更新，请刷新后再修改');
    const stepIndex = current.steps.findIndex(n => n.id === nodeId);
    if (stepIndex < 0) throw new Error('步骤不存在');
    const before = clone(current.steps[stepIndex]);
    current.steps[stepIndex] = { ...before, ...patch }; current.revision++;
    this.state.revisions.push({ caseId, revision: current.revision, nodeId, before, after: clone(current.steps[stepIndex]), at: new Date().toISOString() });
    for(const parentId of current.practiceParents) for (const level of ['detail','order','rebuild','images','anomaly']) {
      const affectsPractice=nodeId===parentId||before.parentId===parentId||level==='anomaly';
      const previous = this.state.progress[`${caseId}:${version}:${parentId}:${level}`];
      if (!affectsPractice&&previous) this.state.progress[`${caseId}:${current.revision}:${parentId}:${level}`] = clone(previous);
    }
    await this.save(); return clone(current);
  }
}
