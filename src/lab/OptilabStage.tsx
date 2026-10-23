import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Loader2, TriangleAlert } from 'lucide-react';
import type { Station } from './scene-data';
import type { SceneHandle } from './LabScene';
import { command, embedUrl, focusIndexFor, optilabStepFor, parseOptilabMessage } from './optilab-bridge';

interface Props {
  stepId: string;
  onStepChange: (optilabIndex: number) => void;
  label: string;
}

/**
 * OPTILAB 子应用容器。JTC 案例不再用 three.js 的示意场景，而是直接跑真实的
 * 数值仿真（GPU 复数 FFT → 联合功率谱 → 相关输出），LabFlow 只负责流程与笔记。
 *
 * 两条硬约束：
 * 1. iframe 的 src 只在挂载时算一次。若让它跟着 step 变，每换一步就等于重新
 *    载入整个子应用（GPU 上下文 + 首次求解 ~3 s），实验状态全部丢失。
 * 2. 步骤只走 postMessage，并记录「自己刚下发的那一步」，忽略它的回声，
 *    否则 子页→宿主→子页 会互相顶回第 1 步。
 */
export const OptilabStage = forwardRef<SceneHandle, Props>(function OptilabStage({ stepId, onStepChange, label }, ref) {
  const frame = useRef<HTMLIFrameElement>(null);
  const initialSrc = useRef(embedUrl(optilabStepFor(stepId)));
  const posted = useRef<number | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [detail, setDetail] = useState('');
  const index = optilabStepFor(stepId);
  const stepChanged = useRef(onStepChange);
  stepChanged.current = onStepChange;

  const post = (cmd: Parameters<typeof command>[0], value?: number | string) => {
    posted.current = cmd === 'set-step' && typeof value === 'number' ? value : posted.current;
    frame.current?.contentWindow?.postMessage(command(cmd, value), window.location.origin);
  };

  useImperativeHandle(ref, () => ({
    focus: (station?: Station) => {
      const target = station ? focusIndexFor(station) : undefined;
      if (target !== undefined) post('set-step', target);
      else post('set-view', 'bench');
    },
    reset: () => post('reset-view'),
    view: (view: 'perspective' | 'top') => post('set-view', view === 'top' ? 'beam' : 'bench'),
  }), []);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const message = parseOptilabMessage(event.data);
      if (!message) return;
      if (message.type === 'optilab:ready') {
        setStatus('ready');
        post('set-step', optilabStepFor(stepId));
      } else if (message.type === 'optilab:step') {
        // 已经下发过的那一步是回声，不再回传给 LabFlow
        if (message.index !== posted.current) stepChanged.current(message.index);
      } else if (message.type === 'optilab:error') {
        setStatus('failed');
        setDetail(message.message);
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []); // 只订阅一次；步骤通过 ref 转发，避免重新订阅时丢消息

  useEffect(() => {
    if (status !== 'ready' || posted.current === index) return;
    post('set-step', index);
  }, [index, status]);

  return <div className="optilab-host">
    <iframe ref={frame} className="optilab-frame" title={`${label} · OPTILAB 虚拟实验室`} src={initialSrc.current} allow="fullscreen"/>
    {status === 'loading' && <div className="optilab-overlay" role="status"><Loader2 size={18} className="spin"/> 正在装配光学平台与 GPU 求解器…</div>}
    {status === 'failed' && <div className="optilab-overlay failed" role="alert"><TriangleAlert size={18}/> 虚拟实验室未能启动：{detail || '当前浏览器不支持 WebGL2'}。请改用 Chrome / Edge 90+，或在新窗口打开。</div>}
  </div>;
});
