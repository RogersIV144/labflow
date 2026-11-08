# 2026-11-07 · 介绍片制作经验（Recordly 自主录屏 + TTS 配音 + 两版剪辑）

这份文档记录 LabFlow 介绍片从"全自主录屏"到"4 分 05 秒完整版 / 1 分 58 秒节奏版"过程中踩过的坑、根因和最后定下的规则。目的是下次做同类片子时不用重新踩一遍，也说明哪些做法已经被证据推翻。

产物在 `demo-video/`：`LabFlow-介绍.mp4`（244.7s）、`LabFlow-介绍-2min.mp4`（118.7s）、两份同名 `.字幕.srt`、`LabFlow-全程原始录屏.mp4`、`recordly_export_hires.mp4`（2560×1440@60 母版）。所有工具脚本在 `D:\tmp\recwork\`。

---

## 1. Recordly 的正确用法：光标不是录进去的，是导出来的

Windows Graphics Capture 拿到的原始 mp4 里**没有系统光标**。Recordly 把光标位置、点击时间另存成 `recording-<ts>.mp4.cursor.json` 遥测文件，编辑器在导出时用弹簧平滑重绘光标、点击回弹和自动追焦。

由此得到两条硬规则：

- 想要"丝滑追焦"的画面，必须走编辑器导出，不能拿 raw mp4 直接剪。第一版就是因为用了 raw 素材，鼠标看起来是跳跃的、甚至根本看不见。
- 自动追焦的分组逻辑（`zoomSuggestionUtils.ts`）是 2500ms 内合并点击簇、前后各留 500ms，产出 1.5× 的 Auto 区域。也就是说**我点击的节奏决定了成片有没有推镜**——点得太散就没有追焦，点得太密会被并成一坨。

导出编码路径：核显走 `WebGPU + Breeze (h264-stream-copy)`，独显走 `WebGPU + WebCodecs (avc1.640033)`。

## 2. 驱动一个 Electron 应用：三个会静默要命的坑

| 现象 | 根因 | 规则 |
| --- | --- | --- |
| Recordly 启动即退出，exit 0 | Qoder 的 shell 里带着 `ELECTRON_RUN_AS_NODE=1`，Electron 把自己当 node 跑了 | 启动任何 Electron GUI 前先 `unset ELECTRON_RUN_AS_NODE` |
| 我在操作编辑器，却以为在操作录制悬浮窗 | `CDP.attach(port, match=...)` 匹配不到时静默回退到第一个 target | 给了 `match` 就必须匹配成功，否则抛异常 |
| pip 装不上，`websockets` 没有 | 本机 pip 环境坏 | 标准库 `socket`+`base64`+`struct` 手写 WebSocket + CDP 客户端够用（`cdp.py`） |

## 3. OS 级输入：坐标、编码、和"谁抢了鼠标"

- `SendInput` 的绝对坐标是按虚拟屏幕归一化的。机器上一旦出现虚拟显示器（GameViewer），`SM_CXVIRTUALSCREEN` 变成 5120 而实际屏是 2560，**所有坐标被砍半**。改用 `SetCursorPos` 绕开归一化。
- 中文输入：PowerShell 里只设 `OutputEncoding` 不够，`type` 的 JSON 载荷会被 GBK 误解码成非法 JSON。必须 `[Console]::InputEncoding = UTF8`。
- 焦点：`ShowWindow(SW_RESTORE)` 会顺手改窗口尺寸，把辛苦标定好的坐标全部作废。只在 `IsIconic` 时才 restore，其余用 `AttachThreadInput` + `SetForegroundWindow` + `BringWindowToTop`。
- 坐标标定不能靠推算。要往页面注入几个品红色块、截屏回看它们落在哪，反解出 `physical = CSS × 1.5 + (10, 44)` 这种实测偏移。
- 两个 runner 并发会同时抢鼠标并写同一份日志，最坏的表现是"我改了代码但现象没变"，于是继续改第二版第三版——全部打在空气上。长任务用 `DONE_*` 完成标记文件，启动前先确认没有活着的同类进程。

## 4. 演示脚本要像用户，还要能自证

- 切换类按钮（实验场景 / 流程图）没有 `active` class，**盲重点击会把刚打开的视图又切回去**。没有校验谓词时只点一次；要重复就显式写 DOM 谓词。
- 打字必须读回：`type_verified` 输入后回读 DOM value，不符就重来。输入前先检查选区和焦点，否则 `Ctrl+A` 之类会把整页文字选中并留在成片里。
- AI 环节不要用固定 sleep。用 `expect_change`（监听目标区域文本变化）+ `ai_step(action, expect, fail, tries)`，把"降级 / 请求失败"写进 fail 谓词，超时才算失败。
- 报"进程在跑"不算交付。要实测端到端延迟：从点击提交到判定出现，几秒就是几秒。

## 5. 母版质量与 GPU

`为什么 Recordly 用核显渲染` 的答案：录屏/导出走 ANGLE `d3d11`，默认适配器是显示输出所挂的那颗 APU；独显没被选中，也不是性能问题。加一条 per-app 偏好即可：

```
HKCU\Software\Microsoft\DirectX\UserGpuPreferences
  <Recordly.exe 全路径> = GpuPreference=2;
```

效果：导出吞吐从 30–45 FPS 提到中位 160.8 FPS，1440p60 母版约 6 分钟出片。

另一个假警报：高分辨率导出"丢了"，其实产物在 `%TEMP%\recordly-export-XXXX\recordly-export-stream-<uuid>.mp4` 的子目录里。**glob 只扫 Temp 顶层会误判成失败**，先递归再下结论。

## 6. IndexTTS2 配音

- 不要猜构造函数参数。直接读 `indextts/infer_v2.py` 的签名：`IndexTTS2(cfg_path, model_dir, use_fp16, device, ...)`，推理是 `infer(spk_audio_prompt=, text=, output_path=, audio_speed=, verbose=)`。
- 环境必须复刻它的 `启动器.bat`：`HF_HOME`、`TORCH_EXTENSIONS_DIR`、`DS_BUILD_*=0`、并把 `wzf311` 加到 PATH 前面。用 `sh tts_env.sh <脚本>` 执行，**不要 `source`**——脚本最后一行就是带 `"$@"` 的 python 调用，source 之后会拿默认 Anaconda 的 python 跑，`torch` 直接找不到。
- 本机这个音色只念中文可靠。
- 改文案时只重合成变化的那一行，其余复用；把每行真实时长写进 `durations.json`，让时间轴以实测为准，而不是按字数估。

## 7. 剪辑时间轴：这一节最值钱

四个独立缺陷，每一个都会让字幕和画面对不上，而且都不报错：

1. **卡片时长被扣了两次转场。** 规划里卡片记成 `CARD_DUR - XFADE` 并只推进同样多，而 xfade 链把它当完整片段再扣一次。规划总长 244.7s、实际渲染 240.2s，差值正好是 6 张卡 × 0.45s。后果是字幕和旁白越到后面越滞后，到最后一章已经晚 1.8 秒。
   → 规则：渲染结束后断言 `|规划总长 − ffprobe 实测| < 0.2s`，不等就退出。
2. **旁白起点不能信规划。** 解码成片音频算 20ms RMS，测每条旁白第一次越过 −38 dB 的时刻。实测两版最大误差 0.08s / 0.12s，且每条前面是数字静音——这才叫对齐。
3. **每段时长 = max(画面下限, 旁白 + 呼吸)，且不得超过源窗口。** 溢出必须在 plan 阶段逐条打印出来，而不是渲染完才发现旁白压到了下一个镜头上。
4. **镜头窗口不得重叠。** 冷开场和第二个镜头都取了三维实验台，32.6–34.5 那段会播两遍，观感就是"卡了一下"。
   → 规则：渲染前校验任意两个 screen 窗口不相交、且 `start + dur <= window_end`，违反直接 `SystemExit`。

其他 ffmpeg 细节：

- 22 个片段用**一条 `filter_complex_script` 的 xfade 链**一次编码出片，比逐个 re-encode 累积链快一个数量级，而且只有一代损失。之前那版 22 次全链重编码是纯浪费。
- `drawtext` 在 Windows 字体路径上会炸（`No option name near '/Windows/Fonts/msyh.ttc'`）。标题卡改用 PIL 出 PNG，字幕和 concat 用相对路径 + `cwd=WORK`。
- ASS 的 `MarginV` 要避开录制画面底部的任务栏。46px 会把字幕压在任务栏上，150px 才干净。
- 卡片类画面用 `zoompan` 做缓慢推镜（渲染 2560×1440、输出 1920×1080，整段推镜基本是下采样），比静态 PNG 停 20 秒耐看得多。

## 8. 内容诚信：字幕不许说画面没有的东西

这条规则是被四次具体错误逼出来的，每次都是我以为画面上有、其实没有：

- 我说"判定结果和评价来源一起给出"，抽帧一看，那一刻屏幕上还是"正在检查这次提交…"。
- 我写"不计入独立完成次数"，界面脚注的原话是"演示不计入独立训练成绩"。
- 我说"详细点评"那一拍，先在 620s 抽帧看到空面板，就把整拍删了；再抽 618/622/626/628 才发现批注是从 ~616s 才渲染出来的。**一次抽样下结论等于没下结论。**
- 开场 8–17s 我以为是最干净的落地页，实际是"已恢复上次练习草稿"的回忆训练板，跟"四条主线在同一页"对不上。

定下的做法：

- 每个镜头的时间窗都要对着**操作时间线**（`timeline.json`，录制起点 21:56:28.907）落位，并在成片里抽帧回看，而不是看母版。
- 画面配不上时优先换窗口或改字幕措辞；两者都不行就删掉这一拍，不硬凑。
- 数字必须有出处。92 项测试（38/30/15/9）、4/5 首评、分项 5/5/4/3/2、"判定更靠近比对用词"全部来自 `paper/main.tex`，卡片右下角标"数据来源：项目报告"。
- 界面原话优先于我的转述。
- 报告里"检查与反馈"和界面 tab"检验"不一致是我的问题，改成同名。

## 9. 录屏素材里会混进操作系统自己弹的东西

成片 Replay 那一段右下角有个 Windows 开始菜单弹窗。根因：演示脚本有一处点击落在 `y=1529`，而屏幕只有 1440 高，点击被夹到屏幕底边——砸在任务栏上。

做法：把全片按 1 秒步长裁出可疑区域，统计暗像素占比，找孤立尖峰（`646`、`649` 秒命中）。修法是给这个镜头换一个干净窗口（651–668），顺带把"笔记已保存"的提示收进画面。

教训是：录屏素材不能只按"我点了什么"来信任，OS 会在我不预期的时刻插话。

## 10. 节奏：密度高不等于有信息

4:05 版量出来是：旁白密度 82%、平均镜长 16.4s、最长 25s、章节卡占 10%、三张证据卡占 21%，同时有 3 个镜头在旁白讲完后还剩 4.8–6.4s 空转。**一边是说到没气口，一边是没话的地方干等**——这是节奏最差的一种组合，问题不在长度。

2 分钟版的改法不是砍句子，是换机制：

- 章节全屏卡 → 每章第一个镜头左下角 1.7s 角标（ASS `Badge` 样式），零时间成本。
- 加 5.6s 纯画面冷开场，不配任何旁白，再进 logo。
- 旁白改短句，每条后面固定 2.2–3.0s 呼吸，把留白用在"看动画、看批注面板"这类不需要解释的地方。
- 证据三张压两张；回忆训练三档压两档，保留的正是画面差异看得出来的两档。

结果：13 个镜头、平均 9.1s、最长 12.0s、密度 75%、非信息幻灯片从 24.6s 降到 7.2s。

## 11. 交付与自检习惯（跨项目通用）

- 不要在第一次失败就报"阻塞"。高分辨率导出"丢了"、`pip 装不上`、`torch 找不到`，三个都是换个入口就通了。
- "已保存 / 已生成"必须发生在 `Write` 成功之后；报告里的链接要能点开。
- 改动只占画面 1% 时（比如字幕上移 100px），要附放大对照，否则等于没改。
- 指标是我自己写的尺子，绿灯只证明我在优化自己的尺子。所以每个数字都要有对应的抽帧或解码证据：`drift −0.00s`、`onset ≤0.12s`、`decode clean`、`−16.5 LUFS`、27 个抽帧点逐条对过。
- 报告要写清楚**没检查什么**。这次没做的是：没用人耳过一遍 2 分钟版的配音自然度（短句更密，听感可能偏赶）；异常检测只扫了右下区域，没做全画面。

## 12. 工具清单（`D:\tmp\recwork\`）

| 文件 | 作用 |
| --- | --- |
| `cdp.py` | 标准库 WebSocket + CDP；`attach(port, match=)` 匹配失败即抛 |
| `inputd.ps1` / `inp.py` | 常驻 OS 输入服务（JSON lines）：`SetCursorPos`、UTF-8 输入、`Key(vk, up)` |
| `demo.py` | `Demo`：`find/click/goto_tab/type_verified/expect/expect_change/ai_step/ensure_front` |
| `walkthrough.py` / `run_demo.py` | 演示脚本与执行器（`DEMO_SCRIPT/DEMO_TL/DEMO_LOG`，`--dry --from --to`） |
| `hudctl.py` / `export_60.py` | Recordly 悬浮窗控制与导出提交 |
| `set_gpu_pref.ps1` | 写 per-app 高性能 GPU 偏好 |
| `tts_env.sh` + `synth_final.py` / `resynth_changed.py` | IndexTTS2 环境与全量/增量合成 |
| `final_spec.py` / `final_spec_short.py` | 两版规格：章节、镜头窗口、旁白、字幕、数据卡 |
| `build_final.py` | 唯一渲染器，用环境变量选规格：`LABFLOW_SPEC / LABFLOW_DUR / LABFLOW_WORK / LABFLOW_CARDS / LABFLOW_OUT` |
| `qa_final.py` / `qa_audio.py` / `make_srt.py` | 抽帧对照表、旁白起点实测、外挂 SRT |

`build_final.py plan` 是每次改动后的第一道闸：它会打印每个镜头的旁白长度、呼吸、源窗口，并标出溢出；窗口重叠和越界直接让它退出。

## 13. 环境副作用（需要时回滚）

- `.labflow/state.json` 被演示跑改过，备份在 `D:\tmp\recwork\state.backup.json`（1.5 MB）。
- 给 Recordly 加了 `GpuPreference=2;` 的 per-app 偏好（注册表 `HKCU\Software\Microsoft\DirectX\UserGpuPreferences`）。
- CDP 调试端口 9223（Recordly）/ 9224（Edge）仍开着，Recordly 停在编辑器。
- 4318 端口的 demo 服务没有重启过：它的 `LABFLOW_API_BASE_URL` / `LABFLOW_API_KEY` 在我的 shell 里复现不出来，重启等于把它弄坏。
