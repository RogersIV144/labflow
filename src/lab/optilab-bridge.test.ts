import { describe, expect, it } from 'vitest';
import { embedUrl, focusIndexFor, labStepForOptilab, labStepToOptilab, optilabStepFor, parseOptilabMessage, command, OPTILAB_STEP_COUNT } from './optilab-bridge';
import { lessons } from './scene-data';

const jtcSteps = ['jtc-axis', 'jtc-coaxial', 'jtc-filter', 'jtc-collimate', 'jtc-input', 'jtc-spectrum', 'jtc-reload', 'jtc-read'];

describe('OPTILAB 步骤桥接', () => {
  it('JTC 的每一步都有映射，且落在 OPTILAB 的 0–6 范围内', () => {
    for (const stepId of jtcSteps) {
      const index = optilabStepFor(stepId);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(OPTILAB_STEP_COUNT);
    }
  });

  it('映射是单调的：流程不会因为跨到子应用而倒退', () => {
    const indexes = jtcSteps.map(optilabStepFor);
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  });

  it('反向映射只会落到 JTC 真实存在的步骤上', () => {
    for (let index = 0; index < OPTILAB_STEP_COUNT; index += 1) {
      expect(jtcSteps).toContain(labStepForOptilab(index));
    }
  });

  it('未知步骤回落到第 1 步，而不是抛错', () => {
    expect(optilabStepFor('wb-block')).toBe(0);
    expect(labStepForOptilab(99)).toBe('jtc-axis');
  });

  it('器材站台能落到正在调它的那一步', () => {
    for (const stepId of Object.keys(labStepToOptilab)) {
      const station = lessons[stepId].station;
      const candidates = Object.keys(labStepToOptilab).filter(key => lessons[key].station === station).map(optilabStepFor);
      // 同一站台可能对应多个环节（例如相机既记录 JPS 也读相关输出），命中任一即可
      expect(candidates).toContain(focusIndexFor(station));
    }
    expect(focusIndexFor('gel')).toBeUndefined();
  });

  it('内嵌地址带 embed 标记与生效步骤，越界会被夹紧', () => {
    expect(embedUrl(3)).toBe('/optilab/index.html?embed=1&step=3');
    expect(embedUrl(-2)).toContain('step=0');
    expect(embedUrl(99)).toContain(`step=${OPTILAB_STEP_COUNT - 1}`);
  });
});

describe('OPTILAB 消息校验', () => {
  it('只接受 optilab 子页发来的消息', () => {
    expect(parseOptilabMessage({ source: 'optilab', type: 'optilab:step', index: 2 })).not.toBeNull();
    expect(parseOptilabMessage({ source: 'other', type: 'optilab:step' })).toBeNull();
    expect(parseOptilabMessage({ source: 'optilab', type: 'something' })).toBeNull();
    expect(parseOptilabMessage('ready')).toBeNull();
    expect(parseOptilabMessage(null)).toBeNull();
  });

  it('下发的命令带来源标识，子页可据此忽略陌生消息', () => {
    expect(command('set-step', 4)).toEqual({ source: 'labflow', type: 'optilab:cmd', cmd: 'set-step', value: 4 });
  });
});
