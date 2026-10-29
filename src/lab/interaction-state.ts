/** Qualitative practice state, independent of lesson playback and training scores. */
export interface InteractionFeedback { tone: 'info' | 'success' | 'warning'; text: string; }
export interface WBState {
  volume: number;
  tip: 'none' | 'clean' | 'used';
  held: number;
  source: number;
  lanes: [number, number, number, number];
  lane: number;
  target: 'source' | 'lane';
  lidClosed: boolean;
  running: boolean;
  progress: number;
  /** Which side of the gel the membrane was placed on; null until the learner decides. */
  membraneSide: 'anode' | 'cathode' | null;
  transferred: boolean;
  /** Which step the learner chose to run first in immunodetection; null until decided. */
  detectFirst: 'block' | 'primary' | null;
  detected: boolean;
  exposure: number;
  captured: boolean;
  feedback: InteractionFeedback;
}
export interface OpticalCapture {
  kind: 'spectrum' | 'correlation';
  quality: number;
  offsetX: number;
  offsetY: number;
  focus: number;
}
export interface OpticsState {
  laserOn: boolean;
  offsetX: number;
  offsetY: number;
  focus: number;
  input: 'empty' | 'objects' | 'spectrum';
  spectrum: OpticalCapture | null;
  capture: OpticalCapture | null;
  feedback: InteractionFeedback;
}
export interface HandsOnState { wb: WBState; optics: OpticsState; }
export type HandsOnEvent =
  | { type: 'wb-volume'; value: number }
  | { type: 'wb-tip' | 'wb-eject' | 'wb-aspirate' | 'wb-lid' | 'wb-run' | 'wb-transfer' | 'wb-detect' | 'wb-capture' | 'wb-reset' }
  | { type: 'wb-membrane'; side: 'anode' | 'cathode' }
  | { type: 'wb-detect-first'; first: 'block' | 'primary' }
  | { type: 'wb-lane'; lane: number }
  | { type: 'wb-dispense'; lane?: number }
  | { type: 'wb-tick'; delta: number }
  | { type: 'wb-exposure'; value: number }
  | { type: 'opt-laser' | 'opt-input' | 'opt-capture' | 'opt-reload' | 'opt-reset' }
  | { type: 'opt-adjust'; axis: 'offsetX' | 'offsetY' | 'focus'; value: number };

const feedback = (tone: InteractionFeedback['tone'], text: string): InteractionFeedback => ({ tone, text });
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const validLane = (lane: number) => Number.isInteger(lane) && lane >= 0 && lane < 4;

export function createHandsOnState(): HandsOnState {
  return {
    wb: {
      volume: 20, tip: 'none', held: 0, source: 200, lanes: [0, 0, 0, 0], lane: 0, target: 'source',
      lidClosed: false, running: false, progress: 0, membraneSide: null, transferred: false, detectFirst: null, detected: false, exposure: 40, captured: false,
      feedback: feedback('info', '先装新吸头，再从样品管吸液，选择泳道并加样。'),
    },
    optics: {
      laserOn: false, offsetX: 24, offsetY: -18, focus: 24, input: 'empty', spectrum: null, capture: null,
      feedback: feedback('info', '开启光源，调节水平、垂直与准直旋钮，观察近远光屏。'),
    },
  };
}

/** Screen coordinates are offsets from the crosshair; radii are relative display units.
 * These curves express alignment / collimation relationships, not a measured optical model. */
export function opticalMetrics(state: OpticsState) {
  const transmission = state.laserOn ? Math.exp(-(state.offsetX ** 2 + state.offsetY ** 2) / (2 * 15 ** 2)) : 0;
  const quality = transmission * Math.exp(-(state.focus ** 2) / (2 * 19 ** 2));
  return {
    quality,
    transmission,
    near: { x: state.offsetX * .35, y: state.offsetY * .35, r: 8 },
    far: { x: state.offsetX * .7, y: state.offsetY * .7, r: 8 + state.focus * .1 },
  };
}

export function handsOnReducer(state: HandsOnState, event: HandsOnEvent): HandsOnState {
  const w = state.wb, o = state.optics;
  const wb = (changes: Partial<WBState>) => ({ ...state, wb: { ...w, ...changes } });
  const optics = (changes: Partial<OpticsState>) => ({ ...state, optics: { ...o, ...changes } });
  const warnWB = (text: string, changes: Partial<WBState> = {}) => wb({ ...changes, feedback: feedback('warning', text) });
  const warnOptics = (text: string) => optics({ feedback: feedback('warning', text) });
  const loadingBlock = () => w.running ? '电泳正在运行。先停止电源，再接触加样区。'
    : w.progress > 0 ? '样品已开始迁移，不能继续加样。重置本次操作后可重新装样。'
    : w.lidClosed ? '先打开电泳槽盖，再进行吸液或加样。' : null;

  switch (event.type) {
    case 'wb-volume':
      if (!Number.isFinite(event.value)) return state;
      if (w.held > 0) return warnWB('吸头内已有液体。请先排液或弃去吸头，再改变取液量。');
      return wb({ volume: clamp(Math.round(event.value), 5, 30) });
    case 'wb-tip':
      if (w.tip !== 'none') return warnWB(w.tip === 'clean' ? '已安装干净吸头，可以吸液。' : '先弃去使用过的吸头，再装新吸头。');
      return wb({ tip: 'clean', target: 'source', feedback: feedback('success', '新吸头已装好。点击样品管或“吸液”取样。') });
    case 'wb-eject':
      if (w.tip === 'none') return warnWB('还没有安装吸头。');
      return wb({ tip: 'none', held: 0, target: 'source', feedback: feedback('info', w.held > 0 ? '已弃去吸头及其中的残液，源管液量不会恢复。' : '已弃去吸头，可以安装新的吸头。') });
    case 'wb-lane':
      if (!validLane(event.lane)) return state;
      return wb({ lane: event.lane, target: 'lane', feedback: feedback('info', `已选择泳道 ${event.lane + 1}，当前 ${w.lanes[event.lane]} µL。`) });
    case 'wb-aspirate': {
      const blocked = loadingBlock();
      if (blocked) return warnWB(blocked);
      if (w.tip !== 'clean') return warnWB(w.tip === 'none' ? '请先装上新吸头，再吸液。' : '请更换使用过的吸头，再取下一份样品。');
      if (w.held > 0) return warnWB('吸头内已有样品，请先完成排液。');
      if (w.source < w.volume) return warnWB('源管剩余液量不足。请减小取液量，或重置本次操作。');
      return wb({ held: w.volume, source: w.source - w.volume, target: 'source', feedback: feedback('success', `已吸取 ${w.volume} µL。吸头内出现液柱，选择一个泳道进行加样。`) });
    }
    case 'wb-dispense': {
      const lane = event.lane ?? w.lane;
      if (!validLane(lane)) return state;
      const selection = { lane, target: 'lane' as const };
      const blocked = loadingBlock();
      if (blocked) return warnWB(blocked, selection);
      if (w.held <= 0) return warnWB(`已选择泳道 ${lane + 1}。吸头内没有样品，请先吸液。`, selection);
      if (w.lanes[lane] + w.held > 30) return warnWB(`泳道 ${lane + 1} 剩余容量 ${30 - w.lanes[lane]} µL，无法容纳当前液量。请选择其他泳道。`, selection);
      const lanes = [...w.lanes] as WBState['lanes']; lanes[lane] += w.held;
      return wb({ ...selection, lanes, held: 0, tip: 'used', feedback: feedback('success', `泳道 ${lane + 1} 已加入 ${w.held} µL，可观察蓝色样品。换吸头继续加样，或盖盖开始电泳。`) });
    }
    case 'wb-lid':
      if (w.running) return warnWB('运行中不能打开槽盖。请先暂停电泳。');
      return wb({ lidClosed: !w.lidClosed, feedback: feedback('info', w.lidClosed ? '槽盖已打开。' : '槽盖已合上，电极连接就绪。') });
    case 'wb-run':
      if (w.running) return wb({ running: false, feedback: feedback('info', '电泳已暂停，条带停留在当前迁移位置。') });
      if (w.progress >= 1) return warnWB('本轮电泳已完成。可将条带转移到膜上，或重置后重新实验。');
      if (!w.lidClosed) return warnWB('先合上电泳槽盖，再启动电源。');
      if (!w.lanes.some(volume => volume > 0)) return warnWB('泳道中还没有样品。打开槽盖并完成加样。');
      return wb({ running: true, feedback: feedback('success', w.progress > 0 ? '继续电泳，观察条带分离。' : '电泳开始，观察不同位置的条带逐渐分离。') });
    case 'wb-tick': {
      if (!w.running || !Number.isFinite(event.delta) || event.delta <= 0) return state;
      const progress = clamp(w.progress + event.delta, 0, 1);
      return wb({ progress, running: progress < 1, ...(progress === 1 ? { feedback: feedback('success', '电泳示意已完成。各泳道保留本次加样量，可继续转膜与成像。') } : {}) });
    }
    case 'wb-membrane': {
      if (w.transferred) return wb({ feedback: feedback('info', '本次已完成转膜，膜的位置不再改变。重置后可重新组装。') });
      if (w.progress < 1 || w.running) return warnWB('先完成电泳，再组装转膜夹层。');
      if (event.side === 'cathode') return wb({ membraneSide: 'cathode', feedback: feedback('warning', '蛋白带负电，通电后向阳极迁移。膜放在阴极侧时蛋白会穿过凝胶离开，膜上接不到样品。请把膜换到阳极侧。') });
      return wb({ membraneSide: 'anode', feedback: feedback('success', '膜已在阳极侧。蛋白向阳极迁移后滞留在膜上，可以合拢夹层。') });
    }
    case 'wb-transfer':
      if (w.progress < 1 || w.running) return warnWB('先完成电泳，再进行转膜。');
      if (w.transferred) return wb({ feedback: feedback('info', '本次样品已转到膜上，继续完成免疫检测后再成像。') });
      if (!w.membraneSide) return warnWB('先在展开的夹层上确认膜放在凝胶的哪一侧，再合拢转膜。');
      if (w.membraneSide !== 'anode') return warnWB('膜还在阴极侧，蛋白会穿过凝胶而接不到膜上。先把膜换到阳极侧。');
      return wb({ transferred: true, captured: false, feedback: feedback('success', '已完成教学转膜：阴极 − → 凝胶 → 膜 → 阳极 +。继续完成免疫检测示意。') });
    case 'wb-detect-first': {
      if (!w.transferred) return warnWB('先完成转膜，再进行封闭与抗体孵育。');
      if (w.detected) return wb({ feedback: feedback('info', '本次免疫检测示意已完成，可以前往成像。') });
      if (event.first === 'primary') return wb({ detectFirst: 'primary', feedback: feedback('warning', '封闭是先占据膜上的非特异结合位点，一抗才是识别目标。先加一抗再补封闭，已经发生的非特异结合不会被撤销。请先封闭。') });
      return wb({ detectFirst: 'block', feedback: feedback('success', '先封闭再一抗。封闭把非特异位点占住之后，一抗的结合才具有区分度。') });
    }
    case 'wb-detect':
      if (!w.transferred) return warnWB('先完成转膜，再进行封闭、抗体孵育及洗膜。');
      if (w.detected) return wb({ feedback: feedback('info', '本次免疫检测示意已完成，可以前往成像。') });
      if (w.detectFirst !== 'block') return warnWB('先确认第一步是封闭还是直接上一抗。');
      return wb({ detected: true, feedback: feedback('success', '封闭 → 一抗 → 洗膜 → 二抗 → 再洗膜示意已完成，可以前往成像。') });
    case 'wb-exposure':
      if (!Number.isFinite(event.value)) return state;
      return wb({ exposure: clamp(Math.round(event.value), 5, 100), captured: false });
    case 'wb-capture':
      if (!w.transferred) return warnWB('先完成电泳与转膜，成像仪才能看到本次样品。');
      if (!w.detected) return warnWB('转膜后还需完成免疫检测示意：封闭、一抗、洗膜、二抗与再洗膜。');
      return wb({ captured: true, feedback: feedback(w.exposure > 75 ? 'warning' : 'success', w.exposure > 75 ? '已采集。曝光偏高，条带已经饱和：饱和条带的灰度不再随蛋白量变化，不能用于组间定量比较。降低曝光后重新采集。' : w.exposure < 20 ? '已采集。曝光偏低，弱条带不易分辨。' : '已采集本次条带。空泳道保持空白，加样量差异会影响示意信号。') });
    case 'wb-reset': return { ...state, wb: createHandsOnState().wb };

    case 'opt-laser': return optics({ laserOn: !o.laserOn, feedback: feedback('info', o.laserOn ? '光源已关闭，已保存的采集图保留。' : '光源已开启。调节旋钮，比较近远光屏上的位置与大小。') });
    case 'opt-adjust':
      if (!Number.isFinite(event.value) || !['offsetX', 'offsetY', 'focus'].includes(event.axis)) return state;
      return optics({ [event.axis]: clamp(Math.round(event.value), -40, 40), feedback: feedback('info', '旋钮已调节。光屏与光路实时变化；已保存的采集图保持采集时的状态。') });
    case 'opt-input': return optics({ input: 'objects', feedback: feedback('success', '输入面已装载双目标图，可以进行第一次采集。') });
    case 'opt-reload':
      if (!o.spectrum) return warnOptics('先装载双目标并采集联合功率谱，再回显该结果。');
      return optics({ input: 'spectrum', feedback: feedback('success', '已将第一次采集的联合功率谱回显到输入面。再次采集可观察相关结构。') });
    case 'opt-capture': {
      if (!o.laserOn) return warnOptics('光源未开启，请先开启光源。');
      if (o.input === 'empty') return warnOptics('输入面为空。请先装载双目标图。');
      if (o.input === 'spectrum' && !o.spectrum) return warnOptics('没有可回显的联合功率谱。请先完成第一次采集。');
      const kind = o.input === 'objects' ? 'spectrum' : 'correlation';
      const quality = opticalMetrics(o).quality * (kind === 'correlation' ? o.spectrum!.quality : 1);
      const capture: OpticalCapture = { kind, quality, offsetX: o.offsetX, offsetY: o.offsetY, focus: o.focus };
      const name = kind === 'spectrum' ? '联合功率谱' : '相关结构';
      return optics({ capture, ...(kind === 'spectrum' ? { spectrum: capture } : {}), feedback: feedback(quality < .45 ? 'warning' : 'success', quality < .45 ? `已采集${name}，信号偏弱或模糊。检查光轴和准直；第二次结果也受第一次谱图质量影响。` : `已采集${name}。调偏旋钮后重新采集，可比较输出结构的变化。`) });
    }
    case 'opt-reset': return { ...state, optics: createHandsOnState().optics };
  }
}
