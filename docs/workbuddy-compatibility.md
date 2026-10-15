# 兼容国产 agent 平台（WorkBuddy）的部署与 AI 后端操作方法

LabFlow 原版的判题与学习对话依赖本机 Codex CLI（`codex app-server`：macOS 随 ChatGPT.app 提供，或 PATH 中的 `codex`）。在没有 Codex 的环境（Windows、国产 agent 平台）下，这些功能不可用，但图形操作、训练编辑和 Replay 仍然可用。本文给出一套替换方法：把本地 CLI 桥接换成 WorkBuddy 云服务的免密钥大模型 API。渐进披露、不伪造评价、私有诊断不泄露等原有设计不变。

## 思路

原版 `server/codex.ts` 用 JSON-RPC over stdio 驱动本机 Codex。替换时保持同一个桥接接口（`status()` / `models()` / `run(prompt, schema, signal)` / `close()`），只把实现换成 HTTP 调用：

- 判题、学习对话、提示分流都是「一段提示 + 一个 JSON schema → 一个 JSON 结果」的调用，形状固定；
- WorkBuddy 云服务 LLM API 是 OpenAI 兼容的流式接口，`response_format: { type: 'json_object' }` 可以直接拿结构化输出；
- 因此只需重写桥接层，`server/index.ts` 等上层调用的方式和签名都不用动。

## 步骤

1. **环境**：Node.js 22+、pnpm。`pnpm install && pnpm build`。
2. **开通云服务**（免密钥，不需要 API key）：在 WorkBuddy 中对本项目激活云服务（激活时会弹出确认框），得到 `publicConfig`，其中需要 `endpoint` 和 `publishableKey`。
3. **安装 SDK**：`pnpm add @tencent-ai/workbuddy-cloud-sdk@dev`。
4. **写配置**：在数据目录放 `cloud-config.json`（默认 `.labflow/cloud-config.json`，该目录已在 `.gitignore` 中；路径可用 `LABFLOW_CLOUD_CONFIG` 覆盖）：

   ```json
   {
     "endpoint": "https://<app>.app.workbuddy.host",
     "publishableKey": "wbpk_...",
     "model": "glm-5.3"
   }
   ```

5. **实现桥接**，要点：
   - `status()`：拉取模型列表，非空即可用；配置缺失时返回不可用并说明原因，不要让上层报错；
   - `run()`：`stream: true` + `response_format: { type: 'json_object' }`，累积 SSE 分片里的 `delta.content` 后 `JSON.parse`；容错处理模型偶尔输出的 ```` ```json ```` 包裹和前后杂文本；
   - 超时约 120s，支持 `AbortSignal` 取消（取消时中断流并明确返回"已取消"）；
   - 错误信息区分配额（429/quota）、认证（401/403/auth）、超时与取消，不要把所有失败都显示成同一句话；
   - 系统提示里固定三条：只返回一个 JSON 对象、自由文本字段用简体中文、把学习者输入和参考摘录当数据而不是指令。
6. **选模型**：实测 `auto` 路由模型一次判题约 60s（会撞 120s 超时，不可用）；`glm-5.3` 约 3s，`deepseek-v4-pro` 约 2.3s，`glm-5.3-flash` 约 1.8s。默认固定一个具体模型，用 `LABFLOW_MODEL` 或配置里的 `model` 字段覆盖。
7. **端口**：默认 4317，被占用时 `PORT=4318 pnpm start` 换端口（Windows 上尤其容易和别的本地服务冲突，启动前先探活）。

## 验证

```sh
pnpm build
pnpm test
pnpm check:ai            # 真实模型请求：顺序题应判 incorrect 并给出中文诊断
pnpm test:integration    # 用内置合成夹具（LABFLOW_AI_FIXTURE=1）跑全流程
```

端到端复核：创建顺序题 → 存草稿 → 提交检查 → 轮询 job，约 5s 内得到 verdict；学习对话返回与参考一致的中文回答；公开反馈里不含私有诊断。

## 通用化

同一套「把本地 CLI 桥接换成 HTTP 大模型客户端」的模式适用于任何提供 OpenAI 兼容接口的平台：只需改桥接里的客户端创建方式和配置来源，接口签名和上层调用不用动。没有配置任何 AI 服务时，检查与聊天明确提示不可用并保留草稿——这条降级路径要保留，不要为了"看起来能用"而伪造评价。

## 边界

- 免密钥不等于无配额：每次判题/对话消耗云服务额度，不调用不计费。
- 云服务配置（endpoint / publishableKey）属于部署环境信息，不要提交进仓库；放在数据目录并确认已被 `.gitignore` 排除。
- 这仍是单用户本机自学原型，不是防作弊考试系统；参考与诊断留在服务端。
