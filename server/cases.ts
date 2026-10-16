import type { LabCase, Step } from '../shared/types';
import { wbAnomalies, wbReferences } from './wb-content';
const wbSource = '生物实验-WB通用实验方案.docx';
const optSource = '联合傅里叶相关图像识别实验_实践细节说明书.docx';
function step(id: string, title: string, parentId: string | undefined, summary: string, why: string, check: string, source: string, aliases: string[] = [], media: string[] = []): Step {
  return { id, title, parentId, summary, why, check, source, aliases, media };
}
export const seedCases: LabCase[] = [
  {
    id: 'wb', title: 'Western Blot', subtitle: '从样品与条带，到有依据的结果解读', discipline: '生物实验', revision: 2,
    rootId: 'wb', practiceParent: 'wb-antibody', practiceParents: ['wb', 'wb-antibody', 'wb-sample', 'wb-separate', 'wb-interpret'],
    sources: [wbSource, ...Object.values(wbReferences)],
    caveats: ['基础流程由提供的文档整理；具体实验条件以实验室确认版本为准。', '结果解读、膜预处理、条件优化与新增异常题属于厂家资料支持的补充教学，不是课程原文；来源核验见 docs/wb-sources.md。', '丽春红染色的可选性在原文中存在不同表述，暂不作为唯一答案；教学中的转移验证可采用合适的替代证据。', '封闭液与抗体稀释液按具体产品分别核对；不能把 BSA、奶粉、转膜参数或重复次数当作所有实验的统一充分条件。'],
    steps: [
      step('wb', 'WB 实验', undefined, '串联样品制备、蛋白分离、膜上识别、成像与结果解读。', '先建立整体结构，再逐层理解操作和证据。', '能说清各阶段的目的，以及条带能够支持什么结论。', wbSource + '；结果解读为补充教学'),
      step('wb-prepare', '试剂准备', 'wb', '核对样品、缓冲液、膜与抗体，确认对应说明书。', '让后续步骤使用适合当前样品的条件。', '所需材料已核对，适用条件清楚。', wbSource + ' · 一'),
      step('wb-sample', '蛋白提取与定量', 'wb', '获取样品中的蛋白，定量并准备上样。', '比较信号前需要控制上样的可比性。', '能解释为什么需要定量。', wbSource + ' · 二'),
      step('wb-separate', '电泳与转膜', 'wb', '先在凝胶中分离，再把蛋白转移到膜上。', '膜为后续抗体识别提供载体。', '区分分离和转移两个目的。', wbSource + ' · 三'),
      step('wb-antibody', '封闭与抗体孵育', 'wb', '围绕特异性识别与背景控制，建立这一阶段的操作链。', '识别目标与去除多余抗体需要交替进行。', '能独立重建此阶段，并解释两次洗膜。', wbSource + ' · 四'),
      step('wb-image', '显影与成像', 'wb', '准备发光底物、采集图像，检查曝光是否合适。', '将膜上的识别结果转化为可观察信号。', '避免过曝；信号强度不自动等于表达量。', wbSource + ' · 五'),
      step('wb-interpret', '结果解读', 'wb', '补充教学：核查条带身份、可比性与重复证据，再形成有边界的结论。', '获得图像只是测量的一部分，解释还依赖对照和测量条件。', '能区分图像观察、相对定量与尚未证明的机制。', wbReferences.normalization + '；' + wbReferences.replicates),
      step('wb-lysis', '样本裂解', 'wb-sample', '根据样本类型使用相应的裂解流程。', '释放蛋白并尽量保存待分析状态。', '样本条件与所用方案一致。', wbSource + ' · 二 / 样本裂解'),
      step('wb-collect', '离心收集', 'wb-sample', '分离碎片并收集所需的上清。', '减少不溶物对后续分析的干扰。', '注意不将沉淀混入上清。', wbSource + ' · 二 / 离心收集'),
      step('wb-quantify', '蛋白定量', 'wb-sample', '用标准曲线估计蛋白浓度，并据此准备可比的上样量。', '条带更亮也可能源于上样更多。', '说明定量与比较结果之间的关系。', wbSource + ' · 二 / BCA 法'),
      step('wb-denature', '变性处理', 'wb-sample', '按样品与试剂要求完成上样前处理。', '使蛋白适合当前分离方法。', '具体条件核对目标蛋白和试剂说明书。', wbSource + ' · 二 / 变性处理'),
      step('wb-gel', '电泳分离', 'wb-separate', '将处理后的样品上样并完成电泳。', '利用凝胶分离样品中的蛋白。', '核对上样位置和电泳状态。', wbSource + ' · 三 / 电泳'),
      step('wb-membrane', '膜预处理', 'wb-separate', '补充教学：确认膜型号。普通干燥 PVDF 按厂家要求用适用醇类预湿/活化，再平衡到转膜缓冲液；NC 通常用水或转膜缓冲液润湿。', '不同膜的润湿性质不同，不能机械沿用另一种膜的准备方法。', '记录预湿和平衡，避免干膜；预湿产品或特殊膜按自身说明书，不一概要求额外甲醇活化。', wbReferences.membrane, ['预湿膜', '膜活化', 'PVDF预处理']),
      step('wb-transfer', '转膜', 'wb-separate', '按极性组装转膜夹层，注意贴合与气泡。补充：大分子目标需结合转移证据和设备说明优化条件。', '将凝胶中的蛋白转移到膜上；小蛋白转移成功不能证明大蛋白也成功。', '检查方向、接触和转移证据。约 250 kDa 目标可需调整转膜方式、时间/电流及缓冲条件，不能把“加大电流或延长时间”当通用答案。', wbSource + ' · 三 / 转膜；' + wbReferences.transfer),
      step('wb-block', '封闭', 'wb-antibody', '用适合当前检测的封闭液处理膜。补充：磷酸化检测时核对 BSA/奶粉选择，封闭液与一抗稀释液分别遵循产品说明。', '占据膜上的非特异性结合位点，降低背景；奶粉可能干扰部分磷酸化抗体，但并非所有方案都不适用。', '封闭材料与检测目标兼容。BSA 是可验证的候选，不保证消除所有高背景；部分厂家验证方案仍用奶粉封闭。', wbSource + ' · 四 / 封闭；' + wbReferences.blocking + '；' + wbReferences.blockingException, ['封闭处理', 'blocking'], ['card-a']),
      step('wb-primary', '一抗孵育', 'wb-antibody', '让一抗与目标蛋白结合。', '一抗提供对目标的特异性识别。', '抗体与目标匹配，条件依说明书确认。', wbSource + ' · 四 / 一抗孵育', ['一抗', 'primary antibody', '孵育一抗'], ['card-b']),
      step('wb-wash1', '洗膜', 'wb-antibody', '一抗孵育后洗膜。', '去除未结合或结合不牢的抗体，减少背景。', '保留这次洗膜与下一次洗膜各自的位置。', wbSource + ' · 四 / 第一次洗膜', ['一抗后洗膜', '第一次洗膜', 'wash'], ['card-c']),
      step('wb-secondary', '二抗孵育', 'wb-antibody', '使用与一抗匹配的标记二抗。', '通过二抗的标记帮助检测一抗结合的位置。', '二抗与一抗的来源匹配。', wbSource + ' · 四 / 二抗孵育', ['二抗', 'secondary antibody', '孵育二抗'], ['card-d']),
      step('wb-wash2', '洗膜', 'wb-antibody', '二抗孵育后再次洗膜。', '减少游离二抗带来的背景信号。', '不能用前一次洗膜替代。', wbSource + ' · 四 / 第二次洗膜', ['二抗后洗膜', '第二次洗膜', 'wash'], ['card-c']),
      step('wb-check-band', '核对条带身份', 'wb-interpret', '借助合适的 marker 估计表观分子量，并结合预期大小、阳性/阴性对照及抗体特异性判断。', '相近分子量不能独自证明身份；修饰、降解、异构体或非特异结合都可能改变条带。', '异常大小或多条带需解释，不能只选最亮条带当目标。', wbReferences.bands + '；' + wbReferences.protocol, ['分子量核对', '核对marker', '条带确认']),
      step('wb-check-linearity', '核查信号线性', 'wb-interpret', '检查曝光和饱和状态，并用适当样品梯度验证目标与归一化信号的共同线性范围。', '信号饱和或超出线性范围时，亮度变化不再可靠代表蛋白量变化。', '目标和内参/总蛋白信号都须适合定量；不直接比较不同曝光条件下的原始强度。', wbReferences.normalization + '；' + wbReferences.replicates, ['线性范围', '曝光检查', '检查饱和']),
      step('wb-normalize', '归一化比较', 'wb-interpret', '将同一样本的目标信号用经过当前条件验证的稳定内参，或适合本实验的总蛋白信号归一化，再比较组间结果。', '校正上样和转移差异有助于比较；内参并不天然恒定，归一化也不能修复所有实验误差。', '说明参照选择及其有效性；缺少合适参照时不直接把更亮解释为表达上调。', wbReferences.normalization, ['内参归一化', '总蛋白归一化', '标准化']),
      step('wb-replicates', '核查生物学重复', 'wb-interpret', '汇总独立生物学样本的重复结果与变异，并区分同一样本的重复测量。', '独立样本用于评估生物学差异是否可重复；重复曝光只能检查测量的一部分。', '按研究设计说明独立样本与重复数，不把同一样本多次曝光计为独立重复，也不把某个固定次数当作充分保证。', wbReferences.replicates, ['生物学重复', '独立重复', '重复验证']),
      step('wb-conclude', '界定可支持的结论', 'wb-interpret', '根据身份、线性、归一化和重复证据描述结果；关键证据缺失时保留不确定并指出下一步验证。', '条带更亮不自动证明上调，无信号不自动证明不表达，相对丰度也不等于活性或机制。', '对照失效、信号饱和、参照不适用或缺乏独立重复时，不作确定的组间生物学结论。', wbReferences.normalization + '；' + wbReferences.replicates + '；' + wbReferences.detection, ['结论边界', '结果结论', '解释结果'])
    ],
    sequence: ['wb-prepare','wb-lysis','wb-collect','wb-quantify','wb-denature','wb-gel','wb-membrane','wb-transfer','wb-block','wb-primary','wb-wash1','wb-secondary','wb-wash2','wb-image','wb-check-band','wb-check-linearity','wb-normalize','wb-replicates','wb-conclude'],
    anomalies: wbAnomalies
  },
  {
    id: 'jtc', title: '联合傅里叶相关', subtitle: '从联合输入，到两次变换与相关读出', discipline: '光学实验', revision: 2,
    rootId: 'jtc', practiceParent: 'jtc-measure', practiceParents: ['jtc', 'jtc-measure', 'jtc-align'], sources: [optSource],
    caveats: ['原文图 4 自注针孔位置错误，该图不进入参考附件。', '当前为教学流程摘要，实际光路和器件条件需依据实验台核对。'],
    steps: [
      step('jtc', 'JTC 图像识别实验', undefined, '搭建光路，记录联合功率谱，再读出相关结果。', '用两次变换建立输入图像与相关结果之间的联系。', '区分第一次和第二次测量的输入输出。', optSource),
      step('jtc-align', '搭建与校准光路', 'jtc', '建立光轴，完成共轴、空间滤波与准直。', '后续测量依赖稳定、适合的照明和成像几何。', '每步自检后再继续。', optSource + ' · 三'),
      step('jtc-measure', '两次测量与判读', 'jtc', '双目标输入 → 联合功率谱 → 回显功率谱 → 相关读出。', '第二次测量使用第一次的结果作为输入。', '解释为什么需要换图。', optSource + ' · 四'),
      step('jtc-axis', '建立光轴基准', 'jtc-align', '以光阑建立全系统的高度和光轴基准。', '后续元件有一致的参考。', '近远处光斑位置均符合校准要求。', optSource + ' · 步骤 1'),
      step('jtc-coaxial', '元件等高共轴', 'jtc-align', '逐个检查元件中心与光轴。', '避免输入或输出被截断、偏移。', '插入元件后复核位置。', optSource + ' · 步骤 2'),
      step('jtc-filter', '空间滤波', 'jtc-align', '按说明书完成物镜和针孔的调整。', '改善照明光束质量。', '用屏观察状态，不直接观察光束出口。', optSource + ' · 步骤 3'),
      step('jtc-collimate', '准直', 'jtc-align', '调整准直透镜并比较近远处光斑大小。', '让输入面获得适合的平行光照明。', '判据是近远光斑等大，不只是更亮。', optSource + ' · 步骤 4'),
      step('jtc-input', '装载双目标图', 'jtc-measure', '让输入面同时显示目标与参考图。', '两幅图共同形成联合输入。', '图像完整、居中，保持比例。', optSource + ' · 步骤 5', ['双目标输入', '联合输入'], ['card-e']),
      step('jtc-spectrum', '记录联合功率谱', 'jtc-measure', '第一次测量保存联合功率谱。', '记录携带两图关系的强度分布。', '检查条纹与包络是否清楚。', optSource + ' · 步骤 6', ['拍联合功率谱', '联合功率谱', 'JPS'], ['card-f']),
      step('jtc-reload', '回显功率谱', 'jtc-measure', '用刚保存的功率谱替换原双目标输入。', '第二次变换的输入应当是第一次的结果。', '确认已经换成正确的功率谱图。', optSource + ' · 步骤 7', ['装载功率谱', '换成功率谱']),
      step('jtc-read', '相关读出', 'jtc-measure', '观察中心与两侧相关结构，并与输入条件比较。', '根据相关结构判断图像之间的关系。', '不要仅凭中心亮斑判同。', optSource + ' · 步骤 7', ['读取相关峰', '相关结果'], ['card-g'])
    ],
    sequence: ['jtc-axis','jtc-coaxial','jtc-filter','jtc-collimate','jtc-input','jtc-spectrum','jtc-reload','jtc-read'],
    anomalies: [{ id: 'jtc-input-not-reloaded', category: '输入与读出', prompt: '第二次测量仍像原先的功率谱，而不是预期的相关输出。你会先检查哪件事？解释为什么，并说明为什么不宜立即改动整条光路。', rubric: '先检查是否把第一次保存的功率谱真正回显为输入，及采集是否仍停在旧预览。解释第二次变换的输入依赖第一次结果；先排查输入/显示而非无依据重调光路。', broad: '比较两次测量：哪些东西应该保持，哪一项输入必须改变？', source: optSource }]
  }
];
