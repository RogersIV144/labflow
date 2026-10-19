import type { LabCase } from '../../shared/types';

export type Station = 'reagents' | 'sample' | 'centrifuge' | 'gel' | 'transfer' | 'tray' | 'imager' | 'laser' | 'iris' | 'filter' | 'lens' | 'input' | 'camera' | 'fourier';
export interface SceneLesson {
  station: Station;
  equipment: string;
  actions: string[];
  observation: string;
}
const lesson = (station: Station, equipment: string, actions: string[], observation: string): SceneLesson => ({ station, equipment, actions, observation });

// Visual extensions of the supplied case summaries, not a lab-specific SOP.
export const lessons: Record<string, SceneLesson> = {
  'wb-prepare': lesson('reagents', '试剂瓶 · 移液器 · 耗材架', ['核对试剂与抗体标识', '确认膜类型与适用说明'], '试剂架上区分样品处理、转膜与免疫检测材料。实际配方和用量按本实验室方案确认。'),
  'wb-lysis': lesson('sample', '样品管 · 移液器 · 冰盒', ['识别样品管与裂解液', '演示加入与混匀'], '液体进入样品管。这里演示操作关系；温度、裂解条件与保存要求依样品方案。'),
  'wb-collect': lesson('centrifuge', '台式离心机 · 配平样品管', ['查看对称放置的配平管', '合盖并演示分离', '查看上清与沉淀'], '转子停止后观察上清与底部沉淀；收集时避免扰动沉淀。转速和时间不在本场景中指定。'),
  'wb-quantify': lesson('sample', '定量板 · 标准品 · 样品管', ['查看标准品与待测样品', '比较标准与样品响应'], '示意定量板的颜色变化。浓度需要由标准曲线、空白与适用范围计算，不能凭颜色直接读数。'),
  'wb-denature': lesson('sample', '样品管 · 温控模块', ['核对上样前处理条件', '演示处理后的样品'], '样品准备好进入分离阶段。具体温度和处理时长按目标与试剂要求确认。'),
  'wb-gel': lesson('gel', '垂直电泳槽 · 上样孔 · 电源', ['定位上样孔与泳道', '演示样品进入凝胶', '观察不同位置的条带'], '示意条带沿泳道分离。颜色仅用于区分组分，不代表实际可见的蛋白颜色。'),
  'wb-membrane': lesson('transfer', '膜 · 润湿盘 · 转膜缓冲液', ['区分膜与凝胶', '查看预湿与平衡的位置'], '膜需保持合适的润湿状态。普通干燥 PVDF、NC 与预湿产品的处理不同，按厂家说明确认。'),
  'wb-transfer': lesson('transfer', '转膜夹层 · 凝胶 · 膜', ['展开查看夹层顺序', '核对膜位于凝胶的阳极侧', '贴合夹层并演示转移'], '常规 SDS-PAGE 转膜示意：蛋白从凝胶向阳极侧的膜移动。贴合和气泡会影响转移，设备要求优先。'),
  'wb-block': lesson('tray', '孵育盘 · 膜 · 封闭液', ['定位膜与孵育盘', '演示液体覆盖膜', '观察轻柔摇动'], '封闭液与膜表面接触。封闭材料和一抗稀释液须分别核对，不能把某一种材料当通用答案。'),
  'wb-primary': lesson('tray', '一抗试剂 · 孵育盘', ['核对一抗与目标', '演示一抗与膜接触'], '放大示意中，一抗结合到目标位置。结合图形帮助理解机制，不是分子尺度仿真。'),
  'wb-wash1': lesson('tray', '洗液 · 孵育盘', ['识别一抗后的洗膜位置', '演示洗液交换'], '游离的一抗随液体交换减少；这次洗膜位于一抗与二抗之间。'),
  'wb-secondary': lesson('tray', '标记二抗 · 孵育盘', ['核对二抗与一抗的匹配', '演示标记二抗结合'], '标记二抗与一抗结合，为后续信号检测建立联系。'),
  'wb-wash2': lesson('tray', '洗液 · 孵育盘', ['识别二抗后的洗膜位置', '演示再次交换洗液'], '减少未结合二抗带来的背景。这是独立的一步，不能由一抗后的洗膜替代。'),
  'wb-image': lesson('imager', '成像仪 · 检测膜 · 图像', ['查看膜与成像位置', '演示信号采集', '比较不同曝光效果'], '用曝光滑块比较示意图：过曝会丢失强度差异，得到图像并不代表已经得到可靠的生物学结论。'),
  'wb-check-band': lesson('imager', '条带图像 · 分子量参照', ['定位参照泳道', '比较目标与其他条带'], '条带位置只提供表观分子量线索，还需结合对照与抗体特异性判断身份。'),
  'wb-check-linearity': lesson('imager', '条带图像 · 曝光控制', ['改变示意曝光', '观察饱和时的信息丢失'], '较强曝光让不同强度趋近同样亮；真实线性范围需用样品梯度验证。滑块不代表真实秒数。'),
  'wb-normalize': lesson('imager', '目标信号 · 归一化参照', ['区分目标与参照信号', '比较归一化前后的含义'], '参照需在当前条件下验证。这个合成示例只说明比较关系，不用于推断表达量。'),
  'wb-replicates': lesson('imager', '独立样本 · 结果图像', ['区分样本泳道', '核对独立样本来源'], '一张图中更多泳道不自动等于更多生物学重复；样本是否独立需要由实验记录判断。'),
  'wb-conclude': lesson('imager', '图像与证据记录', ['回看身份与测量条件', '界定结论与缺失证据'], '场景展示的是实验与证据的关系。条带亮度不能独自证明活性、机制或因果。'),
  'jtc-axis': lesson('iris', '激光器 · 近远光阑 · 光屏', ['查看近远光阑中心', '调整光轴偏移至中心'], '调节滑块查看偏轴与通过中心的差别。只通过光屏观察，不能沿光轴直视。'),
  'jtc-coaxial': lesson('iris', '光学支架 · 光阑 · 透镜', ['识别光轴上的元件', '比较元件中心与光轴'], '元件中心应围绕同一光轴建立。模型展示几何关系，不替代实验台逐件校准。'),
  'jtc-filter': lesson('filter', '物镜 · 针孔 · 调节架', ['定位聚焦处的针孔', '演示通过中心的光束'], '针孔位于聚焦处，帮助改善光束空间质量。光束锥和光路为可视化示意。'),
  'jtc-collimate': lesson('lens', '准直透镜 · 近远光屏', ['比较近远光斑大小', '调节准直偏差'], '将准直偏差调到中心，示意近远光斑趋于等大。亮度增加本身不能证明准直。'),
  'jtc-input': lesson('input', '输入显示面 · 参考图与目标图', ['在输入面装载双目标', '确认两幅图完整显示'], '输入面同时呈现参考与目标。教学图形为合成数据，不是实际相机采集。'),
  'jtc-spectrum': lesson('camera', '傅里叶透镜 · 相机 · 采集图', ['查看第一次测量的输入', '演示记录联合功率谱'], '输出为有条纹和包络的联合功率谱；这是第一次测量结果，还不是相关读出。'),
  'jtc-reload': lesson('input', '输入显示面 · 已保存的功率谱', ['确认已保存第一次结果', '用功率谱替换双目标图'], '输入显示面从双目标切换为功率谱；这一变化连接两次测量，光路无需在这里整体重搭。'),
  'jtc-read': lesson('camera', '相关输出 · 中心与两侧结构', ['确认第二次输入为功率谱', '观察中心与两侧相关结构'], '合成示例用两侧结构说明相关读出的位置。中心亮斑本身不能作为判同依据，也不输出识别置信度。'),
};

export const stationNames: Record<Station, string> = {
  reagents:'试剂与耗材', sample:'样品工作区', centrifuge:'离心机', gel:'电泳槽', transfer:'转膜工作区', tray:'孵育与洗膜', imager:'成像与分析',
  laser:'激光器', iris:'光轴基准', filter:'空间滤波器', lens:'准直透镜', fourier:'傅里叶透镜', input:'输入显示面', camera:'采集相机',
};

export function lessonForStep(lab: LabCase, id?: string) {
  if (id && lab.sequence.includes(id) && lessons[id]) return id;
  const child = lab.sequence.find(key => lab.steps.find(step => step.id === key)?.parentId === id);
  return child || lab.sequence[0];
}

export function scenePhases(lab: LabCase) {
  const phases: { id: string; title: string; steps: string[] }[] = [];
  for (const id of lab.sequence) {
    let top = lab.steps.find(step => step.id === id);
    const seen = new Set<string>();
    while (top?.parentId && top.parentId !== lab.rootId && !seen.has(top.id)) {
      seen.add(top.id);
      top = lab.steps.find(step => step.id === top!.parentId);
    }
    const phaseId = top?.id || id;
    let phase = phases.find(item => item.id === phaseId);
    if (!phase) { phase = { id: phaseId, title: top?.title || id, steps: [] }; phases.push(phase); }
    phase.steps.push(id);
  }
  return phases;
}

export function practiceScope(lab: LabCase, id: string) {
  const parent = lab.steps.find(step => step.id === id)?.parentId;
  return parent && lab.practiceParents.includes(parent) ? parent : lab.practiceParents[0] || lab.practiceParent;
}
