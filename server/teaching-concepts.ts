import type { Task } from './engine';

export interface ConceptScope { title:string; facts:string[]; sources:string[] }

// A correctness request takes precedence over concept keywords in the answer.
// These local boundaries also apply if the model misclassifies the message.
export function practiceChatGuard(message:string):'check'|'no-explanation'|undefined {
  const clauses=message.split(/[，,。.!?？；;\n]/);
  const asksCheck=clauses.some(clause=>
    !/(?:不要|不用|无需|别|不想|不需要).{0,8}(?:检查|判断|判定|评价|评估|判答|只|告诉)/.test(clause)&&
    /(?:检查|判断|判定|评价|评判|评估).{0,10}(?:答案|作答|回答|提交|对错|正确|是否有错)|(?:答案|作答|回答).{0,12}(?:是否正确|正确吗|对不对|有没有错)|(?:只|仅).{0,8}(?:对错|对不对|是否正确|是否有错|有没有错)/.test(clause));
  if(asksCheck)return 'check';
  if(clauses.some(clause=>/(?:不要|不用|无需|不想|不需要|(?:^|请|也|先)别).{0,8}(?:解释|讲解|说明|概念|提示)|(?:do not|don['’]?t)\s+explain/i.test(clause.trim())))return 'no-explanation';
}

// Scopes contain excerpts from the exercise's frozen reference, not a second
// scientific answer key. A concept question never supplies the whole rubric.
export function conceptScope(task:Task,message:string):ConceptScope|undefined {
  if(practiceChatGuard(message))return;
  if(task.caseId!=='wb'||!/[?？]|为什么|区别|是否|有必要|解释|怎么理解|什么意思|是什么|如何理解/.test(message))return;
  const steps=task.reference.steps;
  const find=(id:string)=>steps.find(step=>step.id===id);
  if(/封闭/.test(message)&&/稀释/.test(message)) {
    if(/归一化|内参|总蛋白|生物.{0,3}重复|技术.{0,3}重复|线性|饱和|PVDF|NC\s*膜/i.test(message))return;
    const block=find('wb-block'),primary=find('wb-primary');
    const distinction=block?.summary.match(/封闭液与一抗稀释液[^。]*。/)?.[0];
    if(!block||!primary||!distinction)return;
    return {title:'封闭液与一抗稀释液的不同用途',facts:[block.why.split('；')[0]+'。',primary.summary,distinction],sources:[block.source,primary.source]};
  }
  const candidates=[
    {id:'wb-normalize',match:/归一化|内参|总蛋白/.test(message)},
    {id:'wb-replicates',match:/生物.{0,3}重复|技术.{0,3}重复|重复曝光|多次曝光|独立样本/.test(message)},
    {id:'wb-check-linearity',match:/线性|饱和/.test(message)},
    {id:'wb-membrane',match:/PVDF|NC\s*膜|预湿|膜活化/i.test(message)}
  ].filter(item=>item.match);
  if(candidates.length!==1)return;
  const step=find(candidates[0].id);if(!step)return;
  return {title:step.title,facts:[step.summary,step.why,step.check],sources:[step.source]};
}

// Disclosure is authorized by this message only, never by history or a
// previously attained help level. Conservative on negated/ambiguous requests.
export function explicitlyRequestsFullAnswer(message:string) {
  return /完整答案|全部答案|查看答案|直接.{0,12}答案|full\s+answer|complete\s+answer/i.test(message)
    && !/不要|不想|别|不用|无需|不需要|不给|不提供|不看|不透露|不展示|不要再|do\s+not|don['’]?t|without|no\s+(?:full|complete)/i.test(message);
}

export function requestedHelpLevel(intent:string,message:string,previousHelpLevel:number) {
  if(practiceChatGuard(message))return 0;
  if(intent==='full')return explicitlyRequestsFullAnswer(message)?3:1;
  if(intent==='specific')return previousHelpLevel>=1?2:1;
  return intent==='broad'?1:0;
}
