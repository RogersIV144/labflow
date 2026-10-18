import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ReactFlow, Background, Controls, Handle, Position, BaseEdge, addEdge, applyNodeChanges, applyEdgeChanges, useReactFlow, useNodesInitialized, type Node, type Edge, type EdgeProps, type NodeProps, type Connection } from '@xyflow/react';
import { ArrowUpRight, ArrowRight, BookOpen, Check, ChevronDown, ChevronRight, ChevronLeft, CircleHelp, FlaskConical, ImagePlus, Layers3, Loader2, MessageCircle, Play, Plus, RotateCcw, ScanLine, Send, Sparkles, Square, Undo2, X, Maximize2, Pencil, Save, LibraryBig, Settings2, WandSparkles } from 'lucide-react';
import './lab/lab.css';
const LabExperience = lazy(() => import('./lab/LabExperience'));
import type { Answer, Feedback, LabCase, Level, Mode, Progress, PublicJob, PublicTask, Step } from '../shared/types';
import { layoutAnswer, layoutLearning, legacyEdgeHandles, serializeAnswerEdges, type HierarchyRoute } from './layout';

async function api<T>(path:string, body?:unknown, method?:string):Promise<T> {
  const response=await fetch('/api'+path,{method:method || (body===undefined?'GET':'POST'),headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json(); if(!response.ok) throw new Error(data.error || '请求未完成'); return data;
}
type CardData = { label:string; summary?:string; number?:string; editable?:boolean; practice?:boolean; expandable?:boolean; expanded?:boolean; media:string[]; onText?:(value:string)=>void; onExpand?:()=>void; onMedia?:(id:string)=>void; onRemoveMedia?:(id:string)=>void; current?:boolean; kind?:string; [key:string]:unknown };
type FlowNode=Node<CardData>;
function StepCard({data,selected}:NodeProps<FlowNode>) {
  const [over,setOver]=useState(false);
  return <div className={`step-card ${selected?'selected':''} ${data.current?'current':''} ${over?'drop-over':''}`} onDragOver={e=>{if(data.onMedia){e.preventDefault();e.dataTransfer.dropEffect='copy';setOver(true);}}} onDragLeave={()=>setOver(false)} onDrop={e=>{e.preventDefault();setOver(false);const id=e.dataTransfer.getData('application/labflow-media');if(id)data.onMedia?.(id);}}>
    <Handle id="top" type="target" position={Position.Top}/><Handle id="left" type="target" position={Position.Left}/>{!data.practice&&<Handle id="hierarchy-left" type="source" position={Position.Left}/>}
    {data.practice&&<><Handle className="legacy-handle" id="legacy-left-source" type="source" position={Position.Left} isConnectable={false}/><Handle className="legacy-handle" id="legacy-top-source" type="source" position={Position.Top} isConnectable={false}/><Handle className="legacy-handle" id="legacy-right-target" type="target" position={Position.Right} isConnectable={false}/><Handle className="legacy-handle" id="legacy-bottom-target" type="target" position={Position.Bottom} isConnectable={false}/></>}
    <div className="card-top"><span>{data.kind || '操作步骤'}</span>{data.number&&<span className="mono">{data.number}</span>}</div>
    {data.editable?<input className="nodrag nowheel node-input" aria-label="步骤名称" placeholder="填写步骤名称…" value={data.label} onChange={e=>data.onText?.(e.target.value)}/>:<h3>{data.label}</h3>}
    {data.summary&&<p>{data.summary}</p>}
    {data.media.length>0&&<div className="node-images">{data.media.map((id,i)=><div key={id}><img src={`/api/media/${id}`} alt={`节点附件 ${i+1}`}/>{data.onRemoveMedia&&<button className="nodrag image-remove" aria-label="移除附件" onClick={()=>data.onRemoveMedia?.(id)}><X size={12}/></button>}</div>)}</div>}
    {data.expandable&&<button className="nodrag expand-node" onClick={data.onExpand}>{data.expanded?<ChevronDown size={14}/>:<Plus size={14}/>} {data.expanded?'收起这一层':'展开学习'}</button>}
    <Handle id="bottom" type="source" position={Position.Bottom}/><Handle id="right" type="source" position={Position.Right}/>
  </div>;
}
const nodeTypes={step:StepCard};
type RoutedEdge=Edge<HierarchyRoute>;
function HierarchyEdge({id,sourceX,sourceY,targetX,targetY,data,markerEnd,style}:EdgeProps<RoutedEdge>) {
  const path=data?`M ${sourceX} ${sourceY} L ${data.viaX} ${sourceY} L ${data.viaX} ${data.viaY} L ${targetX} ${data.viaY} L ${targetX} ${targetY}`:`M ${sourceX} ${sourceY} C ${sourceX} ${(sourceY+targetY)/2}, ${targetX} ${(sourceY+targetY)/2}, ${targetX} ${targetY}`;
  return <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style}/>;
}
const edgeTypes={hierarchy:HierarchyEdge};
const modes:{id:Mode;label:string;icon:typeof BookOpen}[]=[{id:'learn',label:'学习',icon:BookOpen},{id:'practice',label:'回忆训练',icon:Layers3},{id:'assess',label:'检验',icon:ScanLine},{id:'replay',label:'Replay',icon:Play}];
const levels:{id:Level;label:string}[]=[{id:'detail',label:'01 细节补全'},{id:'order',label:'02 顺序重建'},{id:'rebuild',label:'03 整段重建'},{id:'images',label:'配图归位'}];
type ChatMessage={role:'user'|'assistant';text:string};
type AgentState={available:boolean;message:string;backend?:string;model?:string};
type ReviewAnnotation={quote:string;kind:'correct'|'missing'|'incorrect';explanation:string;suggestion?:string;source:string};
type TaskReview={assisted:true;helpLevel:number;text:string;annotations:ReviewAnnotation[];source?:string;snapshotId:string};
type AgentModel={model:string;isDefault:boolean;supportedReasoningEfforts?:string[]};
const feedbackSourceLabel=(source:Feedback['source'])=>source==='rule'?'规则检查':source==='api'?'服务评价': 'Codex';
const taskKey=(caseId:string,parentId:string,level:Level)=>`labflow.task.${caseId}.${parentId}.${level}`;

export default function App() {
  const [cases,setCases]=useState<Pick<LabCase,'id'|'title'|'subtitle'|'discipline'|'revision'>[]>([]);
  const [caseId,setCaseId]=useState(()=>localStorage.getItem('labflow.case') || 'wb');
  const [lab,setLab]=useState<LabCase>(); const [mode,setMode]=useState<Mode>('learn');
  const [expanded,setExpanded]=useState<string[]>([]); const [selected,setSelected]=useState<string>();
  const [nodes,setNodes]=useState<FlowNode[]>([]); const [edges,setEdges]=useState<Edge[]>([]);
  const [task,setTask]=useState<PublicTask>(); const [level,setLevel]=useState<Level>('detail'); const [practiceParent,setPracticeParent]=useState(''); const [anomalyId,setAnomalyId]=useState('');
  const [answerText,setAnswerText]=useState(''); const [job,setJob]=useState<PublicJob>(); const [feedback,setFeedback]=useState<Feedback>();
  const [hint,setHint]=useState(''); const [hintTier,setHintTier]=useState(1); const [pendingMedia,setPendingMedia]=useState<string>(); const [history,setHistory]=useState<Answer[]>([]);
  const [agent,setAgent]=useState<AgentState>({available:false,message:'正在连接 Codex…'}); const [agentModels,setAgentModels]=useState<AgentModel[]>([]); const [modelDraft,setModelDraft]=useState(''); const [agentSettingsOpen,setAgentSettingsOpen]=useState(false); const [agentSettingsBusy,setAgentSettingsBusy]=useState(false);
  const [progress,setProgress]=useState<Progress>({});
  const [chat,setChat]=useState<ChatMessage[]>([]); const [chatInput,setChatInput]=useState(''); const [chatBusy,setChatBusy]=useState(false);
  const [proposals,setProposals]=useState<{id:string;nodeId:string;patch:Partial<Step>;reason:string}[]>([]);
  const [toast,setToast]=useState(''); const [busy,setBusy]=useState(false); const [replayIndex,setReplayIndex]=useState(0);
  const [note,setNote]=useState(''); const [editing,setEditing]=useState(false); const [edit,setEdit]=useState({title:'',summary:'',why:'',check:''});
  const [stale,setStale]=useState(false); const [saved,setSaved]=useState(true); const [review,setReview]=useState<TaskReview>(); const [reviewBusy,setReviewBusy]=useState(false);
  const [focusCanvas,setFocusCanvas]=useState(false);
  const [learningView,setLearningView]=useState<'scene'|'flow'>('scene');
  const [hintBusy,setHintBusy]=useState(false);
  const flow=useReactFlow(); const nodesInitialized=useNodesInitialized(); const taskRef=useRef(task); taskRef.current=task;
  const modeRef=useRef(mode); modeRef.current=mode;
  const caseRef=useRef(caseId); caseRef.current=caseId;
  const graphRef=useRef({nodes,edges,answerText}); graphRef.current={nodes,edges,answerText};
  const pollRef=useRef<ReturnType<typeof setTimeout> | undefined>(undefined); const uploadRef=useRef<HTMLInputElement>(null); const chatEnd=useRef<HTMLDivElement>(null);
  const snapshotHash=useRef(''); const canvasRef=useRef<HTMLElement>(null);
  const feedbackRef=useRef(feedback);feedbackRef.current=feedback;const staleRef=useRef(stale);staleRef.current=stale;
  useEffect(()=>{const canvas=canvasRef.current;if(!canvas)return;let timer:ReturnType<typeof setTimeout>;const fit=()=>{clearTimeout(timer);timer=setTimeout(()=>flow.fitView({padding:.08,duration:0,maxZoom:1.1}),80);};const observer=new ResizeObserver(fit);observer.observe(canvas);fit();return()=>{observer.disconnect();clearTimeout(timer);};},[flow,task?.id,mode]);
  useEffect(()=>{if(!nodesInitialized)return;const timer=setTimeout(()=>flow.fitView({padding:.08,duration:0,maxZoom:1.1}),30);return()=>clearTimeout(timer);},[nodesInitialized,task?.id,mode,flow]);
  useEffect(()=>{const timer=setTimeout(()=>flow.fitView({padding:.08,duration:0,maxZoom:1.1}),120);return()=>clearTimeout(timer);},[focusCanvas,flow]);
  const practicing=mode==='practice'||mode==='assess';
  const chosen=lab?.steps.find(n=>n.id===selected);
  const count=lab ? progress[`${caseId}:${lab.revision}:${task?.parentId||practiceParent||lab.practiceParent}:${level}`]?.independent.length || 0 : 0;
  const hasPracticeMedia=Boolean(task?.media?.length||lab?.steps.some(step=>(step.parentId===practiceParent||step.id===practiceParent)&&step.media.length));
  const tell=(text:string)=>{setToast(text);};
  useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(t);}},[toast]);
  const refreshAgent=useCallback(async()=>{const [statusResult,modelsResult]=await Promise.allSettled([api<AgentState>('/agent'),api<AgentModel[]>('/agent/models')]);if(statusResult.status==='fulfilled'){const status=statusResult.value;setAgent(status);if(modelsResult.status==='fulfilled'){setAgentModels(modelsResult.value);setModelDraft(status.model||modelsResult.value.find(m=>m.isDefault)?.model||'');}else setAgentModels([]);}else setAgent({available:false,message:statusResult.reason instanceof Error?statusResult.reason.message:'模型状态暂不可用'});},[]);
  useEffect(()=>{api<typeof cases>('/cases').then(setCases).catch(e=>tell(e.message));refreshAgent();api<Progress>('/progress').then(setProgress).catch(()=>{});},[refreshAgent]);
  useEffect(()=>{
    let alive=true;setBusy(true);setTask(undefined);setFeedback(undefined);setHint('');setChat([]);setMode('learn');setSelected(undefined);
    api<LabCase>(`/cases/${caseId}`).then(async data=>{if(alive){setLab(data);setPracticeParent(current=>data.practiceParents.includes(current)?current:data.practiceParents[0]||data.practiceParent);setAnomalyId(current=>data.anomalies.some(a=>a.id===current)?current:data.anomalies[0]?.id||'');setExpanded([]);setReplayIndex(0);localStorage.setItem('labflow.case',caseId);const initialParent=data.practiceParents[0]||data.practiceParent;const savedTask=localStorage.getItem('labflow.task.'+caseId)||localStorage.getItem(taskKey(caseId,initialParent,'detail'));if(savedTask){try{const restored=await api<PublicTask>('/tasks/'+savedTask);if(alive){const parent=restored.parentId||initialParent;setPracticeParent(parent);localStorage.setItem(taskKey(caseId,parent,restored.level),restored.id);taskRef.current=restored;setTask(restored);setLevel(restored.level);setMode(restored.level==='anomaly'?'assess':'practice');const draft=JSON.parse(localStorage.getItem('labflow.draft.'+restored.id)||'null') as Answer|null;restore(draft||restored.initial);tell('已恢复上次练习草稿');}}catch{localStorage.removeItem('labflow.task.'+caseId);}}}}).catch(e=>tell(e.message)).finally(()=>{if(alive)setBusy(false);});
    return()=>{alive=false;if(pollRef.current)clearTimeout(pollRef.current);};
  },[caseId]);
  useEffect(()=>{let alive=true;const refresh=()=>api<typeof proposals>('/proposals/'+caseId).then(result=>{if(alive)setProposals(result);}).catch(()=>{});refresh();const timer=setInterval(refresh,5000);return()=>{alive=false;clearInterval(timer);};},[caseId]);
  useEffect(()=>{chatEnd.current?.scrollIntoView({behavior:'smooth',block:'nearest'});},[chat,chatBusy]);
  useEffect(()=>{if(chosen){setEditing(false);setEdit({title:chosen.title,summary:chosen.summary,why:chosen.why,check:chosen.check});let alive=true;api<{text:string}>(`/notes/${caseId}/${chosen.id}`).then(r=>{if(alive)setNote(r.text);});return()=>{alive=false;};}},[chosen?.id,lab?.revision]);

  const answer=useCallback(():Answer=>({nodes:graphRef.current.nodes.map(n=>({id:n.id,label:n.data.label,position:n.position,media:n.data.media})),edges:serializeAnswerEdges(graphRef.current.edges),text:graphRef.current.answerText}),[]);
  const remember=()=>setHistory(h=>[...h.slice(-24),answer()]);
  const changeText=(id:string,label:string)=>{remember();setNodes(ns=>ns.map(n=>n.id===id?{...n,data:{...n.data,label}}:n));setStale(true);setReview(undefined);};
  const attachMedia=(id:string,media:string)=>{remember();setNodes(ns=>ns.map(n=>n.id===id?{...n,data:{...n.data,media:[...new Set([...n.data.media,media])]}}:n));setStale(true);setReview(undefined);};
  const removeMedia=(id:string,media:string)=>{remember();setNodes(ns=>ns.map(n=>n.id===id?{...n,data:{...n.data,media:n.data.media.filter(m=>m!==media)}}:n));setStale(true);setReview(undefined);};
  function restore(value:Answer) {
    setNodes(value.nodes.map(n=>({id:n.id,type:'step',position:n.position,data:{label:n.label,media:n.media,editable:taskRef.current?.level!=='images',practice:true,kind:'我的步骤',onText:(label:string)=>changeText(n.id,label),onMedia:(id:string)=>attachMedia(n.id,id),onRemoveMedia:(id:string)=>removeMedia(n.id,id)}})));
    const positions=Object.fromEntries(value.nodes.map(n=>[n.id,n.position]));
    setEdges(value.edges.map(e=>{const fallback=legacyEdgeHandles(positions[e.source],positions[e.target]);return {...e,sourceHandle:e.sourceHandle??fallback.sourceHandle,targetHandle:e.targetHandle??fallback.targetHandle,type:'default',markerEnd:{type:'arrowclosed',color:'#537b6b'},style:{stroke:'#537b6b',strokeWidth:2}};}));setAnswerText(value.text);
  }
  useEffect(()=>{
    if(!lab||practicing)return;
    const focused=[...expanded].reverse().find(id=>id!==lab.rootId&&lab.steps.some(n=>n.parentId===id));
    const anchor=lab.steps.find(n=>n.id===(focused||lab.rootId))!;
    const children=expanded.includes(anchor.id)?lab.steps.filter(n=>n.parentId===anchor.id):[];
    const visible=[anchor,...children]; const layout=layoutLearning(visible.map(n=>n.id),lab.sequence,lab.steps);
    setNodes(visible.map((n,i)=>({id:n.id,type:'step',position:layout.positions[n.id],selected:n.id===selected,data:{label:n.title,summary:n.summary,kind:i===0?'当前范围':'展开步骤',number:i?String(i).padStart(2,'0'):undefined,media:n.media,expandable:lab.steps.some(c=>c.parentId===n.id),expanded:expanded.includes(n.id),onExpand:()=>setExpanded(e=>e.includes(n.id)?e.filter(id=>id!==n.id):[lab.rootId,n.id]),current:mode==='replay'&&lab.sequence[replayIndex]===n.id}})));
    setEdges(layout.edges.map((edge,i)=>({id:`hierarchy-${edge.source}-${edge.target}-${i}`,source:edge.source,target:edge.target,sourceHandle:edge.sourceHandle,targetHandle:edge.targetHandle,type:'hierarchy',data:edge.route,markerEnd:{type:'arrowclosed',color:'#537b6b'},style:{stroke:'#537b6b',strokeWidth:2}})));
    const timer=setTimeout(()=>flow.fitView({padding:.08,duration:0,maxZoom:1.1}),120);return()=>clearTimeout(timer);
  },[lab,expanded,practicing,mode,replayIndex]);
  useEffect(()=>{
    if(!lab||practicing||!nodes.length||!nodes.every(node=>node.measured?.height))return;
    const focused=[...expanded].reverse().find(id=>id!==lab.rootId&&lab.steps.some(n=>n.parentId===id));
    const anchor=lab.steps.find(n=>n.id===(focused||lab.rootId));if(!anchor)return;
    const visible=[anchor,...(expanded.includes(anchor.id)?lab.steps.filter(n=>n.parentId===anchor.id):[])];
    if(nodes.length!==visible.length||nodes.some(node=>!visible.some(step=>step.id===node.id)))return;
    const heights=Object.fromEntries(nodes.map(node=>[node.id,Math.ceil(node.measured?.height||160)]));
    const layout=layoutLearning(visible.map(step=>step.id),lab.sequence,lab.steps,heights);
    if(nodes.some(node=>Math.abs(node.position.x-layout.positions[node.id].x)>.5||Math.abs(node.position.y-layout.positions[node.id].y)>.5)){
      setNodes(current=>current.map(node=>({...node,position:layout.positions[node.id]||node.position})));
      setTimeout(()=>flow.fitView({padding:.08,duration:0,maxZoom:1.1}),60);
    }
    const routes=Object.fromEntries(layout.edges.map(edge=>[edge.target,edge.route]));
    setEdges(current=>current.some(edge=>{const a=edge.data as HierarchyRoute|undefined;const b=routes[edge.target];return a?.viaX!==b?.viaX||a?.viaY!==b?.viaY;})?current.map(edge=>({...edge,data:routes[edge.target]})):current);
  },[lab,expanded,practicing,nodes,flow]);
  useEffect(()=>{
    if(!task||!practicing)return;
    setSaved(false);
    const id=task.id;const current=answer();
    localStorage.setItem('labflow.draft.'+id,JSON.stringify(current));
    const t=setTimeout(()=>api(`/tasks/${id}/draft`,current,'PUT').then(()=>{if(taskRef.current?.id===id)setSaved(true);}).catch(()=>tell('草稿暂未保存')),500);
    return()=>clearTimeout(t);
  },[nodes,edges,answerText,task?.id,practicing]);

  async function startExercise(next:Level,freshRound=false,reuse=false,generate=false,parentOverride?:string,anomalyOverride?:string) {
    if(!lab||busy)return;setBusy(true);setReview(undefined);
    if(job?.status==='running') await api(`/jobs/${job.id}/cancel`,{}).catch(()=>{});
    if(pollRef.current)clearTimeout(pollRef.current);
    const requestedCase=caseId;
    try {
      const parent=parentOverride||practiceParent||lab.practiceParents[0]||lab.practiceParent;
      let nextTask:PublicTask|undefined; const key=taskKey(caseId,parent,next); const cached=localStorage.getItem(key); if(reuse&&cached){try{const previous=await api<PublicTask>('/tasks/'+cached);if(previous.revision===lab.revision&&previous.parentId===parent&&previous.level===next)nextTask=previous;}catch{}} const resuming=Boolean(nextTask);
      const pinnedAnomaly=next==='anomaly'?(anomalyOverride||((generate||freshRound)&&task?.level==='anomaly'&&task.parentId===parent?task.questionId:undefined)):undefined;
      nextTask ||= await api<PublicTask>('/tasks',{caseId,level:next,freshRound,parentId:parent,...(generate?{generate:true}:{}),...(pinnedAnomaly?{anomalyId:pinnedAnomaly}:{})});
      if(caseRef.current!==requestedCase)return;
      localStorage.setItem(key,nextTask.id);localStorage.setItem('labflow.task.'+caseId,nextTask.id);setPracticeParent(nextTask.parentId||parent);if(nextTask.questionId&&next==='anomaly')setAnomalyId(nextTask.questionId);setPendingMedia(undefined);taskRef.current=nextTask;setTask(nextTask);setLevel(next);setMode(next==='anomaly'?'assess':'practice');setFeedback(undefined);setReview(undefined);setJob(undefined);setHint('');setSelected(undefined);setHistory([]);setStale(false);setChat([]);const savedDraft=JSON.parse(localStorage.getItem('labflow.draft.'+nextTask.id)||'null') as Answer|null;restore(resuming?savedDraft||nextTask.initial:nextTask.initial);if(resuming)tell('已恢复这一层的练习草稿');
      setTimeout(()=>flow.fitView({padding:.25,duration:300,maxZoom:1}),200);
    } catch(e){tell((e as Error).message);} finally {setBusy(false);}
  }
  async function changeMode(next:Mode) {
    if(next===mode)return;
    if(next==='practice'||next==='assess'){await startExercise(next==='assess'?'anomaly':level==='anomaly'?'detail':level,false,true);return;}
    if(task){await api(`/tasks/${task.id}/assistance`,{});}
    if(job?.status==='running')await api(`/jobs/${job.id}/cancel`,{}).catch(()=>{});
    if(pollRef.current)clearTimeout(pollRef.current);
    localStorage.removeItem('labflow.task.'+caseId);setTask(undefined);taskRef.current=undefined;setMode(next);setJob(undefined);setFeedback(undefined);setReview(undefined);setHint('');setAnswerText('');setChat([]);
    if(next==='replay'&&lab){const id=lab.sequence[replayIndex];setSelected(id);setExpanded([lab.rootId,lab.steps.find(n=>n.id===id)?.parentId||lab.rootId]);}
  }
  async function checkAnswer() {
    if(!task||job?.status==='running')return;
    const taskId=task.id;const snapshot=answer();snapshotHash.current=JSON.stringify(snapshot);setStale(false);setFeedback(undefined);setReview(undefined);setJob({id:'starting',status:'running'});
    try {
      const result=await api<{id:string}>(`/tasks/${taskId}/check`,snapshot);if(taskRef.current?.id!==taskId){await api(`/jobs/${result.id}/cancel`,{});return;}setJob({id:result.id,status:'running'});
      const poll=async()=>{
        if(taskRef.current?.id!==taskId)return;
        try {
          const current=await api<PublicJob>(`/jobs/${result.id}`);
          if(taskRef.current?.id!==taskId)return;
          setJob(current);
          if(current.status==='running')pollRef.current=setTimeout(poll,900);
          else if(current.feedback){setFeedback(current.feedback);setStale(JSON.stringify(answer())!==snapshotHash.current);api<Progress>('/progress').then(setProgress);}
        }catch(e){tell((e as Error).message);setJob({id:result.id,status:'failed'});}
      };await poll();
    }catch(e){setJob({id:'failed',status:'failed',message:(e as Error).message});}
  }
  async function requestReview() {
    if(!task||!feedback||stale||job?.status!=='completed'||reviewBusy)return;
    const taskId=task.id;const snapshotId=feedback.snapshotId;const answerSnapshot=JSON.stringify(answer());setReviewBusy(true);
    try{const result=await api<TaskReview>(`/tasks/${taskId}/review`,{});if(taskRef.current?.id===taskId&&feedbackRef.current?.snapshotId===snapshotId&&result.snapshotId===snapshotId&&!staleRef.current&&JSON.stringify(answer())===answerSnapshot){setReview(result);setFocusCanvas(false);setTask(current=>current?{...current,assisted:true,helpLevel:result.helpLevel}:current);}}
    catch(e){if(taskRef.current?.id===taskId)tell((e as Error).message);}
    finally{if(taskRef.current?.id===taskId)setReviewBusy(false);}
  }
  async function changeCase(id:string){if(id===caseId)return;if(job?.status==='running'&&job.id!=='starting')await api(`/jobs/${job.id}/cancel`,{}).catch(()=>{});setJob(undefined);setCaseId(id);}
  async function requestHint(next:number) {
    if(!task||hintBusy)return;
    if(next===2&&stale){tell('答案已修改，请先重新检查；具体提示只对应上次提交。');return;}
    const taskId=task.id;const snapshotId=feedbackRef.current?.snapshotId;const answerSnapshot=JSON.stringify(answer());setHintBusy(true);
    try{
      const result=await api<{text:string;helpLevel:number;snapshotId?:string}>(`/tasks/${taskId}/hint`,{level:next});
      if(taskRef.current?.id!==taskId)return;
      setTask(t=>t?{...t,helpLevel:result.helpLevel,assisted:true}:t);
      if(next===2&&(feedbackRef.current?.snapshotId!==snapshotId||staleRef.current||JSON.stringify(answer())!==answerSnapshot)){
        tell('答案或检查结果已变化，请先检查最新答案，再请求具体提示。');return;
      }
      setHint(result.text);setFocusCanvas(false);setHintTier(next);
    }catch(e){if(taskRef.current?.id===taskId)tell((e as Error).message);}
    finally{setHintBusy(false);}
  }
  async function sendChat() {
    if(!chatInput.trim()||chatBusy)return;
    const message=chatInput;const id=caseId;const currentTask=task?.id;setChatInput('');setChat(c=>[...c,{role:'user',text:message}]);setChatBusy(true);
    try{const result=await api<{text:string;helpLevel?:number;assisted?:boolean;requestCheck?:boolean}>('/chat',{caseId,nodeId:selected,taskId:task?.id,message,history:chat.slice(-10)});if(caseRef.current===id&&taskRef.current?.id===currentTask){setChat(c=>[...c,{role:'assistant',text:result.text}]);if(result.assisted)setTask(t=>t?{...t,assisted:true,helpLevel:result.helpLevel??t.helpLevel}:t);if(result.requestCheck)await checkAnswer();}}
    catch(e){if(caseRef.current===id&&taskRef.current?.id===currentTask)setChat(c=>[...c,{role:'assistant',text:'这次请求未完成：'+(e as Error).message+'。可以稍后重新发送。'}]);}finally{setChatBusy(false);}
  }
  async function saveRefinement(media?:string[]) {
    if(!lab||!chosen)return;
    try{const updated=await api<LabCase>(`/cases/${caseId}/nodes/${chosen.id}`,{revision:lab.revision,patch:media?{media}:edit},'PATCH');setLab(updated);setEditing(false);tell(`已保存为参考版本 v${updated.revision}`);}catch(e){tell((e as Error).message);}
  }
  async function upload(file?:File) {
    if(!file||!chosen)return;
    if(file.size>5_000_000){tell('请选择 5 MB 以内的图片');return;}
    const reader=new FileReader();reader.onload=async()=>{try{const {id}=await api<{id:string}>('/media',{data:reader.result});await saveRefinement([...chosen.media,id]);}catch(e){tell((e as Error).message);}};reader.readAsDataURL(file);
  }
  const onConnect=(connection:Connection)=>{remember();setEdges(es=>addEdge({...connection,type:'default',markerEnd:{type:'arrowclosed',color:'#537b6b'},style:{stroke:'#537b6b',strokeWidth:2}},es));setStale(true);setReview(undefined);};
  const organizeAnswer=()=>{const current=graphRef.current;const positions=layoutAnswer(current.nodes.map(n=>n.id),Object.fromEntries(current.nodes.map(n=>[n.id,n.position])),current.edges.map(e=>({source:e.source,target:e.target})));setNodes(ns=>ns.map(n=>({...n,position:positions[n.id]})));setStale(true);setReview(undefined);};
  const addNode=()=>{remember();const id=crypto.randomUUID();setNodes(ns=>[...ns,{id,type:'step',position:{x:80+(ns.length%3)*270,y:70+Math.floor(ns.length/3)*180},data:{label:'',media:[],editable:true,practice:true,kind:'我的步骤',onText:(label:string)=>changeText(id,label),onMedia:(media:string)=>attachMedia(id,media),onRemoveMedia:(media:string)=>removeMedia(id,media)}}]);setStale(true);setReview(undefined);};
  const replayGo=(index:number)=>{if(!lab)return;setReplayIndex(index);setSelected(lab.sequence[index]);setExpanded([lab.rootId,lab.steps.find(n=>n.id===lab.sequence[index])?.parentId||lab.rootId]);};
  const saveAgentSettings=async()=>{const model=modelDraft.trim();if(!model)return;setAgentSettingsBusy(true);try{const status=await api<AgentState>('/agent/settings',{model},'PUT');setAgent(status);tell('模型设置已保存');}catch(e){tell((e as Error).message);}finally{setAgentSettingsBusy(false);}};
  const selectedAnomaly=lab?.anomalies.find(item=>item.id===(task?.questionId||anomalyId));
  return <div className={`app-shell ${focusCanvas?'focus-canvas':''} ${!practicing&&learningView==='scene'?'lab-scene-mode':''}`}>
    <header className="topbar"><a className="brand" href="/" aria-label="LabFlow 首页"><span className="brand-mark"><Layers3 size={22}/></span>Lab<span>Flow</span><small>实验学习工作台</small></a><div className="top-right"><span className="local-label">本地空间</span><button className="connection" onClick={refreshAgent}><i className={agent.available?'online':''}/>{agent.message}</button><button aria-label="模型设置" title="模型设置" onClick={()=>setAgentSettingsOpen(open=>!open)}><Settings2 size={16}/></button><div className="avatar">L</div></div>{agentSettingsOpen&&<section className="agent-settings" aria-label="模型设置"><div className="agent-settings-title"><strong>模型设置</strong><button aria-label="关闭模型设置" onClick={()=>setAgentSettingsOpen(false)}><X size={15}/></button></div><p>状态：{agent.available?(agent.backend==='openai-compatible'?'已配置，首次请求时验证':'Codex 可用'):'未连接'}{agent.backend?` · ${agent.backend}`:''}</p>{agent.available&&agentModels.length>0?<><label>模型<select aria-label="选择模型" value={agentModels.some(item=>item.model===modelDraft)?modelDraft:agent.backend==='openai-compatible'?'__custom__':agentModels[0]?.model||''} onChange={e=>{if(e.target.value!=='__custom__')setModelDraft(e.target.value);}}>{agentModels.map(item=><option key={item.model} value={item.model}>{item.model}{item.isDefault?'（默认）':''}</option>)}{agent.backend==='openai-compatible'&&<option value="__custom__">自定义 HTTP 模型</option>}</select></label>{agent.backend==='openai-compatible'&&<input aria-label="模型名称" placeholder="输入模型 ID" value={modelDraft} onChange={e=>setModelDraft(e.target.value)}/>}</>:<p className="model-unavailable">{agent.available?'尚未取得可选模型列表，请刷新状态。':'当前离线，连接后可选择模型；HTTP 模型仅在 HTTP 后端可配置。'}</p>}<div className="row"><button disabled={agentSettingsBusy} onClick={refreshAgent}>刷新状态</button><button className="primary" disabled={agentSettingsBusy||!agent.available||!modelDraft.trim()} onClick={saveAgentSettings}>{agentSettingsBusy?'保存中…':'保存模型'}</button></div><small>{agent.model?`当前模型：${agent.model}`:''}</small></section>}</header>
    <aside className="sidebar"><div className="sidebar-label"><LibraryBig size={15}/> 实验知识库 <span>02</span></div><div className="case-list">{cases.map(c=><button key={c.id} aria-label={c.title+' '+c.discipline} className={`case-button ${caseId===c.id?'active':''}`} onClick={()=>changeCase(c.id)}><span className="case-icon">{c.id==='wb'?<FlaskConical size={20}/>:<ScanLine size={20}/>}</span><span><strong>{c.title}</strong><small>{c.discipline}</small></span>{caseId===c.id&&<span className="case-dot"/>}</button>)}</div>
      <div className="sidebar-label secondary">学习路线</div><div className="route-list">{['建立整体印象','理解操作与原因','独立重建流程','处理异常情境'].map((label,i)=><div key={label} className={(mode==='learn'?0:mode==='assess'?3:2)===i?'route-active':''}><span>{String(i+1).padStart(2,'0')}</span>{label}</div>)}</div>
      <div className="progress-card"><span className="eyebrow">循序渐进</span><h3>{practicing?`${Math.min(count,2)} / 2 次独立完成`:'先看见整体，再走进细节'}</h3><div className="progress-track"><i style={{width:`${practicing?Math.min(count,2)*50:12}%`}}/></div><p>{practicing?(count>=2?'可以尝试下一层重建。你也可以继续巩固。':'提示由你决定何时开启。得到帮助的作答会单独记录。'):'按自己的节奏展开流程。准备好后，再试着把它回忆出来。'}</p></div>
      <div className="sidebar-footer"><span className="tiny-dot"/> 内容保存在这台电脑<small>INFO5000 · Group 8 Demo</small></div>
    </aside>
    <main className="workspace"><div className="workspace-heading"><div><div className="breadcrumb">实验知识库 <ChevronRight size={13}/> {lab?.discipline}</div><h1>{lab?.title || '正在打开实验…'}</h1><p>{lab?.subtitle}</p></div><select className="mobile-case-select" aria-label="切换场景实验" value={caseId} onChange={e=>changeCase(e.target.value)}>{cases.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select><span className="version">参考 v{practicing&&task?task.revision:lab?.revision || 1}</span></div>
      <div className="mode-bar"><div className="mode-tabs">{modes.map(({id,label,icon:Icon})=><button key={id} className={mode===id?'active':''} disabled={busy} onClick={()=>changeMode(id)}><Icon size={16}/>{label}</button>)}</div>{!practicing&&<div className="learning-view-switch" aria-label="学习视图"><button aria-pressed={learningView==='scene'} onClick={()=>{setLearningView('scene');setFocusCanvas(false);}}><FlaskConical size={14}/>实验场景</button><button aria-pressed={learningView==='flow'} onClick={()=>setLearningView('flow')}><Layers3 size={14}/>流程图</button></div>}<span className="save-state" style={!practicing?{display:'none'}:undefined}>{practicing?(saved?<><Check size={13}/> 草稿已保存</>:<><Loader2 size={13}/> 保存中</>):'按需展开 · 自由探索'}</span></div>
      {practicing?<div className="exercise-header"><div className="level-tabs">{mode==='practice'&&levels.map(item=><button className={level===item.id?'active':''} disabled={busy||(item.id==='images'&&!hasPracticeMedia)} title={item.id==='images'&&!hasPracticeMedia?'当前练习阶段暂无可用配图':''} key={item.id} onClick={()=>startExercise(item.id,false,true)}>{item.label}</button>)}{mode==='assess'&&<span className="eyebrow">异常判断 · 迁移理解</span>}{mode==='practice'&&!hasPracticeMedia&&<span className="media-unavailable">配图阶段不可用：当前练习阶段暂无配图</span>}<button className="new-exercise" onClick={()=>startExercise(level)} disabled={busy}><RotateCcw size={14}/> 换一题</button>{(level==='detail'||level==='anomaly')&&<button className="ai-exercise" disabled={busy} onClick={()=>startExercise(level,false,false,true)}><WandSparkles size={14}/>{busy?'正在出题…':'AI 出题'}</button>}</div>{mode==='practice'&&lab&&<label className="scope-select">练习阶段<select aria-label="选择练习阶段" value={task?.parentId||practiceParent} disabled={busy} onChange={e=>{const parent=e.target.value;setPracticeParent(parent);const nextLevel=level==='images'&&!lab.steps.some(step=>(step.parentId===parent||step.id===parent)&&step.media.length)?'detail':level;if(nextLevel!==level){setLevel(nextLevel);tell('该阶段没有配图，已切换到细节补全。');}startExercise(nextLevel,false,true,false,parent);}}>{lab.practiceParents.map(parent=><option key={parent} value={parent}>{lab.steps.find(step=>step.id===parent)?.title||parent}{!lab.steps.some(step=>(step.parentId===parent||step.id===parent)&&step.media.length)?'（暂无配图）':''}</option>)}</select></label>}{mode==='assess'&&lab&&lab.anomalies.length>0&&<label className="scope-select">异常情境<select aria-label="选择异常情境" value={task?.questionId||anomalyId} disabled={busy} onChange={e=>{setAnomalyId(e.target.value);startExercise('anomaly',false,false,false,practiceParent,e.target.value);}}>{lab.anomalies.map(item=><option key={item.id} value={item.id}>{item.category}</option>)}</select></label>}<div className="exercise-focus"><span className="eyebrow">{mode==='assess'?'当前情境':lab?.steps.find(step=>step.id===(task?.parentId||practiceParent))?.title||'当前练习'}</span>{mode!=='assess'&&<p>{task?.prompt}</p>}</div><div className="exercise-meta"><span className={`generation-pill ${task?.generation?.source==='ai'?'ai':''}`}>{task?.generation?.source==='ai'?'AI 生成题目':'题库练习'}{task?.generation?.message?` · ${task.generation.message}`:''}</span><span className={task?.assisted?'assisted':''}>{task?.assisted?'已获得帮助':'独立尝试中'}</span>{level==='images'&&!(task?.media?.length)&&<span className="media-unavailable">当前阶段暂无配图</span>}{task?.assisted&&<button className="fresh-round" disabled={busy} onClick={()=>startExercise(level,true)}>收起帮助，开始新一轮独立回忆</button>}</div></div>:learningView==='flow'?<div className="canvas-instruction"><span>{mode==='replay'?<Play size={16}/>:<CircleHelp size={16}/>}</span>{mode==='replay'?'逐步浏览参考流程。遇到新经验，随时补充笔记或修订。':'从一个总块开始。点击「展开学习」，逐层认识实验。'}<button onClick={()=>setExpanded(lab?[lab.rootId]:[])}>回到阶段总览 <ArrowUpRight size={14}/></button><button className="focus-toggle" aria-pressed={focusCanvas} onClick={()=>setFocusCanvas(value=>!value)}><Maximize2 size={14}/>{focusCanvas?'退出专注':'展开画布'}</button></div>:null}
      {!practicing&&learningView==='scene'&&lab&&lab.id===caseId&&<Suspense fallback={<div className="lab-scene-loading">正在布置实验台…</div>}><LabExperience key={lab.id} lab={lab} selected={selected} onSelect={id=>replayGo(lab.sequence.indexOf(id))} onPractice={()=>startExercise('detail')}/></Suspense>}
      {practicing&&level!=='anomaly'&&<div className="canvas-tools">{focusCanvas&&<span className="focus-context">{lab?.title} · {lab?.steps.find(step=>step.id===(task?.parentId||practiceParent))?.title} · {levels.find(item=>item.id===level)?.label}</span>}<button disabled={!nodes.length} onClick={organizeAnswer}><Layers3 size={15}/> 整理画布</button><button onClick={addNode}><Plus size={15}/> 添加步骤</button><button disabled={!history.length} onClick={()=>{const previous=history.at(-1);if(previous){restore(previous);setHistory(h=>h.slice(0,-1));setStale(true);setReview(undefined);}}}><Undo2 size={15}/> 撤销</button><button onClick={()=>flow.fitView({padding:.2,duration:250,maxZoom:1})} aria-label="适应画布"><Maximize2 size={15}/></button><button className="focus-toggle" aria-pressed={focusCanvas} onClick={()=>setFocusCanvas(value=>!value)}><Maximize2 size={15}/>{focusCanvas?'退出专注':'展开画布'}</button></div>}
      {(practicing||learningView==='flow')&&<section ref={canvasRef} className={`canvas-area ${level==='anomaly'&&practicing?'anomaly-canvas':''} ${!practicing?'learning-graph':''}`}>
        {level==='anomaly'&&practicing?<div className="scenario"><div className="scenario-icon"><ScanLine size={20}/></div><span className="eyebrow">{selectedAnomaly?.category||'异常情境'}</span><h2>{task?.prompt||selectedAnomaly?.prompt||'先做判断，再解释你的依据。'}</h2>{(task?.helpLevel===3||review)&&<p className="scenario-source">依据当前参考 v{task?.revision||lab?.revision}{selectedAnomaly?.source?' · 情境来源已用于本次参考':''}</p>}<textarea aria-label="异常判断答案" placeholder="我的判断是……因为……我会先检查……" value={answerText} onChange={e=>{setAnswerText(e.target.value);setStale(true);setReview(undefined);}}/></div>:<ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={changes=>{setNodes(ns=>applyNodeChanges(changes,ns));if(changes.some(c=>c.type==='position'&&c.dragging===false)){setStale(true);setReview(undefined);}}} onEdgesChange={changes=>{setEdges(es=>applyEdgeChanges(changes,es));if(changes.some(c=>c.type==='remove')){setStale(true);setReview(undefined);}}} onNodeClick={(_,n)=>{if(!practicing)setSelected(n.id);else if(pendingMedia&&level==='images')attachMedia(n.id,pendingMedia);}} onNodeDragStart={()=>{if(practicing)remember();}} onConnect={practicing?onConnect:undefined} nodesDraggable={practicing} nodesConnectable={practicing} edgesReconnectable={practicing} deleteKeyCode={practicing?['Backspace','Delete']:null} onBeforeDelete={async()=>{remember();return true;}} fitView minZoom={.25} maxZoom={1.5} defaultEdgeOptions={{type:'default',markerEnd:{type:'arrowclosed',color:'#537b6b'},style:{stroke:'#537b6b',strokeWidth:2}}} proOptions={{hideAttribution:false}}><Background color="#cdd4cd" gap={22} size={1}/><Controls showInteractive={false}/></ReactFlow>}
        {practicing&&level==='rebuild'&&nodes.length===0&&<div className="empty-canvas"><Layers3 size={38}/><h3>这一次，由你搭起流程。</h3><p>不预设步骤数量，从你记得的第一步开始。</p><button className="primary" onClick={addNode}><Plus size={16}/> 添加第一个步骤</button></div>}

        {!practicing&&<div className="canvas-legend"><i/> {mode==='replay'?'当前步骤已标记':'展开关系图'}<span>滚轮缩放 · 拖动画布</span></div>}
        {busy&&<div className="loading-cover"><Loader2 className="spin" size={24}/> 正在准备…</div>}
      </section>}
      {practicing&&level==='images'&&<div className="media-tray"><div><ImagePlus size={17}/><strong>配图卡片</strong><small>{pendingMedia?'已选卡片，点击流程块归位':'拖动，或先点图片再点流程块'}</small></div><div className="media-cards">{task?.media.map((id,i)=><button key={id} draggable aria-label={`选择示意卡片 ${i+1}`} aria-pressed={pendingMedia===id} onClick={()=>setPendingMedia(id)} onDragStart={e=>{e.dataTransfer.effectAllowed='copy';e.dataTransfer.setData('application/labflow-media',id);setPendingMedia(id);}}><img src={`/api/media/${id}`} alt={`可拖动示意卡片 ${i+1}`} draggable={false}/></button>)}</div></div>}
      {practicing?<div className="answer-bar">{level!=='anomaly'&&<textarea aria-label="补充文字答案" placeholder="补充你的解释，或写下理由（可选）…" value={answerText} onChange={e=>{setAnswerText(e.target.value);setStale(true);setReview(undefined);}}/>}<div className="answer-actions"><div><span className="feedback-label">{job?.status==='running'?<><Loader2 className="spin" size={15}/> 正在检查这次提交…</>:feedback?<><span className={`verdict ${feedback.verdict}`}>{feedback.verdict==='correct'?'正确':feedback.verdict==='incorrect'?'有错误':'无法判断'}</span><small>{stale?'答案已修改，结果对应上次提交':`评价来源：${feedbackSourceLabel(feedback.source)}`}{feedback.verdict==='uncertain'?(feedback.source==='rule'?' · 语义评价尚未完成':' · 依据不足，无法判定对错'):''}</small></>:job?.status==='failed'?<span className="error-text">{job.message||'检查未完成'}</span>:<span className="muted">先独立尝试，再决定是否需要帮助。</span>}</span></div>{job?.status==='running'?<button disabled={job.id==='starting'} onClick={async()=>{const result=await api<{cancelled:boolean}>(`/jobs/${job.id}/cancel`,{});if(result.cancelled)setJob({...job,status:'cancelled'});}}><Square size={14}/> 取消</button>:<div className="answer-primary-actions"><button className="primary review-button" disabled={!feedback||stale||job?.status!=='completed'||reviewBusy} onClick={requestReview}>{reviewBusy?<Loader2 className="spin" size={14}/>:<Sparkles size={14}/>}详细点评与修订</button><button className="primary" disabled={!task||busy} onClick={checkAnswer}><Check size={16}/> 检查答案</button></div>}</div><div className="help-actions"><button disabled={hintBusy} onClick={()=>requestHint(1)}><CircleHelp size={14}/> 给我一个提示</button>{(task?.helpLevel||0)>=1&&<button disabled={hintBusy} onClick={()=>requestHint(2)}>再具体一点</button>}<button className="answer-link" disabled={hintBusy} onClick={()=>requestHint(3)}>查看完整答案</button>{hintBusy&&<span role="status"><Loader2 className="spin" size={13}/> 正在核对提示…</span>}</div></div>:learningView==='scene'?null:mode==='replay'&&lab?<div className="replay-bar"><button disabled={replayIndex===0} onClick={()=>replayGo(replayIndex-1)}><ChevronLeft size={16}/> 上一步</button><div><span className="eyebrow">实操导览 {replayIndex+1} / {lab.sequence.length}</span><select aria-label="跳转实验步骤" value={replayIndex} onChange={e=>replayGo(Number(e.target.value))}>{lab.sequence.map((id,i)=><option value={i} key={id}>{i+1}. {lab.steps.find(s=>s.id===id)?.title}</option>)}</select></div><button className="primary" disabled={replayIndex===lab.sequence.length-1} onClick={()=>replayGo(replayIndex+1)}>下一步 <ChevronRight size={16}/></button></div>:<div className="learning-footer"><span><BookOpen size={16}/> 理解之后，试着不看答案重建它。</span><button className="primary" onClick={()=>startExercise('detail')}>开始回忆训练 <ArrowRight size={16}/></button></div>}
    </main>
    <aside className="coach-panel"><div className="coach-heading"><span className="coach-symbol"><Sparkles size={18}/></span><div><strong>学习伙伴</strong><small>让思考留在你手里</small></div><span className="agent-badge">{agent.backend==='openai-compatible'?'模型服务':'Codex'}</span></div>
      {!practicing&&chosen?<section className="detail-panel"><div className="detail-title"><span className="eyebrow">当前节点</span><button aria-label="关闭节点详情" onClick={()=>setSelected(undefined)}><X size={16}/></button></div><h2>{chosen.title}</h2>{editing?<div className="edit-form">{(['title','summary','why','check'] as const).map((key,i)=><label key={key}>{['名称','操作说明','为什么','检查点'][i]}<textarea value={edit[key]} onChange={e=>setEdit({...edit,[key]:e.target.value})}/></label>)}<div className="row"><button onClick={()=>setEditing(false)}>取消</button><button className="primary" onClick={()=>saveRefinement()}><Save size={14}/> 确认保存新版本</button></div></div>:<><p>{chosen.summary}</p><div className="detail-block"><strong>为什么这样做</strong><p>{chosen.why}</p></div><div className="detail-block"><strong>检查点</strong><p>{chosen.check}</p></div><div className="detail-media">{chosen.media.map((id,i)=><img key={id} src={`/api/media/${id}`} alt={`参考附件 ${i+1}`}/>)}</div><div className="row"><button onClick={()=>setEditing(true)}><Pencil size={13}/> 修订参考</button><button onClick={()=>uploadRef.current?.click()}><ImagePlus size={13}/> 附加图片</button></div><input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>upload(e.target.files?.[0])}/><details className="personal-note"><summary>我的笔记</summary><textarea aria-label="个人笔记" placeholder="记录自己的理解或实操经验…" value={note} onChange={e=>setNote(e.target.value)}/><button onClick={()=>api(`/notes/${caseId}/${chosen.id}`,{text:note},'PUT').then(()=>tell('笔记已保存')).catch(e=>tell(e.message))}>保存笔记</button></details><small className="source-note">来源：{chosen.source}</small></>}</section>:<div className="coach-intro"><span className="eyebrow">{practicing?'保持恰当的学习难度':'把实验变成可理解的结构'}</span><h2>{practicing?'我先检查，\n不替你想完。':'一步一步，\n建立你的实验地图。'}</h2><p>{practicing?'默认只告诉你是否有错。需要时，再由你请求一个方向或更具体的帮助。':'选择流程块查看操作、原因和检查点，也可以在这里提出具体问题。'}</p></div>}
      <div className="chat-area">{!practicing&&proposals.map(proposal=><div className="hint-box" key={proposal.id}><strong>参考修订建议</strong><p>{proposal.reason}</p><p>{Object.entries(proposal.patch).map(([key,value])=>key+': '+String(value)).join('；')}</p><button onClick={()=>api<LabCase>('/proposals/'+proposal.id+'/accept',{}).then(updated=>{setLab(updated);setProposals(items=>items.filter(item=>item.id!==proposal.id));tell('已确认修订');}).catch(e=>tell(e.message))}>确认应用建议</button></div>)}{hint&&<div className="hint-box"><span><CircleHelp size={16}/> {hintTier===1?'思考方向':hintTier===2?'具体提示':'参考答案'}</span><p>{hint}</p></div>}{review&&<section className="review-results" aria-label="详细点评与修订"><strong>详细点评与修订</strong><p>{review.text}</p>{review.annotations.map((item,index)=><article className={`review-annotation ${item.kind}`} key={`${index}-${item.quote}`}><span>{item.kind==='correct'?'做得好的地方':item.kind==='missing'?'可以补充':'需要修正'}</span><blockquote>{item.quote}</blockquote><p>{item.explanation}</p>{item.suggestion&&<small>修订建议：{item.suggestion}</small>}<small>来源：{item.source}</small></article>)}</section>}<div className="chat-section-label"><MessageCircle size={14}/> 当前学习对话</div>{chat.length===0&&<div className="chat-empty">{practicing?'可以说：“给我一个提示”。答案请提交到左侧练习区。':'比如：“这个步骤为什么放在这里？”'}</div>}{chat.map((m,i)=><div key={i} className={`chat-message ${m.role}`}>{m.role==='assistant'&&<span className="message-label">学习伙伴</span>}<p>{m.text}</p></div>)}{chatBusy&&<div className="chat-thinking"><Loader2 className="spin" size={14}/> 正在思考你的问题…</div>}<div ref={chatEnd}/></div><div className="chat-compose"><textarea aria-label="向学习伙伴提问" placeholder={practicing?'提问或请求提示…':'提出一个具体问题…'} value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();sendChat();}}}/><div>{practicing?<button className="write-answer" disabled={!chatInput.trim()} onClick={()=>{setAnswerText(chatInput);setChatInput('');setStale(true);setReview(undefined);tell('已写入答案，点检查即可提交');}}>写入答案</button>:<small>{selected?'已关联选中节点':'Enter 发送 · Shift+Enter 换行'}</small>}<button className="send-button" aria-label="发送问题" disabled={chatBusy||!chatInput.trim()} onClick={sendChat}><Send size={16}/></button></div></div>
    </aside>
    {toast&&<div className="toast" role="status">{toast}<button onClick={()=>setToast('')} aria-label="关闭通知"><X size={14}/></button></div>}
  </div>;
}
