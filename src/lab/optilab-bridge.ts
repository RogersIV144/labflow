import { lessons, type Station } from './scene-data';

/**
 * OPTILAB（联合傅里叶变换相关识别虚拟实验室）与 LabFlow 的桥接。
 *
 * 这里的映射是人工核对的，不做模糊匹配：LabFlow 的 JTC 案例有 8 个步骤，
 * OPTILAB 的引导流程有 7 个，两边不是一一对应。
 *   OPTILAB 0 光轴与照明基准 · 1 针孔调准 · 2 准直扩束 · 3 偏振片 P1⊥P2
 *           4 装载目标并限制照明 · 5 CMOS 落在后焦面 · 6 读出相关输出
 * LabFlow 没有「偏振片 P1⊥P2」这一步，所以 3 号步骤不会从 LabFlow 触发。
 */
export const OPTILAB_PATH = '/optilab/index.html';
export const OPTILAB_STEP_COUNT = 7;

export const labStepToOptilab: Record<string, number> = {
  'jtc-axis': 0,
  'jtc-coaxial': 0,
  'jtc-filter': 1,
  'jtc-collimate': 2,
  'jtc-input': 4,
  'jtc-spectrum': 5,
  'jtc-reload': 5,
  'jtc-read': 6,
};

/** 反向映射优先落到「第一个」对应步骤，避免一次内部跳转把学习者带回前面的环节。 */
export const optilabStepToLab: Record<number, string> = {
  0: 'jtc-axis',
  1: 'jtc-filter',
  2: 'jtc-collimate',
  3: 'jtc-input',
  4: 'jtc-input',
  5: 'jtc-spectrum',
  6: 'jtc-read',
};

export function optilabStepFor(stepId: string) {
  const index = labStepToOptilab[stepId];
  return typeof index === 'number' ? index : 0;
}

export function labStepForOptilab(index: number) {
  return optilabStepToLab[index] ?? 'jtc-axis';
}

/** 站台 → OPTILAB 步骤：点「傅里叶透镜」这类器材时，落到真正在调它的那一步。 */
export function focusIndexFor(station: Station) {
  const entry = Object.entries(labStepToOptilab).find(([stepId]) => lessons[stepId]?.station === station);
  return entry ? entry[1] : undefined;
}

export function embedUrl(stepIndex: number) {
  return `${OPTILAB_PATH}?embed=1&step=${Math.max(0, Math.min(OPTILAB_STEP_COUNT - 1, stepIndex))}`;
}

export type OptilabCommand = 'set-step' | 'set-mode' | 'set-view' | 'solve' | 'reset-view';

export interface OptilabReady {
  source: 'optilab';
  type: 'optilab:ready';
  version: string;
  steps: { index: number; title: string; brief: string }[];
}

export interface OptilabStep {
  source: 'optilab';
  type: 'optilab:step';
  index: number;
  title: string;
  count: number;
  done: number[];
  mode: 'guide' | 'free';
}

export interface OptilabError {
  source: 'optilab';
  type: 'optilab:error';
  message: string;
}

export type OptilabMessage = OptilabReady | OptilabStep | OptilabError;

/** 只接受来自 OPTILAB 子页的消息：其它 iframe / 扩展的消息一律忽略。 */
export function parseOptilabMessage(data: unknown): OptilabMessage | null {
  if (!data || typeof data !== 'object') return null;
  const message = data as { source?: unknown; type?: unknown };
  if (message.source !== 'optilab' || typeof message.type !== 'string') return null;
  if (!message.type.startsWith('optilab:')) return null;
  return data as OptilabMessage;
}

export function command(cmd: OptilabCommand, value?: number | string) {
  return { source: 'labflow', type: 'optilab:cmd', cmd, value };
}
