// Supplementary teaching material, checked against manufacturer sources on 2026-10-16.
// These additions are not quotations from the course's WB document or a lab-specific SOP.
export const wbReferences = {
  membrane: '补充教学（非课程原文）· Bio-Rad：膜预处理、转膜与验证 · https://www.bio-rad-antibodies.com/separating-proteins-to-a-blotting-membrane-western-blotting.html',
  transfer: '补充教学（非课程原文）· Thermo Fisher：转膜条件与大分子蛋白 · https://www.thermofisher.com/us/en/home/life-science/protein-biology/protein-biology-learning-center/protein-biology-resource-library/pierce-protein-methods/western-blot-transfer-methods.html',
  blocking: '补充教学（非课程原文）· Abcam：磷酸化蛋白与封闭液 · https://www.abcam.com/en-us/technical-resources/protocols/western-blot-for-phosphorylated-proteins',
  blockingException: '补充教学（非课程原文）· CST：奶粉或 BSA 依抗体和用途选择 · https://blog.cellsignal.com/tech-tips-video-milk-or-bsa-choosing-a-blocking-protein-for-western-blot',
  protocol: '补充教学（非课程原文）· CST：封闭、一抗、洗膜与检测流程 · https://www.cellsignal.com/learn-and-support/protocols/protocol-western',
  bands: '补充教学（非课程原文）· Bio-Rad：异常分子量与条带特异性 · https://www.bio-rad-antibodies.com/western-blot-unusual-unexpected-bands-western-blotting.html',
  normalization: '补充教学（非课程原文）· LI-COR：归一化与线性范围 · https://www.licorbio.com/support/contents/applications/western-blots/normalization-handbook.html',
  replicates: '补充教学（非课程原文）· LI-COR：生物学与技术重复 · https://www.licorbio.com/applications/quantitative-western-blots/replication',
  detection: '补充教学（非课程原文）· Thermo Fisher：弱信号、无信号与检测排查 · https://www.thermofisher.com/hk/en/home/technical-resources/technical-reference-library/protein-electrophoresis-western-blotting-support-center/western-blot-detection-support/western-blot-detection-support-troubleshooting.html?open=soades'
};

export const wbAnomalies = [
  {
    id: 'wb-high-background', category: '背景与曝光',
    prompt: '成像后背景很高。有人建议直接延长曝光，让目标条带更明显。你会如何评价这个建议？提出两个应优先检查的环节，并解释理由。',
    rubric: '指出延长曝光不能解决高背景且可能加剧过曝。合理检查封闭、洗膜、抗体浓度或特异性等；给出与背景相关的原因。无需罗列所有可能因素，不能声称一定定位唯一原因。',
    broad: '先想一想：背景来自哪里？把信号显示得更亮，是否等于改善了信号与背景的关系？',
    source: '原有教学题，基于生物实验-WB通用实验方案.docx；排查边界参考 ' + wbReferences.detection
  },
  {
    id: 'wb-brighter-treatment', category: '结果解读',
    prompt: '同一张 WB 图上，处理组的目标条带比对照组更亮。组员据此写下“处理使目标蛋白上调”。现有信息足够支持这句话吗？你还需要哪些证据，才会比较两组结果？',
    rubric: '不能只凭原始亮度断言上调。需解释并覆盖：用经当前条件验证稳定的内参或合适的总蛋白信号归一化，排查上样/转膜差异；目标与归一化信号均应在验证的线性范围内且未饱和，不直接比较不同曝光条件下的原始强度；用独立生物学样本的重复结果判断差异及变异，同一样本多次曝光不算独立生物学重复。可补充分子量、特异性与对照检查。证据满足时只支持相应条件下目标蛋白相对丰度的变化，不自动证明转录上调、活性变化或因果机制。不要求固定重复次数，也不能把某个次数当作充分证据。',
    broad: '把“图上的亮度”与“希望比较的生物学量”分开：两者之间还经过了哪些可能改变信号的环节？',
    source: wbReferences.normalization + '；' + wbReferences.replicates
  },
  {
    id: 'wb-phospho-milk', category: '封闭液选择',
    prompt: '检测磷酸化蛋白时，使用奶粉封闭后背景很高，抗体具体说明书还没核对。组员说“所有磷酸化抗体都必须用 BSA，换掉奶粉就一定能解决”。你如何评价并安排下一步？',
    rubric: '指出奶粉中的酪蛋白可能与部分磷酸化特异性抗体发生干扰，因此 BSA 是值得按说明书验证的候选；但不能声称奶粉对所有磷酸化抗体都不适用，或 BSA 必定解决。先核对该抗体厂家对封闭液和一抗稀释液的分别建议，二者不能混为一谈；部分经过验证的方案仍用奶粉封闭。依据产品建议、适当对照和对比结果选择，背景仍高时也考虑抗体浓度/特异性、洗膜等因素。只说“换 BSA”而不给条件与原因不充分。',
    broad: '先区分“某类抗体的一般经验”和“这支抗体已经验证的条件”；同一种试剂在不同用途下是否必然适用？',
    source: wbReferences.blocking + '；' + wbReferences.blockingException
  },
  {
    id: 'wb-pvdf-no-signal', category: '膜预处理',
    prompt: '这次从 NC 膜换成普通干燥 PVDF 膜，沿用了原来的准备方法，检测时整膜没有信号。组员认为两种膜的预处理相同。你会先核查什么，能否据此认定唯一原因？',
    rubric: '核对膜产品和预湿记录：普通疏水 PVDF 一般要按厂家要求先用适用醇类预湿/活化，再完成水或转膜缓冲液平衡，并避免干燥；预湿产品或特殊膜按各自说明书。NC 一般用水或转膜缓冲液润湿，不应直接套用 PVDF 的甲醇活化要求。遗漏 PVDF 预湿是合理疑点，但整膜无信号不能证明其为唯一原因；应结合已有转膜/总蛋白证据和对照，再检查转膜方向与接触、抗体/检测系统等。不要将预染 marker 可见当作所有目标蛋白都已成功转移的证明。',
    broad: '换了材料后，哪些原先默认成立的准备条件需要重新核对？观察结果能把原因缩小到唯一一项吗？',
    source: wbReferences.membrane + '；' + wbReferences.detection
  },
  {
    id: 'wb-large-protein-transfer', category: '大蛋白转膜',
    prompt: '同一块膜上约 40 kDa 的对照蛋白有清楚信号，但约 250 kDa 的目标蛋白没有信号。组员认为“40 kDa 正常就证明转膜没问题，250 kDa 一定不表达”。你如何判断，并提出有依据的排查方向？',
    rubric: '40 kDa 正常仅提供该检测链路部分有效的证据，不能证明 250 kDa 的转移和检测成功，也不能据无信号断言不表达。大蛋白可能较难从凝胶洗脱和转移，需结合转后凝胶、膜蛋白染色、适当分子量 marker 或阳性对照的证据，按具体转膜系统优化凝胶/转膜方式、时间或电流以及甲醇/SDS等缓冲条件；不要求固定数值。避免简单“无限延长时间/增大电流”，应兼顾温度、膜结合和其他蛋白。也保留样品中目标丰度/降解、目标抗体适用性、表位及成像等可能性；不能确定转膜是唯一原因。',
    broad: '一个分子量范围正常，能证明另一个范围也正常吗？先说明这个对照实际验证了什么。',
    source: wbReferences.transfer + '；' + wbReferences.membrane + '；' + wbReferences.detection
  },
  {
    id: 'wb-blocking-order', category: '步骤因果',
    prompt: '在当前参考流程中，一位同学把“封闭”和“一抗孵育”交换了顺序，认为最后都做过就等价。你如何评价？请解释顺序的作用，以及出现异常时能下到什么程度的结论。',
    rubric: '当前参考流程先封闭再一抗孵育。封闭先占据膜上非特异结合位点，随后一抗才进行目标识别；先加入一抗可能增加非特异结合和背景，之后补封闭不能被假定会逆转已经发生的结合。应恢复已验证方案并用对照/记录检查结果，保留一抗后与二抗后各自的洗膜。不能绝对断言顺序一换就必定完全无信号；若主张其他顺序，需有针对该体系验证的协议依据，不能仅以“都做过”为理由。',
    broad: '考虑前一个步骤是否在为后一个步骤创造条件：补做某个步骤，能否撤销已经发生的过程？',
    source: wbReferences.protocol
  },
  {
    id: 'wb-whole-blot-no-signal', category: '系统排查',
    prompt: '化学发光 WB 检测时整张膜没有信号，原因未知。组员建议立刻换掉所有抗体并从裂解重新做起。你会如何利用已有记录和对照，从低成本检查开始排查？说明每项检查能区分什么。',
    rubric: '不直接认定样品不表达，也不无依据同时更换全部条件。可有不同合理顺序，但应优先利用现有图像/记录/对照，覆盖：成像模式、膜的位置与采集/曝光设置及发光底物是否正确使用和有效；一抗是否用于该目标/应用、二抗是否识别一抗宿主/类型以及标记是否与检测系统匹配，是否漏加或失活；转膜极性、组装/接触和实际转移证据，必要时以兼容蛋白染色、转后凝胶或阳性对照帮助区分。预染 marker 只能提供有限转移证据。检查后再选择针对性的验证或重做，每一步说明希望排除或支持哪种可能，而非把所有排查因素当作必须盲目更换的清单。',
    broad: '从最终读出向前追溯：哪些已有证据能证明一个环节确实工作过？先选择能区分不同可能性的检查。',
    source: wbReferences.detection + '；' + wbReferences.protocol + '；' + wbReferences.membrane
  }
];
