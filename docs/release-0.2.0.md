# LabFlow 0.2.0 — 队友试用反馈迭代

本轮依据 2026-10-16 读取的 GitHub issues #2–#11 更新，保留本地网页 + 外部 harness 的结构。没有新增 agent 执行框架，也没有改变仓库可见性。

| Issue | 本版处理 | 验收边界 |
| --- | --- | --- |
| [#2 可读性](https://github.com/RogersIV144/labflow/issues/2) | 加深文字、操作与选中态；突出当前任务和检查入口 | 核验笔记本视口与关键颜色，不宣称完整 WCAG 审计 |
| [#3 流程布局](https://github.com/RogersIV144/labflow/issues/3) | 学习图按父子关系展开，阶段按子树最早流程步骤排序，使用曲线和编号；练习可按自己的连线整理画布 | 整理练习画布不读取隐藏标准顺序 |
| [#4 模型选择](https://github.com/RogersIV144/labflow/issues/4) | 网页选择模型，保存在本地应用数据；每次请求使用模型快照 | 不修改全局 Codex 设置；不可用模型不伪装成功 |
| [#5 主观点评](https://github.com/RogersIV144/labflow/issues/5) | 主动点击后展示原句、正确/缺失/错误类别、修订建议和来源 | 默认仍只显示对错；完整点评计辅助，绑定提交快照，引用需能在提交中找到 |
| [#6 动态训练](https://github.com/RogersIV144/labflow/issues/6) | 按所问内容生成受限回复；AI 选择掩码或生成情境变式，并核对依据 | 原题 rubric 保持权威；生成失败明确回退；语义审查不能保证模型绝无幻觉 |
| [#7 HTTP 接入](https://github.com/RogersIV144/labflow/issues/7) | 增加 Chat Completions/Responses 适配、结构化输出校验、取消与超时 | 本机 mock 验证协议；未获得队友实际代理凭据，尚未在其 CC Switch 实例联调 |
| [#8 无登录回退](https://github.com/RogersIV144/labflow/issues/8) | 已知客观答案优先规则检查；主观语义无法判定时明确 uncertain | 规则与 AI 来源分开，不把结构通过当成主观理解正确 |
| [#9 多阶段/多题](https://github.com/RogersIV144/labflow/issues/9) | 可选练习阶段；题库数组、稳定题目 ID、情境轮换；按阶段隔离进度和草稿 | 无配图阶段明确禁用配图，并可切回细节练习 |
| [#10 结果解读](https://github.com/RogersIV144/labflow/issues/10) | 新增结果解读五子节点、膜预处理及条件核对 | 标注补充教学来源，保留厂家/实验条件差异 |
| [#11 六道新题](https://github.com/RogersIV144/labflow/issues/11) | WB 原题 + 六道新题，含结果、试剂、膜、参数、顺序、系统排查 | 经官方来源修订绝对化表述，不把 BSA 或固定重复次数当通用充分标准 |

## 升级

停止旧服务，保留旧目录备份，将原 `.labflow` 复制到新解压目录后启动。应用会先保存 `state.before-v0.2.json`，再补入新版案例，保留用户修订过的节点、笔记、附件、旧题的参考快照。旧题继续按其原版本检查；新题使用升级后的参考。原分享 ZIP 不含个人状态和凭据。

模型接入见 [ai-backends.md](ai-backends.md)，WB 补充依据见 [wb-sources.md](wb-sources.md)，验证记录见 [testing.md](testing.md)。

## 保留限制

- Windows/Linux 启动脚本有提供，本轮没有对应操作系统的真实 GUI 验证。
- HTTP 兼容服务必须支持所选协议的 JSON Schema 输出；不会静默降级为无约束文本。
- AI 生成、判答和逐句解释均可能出错，属于可试用的教学辅助；用户仍可按来源修订参考。
- 外部 MCP harness 可读写工具范围内的本地状态；任意第三方评分写回仍未开放。
- 本版没有历史会话或实验日志，也不宣称两次完成能证明长期掌握。
