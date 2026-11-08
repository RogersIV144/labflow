# LabFlow 报告摘要 / Report Summary

> 基于 `paper/main.tex`（INFH5000 · Group 8 · Working draft, 3 Nov 2026）与
> `paper/main.pdf`。本文是面向项目介绍页的**双语摘要**，不是报告的替代品。
> Based on the group's LaTeX report; this is a bilingual summary for the project
> showcase, not a replacement for the full text.

---

## 一句话结论 / In one line

**中文**：让 AI 随时可问，但绝不替学习者回忆和推理——渐进披露与引导练习确实带来了真实记忆，
而「解释原理」仍是尚未跨过的一道坎。

**EN**: AI stays available but never takes over recall or reasoning. Progressive
disclosure and guided practice produced real recall; explaining *why* remains the
open frontier.

---

## 研究问题 / Research question

| 中文 | English |
| --- | --- |
| 如何把一份「读得懂的实验流程」变成「能独立完成的实践」，同时让帮助始终可得、却不抢走本该由学习者完成的回忆与推理？ | How to move from a readable procedure to independent practice while keeping help available — without letting it remove the recall and reasoning the learner is meant to do? |
| 难点不在「有没有答案」，而在「答案什么时候出现」：完整回答会直接给出本该回忆的步骤，过细的提示会替学习者选好推理路径。 | The problem is not answer availability but answer *timing*: a complete answer supplies the steps meant to be retrieved, and finely divided prompts pre-empt the learner's own reasoning path. |

## 方法设计 / Design

| 中文 | English | 对应机制 / Mechanism |
| --- | --- | --- |
| 同一份**版本化实验参考**贯穿学习、练习、判答与 Replay | One shared, versioned protocol reference across study, practice, checking and Replay | 实验 → 阶段 → 步骤三级节点，含操作、原因、检查点、来源 |
| **渐进披露**：先看总块，展开才见阶段与步骤 | Progressive disclosure: root overview first, detail only on expansion | 展开学习 / Expand Learning |
| 回忆从**局部填空**走向**空白重建** | From partial recall to independent reconstruction | 细节补全、顺序重建、配图归一、整段空白重建、情境作答 |
| **帮助必须由学习者请求**，并分级 | Help is request-gated and graduated | 只给判定 → 宽泛提示 → 具体定位与原因 → 答案；另设「详细点评」 |
| 把知识与**器材、动作**连起来 | Connect knowledge to equipment and actions | 三维实验台、观看演示、动手操作、Replay 逐步导航与节点笔记 |
| 结果绑定**当次提交与参考版本** | Results stay tied to the submitted answer and reference version | 求助标记 assisted；旧题沿用旧版快照 |

> 两个案例把同一套机制放到不同学科里检验：Western Blot 强调操作顺序与结果解读，
> 联合傅里叶相关（JTC）把光轴调节接到 OPTILAB 的真实复数 FFT 求解上。
> Two cases stress one design across disciplines: WB for handling order and
> interpretation, JTC for alignment decisions with computed optical outputs.

## 测量与证据 / Measurement

| 证据来源 / Source | 中文 | English |
| --- | --- | --- |
| 工程验证 `2d0cd48`（29 Oct） | **92 项自动化测试全通过**：训练与教学 38、场景与交互状态 30、布局与 OPTILAB 集成 15、AI 传输与状态 9；类型检查、生产构建、HTTP/MCP 集成干净；受控 AI 超时下仍保留作答并明确标注降级 | 92 automated tests passed; type check, production build and HTTP/MCP integration clean; a controlled AI timeout preserved the submitted answer and degraded explicitly |
| 领域同伴走查（0.4.0, 27 Oct） | 走完全套 WB 流程且具生物信息学背景的队友试了 5 类任务、判答与提示、两个场景；肯定「1 总块 → 6 阶段 → 19 步」的层次与结果解读内容，同时指出 5 个判读动作是**并行检查**却被线性结构误读为顺序 | A domain-informed peer tried all five task types, checking, hints and both scenes; confirmed the hierarchy, flagged that five parallel interpretation checks read as sequential steps |
| 判答复现实验 | 同一重建答案用自己的措辞：27 Oct 规则判定 120s 超时为「不确定」；29 Oct 合并版 + 在线模型 **10.2s 判定正确**，错误排查答案 **9.0s 判错**。结论：瓶颈在判答机制（匹配节点措辞），不在学习者 | Same reconstruction, own wording: 120 s timeout "uncertain" (rules) → 10.2 s "correct" (AI); wrong troubleshooting answer judged incorrect in 9.0 s. The bottleneck is wording match, not understanding |
| 两位非专业用户 | 两次自观察显示**第二次无需重学即可快速回忆步骤顺序、仪器与操作**；问卷总体 **4/5**，流程与内容 **5/5**，顺序重建 **5/5**，细节补全 3/5，空白重建 2/5，三维场景 4/5 | Two-session self-observation showed real recall of order, instruments and operations on second use; questionnaire 4/5 overall, 5/5 content and order reconstruction, 3/5 detail completion, 2/5 blank reconstruction, 4/5 3D scene |
| 用户原声 | 「引导式填空加深了实际记忆，而不是自以为懂了」；「（详细点评）是告诉我怎么改进回答的定制评价」；「第一次学习者不该一上来就遇到空白画布这个 boss」 | "Guided fill-in deepened actual memory instead of an assumed understanding"; "a customised evaluation that told me how to improve my answer"; blank canvas is "not a boss a first-time learner should meet" |

## 结论 / Conclusions

**已被证据支持 / Supported**

- 渐进披露 + 引导练习带来**真实回忆**：第一次需要 AI 解释每个陌生概念的学习者，第二次就能回忆步骤顺序、仪器与操作。
- **领域反馈能变成界面决策**：把「转膜方向」「封闭与一抗先后」从确认改成判断，选错时夹层保持展开、膜变红并说明后果。
- **按需点评补上了判定给不了的理由**：判定只说对错，详细点评才分离「说对了什么 / 缺什么依据 / 可怎么改」。

**尚未验证 / Not yet verified**

- **解释层最薄弱**：能排列与重建步骤，却说不清「这台仪器为什么能完成这个动作」；检查器量的是措辞，不是理解。
- **求助之后是否回到独立练习**，本轮没有任何数据；assisted 标记能否真正守住独立回合仍未检验。
- 空白重建被判定为「对首次学习者过早」；功能可发现性不足（图片附件与参考修订根本没被找到）。
- 无实体实验场景使用记录，无延迟测验，也无真正的掌握度估计。

**下一轮方向 / Next iteration**

把解释放到首位：原理挂在操作发生的地方、深度可调；对学习者自己的措辞做语义判断；
并用「求助 → 独立」的循环追踪长期效果，一直延伸到实验台现场。
Put explanation first: principles attached to the operation at adjustable depth,
semantic judgement of the learner's own wording, and an evaluation that follows
the assisted-to-independent cycle towards the physical bench.

---

## 原始资料 / Sources

- [`LabFlow-report.pdf`](LabFlow-report.pdf) — 已编译的完整报告 / compiled full report (INFH5000 · Group 8 · 3 Nov 2026)
- LaTeX 源码 `main.tex`、参考文献 `references.bib`、自学观察原文 `report.md`、问卷与截图保存在小组本地资料中，未随本仓库发布。
- The LaTeX sources, bibliography, raw self-observation notes and questionnaire remain in the group's local materials and are not published in this repository.
