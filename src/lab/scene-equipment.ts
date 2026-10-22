import type { Station } from './scene-data';

interface EquipmentDetails {
  parts: { name: string; description: string }[];
  look: string;
}

// Parts represented by these generic teaching models, rather than a brand-specific manual.
export const equipmentDetails: Record<Station, EquipmentDetails> = {
  reagents: {
    parts: [
      { name: '试剂瓶与瓶签', description: '先辨认瓶签，再区分试剂用途。' },
      { name: '带防滑纹的瓶盖', description: '观察盖体与瓶口的连接位置。' },
      { name: '试剂托盘', description: '把待用试剂集中放置，辨认取用位置。' },
      { name: '膜包装', description: '用于核对膜类型与相应的处理要求。' },
    ],
    look: '转动模型，查看瓶签、瓶口以及膜包装的摆放位置。',
  },
  sample: {
    parts: [
      { name: '移液器与一次性吸头', description: '上部按钮控制活塞，液体位于下端吸头。' },
      { name: '样品管与冷却盒', description: '识别管盖、锥形管底及样品放置位置。' },
      { name: '微孔定量板', description: '不同孔位承载标准品与待测样品。' },
      { name: '温控模块', description: '金属孔位支撑样品管，处理条件依方案设定。' },
    ],
    look: '从近景区分吸头、样品管和孔板；液体颜色仅作示意。',
  },
  centrifuge: {
    parts: [
      { name: '倾斜孔转子', description: '管孔围绕中心排列，配平管对称放置。' },
      { name: '圆形离心腔', description: '围住转子，留出旋转所需的空间。' },
      { name: '转子盖与铰链外盖', description: '区分覆盖转子的内盖与整机外盖。' },
      { name: '前面板与旋钮', description: '识别设备状态和操作控制所在区域。' },
    ],
    look: '依次查看配平、合盖和停转后的样品；转子运动在闭盖后演示。',
  },
  gel: {
    parts: [
      { name: '透明槽壁', description: '从侧面辨认内部支架和缓冲液区域。' },
      { name: '玻璃板与凝胶', description: '凝胶竖直夹在玻璃板之间。' },
      { name: '上样孔', description: '样品由顶部孔位进入各自泳道。' },
      { name: '红黑端子与电源', description: '电极连接至外置电源，形成电泳通路。' },
    ],
    look: '切到俯视定位上样孔，再用侧面近景观察凝胶和缓冲液腔。',
  },
  transfer: {
    parts: [
      { name: '湿转槽', description: '容纳缓冲液与竖直放置的转膜夹。' },
      { name: '阴极侧与阳极侧', description: '用两侧标记辨认夹层的方向。' },
      { name: '凝胶与膜', description: '常规 SDS-PAGE 转膜时，膜位于凝胶的阳极侧。' },
      { name: '滤纸与纤维垫', description: '位于凝胶、膜组合的外侧，帮助夹层贴合。' },
    ],
    look: '展开夹层看顺序，合拢后查看整套夹具在槽中的位置。',
  },
  tray: {
    parts: [
      { name: '摇床底座', description: '支撑摇动机构与上方平台。' },
      { name: '摇动平台', description: '带着孵育盘轻柔摆动。' },
      { name: '孵育盘与膜', description: '膜置于浅盘内，液体覆盖膜面。' },
      { name: '前面板旋钮', description: '识别摇床控制位置，动画不代表实际速度。' },
    ],
    look: '观察盘壁、液面与膜的相对位置；结合符号是放大的机制示意。',
  },
  imager: {
    parts: [
      { name: '遮光暗箱', description: '关闭后为信号采集提供遮光环境。' },
      { name: '箱门与把手', description: '装样时打开，采集时合拢。' },
      { name: '膜托盘', description: '把待测膜平放在采集位置。' },
      { name: '外侧显示器', description: '显示采集后的合成条带图。' },
    ],
    look: '播放装样与采集，查看托盘收回、箱门关闭以及图像出现的顺序。',
  },
  laser: {
    parts: [
      { name: '激光器壳体', description: '金属外壳带有散热结构。' },
      { name: '出光孔', description: '位于朝向光学元件的一端。' },
      { name: '开关与状态标记', description: '辨认设备的操作面和出光方向。' },
      { name: '固定底座', description: '将光源安装到光学台上。' },
    ],
    look: '从侧面观察出光孔与光轴的关系；发光光束是教学叠加示意。',
  },
  iris: {
    parts: [
      { name: '近、远两只光阑', description: '两个中心共同提供光轴位置的参照。' },
      { name: '开孔叶片', description: '叶片围成中央通光孔。' },
      { name: '调节拨杆', description: '用于改变光阑开孔大小。' },
      { name: '立柱与锁紧座', description: '支撑光阑并保持中心高度。' },
    ],
    look: '沿台面侧向比较两只光阑中心，再用光轴滑块观察偏移。',
  },
  filter: {
    parts: [
      { name: '聚焦物镜', description: '将入射光聚焦到针孔附近。' },
      { name: '针孔与夹持架', description: '针孔位于聚焦位置，供中心光束通过。' },
      { name: '横向微分头', description: '调节针孔在横向两个方向的位置。' },
      { name: '轴向调焦结构', description: '调整物镜与针孔之间的相对位置。' },
    ],
    look: '旋转近景，区分物镜端与针孔端，以及不同方向的调节机构。',
  },
  lens: {
    parts: [
      { name: '准直镜片', description: '位于空间滤波器之后，接收发散光束。' },
      { name: '金属压圈', description: '将镜片固定在镜架内。' },
      { name: '镜架与立柱', description: '使镜片中心位于光轴高度。' },
      { name: '底座锁紧件', description: '将支架固定到台面孔位。' },
    ],
    look: '从斜侧面查看镜片和压圈，再比较近、远光屏上的示意光斑。',
  },
  input: {
    parts: [
      { name: '透射显示面', description: '加载双目标图，或回显第一次采集的功率谱。' },
      { name: '开窗边框', description: '围住有效显示区域，中央保留通光面。' },
      { name: '控制接口与连接线', description: '把显示模块连接到控制端。' },
      { name: '支撑架', description: '让输入面与光轴垂直。' },
    ],
    look: '转到显示面一侧观察内容；回显功率谱后，输入内容随步骤切换。',
  },
  fourier: {
    parts: [
      { name: '傅里叶透镜', description: '位于输入面与采集相机之间。' },
      { name: '镜片压圈', description: '将镜片固定在通光孔内。' },
      { name: '金属镜架', description: '围住镜片边缘，中央供光束通过。' },
      { name: '立柱与固定座', description: '把镜片中心维持在共同光轴上。' },
    ],
    look: '在全景中确认输入面、透镜和相机的前后顺序，再查看镜架近景。',
  },
  camera: {
    parts: [
      { name: 'C 接口与感光窗', description: '朝向傅里叶透镜，承接输出面的光信号。' },
      { name: '工业相机机身', description: '承载探测器与采集电路。' },
      { name: '后部接口与线缆', description: '连接相机与采集设备。' },
      { name: '读出显示器', description: '第一次显示功率谱，第二次显示相关结构。' },
    ],
    look: '首次采集前显示器等待采集；模型中的结果图均为合成示意。',
  },
};
