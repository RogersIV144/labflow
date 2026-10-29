# AI backends

LabFlow uses one small `TutorBridge` interface for model checks and teaching requests. The default backend remains the installed Codex CLI app-server. Set `LABFLOW_AI_BACKEND=openai-compatible` only when you intentionally want to use an OpenAI-compatible HTTP service. LabFlow does not edit global Codex settings or store API keys in its learning data.

| Variable | Meaning |
| --- | --- |
| `LABFLOW_AI_BACKEND` | `codex` (default) or `openai-compatible` |
| `LABFLOW_MODEL` | Default model. Required for HTTP mode; optional for Codex mode. A caller can override it per request. |
| `LABFLOW_API_BASE_URL` | Required in HTTP mode. Include the API root, such as `https://provider.example/v1` or a loopback development server. |
| `LABFLOW_API_KEY` | Optional bearer token for HTTP mode. Keep it in the process environment; the status and model APIs never return it. |
| `LABFLOW_API_STYLE` | `chat-completions` (default) or `responses`. |
| `CODEX_BIN` | Optional path to a local Codex CLI executable for Codex mode. This is an executable path, not an API URL. |

HTTP mode makes no discovery request: `models()` returns the configured `LABFLOW_MODEL`, and `status()` reports configuration plus the most recent request outcome. A successful model call verifies service access. No HTTP request is made until `run()` is called. The configured URL must use HTTPS, except for `localhost`, `127.0.0.1`, or `[::1]` over HTTP. Redirects are rejected so a bearer token cannot follow a redirect to another host. Provider response bodies, URLs, and credentials are omitted from user-facing errors.

Both HTTP styles request JSON Schema output and validate the returned JSON locally against the object, scalar, array, enum, and bound constraints used by LabFlow's current result schemas before passing it to the application. The application should still validate its domain-specific result. A request can be cancelled with `AbortSignal`. Judging uses a 45-second model-turn deadline (`LABFLOW_JUDGE_TIMEOUT_MS`); learning chat and intent classification use 60 seconds (`LABFLOW_CHAT_TIMEOUT_MS`). Other calls use 120 seconds (`LABFLOW_TURN_TIMEOUT_MS`). Per-call deadlines apply to both backends. Codex initialization and thread creation have their own transport timeouts. Failed requests update the connection message; a successful retry clears degradation, while cancellation does not mark the service unhealthy. For the Codex backend, the bridge uses `model/list`, `thread/start`, `turn/start`, and `turn/interrupt`; model and reasoning effort can be chosen for each call. The model catalog is a picker source, not proof that the current account can run every listed model.

The HTTP adapter intentionally supports the shared text and structured-output subset of these APIs. Providers that do not implement `response_format: {type: "json_schema"}` for Chat Completions or `text.format` for Responses will return an error rather than silently accepting unstructured output. Reasoning effort is sent only when explicitly selected. HTTP model metadata is provider-specific, so its `supportedReasoningEfforts` list is empty rather than an invented capability list.

This implementation was checked against the [OpenAI Chat Completions reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create), [Responses reference](https://developers.openai.com/api/reference/resources/responses/methods/create), [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs), and [Codex app-server model catalog](https://learn.chatgpt.com/docs/app-server). The local Codex CLI help confirms `app-server --listen stdio://` on this Mac. Tests use a local mock HTTP server and never use a real API key or model request.

## 试用包配置例子

在解压目录的终端中设置环境变量，然后启动。下面是占位例子，地址和模型名需换成你自己的服务配置；不需要认证的本机服务可省略 API key。

macOS / Linux:

```sh
export LABFLOW_AI_BACKEND=openai-compatible
export LABFLOW_API_BASE_URL=https://your-provider.example/v1
export LABFLOW_MODEL=your-model-id
export LABFLOW_API_STYLE=responses
# 若服务需要认证，通过你的本机环境/凭据管理方式设置 LABFLOW_API_KEY。
node start.mjs
```

Windows PowerShell:

```powershell
$env:LABFLOW_AI_BACKEND = 'openai-compatible'
$env:LABFLOW_API_BASE_URL = 'https://your-provider.example/v1'
$env:LABFLOW_MODEL = 'your-model-id'
$env:LABFLOW_API_STYLE = 'responses'
node start.mjs
```

如果代理提供 `/chat/completions`，将 style 改为 `chat-completions`；base URL 只填 API 根目录，不重复添加具体 endpoint。网页保存的模型选择优先于默认 `LABFLOW_MODEL`，可在右上角再次切换。分享或提 issue 时不要包含密钥、个人启动环境或 `.labflow`。
