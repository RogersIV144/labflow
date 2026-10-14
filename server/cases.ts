import type { LabCase, Step } from '../shared/types';
const wbSource = '生物实验-WB通用实验方案.docx';
const optSource = '联合傅里叶相关图像识别实验_实践细节说明书.docx';
function step(id: string, title: string, parentId: string | undefined, summary: string, why: string, check: string, source: string, aliases: string[] = [], media: string[] = []): Step {
  return { id, title, parentId, summary, why, check, source, aliases, media };
}
export const seedCases: LabCase[] = [
  {
    id: 'wb', title: 'Western Blot', subtitle: '从一份样品，到看见目标蛋白', discipline: '生物实验', revision: 1,
    rootId: 'wb', practiceParent: 'wb-antibody', sources: [wbSource],
    caveats: ['教学流程由提供的文档整理；具体实验条件以实验室确认版本为准。', '丽春红染色的可选性在原文中存在不同表述，暂不作为唯一答案。'],
    steps: [
      step('wb', 'WB 实验', undefined, '学习样品制备、蛋白分离、膜上识别与成像之间的联系。', '先建立整体结构，再逐层理解操作。', '能说清每个阶段的目的与衔接。', wbSource),
      step('wb-prepare', '试剂准备', 'wb', '核对样品、缓冲液、膜与抗体，确认对应说明书。', '让后续步骤使用适合当前样品的条件。', '所需材料已核对，适用条件清楚。', wbSource + ' · 一'),
      step('wb-sample', '蛋白提取与定量', 'wb', '获取样品中的蛋白，定量并准备上样。', '比较信号前需要控制上样的可比性。', '能解释为什么需要定量。', wbSource + ' · 二'),
      step('wb-separate', '电泳与转膜', 'wb', '先在凝胶中分离，再把蛋白转移到膜上。', '膜为后续抗体识别提供载体。', '区分分离和转移两个目的。', wbSource + ' · 三'),
      step('wb-antibody', '封闭与抗体孵育', 'wb', '围绕特异性识别与背景控制，建立这一阶段的操作链。', '识别目标与去除多余抗体需要交替进行。', '能独立重建此阶段，并解释两次洗膜。', wbSource + ' · 四'),
      step('wb-image', '显影与成像', 'wb', '准备发光底物、采集图像，检查曝光是否合适。', '将膜上的识别结果转化为可观察信号。', '避免过曝；信号强度不自动等于表达量。', wbSource + ' · 五'),
      step('wb-lysis', '样本裂解', 'wb-sample', '根据样本类型使用相应的裂解流程。', '释放蛋白并尽量保存待分析状态。', '样本条件与所用方案一致。', wbSource + ' · 二 / 样本裂解'),
      step('wb-collect', '离心收集', 'wb-sample', '分离碎片并收集所需的上清。', '减少不溶物对后续分析的干扰。', '注意不将沉淀混入上清。', wbSource + ' · 二 / 离心收集'),
      step('wb-quantify', '蛋白定量', 'wb-sample', '用标准曲线估计蛋白浓度，并据此准备可比的上样量。', '条带更亮也可能源于上样更多。', '说明定量与比较结果之间的关系。', wbSource + ' · 二 / BCA 法'),
      step('wb-denature', '变性处理', 'wb-sample', '按样品与试剂要求完成上样前处理。', '使蛋白适合当前分离方法。', '具体条件核对目标蛋白和试剂说明书。', wbSource + ' · 二 / 变性处理'),
      step('wb-gel', '电泳分离', 'wb-separate', '将处理后的样品上样并完成电泳。', '利用凝胶分离样品中的蛋白。', '核对上样位置和电泳状态。', wbSource + ' · 三 / 电泳'),
      step('wb-transfer', '转膜', 'wb-separate', '按极性组装转膜夹层，注意贴合与气泡。', '将凝胶中的蛋白转移到膜上。', '凝胶和膜的相对方向正确，接触区域无气泡。', wbSource + ' · 三 / 转膜'),
      step('wb-block', '封闭', 'wb-antibody', '用适合当前检测的封闭液处理膜。', '占据膜上的非特异性结合位点，降低背景。', '封闭材料与检测目标兼容。', wbSource + ' · 四 / 封闭', ['封闭处理', 'blocking'], ['card-a']),
      step('wb-primary', '一抗孵育', 'wb-antibody', '让一抗与目标蛋白结合。', '一抗提供对目标的特异性识别。', '抗体与目标匹配，条件依说明书确认。', wbSource + ' · 四 / 一抗孵育', ['一抗', 'primary antibody', '孵育一抗'], ['card-b']),
      step('wb-wash1', '洗膜', 'wb-antibody', '一抗孵育后洗膜。', '去除未结合或结合不牢的抗体，减少背景。', '保留这次洗膜与下一次洗膜各自的位置。', wbSource + ' · 四 / 第一次洗膜', ['一抗后洗膜', '第一次洗膜', 'wash'], ['card-c']),
      step('wb-secondary', '二抗孵育', 'wb-antibody', '使用与一抗匹配的标记二抗。', '通过二抗的标记帮助检测一抗结合的位置。', '二抗与一抗的来源匹配。', wbSource + ' · 四 / 二抗孵育', ['二抗', 'secondary antibody', '孵育二抗'], ['card-d']),
      step('wb-wash2', '洗膜', 'wb-antibody', '二抗孵育后再次洗膜。', '减少游离二抗带来的背景信号。', '不能用前一次洗膜替代。', wbSource + ' · 四 / 第二次洗膜', ['二抗后洗膜', '第二次洗膜', 'wash'], ['card-c'])
    ],
    sequence: ['wb-prepare','wb-lysis','wb-collect','wb-quantify','wb-denature','wb-gel','wb-transfer','wb-block','wb-primary','wb-wash1','wb-secondary','wb-wash2','wb-image'],
    anomaly: { prompt: '成像后背景很高。有人建议直接延长曝光，让目标条带更明显。你会如何评价这个建议？提出两个应优先检查的环节，并解释理由。', rubric: '指出延长曝光不能解决高背景且可能加剧过曝。合理检查封闭、洗膜、抗体浓度或特异性等；给出与背景相关的原因。无需罗列所有可能因素，不能声称一定定位唯一原因。', broad: '先想一想：背景来自哪里？把信号显示得更亮，是否等于改善了信号与背景的关系？' }
  },
  {
    id: 'jtc', title: '联合傅里叶相关', subtitle: '从联合输入，到两次变换与相关读出', discipline: '光学实验', revision: 1,
    rootId: 'jtc', practiceParent: 'jtc-measure', sources: [optSource],
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
    anomaly: { prompt: '第二次测量仍像原先的功率谱，而不是预期的相关输出。你会先检查哪件事？解释为什么，并说明为什么不宜立即改动整条光路。', rubric: '先检查是否把第一次保存的功率谱真正回显为输入，及采集是否仍停在旧预览。解释第二次变换的输入依赖第一次结果；先排查输入/显示而非无依据重调光路。', broad: '比较两次测量：哪些东西应该保持，哪一项输入必须改变？' }
  }
];
