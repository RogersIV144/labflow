import { describe, expect, it } from 'vitest';
import { createHandsOnState, handsOnReducer, opticalMetrics, type HandsOnEvent, type HandsOnState } from './interaction-state';

const apply = (state: HandsOnState, ...events: HandsOnEvent[]) => events.reduce(handsOnReducer, state);
const totalLiquid = (state: HandsOnState) => state.wb.source + state.wb.held + state.wb.lanes.reduce((sum, value) => sum + value, 0);
const load = (state = createHandsOnState(), lane = 0) => apply(state, { type: 'wb-tip' }, { type: 'wb-aspirate' }, { type: 'wb-dispense', lane });
const aligned = () => apply(createHandsOnState(), { type: 'opt-laser' }, { type: 'opt-adjust', axis: 'offsetX', value: 0 }, { type: 'opt-adjust', axis: 'offsetY', value: 0 }, { type: 'opt-adjust', axis: 'focus', value: 0 });

describe('hands-on pipetting and experiment state', () => {
  it('requires a clean tip and prevents taking more liquid while the tip is full', () => {
    let state = handsOnReducer(createHandsOnState(), { type: 'wb-aspirate' });
    expect(state.wb).toMatchObject({ held: 0, source: 200, feedback: { tone: 'warning' } });
    state = apply(state, { type: 'wb-tip' }, { type: 'wb-aspirate' });
    expect(state.wb).toMatchObject({ tip: 'clean', held: 20, source: 180, target: 'source' });
    state = handsOnReducer(state, { type: 'wb-aspirate' });
    expect(state.wb).toMatchObject({ held: 20, source: 180, feedback: { tone: 'warning' } });
    state = handsOnReducer(state, { type: 'wb-volume', value: 10 });
    expect(state.wb.volume).toBe(20);
  });

  it('conserves liquid across aspiration and loading, without mutating previous snapshots', () => {
    const initial = createHandsOnState();
    let state = apply(initial, { type: 'wb-volume', value: 15 }, { type: 'wb-tip' }, { type: 'wb-aspirate' });
    expect(totalLiquid(state)).toBe(200);
    const aspirated = state;
    state = handsOnReducer(state, { type: 'wb-dispense', lane: 2 });
    expect(totalLiquid(state)).toBe(200);
    expect(state.wb).toMatchObject({ held: 0, tip: 'used', lane: 2, target: 'lane', lanes: [0, 0, 15, 0] });
    expect(initial.wb.source).toBe(200);
    expect(aspirated.wb.held).toBe(15);
    expect(aspirated.wb.lanes).toEqual([0, 0, 0, 0]);
  });

  it('requires ejecting a used tip and keeps rejected over-capacity liquid inside the new tip', () => {
    let state = load();
    state = apply(state, { type: 'wb-tip' }, { type: 'wb-aspirate' });
    expect(state.wb).toMatchObject({ held: 0, source: 180, tip: 'used' });
    state = apply(state, { type: 'wb-eject' }, { type: 'wb-tip' }, { type: 'wb-aspirate' }, { type: 'wb-dispense', lane: 0 });
    expect(state.wb).toMatchObject({ held: 20, lanes: [20, 0, 0, 0], feedback: { tone: 'warning' } });
    expect(totalLiquid(state)).toBe(200);
    state = handsOnReducer(state, { type: 'wb-dispense', lane: 1 });
    expect(state.wb).toMatchObject({ held: 0, lanes: [20, 20, 0, 0] });
  });

  it('selects a clicked lane even if no sample is ready, but rejects invalid lane IDs', () => {
    let state = handsOnReducer(createHandsOnState(), { type: 'wb-dispense', lane: 3 });
    expect(state.wb).toMatchObject({ lane: 3, target: 'lane', feedback: { tone: 'warning' } });
    for (const lane of [-1, 4, 1.5, NaN]) {
      expect(handsOnReducer(state, { type: 'wb-lane', lane })).toBe(state);
      expect(handsOnReducer(state, { type: 'wb-dispense', lane })).toBe(state);
    }
  });

  it('accounts for discarded residual liquid and rejects insufficient source volume', () => {
    let state = apply(createHandsOnState(), { type: 'wb-volume', value: 30 });
    for (let i = 0; i < 6; i++) state = apply(state, { type: 'wb-tip' }, { type: 'wb-aspirate' }, { type: 'wb-eject' });
    expect(state.wb).toMatchObject({ source: 20, held: 0, tip: 'none' });
    state = apply(state, { type: 'wb-tip' }, { type: 'wb-aspirate' });
    expect(state.wb).toMatchObject({ source: 20, held: 0, feedback: { tone: 'warning' } });
    state = apply(state, { type: 'wb-volume', value: 20 }, { type: 'wb-aspirate' });
    expect(state.wb).toMatchObject({ source: 0, held: 20 });
  });

  it('gates electrophoresis on sample and lid, pauses the simulation, and locks loading after migration starts', () => {
    let state = apply(createHandsOnState(), { type: 'wb-lid' }, { type: 'wb-run' });
    expect(state.wb.running).toBe(false);
    state = load();
    state = handsOnReducer(state, { type: 'wb-run' });
    expect(state.wb.running).toBe(false);
    state = apply(state, { type: 'wb-lid' }, { type: 'wb-run' }, { type: 'wb-lid' }, { type: 'wb-tick', delta: .4 });
    expect(state.wb).toMatchObject({ running: true, lidClosed: true, progress: .4 });
    state = apply(state, { type: 'wb-run' }, { type: 'wb-tick', delta: .5 });
    expect(state.wb).toMatchObject({ running: false, progress: .4 });
    state = apply(state, { type: 'wb-lid' }, { type: 'wb-eject' }, { type: 'wb-tip' }, { type: 'wb-aspirate' });
    expect(state.wb).toMatchObject({ held: 0, source: 180, feedback: { tone: 'warning' } });
    state = apply(state, { type: 'wb-lid' }, { type: 'wb-run' }, { type: 'wb-tick', delta: 5 });
    expect(state.wb).toMatchObject({ running: false, progress: 1 });
    expect(handsOnReducer(state, { type: 'wb-run' }).wb.running).toBe(false);
  });

  it('blocks loading behind the closed lid, and never consumes a sample on rejection', () => {
    let state = apply(createHandsOnState(), { type: 'wb-tip' }, { type: 'wb-lid' }, { type: 'wb-aspirate' });
    expect(state.wb).toMatchObject({ source: 200, held: 0, feedback: { tone: 'warning' } });
    state = apply(state, { type: 'wb-lid' }, { type: 'wb-aspirate' }, { type: 'wb-lid' }, { type: 'wb-dispense' });
    expect(state.wb).toMatchObject({ held: 20, lanes: [0, 0, 0, 0], feedback: { tone: 'warning' } });
  });

  it('requires separation, transfer and immunodetection before capture, and invalidates capture on exposure change', () => {
    let state = apply(createHandsOnState(), { type: 'wb-transfer' }, { type: 'wb-detect' }, { type: 'wb-capture' });
    expect(state.wb).toMatchObject({ transferred: false, detected: false, captured: false });
    state = apply(load(), { type: 'wb-lid' }, { type: 'wb-run' }, { type: 'wb-tick', delta: 1 }, { type: 'wb-transfer' }, { type: 'wb-capture' });
    expect(state.wb).toMatchObject({ transferred: false, detected: false, captured: false, feedback: { tone: 'warning' } });
    state = apply(state, { type: 'wb-membrane', side: 'anode' }, { type: 'wb-transfer' }, { type: 'wb-capture' });
    expect(state.wb).toMatchObject({ transferred: true, detected: false, captured: false });
    state = apply(state, { type: 'wb-detect' }, { type: 'wb-capture' });
    expect(state.wb).toMatchObject({ detected: false, captured: false, feedback: { tone: 'warning' } });
    state = apply(state, { type: 'wb-detect-first', first: 'block' }, { type: 'wb-detect' }, { type: 'wb-capture' });
    expect(state.wb).toMatchObject({ detected: true, captured: true });
    state = apply(state, { type: 'wb-exposure', value: 95 }, { type: 'wb-capture' });
    expect(state.wb).toMatchObject({ exposure: 95, captured: true, feedback: { tone: 'warning' } });
    expect(handsOnReducer(state, { type: 'wb-exposure', value: 40 }).wb.captured).toBe(false);
  });

  it('rejects a membrane on the cathode side and explains why it cannot receive protein', () => {
    let state = apply(load(), { type: 'wb-lid' }, { type: 'wb-run' }, { type: 'wb-tick', delta: 1 }, { type: 'wb-membrane', side: 'cathode' });
    expect(state.wb).toMatchObject({ membraneSide: 'cathode', transferred: false, feedback: { tone: 'warning' } });
    state = apply(state, { type: 'wb-transfer' });
    expect(state.wb).toMatchObject({ transferred: false, feedback: { tone: 'warning' } });
    state = apply(state, { type: 'wb-membrane', side: 'anode' }, { type: 'wb-transfer' });
    expect(state.wb).toMatchObject({ transferred: true, feedback: { tone: 'success' } });
  });

  it('blocks immunodetection that starts with the primary antibody', () => {
    let state = apply(load(), { type: 'wb-lid' }, { type: 'wb-run' }, { type: 'wb-tick', delta: 1 }, { type: 'wb-membrane', side: 'anode' }, { type: 'wb-transfer' });
    state = apply(state, { type: 'wb-detect-first', first: 'primary' }, { type: 'wb-detect' });
    expect(state.wb).toMatchObject({ detectFirst: 'primary', detected: false, feedback: { tone: 'warning' } });
    state = apply(state, { type: 'wb-detect-first', first: 'block' }, { type: 'wb-detect' });
    expect(state.wb).toMatchObject({ detected: true, feedback: { tone: 'success' } });
  });
});

describe('hands-on optical measurements', () => {
  it('requires illumination and input, and only reloads an existing first measurement', () => {
    let state = apply(createHandsOnState(), { type: 'opt-capture' }, { type: 'opt-reload' });
    expect(state.optics).toMatchObject({ input: 'empty', spectrum: null, capture: null, feedback: { tone: 'warning' } });
    state = apply(state, { type: 'opt-laser' }, { type: 'opt-capture' });
    expect(state.optics.capture).toBeNull();
    state = apply(state, { type: 'opt-input' }, { type: 'opt-capture' });
    expect(state.optics.capture?.kind).toBe('spectrum');
  });

  it('expresses axis alignment and near/far collimation independently', () => {
    let state = aligned();
    const good = opticalMetrics(state.optics);
    expect(good.quality).toBe(1);
    expect(good.near).toEqual(good.far);
    state = handsOnReducer(state, { type: 'opt-adjust', axis: 'offsetX', value: 30 });
    const shifted = opticalMetrics(state.optics);
    expect(shifted.transmission).toBeLessThan(good.transmission);
    expect(shifted.far.x).toBeGreaterThan(shifted.near.x);
    state = apply(state, { type: 'opt-adjust', axis: 'offsetX', value: 0 }, { type: 'opt-adjust', axis: 'focus', value: 30 });
    const unfocused = opticalMetrics(state.optics);
    expect(unfocused.transmission).toBe(1);
    expect(unfocused.quality).toBeLessThan(good.quality);
    expect(unfocused.far.r).toBeGreaterThan(unfocused.near.r);
    const dark = opticalMetrics(handsOnReducer(state, { type: 'opt-laser' }).optics);
    expect(dark.quality).toBe(0);
    expect(dark.transmission).toBe(0);
  });

  it('saves capture snapshots instead of retroactively improving them with a knob change', () => {
    let state = apply(createHandsOnState(), { type: 'opt-laser' }, { type: 'opt-input' }, { type: 'opt-capture' });
    const original = state.optics.capture!;
    expect(original.quality).toBeLessThan(.45);
    expect(state.optics.feedback.tone).toBe('warning');
    state = apply(state, { type: 'opt-adjust', axis: 'offsetX', value: 0 }, { type: 'opt-adjust', axis: 'offsetY', value: 0 }, { type: 'opt-adjust', axis: 'focus', value: 0 });
    expect(state.optics.capture).toBe(original);
    expect(opticalMetrics(state.optics).quality).toBe(1);
    state = apply(state, { type: 'opt-reload' }, { type: 'opt-capture' });
    expect(state.optics.capture?.kind).toBe('correlation');
    expect(state.optics.capture?.quality).toBeCloseTo(original.quality);
    expect(state.optics.spectrum).toBe(original);
  });

  it('replaces an old correlation image when a new first measurement is acquired', () => {
    let state = apply(aligned(), { type: 'opt-input' }, { type: 'opt-capture' }, { type: 'opt-reload' }, { type: 'opt-capture' });
    expect(state.optics.capture).toMatchObject({ kind: 'correlation', quality: 1 });
    state = apply(state, { type: 'opt-input' }, { type: 'opt-adjust', axis: 'offsetY', value: 25 }, { type: 'opt-capture' });
    expect(state.optics.capture).toMatchObject({ kind: 'spectrum', offsetY: 25 });
    expect(state.optics.spectrum).toBe(state.optics.capture);
    expect(state.optics.capture?.quality).toBeLessThan(1);
  });
});

describe('input integrity and experiment isolation', () => {
  it('ignores invalid numeric inputs and clamps valid values to instrument ranges', () => {
    const initial = createHandsOnState();
    for (const value of [NaN, Infinity, -Infinity]) {
      expect(handsOnReducer(initial, { type: 'wb-volume', value })).toBe(initial);
      expect(handsOnReducer(initial, { type: 'wb-exposure', value })).toBe(initial);
      expect(handsOnReducer(initial, { type: 'opt-adjust', axis: 'offsetY', value })).toBe(initial);
    }
    const state = apply(initial, { type: 'wb-volume', value: 80 }, { type: 'wb-exposure', value: -20 }, { type: 'opt-adjust', axis: 'offsetX', value: 1000 });
    expect(state.wb.volume).toBe(30);
    expect(state.wb.exposure).toBe(5);
    expect(state.optics.offsetX).toBe(40);
    const running = apply(load(), { type: 'wb-lid' }, { type: 'wb-run' });
    for (const delta of [NaN, Infinity, -Infinity, -1, 0]) expect(handsOnReducer(running, { type: 'wb-tick', delta })).toBe(running);
  });

  it('resets only the requested experiment and allocates fresh arrays', () => {
    const state = apply(load(), { type: 'opt-laser' }, { type: 'opt-input' }, { type: 'opt-capture' });
    const resetWB = handsOnReducer(state, { type: 'wb-reset' });
    expect(resetWB.wb).toEqual(createHandsOnState().wb);
    expect(resetWB.optics).toBe(state.optics);
    const resetOptics = handsOnReducer(state, { type: 'opt-reset' });
    expect(resetOptics.optics).toEqual(createHandsOnState().optics);
    expect(resetOptics.wb).toBe(state.wb);
    expect(createHandsOnState().wb.lanes).not.toBe(createHandsOnState().wb.lanes);
  });
});
