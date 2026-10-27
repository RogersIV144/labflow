import { useEffect, useState } from 'react';
import { ArrowRight, Check, CircleDot, Droplets, MoveHorizontal, Power, RotateCcw, ScanLine } from 'lucide-react';
import { opticalMetrics, type HandsOnEvent, type HandsOnState, type OpticalCapture, type OpticsState, type WBState } from './interaction-state';
import { lessons, type Station } from './scene-data';
import './interaction.css';

interface Props {
  optical: boolean; state: HandsOnState; stepId: string;
  send: (event: HandsOnEvent) => void;
  navigate: (step: string, station: Station) => void;
}
const wbTasks = [
  { label: '移液加样', step: 'wb-gel', station: 'sample' },
  { label: '电泳分离', step: 'wb-gel', station: 'gel' },
  { label: '转膜检测', step: 'wb-transfer', station: 'transfer' },
  { label: '曝光成像', step: 'wb-image', station: 'imager' },
] as const;

export default function HandsOnPanel({ optical, state, stepId, send, navigate }: Props) {
  const [task, setTask] = useState(0);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    if (optical) return;
    if (['transfer', 'tray'].includes(lessons[stepId].station)) setTask(2);
    else if (lessons[stepId].station === 'imager') setTask(3);
    else setTask(current => stepId === 'wb-gel' && current === 1 ? 1 : 0);
  }, [stepId, optical]);
  const feedback = optical ? state.optics.feedback : state.wb.feedback;
  return <section className="hands-on-console" aria-label={optical ? '光学实验操作台' : 'WB 实验操作台'}>
    <header className="console-heading"><div><span>HANDS-ON LAB</span><h3>你的实验操作台</h3></div><button aria-label={optical ? '重置光学实验' : '重置 WB 实验'} title="清空本实验操作" onClick={() => { send({ type: optical ? 'opt-reset' : 'wb-reset' }); setTask(0); setGeneration(value => value + 1); navigate(optical ? 'jtc-axis' : 'wb-gel', optical ? 'iris' : 'sample'); }}><RotateCcw size={16}/></button></header>
    <p className="console-intro">{optical ? '改变旋钮，观察光斑，再把这一刻的结果采下来。' : '从已完成前处理的同一样品出发，试试加样量如何改变结果。'}</p>
    <div className={`operation-feedback ${feedback.tone}`} role="status" aria-live="polite"><CircleDot size={15}/><span>{feedback.text}</span></div>
    {optical ? <OpticalControls key={generation} state={state.optics} send={send} navigate={navigate}/> : <>
      <nav className="operation-tasks" aria-label="动手实验任务">{wbTasks.map((item, i) => <button key={item.label} aria-current={task === i ? 'step' : undefined} onClick={() => { setTask(i); navigate(item.step, item.station); }}><span>{i + 1}</span>{item.label}</button>)}</nav>
      {task === 0 && <>
        <div className="pipette-readout"><Droplets size={22}/><div><span>移液器设定</span><strong>{state.wb.volume}<small> µL</small></strong></div><div><span>吸头内</span><strong>{state.wb.held}<small> µL</small></strong></div></div>
        <ControlRange label="移液体积" value={state.wb.volume} min={5} max={30} unit="µL" onChange={value => send({ type: 'wb-volume', value })}/>
        <div className="control-pair"><button onClick={() => send({ type: 'wb-tip' })}>装新吸头</button><button onClick={() => send({ type: 'wb-eject' })}>退掉吸头</button></div>
        <dl className="instrument-state"><div><dt>吸头状态</dt><dd>{state.wb.tip === 'none' ? '未安装' : state.wb.tip === 'clean' ? '干净' : '已使用'}</dd></div><div><dt>样品余量</dt><dd>{state.wb.source} µL</dd></div></dl>
        <button className="operation-primary" onClick={() => send({ type: 'wb-aspirate' })}><Droplets size={16}/> 从样品管吸液</button>
        <h4 className="control-label">选择目标泳道</h4>
        <LaneSelector state={state.wb} send={send}/>
        <button className="operation-primary" onClick={() => send({ type: 'wb-dispense' })}>向泳道 {state.wb.lane + 1} 加样 <ArrowRight size={16}/></button>
        <p className="control-note">也可直接点击三维吸头盒、源样品管与泳道。每次加样后换新吸头。练习容量为 30 µL／泳道，不代表实际胶孔规格。</p>
        <button className="operation-next" onClick={() => { setTask(1); navigate('wb-gel', 'gel'); }}>查看电泳变化 <ArrowRight size={14}/></button>
      </>}
      {task === 1 && <>
        <h4 className="control-label">你的加样记录</h4><LaneSelector state={state.wb} send={send}/>
        <GelResult state={state.wb}/>
        <div className="run-progress"><progress aria-label="电泳迁移进度" max={1} value={state.wb.progress}/><span>{Math.round(state.wb.progress * 100)}%</span></div>
        <div className="control-pair"><button aria-pressed={state.wb.lidClosed} onClick={() => send({ type: 'wb-lid' })}>{state.wb.lidClosed ? '打开槽盖' : '合上槽盖'}</button><button className="operation-primary" onClick={() => send({ type: 'wb-run' })}><Power size={14}/>{state.wb.running ? '暂停电泳' : state.wb.progress === 1 ? '迁移已完成' : state.wb.progress > 0 ? '继续电泳' : '启动电泳'}</button></div>
        <p className="control-note">先合盖再通电。时间经过教学压缩；色带表示分离关系。空泳道保持空白，加样量影响示意强度。</p>
        <button className="operation-next" onClick={() => { setTask(2); navigate('wb-transfer', 'transfer'); }}>前往转膜 <ArrowRight size={14}/></button>
      </>}
      {task === 2 && <>
        <h4 className="control-label">膜放在凝胶的哪一侧？</h4>
        <div className="control-pair"><button aria-pressed={state.wb.membraneSide === 'anode'} onClick={() => send({ type: 'wb-membrane', side: 'anode' })}>阳极侧 +</button><button aria-pressed={state.wb.membraneSide === 'cathode'} onClick={() => send({ type: 'wb-membrane', side: 'cathode' })}>阴极侧 −</button></div>
        <p className="control-note">展开夹层可以看清每一层的位置。先想清楚蛋白在电场里往哪个方向走，再决定膜放在哪一侧。</p>
        {state.wb.transferred && <div className="transfer-order"><span>阴极 −</span><strong>凝胶 → 膜</strong><span>阳极 +</span></div>}
        <button className="operation-primary" onClick={() => send({ type: 'wb-transfer' })}>{state.wb.transferred ? <Check size={16}/> : <ArrowRight size={16}/>} {state.wb.transferred ? '已转移到膜' : '合拢并完成转膜示意'}</button>
        <div className="detection-check"><strong>成像之前，还有免疫检测</strong><p>第一步该做什么？封闭与一抗的先后不能互换。可切回「观看演示」逐步学习，本练习把中间几步合并确认。</p>
          <div className="control-pair"><button aria-pressed={state.wb.detectFirst === 'block'} onClick={() => send({ type: 'wb-detect-first', first: 'block' })}>先封闭</button><button aria-pressed={state.wb.detectFirst === 'primary'} onClick={() => send({ type: 'wb-detect-first', first: 'primary' })}>先上一抗</button></div>
          <button onClick={() => send({ type: 'wb-detect' })}>{state.wb.detected ? '✓ 免疫检测示意已完成' : '完成免疫检测示意'}</button></div>
        <button className="operation-next" onClick={() => { setTask(3); navigate('wb-image', 'imager'); }}>前往成像 <ArrowRight size={14}/></button>
      </>}
      {task === 3 && <>
        <ControlRange label="示意曝光" value={state.wb.exposure} min={5} max={100} unit="" onChange={value => send({ type: 'wb-exposure', value })}/>
        <p className="exposure-quality">{state.wb.exposure > 75 ? '高曝光 · 强信号可能饱和' : state.wb.exposure < 20 ? '低曝光 · 弱信号可能不易观察' : '中等曝光 · 比较泳道差异'}</p>
        <button className="operation-primary" onClick={() => send({ type: 'wb-capture' })}><ScanLine size={16}/> 采集当前曝光</button>
        {state.wb.captured ? <GelResult state={state.wb} blot/> : <div className="capture-empty">{state.wb.detected ? '调好曝光后点击采集' : '等待转膜与免疫检测完成'}</div>}
        <p className="control-note">图像使用你实际加入各泳道的量；下方那条是内参条带，它随上样量一起变化。调整曝光后需重新采集；这是合成示意，不是浓度测定或表达量结论。</p>
      </>}
    </>}
    <p className="session-note">切换步骤与演示模式会保留操作；刷新或离开本实验后重置。不计入回忆训练成绩。</p>
  </section>;
}

function LaneSelector({ state, send }: { state: WBState; send: Props['send'] }) {
  return <div className="lane-selector" aria-label="加样泳道">{state.lanes.map((amount, i) => <button key={i} aria-label={`选择泳道 ${i + 1}`} aria-pressed={state.lane === i} onClick={() => send({ type: 'wb-lane', lane: i })}><span>{i + 1}</span><i style={{ height: `${Math.max(3, amount / 30 * 22)}px`, opacity: amount ? 1 : .18 }}/><strong>{amount}<small> µL</small></strong></button>)}</div>;
}

function GelResult({ state, blot = false }: { state: WBState; blot?: boolean }) {
  return <figure className={`manual-gel ${blot ? 'blot' : ''}`}><svg viewBox="0 0 240 150" role="img" aria-label={blot ? '按实际加样量生成的合成条带，下方为内参' : '实时电泳迁移示意'}>
    <rect width="240" height="150" rx="8" fill={blot ? '#e4e6df' : '#162e3c'}/>
    {state.lanes.map((amount, lane) => <g key={lane}><text x={45 + lane * 50} y="17" textAnchor="middle" fill={blot ? '#49564f' : '#abc6cf'} fontSize="10">{lane + 1}</text><path d={`M${27 + lane * 50} 24h36v108h-36Z`} fill={blot ? '#d9ddd7' : '#204653'} opacity=".7"/>{amount > 0 && [0, 1, 2].map((band) => {
      // A saturated band is flat-topped: its grey no longer tracks protein amount.
      const saturated = blot && state.exposure > 75;
      const y = 29 + (blot ? 1 : state.progress) * (25 + band * 32);
      return <g key={band}>{saturated && <rect x={28 + lane * 50} y={y - 3} width={34} height={15} rx="3" fill="#ffffff" opacity=".22"/>}<rect x={32 + lane * 50} y={y} width={26} height={saturated ? 9 : 4} rx="1" fill={saturated ? '#ffffff' : blot ? '#273c38' : ['#73c6e9', '#9dd5bd', '#bcb6db'][band]} opacity={saturated ? .95 : Math.min(1, amount / 25 * (blot ? state.exposure / 45 : 1) * (1 - band * .14))}/></g>;
    })}</g>)}
    {blot && <>
      <text x="3" y="131" fill="#49564f" fontSize="7.5">内参</text>
      {state.lanes.map((amount, lane) => {
        if (amount <= 0) return null;
        // The loading control comes from the same sample, so it tracks loading volume, not biology.
        const saturated = state.exposure > 75;
        const opacity = saturated ? .95 : Math.min(1, amount / 25 * state.exposure / 45);
        return <g key={`control-${lane}`}>{saturated && <rect x={28 + lane * 50} y={124} width={34} height={11} rx="3" fill="#ffffff" opacity=".22"/>}<rect x={32 + lane * 50} y={127} width={26} height={saturated ? 6 : 4} rx="1" fill={saturated ? '#ffffff' : '#273c38'} opacity={opacity}/></g>;
      })}
    </>}
  </svg><figcaption>{blot ? (state.exposure > 75 ? '已采集 · 合成信号（下方为内参）· 条带已饱和，不能用于定量比较' : '已采集 · 合成信号（下方为内参）') : state.progress ? '实时迁移 · 相同样品，不同加样量' : '等待通电 · 加样保留在孔位'}</figcaption></figure>;
}

export function ControlRange({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (value: number) => void }) {
  const [rangeId] = useState(() => `control-${label}`);
  return <div className="instrument-range"><label htmlFor={rangeId}>{label}<output>{value > 0 && min < 0 ? '+' : ''}{value}{unit && ` ${unit}`}</output></label><div><button aria-label={`${label}减小`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button><input id={rangeId} aria-label={label} type="range" min={min} max={max} step={1} value={value} onChange={e => onChange(Number(e.target.value))}/><button aria-label={`${label}增大`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>+</button></div></div>;
}

function OpticalControls({ state, send, navigate }: { state: OpticsState; send: Props['send']; navigate: Props['navigate'] }) {
  const metrics = opticalMetrics(state);
  const [tab, setTab] = useState<'align' | 'capture'>('align');
  return <>
    <div className="optical-control-tabs"><button aria-pressed={tab === 'align'} onClick={() => { setTab('align'); navigate('jtc-axis', 'iris'); }}>01 光路调节</button><button aria-pressed={tab === 'capture'} onClick={() => { setTab('capture'); navigate('jtc-spectrum', 'camera'); }}>02 两次采集</button></div>
    <button className={`laser-switch ${state.laserOn ? 'on' : ''}`} aria-pressed={state.laserOn} onClick={() => send({ type: 'opt-laser' })}><Power size={16}/><span>激光器</span><strong>{state.laserOn ? '已开启' : '已关闭'}</strong></button>
    <div className="live-optical-screens">{([['近屏', metrics.near], ['远屏', metrics.far]] as const).map(([title, spot]) => <figure key={title}><svg viewBox="-50 -35 100 70" role="img" aria-label={`${title}实时光斑`}><path d="M-45 0h90M0-30v60" stroke="#69848b" strokeWidth=".5"/><circle r="8" fill="none" stroke="#658d94" strokeDasharray="2 2"/>{state.laserOn && <><circle cx={spot.x} cy={spot.y} r={spot.r * 1.4} fill="#eda27f" opacity=".12"/><circle cx={spot.x} cy={spot.y} r={spot.r} fill="#ffcfac" opacity={.2 + metrics.transmission * .7}/><circle cx={spot.x} cy={spot.y} r="1.5" fill="#fff0d6"/></>}</svg><figcaption>{title}<span>{state.laserOn ? '实时' : '无光'}</span></figcaption></figure>)}</div>
    <div className="transmission-meter"><span>示意透过</span><meter min={0} max={1} value={metrics.transmission}/><strong>{Math.round(metrics.transmission * 100)}%</strong></div>
    {tab === 'align' ? <>
      {(['offsetX', 'offsetY', 'focus'] as const).map((axis, i) => <ControlRange key={axis} label={['水平微调 X', '垂直微调 Y', '准直调节'][i]} value={state[axis]} min={-40} max={40} unit="" onChange={value => send({ type: 'opt-adjust', axis, value })}/>)}
      <button className="operation-next" onClick={() => navigate('jtc-filter', 'filter')}><MoveHorizontal size={15}/> 近看并拖动三维旋钮</button>
      <p className="control-note">让两块屏上的光斑回到十字中心，再比较大小。三维旋钮可左右拖动；滑块和 ± 按钮也可调节。刻度为练习用相对量。</p>
      <button className="operation-next" onClick={() => { setTab('capture'); navigate('jtc-spectrum', 'camera'); }}>开始两次测量 <ArrowRight size={14}/></button>
    </> : <>
      <div className="input-state"><span>当前输入</span><strong>{state.input === 'empty' ? '尚未装载' : state.input === 'objects' ? '参考图 + 目标图' : '已保存的联合功率谱'}</strong></div>
      <div className="capture-sequence">
        <button onClick={() => { send({ type: 'opt-input' }); navigate('jtc-input', 'input'); }}><span>1</span>装载双目标图</button>
        <button disabled={state.input === 'spectrum'} onClick={() => { send({ type: 'opt-capture' }); navigate('jtc-spectrum', 'camera'); }}><span>2</span>采集联合功率谱<ScanLine size={14}/></button>
        <button onClick={() => { send({ type: 'opt-reload' }); navigate('jtc-reload', 'input'); }}><span>3</span>把已采功率谱回显到输入面</button>
        <button disabled={state.input !== 'spectrum'} onClick={() => { send({ type: 'opt-capture' }); navigate('jtc-read', 'camera'); }}><span>4</span>采集相关输出<ScanLine size={14}/></button>
      </div>
      <div className="saved-captures"><SavedCapture capture={state.spectrum} label="第一次 · 功率谱"/><SavedCapture capture={state.capture?.kind === 'correlation' ? state.capture : null} label="第二次 · 相关输出"/></div>
      <p className="control-note">图像保存采集时的光路状态。调偏光路再采一张，比较变化；较差的第一次结果会继续影响第二次读出。</p>
    </>}
  </>;
}

function SavedCapture({ capture, label }: { capture: OpticalCapture | null; label: string }) {
  return <figure><figcaption>{label}</figcaption>{capture ? <><svg viewBox="0 0 140 88" role="img" aria-label={`${label}合成快照`}><rect width="140" height="88" rx="5" fill="#10232f"/>{capture.kind === 'spectrum' ? Array.from({ length: 25 }, (_, i) => <path key={i} d={`M${16 + i * 4.5} 10v68`} stroke="#c1dfba" strokeWidth={1.5 + (1 - capture.quality) * 1.5} opacity={capture.quality * Math.exp(-(((i - 12) / 7) ** 2))}/>) : <g fill="#daf0c4" opacity={capture.quality}><ellipse cx="70" cy="44" rx="7" ry="10"/>{[30, 110].map(x => <circle key={x} cx={x} cy="44" r={4 + (1 - capture.quality) * 5}/>)}</g>}</svg><small>X {capture.offsetX} · Y {capture.offsetY} · 准直 {capture.focus}</small></> : <div className="capture-empty">尚未采集</div>}</figure>;
}
