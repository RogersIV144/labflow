import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { CodexBridge, evaluationSchema } from '../server/codex';

describe('Codex request health', () => {
  let directory: string;
  let bridge: CodexBridge;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'labflow-status-'));
    vi.stubEnv('LABFLOW_DATA_DIR', directory);
    vi.stubEnv('CODEX_BIN', resolve('tests/harness-fixture.mjs'));
    vi.stubEnv('LABFLOW_FIXTURE_DELAY_MS', '200');
    bridge = new CodexBridge();
  });
  afterEach(async () => {
    bridge.close();
    vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
  });
  it('marks a timed-out turn degraded, clears it after a successful retry, and ignores cancellation', async () => {
    expect(await bridge.status()).toMatchObject({ available: true, degraded: false });
    await expect(bridge.run('timeout', evaluationSchema, undefined, { timeoutMs: 40 })).rejects.toThrow('用时较长');
    expect(await bridge.status()).toMatchObject({ available: true, degraded: true });
    expect(await bridge.run('retry', evaluationSchema, undefined, { timeoutMs: 2000 })).toMatchObject({ verdict: 'correct' });
    expect(await bridge.status()).toMatchObject({ degraded: false });
    const controller = new AbortController();
    const pending = bridge.run('cancel', evaluationSchema, controller.signal);
    const cancelled = expect(pending).rejects.toThrow('已取消');
    setTimeout(() => controller.abort(), 30);
    await cancelled;
    expect(await bridge.status()).toMatchObject({ degraded: false });
  });
  it('reports a failure before a turn starts instead of showing a healthy login', async () => {
    vi.stubEnv('LABFLOW_FIXTURE_THREAD_ERROR', '1');
    await expect(bridge.run('start fails', evaluationSchema)).rejects.toThrow('Fixture thread start failed');
    expect(await bridge.status()).toMatchObject({ available: true, degraded: true, lastFailure: { message: 'Fixture thread start failed' } });
  });
});
