export interface PlaybackState {
  stepId: string;
  action: number;
  playing: boolean;
  fromStart: boolean;
  visited: string[];
}
export type PlaybackEvent =
  | { type: 'select'; stepId: string }
  | { type: 'toggle'; total: number }
  | { type: 'seek'; action: number; total: number }
  | { type: 'tick'; stepId: string; total: number }
  | { type: 'reset' }
  | { type: 'pause' };

export function playbackReducer(state: PlaybackState, event: PlaybackEvent): PlaybackState {
  switch (event.type) {
    case 'select': return { ...state, stepId: event.stepId, action: 0, playing: false, fromStart: true };
    case 'reset': return { ...state, action: 0, playing: false, fromStart: true };
    case 'pause': return { ...state, playing: false };
    case 'toggle': return { ...state, action: state.action >= event.total ? 0 : state.action, playing: !state.playing, fromStart: state.action >= event.total || state.fromStart };
    case 'seek': return { ...state, action: Math.max(0, Math.min(event.total, event.action)), playing: false, fromStart: event.action <= 0 };
    case 'tick': {
      // A timer from a previous step must never complete the newly selected step.
      if (!state.playing || event.stepId !== state.stepId) return state;
      const action = Math.min(event.total, state.action + 1);
      const complete = action === event.total;
      return { ...state, action, playing: !complete, visited: complete && state.fromStart && !state.visited.includes(state.stepId) ? [...state.visited, state.stepId] : state.visited };
    }
  }
}

export function initialAdjustments(stepId: string) {
  return { exploded: stepId === 'wb-transfer', exposure: 40, alignment: ['jtc-axis', 'jtc-coaxial', 'jtc-filter', 'jtc-collimate'].includes(stepId) ? 35 : 0 };
}
export function opticalSignals(stepId: string, action: number): { input: 'input' | 'spectrum'; output: 'spectrum' | 'correlation' | 'empty' } {
  const reloaded = stepId === 'jtc-read' || stepId === 'jtc-reload' && action >= 2;
  const captured = stepId === 'jtc-spectrum' && action >= 2 || stepId === 'jtc-reload';
  return { input: reloaded ? 'spectrum' : 'input', output: stepId === 'jtc-read' && action >= 2 ? 'correlation' : captured ? 'spectrum' : 'empty' };
}

