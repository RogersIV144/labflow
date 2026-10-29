import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HttpCompatibleBridge } from '../server/ai';

const schema = {
  type: 'object',
  properties: { verdict: { type: 'string', enum: ['correct', 'incorrect'] } },
  required: ['verdict'],
  additionalProperties: false
};

describe('HTTP compatible tutor bridge', () => {
  let server: Server;
  let base: string;
  let requests: Array<{ path: string; headers: Record<string, string | string[] | undefined>; body: any }>;
  let handler: (path: string, body: any, response: import('node:http').ServerResponse) => void;

  beforeEach(async () => {
    requests = [];
    handler = (_path, _body, response) => {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"verdict":"correct"}' } }] }));
    };
    server = createServer((request, response) => {
      let text = '';
      request.on('data', chunk => { text += chunk; });
      request.on('end', () => {
        const body = JSON.parse(text || '{}');
        requests.push({ path: request.url || '', headers: request.headers, body });
        handler(request.url || '', body, response);
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); });
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('mock HTTP address unavailable');
    base = `http://127.0.0.1:${address.port}/v1`;
  });

  afterEach(async () => {
    if (!server.listening) return;
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it('sends Chat Completions schema and selected model, then validates result', async () => {
    const bridge = new HttpCompatibleBridge({ LABFLOW_API_BASE_URL: base, LABFLOW_MODEL: 'configured', LABFLOW_API_KEY: 'mock-secret' });
    expect(await bridge.status()).toMatchObject({ available: true, backend: 'openai-compatible', model: 'configured' });
    expect(await bridge.models()).toEqual([{ model: 'configured', isDefault: true, supportedReasoningEfforts: [] }]);
    expect(requests).toHaveLength(1); // 模型列表探测失败后回退，仅此一次探测
    expect(requests[0].path).toBe('/v1/models');
    expect(await bridge.run('evaluate', schema, undefined, { model: 'selected', effort: 'medium' })).toEqual({ verdict: 'correct' });
    expect(requests).toHaveLength(2);
    expect(requests[1].path).toBe('/v1/chat/completions');
    expect(requests[1].headers.authorization).toBe('Bearer mock-secret');
    expect(requests[1].body).toMatchObject({ model: 'selected', reasoning_effort: 'medium', response_format: { type: 'json_schema', json_schema: { strict: true, schema } } });
  });

  it('lists provider models when the endpoint offers them', async () => {
    handler = (path, _body, response) => {
      response.setHeader('Content-Type', 'application/json');
      if (path === '/v1/models') { response.end(JSON.stringify({ data: [{ id: 'listed' }, { id: 'configured', name: 'Configured' }] })); return; }
      response.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"verdict":"correct"}' } }] }));
    };
    const bridge = new HttpCompatibleBridge({ LABFLOW_API_BASE_URL: base, LABFLOW_MODEL: 'configured' });
    expect(await bridge.models()).toEqual([
      { model: 'listed', displayName: undefined, isDefault: false, supportedReasoningEfforts: [] },
      { model: 'configured', displayName: 'Configured', isDefault: true, supportedReasoningEfforts: [] },
    ]);
    expect(requests[0].path).toBe('/v1/models');
  });

  it('supports Responses style and rejects malformed structured output', async () => {
    const bridge = new HttpCompatibleBridge({ LABFLOW_API_BASE_URL: base, LABFLOW_MODEL: 'mock', LABFLOW_API_STYLE: 'responses' });
    handler = (_path, _body, response) => {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"verdict":"correct"}' }] }] }));
    };
    expect(await bridge.run('evaluate', schema)).toEqual({ verdict: 'correct' });
    expect(requests[0].path).toBe('/v1/responses');
    expect(requests[0].body.text.format.type).toBe('json_schema');
    handler = (_path, _body, response) => {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ status: 'completed', output_text: '{"verdict":"wrong"}' }));
    };
    await expect(bridge.run('evaluate', schema)).rejects.toThrow('结构校验');
  });

  it('does not forward a key through redirects', async () => {
    const bridge = new HttpCompatibleBridge({ LABFLOW_API_BASE_URL: base, LABFLOW_MODEL: 'mock', LABFLOW_API_KEY: 'mock-secret' });
    handler = (_path, _body, response) => { response.writeHead(302, { Location: '/capture' }); response.end(); };
    await expect(bridge.run('evaluate', schema)).rejects.toThrow('连接失败');
    expect(requests.map(request => request.path)).toEqual(['/v1/chat/completions']);
  });

  it('does not echo provider errors or credentials', async () => {
    const bridge = new HttpCompatibleBridge({ LABFLOW_API_BASE_URL: base, LABFLOW_MODEL: 'mock', LABFLOW_API_KEY: 'mock-secret' });
    handler = (_path, _body, response) => {
      response.writeHead(401, { 'Content-Type': 'application/json' });
      response.end('{"error":"mock-secret was rejected"}');
    };
    await expect(bridge.run('evaluate', schema)).rejects.toThrow('凭据和模型权限');
    try { await bridge.run('evaluate', schema); }
    catch (error) { expect(String(error)).not.toContain('mock-secret'); }
  });

  it('cancels an in-flight request and hides provider details', async () => {
    const bridge = new HttpCompatibleBridge({ LABFLOW_API_BASE_URL: base, LABFLOW_MODEL: 'mock' });
    handler = () => {};
    const controller = new AbortController();
    const pending = bridge.run('evaluate', schema, controller.signal);
    await new Promise<void>(resolve => setTimeout(resolve, 20));
    controller.abort();
    await expect(pending).rejects.toThrow('已取消');
  });

  it('requires an explicit safe endpoint', async () => {
    const bridge = new HttpCompatibleBridge({ LABFLOW_API_BASE_URL: 'http://example.com/v1', LABFLOW_MODEL: 'mock' });
    expect(await bridge.status()).toMatchObject({ available: false, backend: 'openai-compatible' });
    await expect(bridge.run('evaluate', schema)).rejects.toThrow('HTTPS');
  });

  it('uses the per-request deadline, reports degradation, and recovers after success', async () => {
    const bridge = new HttpCompatibleBridge({ LABFLOW_API_BASE_URL: base, LABFLOW_MODEL: 'mock' });
    handler = () => {};
    const started = Date.now();
    await expect(bridge.run('evaluate', schema, undefined, { timeoutMs: 40 })).rejects.toThrow('用时较长');
    expect(Date.now() - started).toBeLessThan(1000);
    expect(await bridge.status()).toMatchObject({ available: true, degraded: true, lastFailure: { message: '检查用时较长，请重试' } });
    handler = (_path, _body, response) => response.end(JSON.stringify({ choices: [{ message: { content: '{"verdict":"correct"}' } }] }));
    expect(await bridge.run('retry', schema)).toEqual({ verdict: 'correct' });
    expect(await bridge.status()).toMatchObject({ available: true, degraded: false, message: 'HTTP 模型最近一次请求成功' });
  });
});
