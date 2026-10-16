# WB 补充教学内容与来源

核验日期：2026-10-16。对应内容：`server/cases.ts`、`server/wb-content.ts`，种子参考版本 v2，issues #10、#11。

## 来源边界

原有基础流程来自用户提供的《生物实验-WB通用实验方案.docx》。新增“膜预处理”“结果解读”、转膜/封闭条件说明和六道异常题，是依据以下厂家官方资料编写的**补充教学**，并非该课程原文。新增与混合节点的 `source` 明示这一点，并保留可核验 URL。题目情境、教学拆分、低成本排查顺序和判分规则是本项目的教学设计；厂家页面支持相关知识，并不意味着厂家直接提出了这些题目。

本内容用于练习解释和证据判断，不是某台设备、某支抗体或某种样品的完整实验 SOP。具体条件以产品说明和实验室确认方案为准。参考流程是一种教学组织方式，不能把每个分析检查点的排列当作唯一可行研究流程。

原文关于丽春红染色“可选”与“初学者必须做”的表述差异继续保留，不把丽春红作为唯一可接受的转移验证方式。预染 marker 能提供转移线索，但不能证明每条泳道、每个目标蛋白均已成功转移。

## 核验资料

| 编号 | 官方资料 | 支持的补充点与边界 |
| --- | --- | --- |
| S1 | [Bio-Rad — Separating Proteins to a Blotting Membrane](https://www.bio-rad-antibodies.com/separating-proteins-to-a-blotting-membrane-western-blotting.html) | 常规 PVDF 与 NC 的预湿方法有别；膜需平衡并正确组装。大蛋白的转移不能由小蛋白的成功推定。marker 是有限证据，兼容蛋白染色可提供补充证据。预湿产品/特殊膜仍需核对具体说明。 |
| S2 | [Thermo Fisher — Western Blot Transfer Methods](https://www.thermofisher.com/us/en/home/life-science/protein-biology/protein-biology-learning-center/protein-biology-resource-library/pierce-protein-methods/western-blot-transfer-methods.html) | 分子量、转移体系及缓冲条件影响转移。甲醇与 SDS 的作用涉及凝胶释放和膜结合的权衡；不从通用资料复制一套时间、电流或浓度作为所有实验的答案。 |
| S3 | [Abcam — Western blot for phosphorylated proteins](https://www.abcam.com/en-us/technical-resources/protocols/western-blot-for-phosphorylated-proteins) | 奶粉中的磷蛋白成分可能干扰部分磷酸化检测，BSA 是有依据的候选。须与 S4 的具体产品边界一起读，不能概括成“所有磷酸化抗体必须用 BSA”。 |
| S4 | [CST — Milk or BSA? How to Choose a Blocking Protein](https://blog.cellsignal.com/tech-tips-video-milk-or-bsa-choosing-a-blocking-protein-for-western-blot) | CST 介绍了其经验证的奶粉封闭方案，包括部分磷酸化抗体；封闭用液和一抗稀释液必须分别核对。该差异保留在节点、题目与 rubric 中，不能把换 BSA 当作保证有效的修复。 |
| S5 | [CST — Western Blotting Protocol](https://www.cellsignal.com/learn-and-support/protocols/protocol-western) | 该方案先封闭再孵育一抗，并保留抗体孵育后的洗膜；一抗、二抗和检测方式需要匹配。这里使用方案的作用关系，不强制所有实验使用它的具体参数。 |
| S6 | [Bio-Rad — Unusual or Unexpected Bands](https://www.bio-rad-antibodies.com/western-blot-unusual-unexpected-bands-western-blotting.html) | 修饰、降解、异构体及非特异结合等都可能影响表观分子量/条带。结合 marker 和对照判断，不能仅因大小接近或条带最亮就确定身份。 |
| S7 | [LI-COR — Normalization Handbook](https://www.licorbio.com/support/contents/applications/western-blots/normalization-handbook.html) | 内参必须在相关条件下验证；合适的总蛋白信号也是归一化策略。目标和参照须处于适用线性范围，归一化不能修复所有误差。 |
| S8 | [LI-COR — Replicating for Better Reliability](https://www.licorbio.com/applications/quantitative-western-blots/replication) | 区分生物学独立样本与同一样本的技术测量；保持检测时序可比，不任意跨曝光直接比较原始强度。重复曝光不是独立生物学重复；根据设计和变异评估结果，不设置“n≥3 就充分”的通用判据。 |
| S9 | [Thermo Fisher — Western Blot Detection Support: Troubleshooting](https://www.thermofisher.com/hk/en/home/technical-resources/technical-reference-library/protein-electrophoresis-western-blotting-support-center/western-blot-detection-support/western-blot-detection-support-troubleshooting.html?open=soades) | 无/弱信号可能涉及转膜、膜润湿、样品、抗体或检测系统。教学题强调根据已有证据逐项区分，而不是把厂家的可能原因列表当成一个确定诊断。 |

## 内容映射

- `wb-membrane`：PVDF 预湿/活化与 NC 区别（S1）；`wb-transfer`：大蛋白条件需优化（S1、S2）；`wb-block`：磷酸化抗体封闭液选择与例外（S3、S4）。这些增加不改变已有节点 ID。
- `wb-interpret` 位于成像之后；五个子节点依次组织条带身份（S5、S6）、信号线性（S7、S8）、归一化（S7）、生物学重复（S8）和结论边界（S7—S9）。保持“观察到什么”与“尚未证明什么”的区别。
- `wb-high-background` 是保留的原有题，原 prompt/rubric/broad 不变。
- 六个新增题：`wb-brighter-treatment`（S7、S8）、`wb-phospho-milk`（S3、S4）、`wb-pvdf-no-signal`（S1、S9）、`wb-large-protein-transfer`（S1、S2、S9）、`wb-blocking-order`（S5）、`wb-whole-blot-no-signal`（S1、S5、S9）。
- `practiceParents` 提供 WB 全流程、封闭/抗体、样品制备、分离/转膜、结果解读，以及 JTC 全流程、测量/判读和校准范围。默认 `practiceParent` 保留。JTC 原异常题仅迁移到数组并添加稳定 ID/分类，内容不改。

## 判分边界

1. 条带更亮不能单独支持“上调”；需要可比测量、合适归一化和独立重复。即使相对丰度差异得到支持，也不自动证明转录、功能或机制变化。
2. 无信号不等于不表达；约 40 kDa 的对照正常也不证明约 250 kDa 的目标已成功转移和被检测。
3. 奶粉/BSA、PVDF/NC 和转膜参数都依体系而定。题目要求说明理由、证据及条件，不能只背一个替换选项。
4. “整膜无信号”允许不同合理排查顺序。优先利用已有记录、图像和对照属于教学策略；评价的是每步能区分哪些可能，而不是是否背出唯一清单。
5. 原 `wb-wash1` 与 `wb-wash2` 的 ID、相同标题、通用别名及同一图片绑定保持不变。两次洗膜的操作位置仍分别存在，但不能通过不可见内部 ID 把两个同名、同图答案判作不等价。
