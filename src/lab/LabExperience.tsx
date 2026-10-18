import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Box, Check, ChevronLeft, ChevronRight, CircleHelp, Eye, Focus, Hand, Layers3, Maximize2, Pause, Play, RotateCcw, ScanLine } from 'lucide-react';
import type { LabCase } from '../../shared/types';
import { lessonForStep, lessons, stationNames, type Station } from './scene-data';
import { LabScene, type SceneHandle } from './LabScene';
import './lab.css';

interface Props { lab: LabCase; selected?: string; onSelect: (id: string) => void; onPractice: () => void; }

export default function LabExperience({ lab, selected, onSelect, onPractice }: Props) {
  const id = lessonForStep(lab, selected);
  const step = lab.steps.find(item => item.id === id)!;
  const lesson = lessons[id];
  const index = lab.sequence.indexOf(id);
  const optical = lab.id === 'jtc';
  const [action, setAction] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [paused,setPaused] = useState(false);
  const [exploded, setExploded] = useState(false);
  const [exposure, setExposure] = useState(40);
  const [alignment, setAlignment] = useState(0);
  const [inspected, setInspected] = useState<Station>();
  const [visited, setVisited] = useState<string[]>([]);
  const [view, setView] = useState<'perspective'|'top'>('perspective');
  const [enlarged, setEnlarged] = useState(false);
  const scene = useRef<SceneHandle>(null);
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => { setAction(0); setPlaying(false); setPaused(false); setInspected(undefined); setExploded(id === 'wb-transfer'); setAlignment(optical && index < 4 ? 35 : 0); }, [id, lab.revision]);
  useEffect(() => {
    const rail = strip.current;
    const button = rail?.querySelector<HTMLElement>('[aria-current="step"]');
    if (rail && button) rail.scrollTo({ left: button.offsetLeft - rail.offsetLeft - rail.clientWidth / 2 + button.offsetWidth / 2, behavior: 'smooth' });
  }, [id]);
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (action < lesson.actions.length) setAction(value => value + 1);
      else setPlaying(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [playing, action, id]);
  useEffect(() => {
    if (action === lesson.actions.length) setVisited(current => current.includes(id) ? current : [...current, id]);
  }, [id, action, lesson.actions.length]);
  useEffect(()=>{if(action===1)scene.current?.focus();if(id==='wb-transfer'&&action>0)setExploded(action<3);if(optical&&index<4&&action>=2)setAlignment(0);},[id,action]);
  const advance = () => { setPaused(false); setPlaying(false); setAction(value => Math.min(lesson.actions.length, value + 1)); };
  const pickStation = (station: Station) => setInspected(station);
  const stationSteps = inspected ? lab.sequence.filter(key => lessons[key]?.station === inspected) : [];
  const isImaging = lesson.station === 'imager';

  return <div className={`lab-experience ${optical ? 'optical' : 'biological'} ${enlarged ? 'lab-enlarged' : ''}`}>
    <div className="lab-intro"><div><h2>{optical ? '让看不见的光路，变得清晰。' : '从流程，走进实验台。'}</h2><p>{optical ? '沿着光束，理解两次测量之间的联系。' : '靠近器材，观察操作，把每一步与真实场景连起来。'}</p></div><span className="lab-medium"><Box size={14}/> 交互式 3D 场景</span></div>
    <div className="lab-body">
      <div className="lab-visual-column">
        <section className="lab-stage" aria-label={optical ? 'JTC 三维光学实验台' : 'Western Blot 三维实验台'}>
          <div className="stage-header"><div className="stage-title"><span className="live-dot"/>{optical ? '光学实验室' : '分子生物学实验室'}<span className="stage-divider"/>{stationNames[lesson.station]}</div><div className="stage-view-controls"><button aria-label="重置三维视角" title="重置视角" onClick={() => { scene.current?.reset(); setView('perspective'); }}><RotateCcw size={15}/></button><button aria-label="切换俯视视角" title="切换俯视视角" aria-pressed={view === 'top'} onClick={() => { const next = view === 'top' ? 'perspective' : 'top'; setView(next); scene.current?.view(next); }}><ScanLine size={15}/></button><button aria-label={enlarged ? '退出场景专注' : '放大实验场景'} title="场景专注" aria-pressed={enlarged} onClick={() => setEnlarged(value => !value)}><Maximize2 size={15}/></button></div></div>
          <LabScene ref={scene} caseId={lab.id} stepId={id} station={lesson.station} action={action} total={lesson.actions.length} paused={paused} exploded={exploded} exposure={exposure} alignment={alignment} onInspect={pickStation}/>
          <div className="stage-caption"><span>{optical ? 'JTC / OPTICAL BENCH' : 'WB / EXPERIMENT BENCH'}</span><strong>{optical ? '光束路径已可视化' : '器材可点击查看'}<span>教学模型 · 非实测图像</span></strong></div>
          {inspected && <div className="station-popover" role="status"><div><Eye size={15}/><strong>{stationNames[inspected]}</strong><button aria-label="关闭器材说明" onClick={() => setInspected(undefined)}>×</button></div><p>{stationSteps.length ? `用于${stationSteps.map(key => lab.steps.find(item => item.id === key)?.title).join('、')}。` : '光路的组成器件，配合当前步骤观察。'}</p>{stationSteps.length > 0 && <button onClick={() => onSelect(stationSteps[0])}>定位相关步骤 <ArrowRight size={13}/></button>}</div>}
          <button className="stage-focus" onClick={()=>scene.current?.focus()}><Focus size={13}/>靠近当前操作</button><div className="stage-gesture"><Hand size={13}/> 拖动旋转 <span>·</span> 滚轮缩放 <span>·</span> 点击器材</div>
        </section>
        <div className="lab-playback"><button className={`lab-play ${playing ? 'is-playing' : ''}`} aria-label={playing ? '暂停操作演示' : '播放操作演示'} onClick={() => { if (action >= lesson.actions.length) setAction(0); setPaused(playing); setPlaying(value => !value); }}>{playing ? <Pause size={19}/> : <Play size={19} fill="currentColor"/>}</button><div className="playback-label"><strong>{playing ? '正在演示操作' : action === lesson.actions.length ? '本步演示完成' : '观察这一刻的变化'}</strong><span>{action ? lesson.actions[action - 1] : '点击播放，或逐项操作右侧清单'}</span></div><div className="action-track" aria-label={`已演示 ${action} / ${lesson.actions.length} 项操作`}>{lesson.actions.map((_, i) => <i key={i} className={i < action ? 'done' : ''}/>)}</div><button className="playback-reset" aria-label="重置本步演示" onClick={() => { setAction(0); setPlaying(false); setPaused(false); }}><RotateCcw size={16}/></button></div>
        <div className="lab-step-navigation"><button aria-label="上一个场景步骤" disabled={index === 0} onClick={() => onSelect(lab.sequence[index - 1])}><ChevronLeft size={18}/></button><div><span>步骤 {String(index + 1).padStart(2, '0')} <i>/ {String(lab.sequence.length).padStart(2, '0')}</i></span><strong>{step.title}</strong></div><button className="lab-next" disabled={index === lab.sequence.length - 1} onClick={() => onSelect(lab.sequence[index + 1])}>下一步 <ChevronRight size={16}/></button></div>
      </div>
      <aside className="lab-instructions" aria-label="当前步骤操作导览"><div className="lesson-title"><span className="lesson-number">{String(index + 1).padStart(2, '0')}</span><div><h3>{step.title}</h3><p>{lesson.equipment}</p></div></div><p className="lesson-summary">{step.summary}</p>
        <div className="lesson-section"><h4><Hand size={15}/> 操作导览 <span>点击逐项演示</span></h4><ol className="lesson-actions">{lesson.actions.map((text, i) => <li key={text}><button disabled={i > action} aria-pressed={i < action} onClick={() => { if (i === action) advance(); }}><span className={i < action ? 'completed' : i === action ? 'current' : ''}>{i < action ? <Check size={12}/> : i + 1}</span>{text}{i === action && <ChevronRight size={14}/>}</button></li>)}</ol></div>
        {id==='wb-collect'&&action>=3&&<div className="sample-section" aria-label="离心后样品剖面示意"><svg viewBox="0 0 190 100" role="img" aria-label="上部上清与底部沉淀"><path d="M26 9h38v60L45 91 26 69Z" fill="#dce9df" stroke="#537b6b"/><path d="M28 27h34v41L45 87 28 68Z" fill="#92c4bd"/><path d="m37 80 8 9 8-9Z" fill="#bd9859"/><path d="M53 44h35M49 84h39" stroke="#54755e"/><text x="96" y="47">上清 · 避免扰动沉淀</text><text x="96" y="87">沉淀</text></svg></div>}
        {lesson.station === 'transfer' && <div className="scene-adjustment"><div><Layers3 size={15}/><strong>查看转膜夹层</strong></div><button aria-pressed={exploded} onClick={() => setExploded(value => !value)}>{exploded ? '合拢夹层' : '展开夹层'} <Layers3 size={14}/></button><p>阴极 → 凝胶 → 膜 → 阳极<br/>滤纸与纤维垫位于夹层外侧。</p>{id==='wb-transfer'&&action>=3&&<svg className="transfer-section" viewBox="0 0 220 100" role="img" aria-label="蛋白从凝胶转向阳极侧膜的方向示意"><text x="8" y="13">阴极 −</text><rect x="8" y="24" width="130" height="18" rx="3" fill="#b2d0d3"/><text x="153" y="37">凝胶</text><rect x="8" y="68" width="130" height="9" rx="2" fill="#dce6ca" stroke="#6e8b5d"/><text x="153" y="77">膜</text><text x="8" y="96">阳极 +</text>{[30,60,90,120].map((x,i)=><g key={x}><path d={`M${x} 44v20m-3-4 3 4 3-4`} stroke="#6b8864" fill="none"/><circle className="transfer-protein" cx={x} cy="33" r="3" fill="#3e6a81" style={{animationDelay:`${i*.18}s`,animationPlayState:paused?'paused':'running'}}/></g>)}</svg>}</div>}
        {isImaging && <div className="scene-adjustment"><label htmlFor="lab-exposure">示意曝光 <span>{exposure > 75 ? '信号趋于饱和' : exposure < 20 ? '信号偏弱' : '可观察条带差异'}</span></label><input id="lab-exposure" type="range" min="5" max="100" value={exposure} onChange={e => setExposure(Number(e.target.value))}/><p>相对演示强度，不对应真实曝光时间。</p><BlotPreview exposure={exposure}/></div>}
        {optical && <div className="scene-adjustment"><label htmlFor="lab-alignment">{id === 'jtc-collimate' ? '准直偏差' : '光轴偏移'}<span>{Math.abs(alignment) < 7 ? '接近基准' : '观察偏差'}</span></label><input id="lab-alignment" type="range" min="-60" max="60" value={alignment} onChange={e => setAlignment(Number(e.target.value))}/>{index < 4 && <div className="alignment-spots"><span>近处光屏</span><svg viewBox="0 0 75 55" aria-label="近处光斑示意"><path d="M37 5v45M5 27h65" stroke="#769086" strokeWidth=".5"/><circle cx={37+alignment/5} cy="27" r="7" fill="#e2c69a"/></svg><span>远处光屏</span><svg viewBox="0 0 75 55" aria-label="远处光斑示意"><path d="M37 5v45M5 27h65" stroke="#769086" strokeWidth=".5"/><circle cx={37+alignment/3} cy="27" r={id==='jtc-collimate'?7+Math.abs(alignment)/6:7} fill="#e2c69a"/></svg></div>}<div className="optical-readout"><OpticalPreview kind={index >= 7 && action >= 1 ? 'correlation' : index >= 5 && (id !== 'jtc-reload' || action >= 2) ? 'spectrum' : 'input'}/><div><strong>{index >= 7 ? action>=1?'第二次 · 相关输出':'准备第二次测量' : index===6 ? action>=2?'输入面 · 回显功率谱':'输入面 · 双目标图' : index >= 5 ? '第一次 · 联合功率谱' : '联合输入'}</strong><span>合成图像 · 结构示意</span></div></div></div>}
        <div className="lesson-observe" aria-live="polite"><Eye size={16}/><div><h4>你应该观察什么</h4><p>{action === lesson.actions.length ? lesson.observation : step.check}</p></div></div>
        <details className="lesson-reference"><summary><CircleHelp size={14}/> 为什么这样做 · 参考依据</summary><p>{step.why}</p><small>{step.source}</small><p>场景为依据当前参考构建的教学示意，器材造型、动画时长与数据不代表实验室设备或实测结果。具体参数遵循实验室确认方案。</p></details>
      </aside>
    </div>
    <section className="lab-journey" aria-label="实验场景步骤"><div className="journey-heading"><strong>实验全程</strong><span>{visited.length} / {lab.sequence.length} 步已演示</span><button onClick={onPractice}>去回忆训练 <ArrowRight size={13}/></button></div><div className="journey-strip" ref={strip}>{lab.sequence.map((key, i) => <button key={key} aria-label={`场景步骤 ${i + 1} ${lab.steps.find(item => item.id === key)?.title}`} aria-current={key === id ? 'step' : undefined} onClick={() => onSelect(key)}><span>{visited.includes(key) ? <Check size={12}/> : String(i + 1).padStart(2, '0')}</span><strong>{lab.steps.find(item => item.id === key)?.title}</strong></button>)}</div></section>
    <p className="lab-footnote"><Focus size={13}/> 先观察，再解释，最后独立回忆。场景演示不计入独立完成次数。</p>
  </div>;
}

function BlotPreview({ exposure }: { exposure: number }) {
  return <div className="blot-preview" aria-label="合成条带示意图"><span>M</span>{['C1', 'C2', 'T1', 'T2'].map(label => <span key={label}>{label}</span>)}{Array.from({ length: 5 }, (_, lane) => <div className="blot-lane" key={lane}>{(lane === 0 ? [12, 25, 37, 52, 67, 82] : [37, 72]).map((top, row) => <i key={top} style={{ top: `${top}%`, opacity: Math.min(1, exposure / 70 * (lane === 0 ? .75 : row ? .7 : .35 + lane * .16)), height: `${exposure > 75 ? 7 : 4}px` }}/>)}</div>)}</div>;
}
function OpticalPreview({ kind }: { kind: 'input'|'spectrum'|'correlation' }) {
  return <svg viewBox="0 0 140 75" role="img" aria-label={kind === 'input' ? '合成双目标图' : kind === 'spectrum' ? '合成联合功率谱' : '合成相关输出'}><rect width="140" height="75" fill="#101e24"/>{kind === 'input' ? <g fill="none" stroke="#d9ecd9" strokeWidth="5"><path d="M32 23v30h18M90 23v30h18"/></g> : kind === 'spectrum' ? <g>{Array.from({ length: 27 }, (_, i) => <path key={i} d={`M${12 + i * 4.4} 8v59`} stroke="#bdd9ab" strokeWidth="2" opacity={Math.max(.06, .8 * Math.exp(-(((i - 13) / 7) ** 2)))}/>)}</g> : <g fill="#e6eed1"><ellipse cx="70" cy="38" rx="8" ry="11" opacity=".9"/><circle cx="30" cy="38" r="5"/><circle cx="110" cy="38" r="5"/></g>}</svg>;
}
