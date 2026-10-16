import type { Answer, Assessment } from '../shared/types';
import { structuralFindings, type Task } from './engine';

const normalize=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
/** Exact names/declared aliases are decidable; unfamiliar wording is left to AI. */
export function ruleAssessment(task:Task,answer:Answer):Assessment {
  const result=(verdict:Assessment['verdict'],detail:string):Assessment=>({verdict,detail,source:'rule',focusIndex:0});
  if(task.level==='anomaly')return answer.text.trim()?result('uncertain','主观理由需要语义评价'):result('incorrect','尚未填写答案');
  const findings=structuralFindings(task,answer);
  if(findings.length)return result('incorrect',findings.join('；'));
  if(answer.nodes.some(node=>!node.label.trim()))return result('incorrect','存在未填写的步骤');
  const matches=(label:string,index:number)=>[task.expected[index].title,...task.expected[index].aliases||[]].some(name=>normalize(name)===normalize(label));
  if(task.level!=='rebuild') {
    for(const node of answer.nodes) {
      const index=task.expected.findIndex(n=>n.id===task.mapping[node.id]);
      if(index<0)return result('incorrect','步骤不属于当前练习');
      if(!matches(node.label,index))return result('uncertain','名称需要语义评价');
    }
  } else {
    const reach=(from:string,to:string)=>{
      const seen=new Set<string>(),stack=[from];
      while(stack.length){const id=stack.pop()!;if(id===to)return true;if(seen.has(id))continue;seen.add(id);stack.push(...answer.edges.filter(e=>e.source===id).map(e=>e.target));}
      return false;
    };
    const candidates=task.expected.map((_,i)=>answer.nodes.filter(n=>matches(n.label,i)).map(n=>n.id));
    // Do not mistake a valid synonym unknown to the local catalogue for a mistake.
    if(answer.nodes.some(n=>!task.expected.some((_,i)=>matches(n.label,i))))return result('uncertain','自建步骤需要语义评价');
    const fits=(index:number,path:string[]):boolean=>index===candidates.length||candidates[index].some(id=>!path.includes(id)&&(!index||reach(path[index-1],id))&&fits(index+1,[...path,id]));
    if(!fits(0,[]))return result('incorrect','重建步骤或先后关系不符');
  }
  if(answer.text.trim())return result('uncertain','图结构通过，附加文字需要语义评价');
  return result('correct','名称、连线与图片符合当前参考');
}
