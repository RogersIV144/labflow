import { Component, lazy, Suspense, type ReactNode, useEffect, useReducer, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, CircleHelp, Eye, Focus, Hand, Layers3, Maximize2, Minimize2, Pause, Play, RotateCcw, ScanLine, X } from 'lucide-react';
import type { LabCase } from '../../shared/types';
import { lessonForStep, lessons, practiceScope, scenePhases, stationNames, type Station } from './scene-data';
import { initialAdjustments, opticalSignals, playbackReducer } from './scene-state';
import { equipmentDetails } from './scene-equipment';
import { createHandsOnState, handsOnReducer, type HandsOnEvent } from './interaction-state';
import HandsOnPanel from './HandsOnPanel';
import type { SceneHandle } from './LabScene';
const LabScene = lazy(() => import('./LabScene').then(module => ({ default: module.LabScene })));

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="scene-fallback" role="status"><strong>三维场景未能加载</strong><p>操作导览仍可使用。请刷新页面后重试。</p></div> : this.props.children; }
}
import './lab.css';
import './equipment.css';

interface Props {
  lab: LabCase; selected?: string; focused: boolean;
  onSelect: (id: string) => void;
  onPractice: (parent: string) => void;
  onReference: (id: string) => void;
  onFocus: (focused: boolean) => void;
}

export default function LabExperience({ lab, selected, focused, onSelect, onPractice, onReference, onFocus }: Props) {
  const id = lessonForStep(lab, selected);
  const step = lab.steps.find(item => item.id === id)!;
  const lesson = lessons[id];
  const index = lab.sequence.indexOf(id);
  const optical = lab.id === 'jtc';
  const phases = scenePhases(lab);
  const phase = phases.find(item => item.steps.includes(id))!;
  const [playback, dispatch] = useReducer(playbackReducer, { stepId: id, action: 0, playing: false, fromStart: true, visited: [] });
  // The old step's completion must never leak into the first render of a new step.
  const action = playback.stepId === id ? playback.action : 0;
  const playing = playback.stepId === id && playback.playing;
  const [adjustments, setAdjustments] = useState(() => initialAdjustments(id));
  const { exploded, exposure, alignment } = adjustments;
  const [speed, setSpeed] = useState(1);
  const [isolated, setIsolated] = useState(false);
  const [inspected, setInspected] = useState<Station>();
  const [manual, setManual] = useState(false);
  const [handsOn, send] = useReducer(handsOnReducer, undefined, createHandsOnState);
  const [operating, setOperating] = useState<Station>(lesson.station);
  const previousManual = useRef(manual);
  const previousCase = useRef(lab.id);
  const [view, setView] = useState<'perspective' | 'top' | 'focus' | 'free'>('perspective');
  const scene = useRef<SceneHandle>(null);
  const root = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const stationButtons = useRef<Partial<Record<Station, HTMLButtonElement | null>>>({});
  const stationSteps = inspected ? lab.sequence.filter(key => lessons[key]?.station === inspected || inspected === 'fourier' && ['jtc-spectrum', 'jtc-read'].includes(key)) : [];
  const stations: Station[] = optical ? ['laser', 'iris', 'filter', 'lens', 'input', 'fourier', 'camera'] : [...new Set(lab.sequence.map(key => lessons[key].station))];
  const signals = opticalSignals(id, action);
  const select = (next: string) => { dispatch({ type: 'pause' }); if (manual) setOperating(lessons[next].station); onSelect(next); };
  const focus = (station?: Station) => { if (!station) setInspected(undefined); scene.current?.focus(station); setView('focus'); };
  const reset = () => { dispatch({ type: 'reset' }); setAdjustments(initialAdjustments(id)); };
  const seek = (next: number) => { dispatch({ type: 'seek', action: next, total: lesson.actions.length }); };
  const inspect = (station: Station) => { setInspected(station); focus(station); };
  const closeInspection = () => {
    setInspected(undefined);
    if (inspected) stationButtons.current[inspected]?.focus({ preventScroll: true });
  };
  const operateAt = (station: Station) => { setOperating(station); setInspected(undefined); scene.current?.focus(station); setView('focus'); };
  const interact = (event: HandsOnEvent) => {
    send(event);
    if (['wb-tip', 'wb-eject', 'wb-aspirate'].includes(event.type)) operateAt('sample');
    else if (['wb-lane', 'wb-dispense', 'wb-lid', 'wb-run'].includes(event.type)) operateAt('gel');
    else if (event.type === 'wb-transfer') operateAt('transfer');
    else if (event.type === 'wb-detect') operateAt('tray');
    else if (event.type === 'wb-capture') operateAt('imager');
  };
  const navigateManual = (step: string, station: Station) => { select(step); operateAt(station); };
  const switchMode = (next: boolean) => {
    dispatch({ type: 'pause' });
    if (handsOn.wb.running) send({ type: 'wb-run' });
    setManual(next); setInspected(undefined); if (next) setIsolated(true);
    if (next) { onSelect(optical ? 'jtc-axis' : 'wb-gel'); operateAt(optical ? 'iris' : 'sample'); }
  };

  useEffect(() => {
    dispatch({ type: 'select', stepId: id });
    setAdjustments(initialAdjustments(id)); setInspected(undefined);
  }, [id]);
  useEffect(() => {
    if (manual) scene.current?.focus(operating);
    else if (previousManual.current) scene.current?.focus(lesson.station);
    previousManual.current = manual;
  }, [manual, operating, id]);
  useEffect(() => {
    if (previousCase.current !== lab.id) {
      if (handsOn.wb.running) send({ type: 'wb-run' });
      if (manual) { setOperating(optical ? 'iris' : 'sample'); onSelect(optical ? 'jtc-axis' : 'wb-gel'); }
      previousCase.current = lab.id;
    }
  }, [lab.id]);
  useEffect(() => {
    if (!manual || optical || !handsOn.wb.running) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      if (!document.hidden) send({ type: 'wb-tick', delta: Math.min(now - previous, 200) / 18000 });
      previous = now;
    }, 80);
    return () => window.clearInterval(timer);
  }, [manual, optical, handsOn.wb.running]);
  useEffect(() => {
    const rail = strip.current;
    const button = rail?.querySelector<HTMLElement>('[aria-current="step"]');
    if (rail && button) rail.scrollTo({ left: button.offsetLeft - rail.offsetLeft - rail.clientWidth / 2 + button.offsetWidth / 2, behavior: 'auto' });
  }, [id]);
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => dispatch({ type: 'tick', stepId: id, total: lesson.actions.length }), 2600 / speed);
    return () => clearTimeout(timer);
  }, [playing, action, id, speed, lesson.actions.length]);
  useEffect(() => {
    const pause = () => { if (document.hidden) dispatch({ type: 'pause' }); };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, []);
  useEffect(() => {
    setAdjustments(current => ({ ...current, ...(id === 'wb-transfer' ? { exploded: action < 3 } : {}), ...(optical && index < 4 ? { alignment: action >= 2 ? 0 : 35 } : {}) }));
  }, [id, action]);

  return <div ref={root} className={`lab-experience ${optical ? 'optical' : 'biological'} ${focused ? 'lab-enlarged' : ''} ${manual ? 'is-hands-on' : ''}`} onKeyDown={event => {
    if (event.key === 'Escape') { closeInspection(); onFocus(false); }
  }}>
    <header className="lab-intro">
      <div><span className="lab-kicker">{optical ? 'OPTICAL LAB' : 'MOLECULAR LAB'} / 交互实验室</span><h2>{optical ? '沿着光路，理解两次测量。' : '把每一步，放回实验台。'}</h2></div>
      <button className="scene-reference-link" onClick={() => onReference(id)}><BookOpen size={15}/> 流程与笔记 <ArrowRight size={14}/></button>
    </header>
    <section className="experiment-mode" aria-label="实验操作模式"><div><button aria-pressed={!manual} onClick={() => switchMode(false)}><Eye size={14}/> 观看演示</button><button aria-pressed={manual} onClick={() => switchMode(true)}><Hand size={14}/> 动手操作</button></div><p>{manual ? '直接操作器材，观察由你产生的变化。切换步骤会保留当前实验状态。' : '先看清步骤，也可以随时切到动手操作，亲自试一次。'}</p></section>
    <nav className="lab-phases" aria-label="实验阶段">{phases.map((item, i) => <button key={item.id} aria-current={phase.id === item.id ? 'step' : undefined} onClick={() => select(item.steps[0])}><span>{String(i + 1).padStart(2, '0')}</span>{item.title}<small>{item.steps.length} 步</small></button>)}</nav>
    <div className="lab-body">
      <div className="lab-visual-column">
        <section className="lab-stage" aria-label={optical ? 'JTC 三维光学实验台' : 'Western Blot 三维实验台'}>
          <div className="stage-header"><div className="stage-title"><span className="live-dot"/><strong>{stationNames[inspected || (manual ? operating : lesson.station)]}</strong><span>{manual ? '动手操作' : '教学模型'}</span></div><div className="stage-tools"><button className="scene-isolate" aria-pressed={isolated} onClick={() => { setIsolated(value => !value); focus(inspected); }}><Eye size={14}/>{isolated ? '显示全部器材' : '仅看当前器材'}</button><button className="scene-expand" aria-label={focused ? '退出场景专注' : '放大实验场景'} aria-pressed={focused} onClick={() => onFocus(!focused)}>{focused ? <Minimize2 size={17}/> : <Maximize2 size={17}/>}</button></div></div>
          <SceneBoundary><Suspense fallback={<div className="scene-fallback">正在加载三维器材…</div>}><LabScene ref={scene} caseId={lab.id} stepId={id} station={manual ? operating : lesson.station} action={action} total={lesson.actions.length} isolated={isolated} running={manual ? !optical && handsOn.wb.running : playing} exploded={exploded} exposure={exposure} alignment={alignment} handsOn={manual ? handsOn : undefined} onInteract={interact} onInspect={inspect} onViewChange={setView}/></Suspense></SceneBoundary>
          <div className="stage-view-controls" aria-label="场景镜头"><button aria-pressed={view === 'perspective'} onClick={() => { setIsolated(false); scene.current?.reset(); setView('perspective'); }}><RotateCcw size={14}/> 全景</button><button aria-pressed={view === 'focus'} onClick={() => { setInspected(undefined); focus(); }}><Focus size={14}/> 当前操作</button><button aria-pressed={view === 'top'} onClick={() => { scene.current?.view('top'); setView('top'); }}><ScanLine size={14}/> 俯视</button></div>
          <span className="stage-caption">{optical ? 'JTC' : 'WB'} · {String(index + 1).padStart(2, '0')} / {lab.sequence.length}</span>
          <span className="stage-gesture"><Hand size={13}/> 拖动旋转 · 滚轮缩放</span>
        </section>
        <div className="scene-stations" aria-label="浏览实验器材">{stations.map(station => <button key={station} ref={button => { stationButtons.current[station] = button; }} aria-pressed={(inspected || (manual ? operating : lesson.station)) === station} aria-expanded={inspected === station} aria-controls={inspected === station ? 'equipment-guide' : undefined} onClick={() => inspect(station)}>{stationNames[station]}</button>)}</div>
        {inspected && <section id="equipment-guide" className="equipment-guide" aria-label="器材说明">
          <header className="equipment-guide-heading"><div><Eye size={15}/><h3>{stationNames[inspected]}</h3><span>观察部件</span></div><button aria-label="关闭器材说明" onClick={closeInspection}><X size={16}/></button></header>
          <dl className="equipment-parts">{equipmentDetails[inspected].parts.map(part => <div key={part.name}><dt>{part.name}</dt><dd>{part.description}</dd></div>)}</dl>
          <p className="equipment-look"><Focus size={13}/>{equipmentDetails[inspected].look}</p>
          <div className="equipment-related"><span>相关步骤</span><div className="station-step-links">{stationSteps.map(key => <button key={key} aria-current={key === id ? 'step' : undefined} onClick={() => { select(key); setInspected(undefined); }}>{lab.sequence.indexOf(key) + 1}. {lab.steps.find(item => item.id === key)?.title}</button>)}{!stationSteps.length && <span>配合光轴基准步骤观察光源与光路。</span>}</div></div>
        </section>}
        {manual ? <div className="manual-session-strip" aria-label="当前操作状态"><strong><i/>实验进行中</strong>{optical ? <><span>激光 {handsOn.optics.laserOn ? 'ON' : 'OFF'}</span><span>X {handsOn.optics.offsetX} / Y {handsOn.optics.offsetY}</span><span>{handsOn.optics.capture ? '已有采集快照' : '等待采集'}</span></> : <><span>吸头 {handsOn.wb.held} µL</span><span>泳道 {handsOn.wb.lane + 1}：{handsOn.wb.lanes[handsOn.wb.lane]} µL</span><span>{handsOn.wb.running ? '电泳运行中' : handsOn.wb.progress === 1 ? '电泳完成' : '等待操作'}</span></>}</div> : <><div className="lab-playback" aria-label="演示控制">
          <button className="lab-play" aria-label={playing ? '暂停操作演示' : '播放操作演示'} onClick={() => { if (!playing) focus(); dispatch({ type: 'toggle', total: lesson.actions.length }); }}>{playing ? <Pause size={19}/> : <Play size={19} fill="currentColor"/>}</button>
          <div className="playback-label" aria-live="polite"><strong>{playing ? '正在演示' : action === lesson.actions.length ? '演示结束，可逐项回看' : action ? '已暂停 · 可自由观察' : '准备就绪'}</strong><span>{action ? lesson.actions[action - 1] : '播放本步，或选择右侧任一操作'}</span></div>
          <label className="playback-speed"><span>演示速度</span><select aria-label="演示速度" value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value={.5}>0.5×</option><option value={1}>1×</option><option value={1.5}>1.5×</option></select></label>
          <button className="playback-reset" aria-label="重置本步演示和参数" title="重置本步" onClick={reset}><RotateCcw size={16}/></button>
        </div>
        <div className="action-scrubber"><span>{action} / {lesson.actions.length}</span><input aria-label="演示进度" type="range" min="0" max={lesson.actions.length} value={action} onChange={e => seek(Number(e.target.value))}/><span>逐项回看</span></div></>}
        <div className="lab-step-navigation"><button aria-label="上一个场景步骤" disabled={index === 0} onClick={() => select(lab.sequence[index - 1])}><ChevronLeft size={17}/></button><label><span>当前步骤</span><select aria-label="跳转场景步骤" value={id} onChange={e => select(e.target.value)}>{lab.sequence.map((key, i) => <option key={key} value={key}>{String(i + 1).padStart(2, '0')} · {lab.steps.find(item => item.id === key)?.title}</option>)}</select></label><button className="lab-next" disabled={index === lab.sequence.length - 1} onClick={() => select(lab.sequence[index + 1])}>下一步 <ChevronRight size={16}/></button></div>
      </div>
      <aside className="lab-instructions" aria-label="当前步骤操作导览">
        {manual ? <HandsOnPanel key={lab.id} optical={optical} state={handsOn} stepId={id} send={interact} navigate={navigateManual}/> : <>
        <div className="lesson-title"><span className="lesson-number">{String(index + 1).padStart(2, '0')}</span><div><span className="lesson-phase">{phase.title}</span><h3>{step.title}</h3></div></div>
        <p className="lesson-equipment">{lesson.equipment}</p><p className="lesson-summary">{step.summary}</p>
        <section className="lesson-section"><h4><Hand size={15}/> 操作导览 <span>点击回看</span></h4><ol className="lesson-actions">{lesson.actions.map((text, i) => <li key={text}><button aria-current={action === i + 1 ? 'step' : undefined} onClick={() => { seek(i + 1); focus(); }}><span>{action > i + 1 ? <Check size={13}/> : i + 1}</span><strong>{text}</strong>{action === i + 1 && <Eye size={15}/>}</button></li>)}</ol></section>
        {id === 'wb-collect' && action >= 3 && <div className="sample-section"><svg viewBox="0 0 220 100" role="img" aria-label="离心后上部上清与底部沉淀"><path d="M26 9h38v60L45 91 26 69Z" fill="#dce9df" stroke="#537b6b"/><path d="M28 27h34v41L45 87 28 68Z" fill="#92c4bd"/><path d="m37 80 8 9 8-9Z" fill="#bd9859"/><path d="M53 44h35M49 84h39" stroke="#54755e"/><text x="96" y="47">上清 · 避免扰动沉淀</text><text x="96" y="87">沉淀</text></svg></div>}
        {lesson.station === 'transfer' && <section className="scene-adjustment"><h4><Layers3 size={15}/> 转膜夹层</h4><button aria-pressed={exploded} onClick={() => setAdjustments(current => ({ ...current, exploded: !current.exploded }))}>{exploded ? '合拢夹层' : '展开夹层'} <Layers3 size={14}/></button><p>阴极 → 凝胶 → 膜 → 阳极<br/>滤纸与纤维垫位于夹层外侧。</p></section>}
        {lesson.station === 'imager' && <section className="scene-adjustment"><label htmlFor="lab-exposure">示意曝光 <span>{exposure > 75 ? '信号趋于饱和' : exposure < 20 ? '信号偏弱' : '可观察条带差异'}</span></label><input id="lab-exposure" type="range" min="5" max="100" value={exposure} onChange={e => setAdjustments(current => ({ ...current, exposure: Number(e.target.value) }))}/><BlotPreview exposure={exposure}/><p>合成图像 · 相对强度，不对应真实曝光时间。</p></section>}
        {optical && <section className="scene-adjustment">{index < 4 && <><label htmlFor="lab-alignment">{id === 'jtc-collimate' ? '准直偏差' : '光轴偏移'}<span>{Math.abs(alignment) < 7 ? '接近基准' : '观察偏差'}</span></label><input id="lab-alignment" type="range" min="-60" max="60" value={alignment} onChange={e => setAdjustments(current => ({ ...current, alignment: Number(e.target.value) }))}/><div className="alignment-spots">{['近处光屏', '远处光屏'].map((label, i) => <div key={label}><svg viewBox="0 0 100 60" role="img" aria-label={`${label}光斑示意`}><path d="M50 5v50M5 30h90" stroke="#879f95" strokeWidth=".7"/><circle cx={50 + alignment / (i ? 3 : 5)} cy="30" r={id === 'jtc-collimate' && i ? 7 + Math.abs(alignment) / 6 : 7} fill="#f2d7a5"/></svg><span>{label}</span></div>)}</div></>}
          <div className="optical-signal-chain"><div><span>输入面</span><OpticalPreview kind={signals.input}/><strong>{signals.input === 'input' ? '双目标图' : '已回显的功率谱'}</strong></div><ArrowRight size={16}/><div><span>采集结果</span>{signals.output === 'empty' ? <div className="signal-empty">等待本次采集</div> : <OpticalPreview kind={signals.output}/>}<strong>{signals.output === 'correlation' ? '相关结构' : signals.output === 'spectrum' ? '联合功率谱' : '尚未产生结果'}</strong></div></div><p>合成图像 · 结构示意，不代表实测结果。</p></section>}
        <section className="lesson-observe"><Eye size={17}/><div><h4>停下来，观察一下</h4><p>{action === lesson.actions.length ? lesson.observation : step.check}</p></div></section>
        <details className="lesson-reference"><summary><CircleHelp size={15}/> 为什么这样做 · 参考依据</summary><p>{step.why}</p><small>{step.source}</small></details>
        <button className="scene-practice" onClick={() => onPractice(practiceScope(lab, id))}>回忆这一阶段 <ArrowRight size={15}/></button>
        </>}
      </aside>
    </div>
    <section className="lab-journey" aria-label="实验场景步骤"><div className="journey-heading"><strong>{phase.title}</strong><span>本次完整播放 {playback.visited.length} / {lab.sequence.length} 步</span></div><div className="journey-strip" ref={strip}>{phase.steps.map(key => <button key={key} aria-label={`场景步骤 ${lab.sequence.indexOf(key) + 1} ${lab.steps.find(item => item.id === key)?.title}`} aria-current={key === id ? 'step' : undefined} onClick={() => select(key)}><span>{playback.visited.includes(key) ? <Check size={13}/> : String(lab.sequence.indexOf(key) + 1).padStart(2, '0')}</span><strong>{lab.steps.find(item => item.id === key)?.title}</strong></button>)}</div></section>
    <p className="lab-footnote">教学示意 · 动画时长与器材比例不代表实际实验条件。演示不计入独立训练成绩。</p>
  </div>;
}
function BlotPreview({ exposure }: { exposure: number }) {
  return <div className="blot-preview" aria-label="合成条带示意图"><span>M</span>{['C1', 'C2', 'T1', 'T2'].map(label => <span key={label}>{label}</span>)}{Array.from({ length: 5 }, (_, lane) => <div className="blot-lane" key={lane}>{(lane === 0 ? [12, 25, 37, 52, 67, 82] : [37, 72]).map((top, row) => <i key={top} style={{ top: `${top}%`, opacity: Math.min(1, exposure / 70 * (lane === 0 ? .75 : row ? .7 : .35 + lane * .16)), height: `${exposure > 75 ? 7 : 4}px` }}/>)}</div>)}</div>;
}
function OpticalPreview({ kind }: { kind: 'input'|'spectrum'|'correlation' }) {
  return <svg viewBox="0 0 140 75" role="img" aria-label={kind === 'input' ? '合成双目标图' : kind === 'spectrum' ? '合成联合功率谱' : '合成相关输出'}><rect width="140" height="75" fill="#101e24"/>{kind === 'input' ? <g fill="none" stroke="#d9ecd9" strokeWidth="5"><path d="M32 23v30h18M90 23v30h18"/></g> : kind === 'spectrum' ? <g>{Array.from({ length: 27 }, (_, i) => <path key={i} d={`M${12 + i * 4.4} 8v59`} stroke="#bdd9ab" strokeWidth="2" opacity={Math.max(.06, .8 * Math.exp(-(((i - 13) / 7) ** 2)))}/>)}</g> : <g fill="#e6eed1"><ellipse cx="70" cy="38" rx="8" ry="11" opacity=".9"/><circle cx="30" cy="38" r="5"/><circle cx="110" cy="38" r="5"/></g>}</svg>;
}
