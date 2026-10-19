import { describe, expect, it } from 'vitest';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { frameBounds } from './scene-camera';
import { seedCases } from '../../server/cases';
import { lessonForStep, lessons, practiceScope, scenePhases } from './scene-data';
import { initialAdjustments, opticalSignals, playbackReducer, type PlaybackState } from './scene-state';

const initial: PlaybackState = { stepId: 'wb-transfer', action: 0, playing: false, fromStart: true, visited: [] };
describe('scene playback isolation', () => {
  it('does not mark a new step complete from the previous step or a late timer', () => {
    let state = playbackReducer(initial, { type: 'toggle', total: 3 });
    for (let i = 0; i < 3; i++) state = playbackReducer(state, { type: 'tick', stepId: 'wb-transfer', total: 3 });
    expect(state.playing).toBe(false);
    expect(state.visited).toEqual(['wb-transfer']);
    state = playbackReducer(state, { type: 'select', stepId: 'wb-block' });
    state = playbackReducer(state, { type: 'toggle', total: 3 });
    state = playbackReducer(state, { type: 'tick', stepId: 'wb-transfer', total: 3 });
    expect(state.action).toBe(0);
    expect(state.visited).toEqual(['wb-transfer']);
  });
  it('pauses, seeks backwards and restarts without claiming completion from a jump', () => {
    let state = playbackReducer(initial, { type: 'toggle', total: 3 });
    state = playbackReducer(state, { type: 'pause' });
    state = playbackReducer(state, { type: 'tick', stepId: initial.stepId, total: 3 });
    expect(state.action).toBe(0);
    state = playbackReducer(state, { type: 'seek', action: 30, total: 3 });
    expect(state).toMatchObject({ action: 3, playing: false, visited: [] });
    state = playbackReducer(state, { type: 'toggle', total: 3 });
    expect(state).toMatchObject({ action: 0, playing: true });
    state = playbackReducer(state, { type: 'seek', action: 1, total: 3 });
    expect(state).toMatchObject({ action: 1, playing: false });
    expect(playbackReducer(state, { type: 'reset' })).toMatchObject({ action: 0, playing: false });
  });
  it('does not count playback that starts after skipping operations', () => {
    let state = playbackReducer(initial, { type: 'seek', action: 2, total: 3 });
    state = playbackReducer(state, { type: 'toggle', total: 3 });
    state = playbackReducer(state, { type: 'tick', stepId: initial.stepId, total: 3 });
    expect(state.action).toBe(3);
    expect(state.visited).toEqual([]);
  });
  it('resets all experiment adjustments to the selected step defaults', () => {
    expect(initialAdjustments('wb-transfer')).toEqual({ exploded: true, exposure: 40, alignment: 0 });
    expect(initialAdjustments('jtc-collimate')).toEqual({ exploded: false, exposure: 40, alignment: 35 });
    expect(initialAdjustments('jtc-read').alignment).toBe(0);
  });
});
describe('scene and reference navigation', () => {
  for (const lab of seedCases) {
    it(`covers every ${lab.id} step once, keeping phase order and practice scope`, () => {
      expect(scenePhases(lab).flatMap(phase => phase.steps)).toEqual(lab.sequence);
      for (const id of lab.sequence) { expect(lessons[id]?.actions.length).toBeGreaterThan(0); expect(lab.practiceParents).toContain(practiceScope(lab, id)); }
    });
  }
  it('rejects steps from the other case and resolves phase selections', () => {
    const [wb, jtc] = seedCases;
    expect(lessonForStep(wb, 'jtc-input')).toBe('wb-prepare');
    expect(lessonForStep(jtc, 'wb-lysis')).toBe('jtc-axis');
    expect(lessonForStep(wb, 'wb-antibody')).toBe('wb-block');
    expect(practiceScope(wb, 'wb-check-linearity')).toBe('wb-interpret');
  });
});
it('keeps optical input and capture output consistent through both measurements and rewind', () => {
  expect(opticalSignals('jtc-input', 2)).toEqual({ input: 'input', output: 'empty' });
  expect(opticalSignals('jtc-spectrum', 1).output).toBe('empty');
  expect(opticalSignals('jtc-spectrum', 2).output).toBe('spectrum');
  expect(opticalSignals('jtc-reload', 1).input).toBe('input');
  expect(opticalSignals('jtc-reload', 2)).toEqual({ input: 'spectrum', output: 'spectrum' });
  expect(opticalSignals('jtc-read', 1)).toEqual({ input: 'spectrum', output: 'empty' });
  expect(opticalSignals('jtc-read', 2)).toEqual({ input: 'spectrum', output: 'correlation' });
  expect(opticalSignals('jtc-read', 0).output).toBe('empty');
});
describe('camera framing', () => {
  for (const aspect of [.7, 1.2, 2.4]) for (const direction of [new Vector3(8, 7.5, 12), new Vector3(.001, 1, .04)]) {
    it(`keeps all bench corners inside the viewport at aspect ${aspect}, elevation ${direction.y}`, () => {
      const bounds = new Box3(new Vector3(-7.6, -.6, -4.2), new Vector3(7.6, 4, 4));
      const pose = frameBounds(bounds, aspect, 37, direction);
      const camera = new PerspectiveCamera(37, aspect, .1, 160);
      camera.position.copy(pose.position); camera.lookAt(pose.target); camera.updateMatrixWorld();
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const point = new Vector3(x, y, z).project(camera);
        expect(Math.abs(point.x)).toBeLessThan(1); expect(Math.abs(point.y)).toBeLessThan(1); expect(point.z).toBeLessThan(1);
      }
    });
  }
});
