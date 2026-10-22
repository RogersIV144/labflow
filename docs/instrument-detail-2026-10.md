# 实验器材细化（2026-10-23）

基于 0.3.0 的两个实验场景，细化通用实验仪器的结构、材质和动作。实验步骤与评分体系沿用已有设计。

## 观察方式

进入「学习 → 实验场景」，点击下方器材名称进入近景。「仅看当前器材」可排除其他设备遮挡；器材识别面板位于画布下方，列出模型中的主要部件及作用。「当前操作」回到本步骤的器材，右上角可放大场景。

## 这次细化

- WB：移液器与吸头、冷却盒与样品管、定量孔板和温控模块；带倾斜管孔的转子、离心腔及铰链盖；分壁透明电泳槽、玻璃夹板、泳道、电极端子和电源；湿转槽与可展开的竖直夹层；摇床、孵育盘及液面；带门暗箱、膜托盘和独立成像显示屏。
- JTC：带孔光学台、固定底座、立柱套筒和锁紧旋钮；近远光阑、物镜与针孔调节架；有压圈与镀膜玻璃的透镜；透射式输入显示面；工业相机镜筒、连接线及独立读出屏。
- 材质与照明：中性色仪器壳体、金属高光、透明塑料与玻璃、台面细微粗糙度、瓶盖防滑纹及样品管刻度。光束与分子符号仍作为教学叠加显示。
- 近景：仪器可提供覆盖开盖、开门、展开动作的固定观察边界，避免动作中被镜头裁掉；器材识别说明不覆盖三维画布。

## 维护

`scene-wb.ts` 与 `scene-optics.ts` 分别构建两个模型；`scene-primitives.ts` 提供共用材质、几何、台面、纹理和模型接口。`LabScene.tsx` 负责镜头、照明、拾取、按需渲染与资源释放。`scene-equipment.ts` 和 `equipment.css` 提供器材识别面板内容与样式。

场景运行不下载外部模型或贴图。重复孔位、紧固件等优先用实例化几何。静止或离屏时继续采用 0.3.0 的按需绘制机制。

## 验证记录

- Windows 本机构建：TypeScript 与 Vite 通过；已有 64 项回归测试通过。
- 几何检查：两个模型成功构建，对所有 27 个步骤的各动作进行更新，未发现无效顶点或变换数值。该检查不替代碰撞检测或实验正确性验证。
- 浏览器实看：覆盖独立器材近景/俯视、器材识别面板、播放返回当前步骤、翻盖移液、成像仪开门/伸托盘与收盘/关门、转膜展开/合拢；检查 1280×800 与 390×844 布局，窄屏 document 宽度与 scrollWidth 均为 390，无页面横向溢出。截图见 [光学调节架](scene-preview/instruments-optics-detail.png)、[成像暗箱](scene-preview/instruments-wb-imager.png)、[转膜夹层](scene-preview/instruments-wb-transfer.png)、[窄屏](scene-preview/instruments-mobile.png)。
- 当前三维延迟加载块约 634 kB / gzip 167 kB，仍有 Vite 大块提醒。Windows 图形驱动输出过 Three.js shader 浮点精度 warning，当前画面可正常渲染；未测 FPS、续航或其他显卡兼容性。

## 表达范围

模型参考常见仪器结构，未复刻特定品牌型号的尺寸与操作面板。它们用于认识部件和理解步骤；液体、蛋白条带、光束与光学输出仍是合成示意，不提供实测值。具体设备的装配方式与实验条件应以其说明书和本实验室方案为准。

## 结构参考

- Bio-Rad：[Mini-PROTEAN 垂直电泳结构](https://www.bio-rad.com/webroot/web/pdf/lsr/literature/1658100.pdf)、[转膜系统产品目录](https://www.bio-rad.com/webroot/web/pdf/lsr/literature/2016_Life_Science_Research_Product_Catalog.pdf)、[成像仪暗箱与托盘](https://www.bio-rad.com/webroot/web/pdf/lsr/global/english/catalogs/6120_231_240_ImageInstrum_US.pdf)。用于核对玻璃夹板、缓冲液腔、湿转夹具和装样结构。
- Eppendorf：[5425 离心机说明书](https://www.eppendorf.com/product-media/doc/en/338022/Centrifugation_Operating-manual_Centrifuge-5425.pdf)。用于核对转子、转子盖、外盖与对称配平关系。
- Thorlabs：[空间滤波系统](https://www.thorlabs.us/newgrouppage9.cfm?objectgroup_id=997)、[光阑](https://www.thorlabs.de/newgrouppage9.cfm?objectgroup_id=206&pn=ID8%2FM)、[镜片固定架](https://www.thorlabs.com/newgrouppage9.cfm?objectgroup_id=1433&pn=LMRA10)。用于核对物镜/针孔与调节架、开孔叶片、压圈和立柱的关系。
- HOLOEYE：[透射式 LC 2012 SLM](https://holoeye.com/products/spatial-light-modulators/lc-2012-spatial-light-modulator-transmissive/)。本场景采用通用透射输入面，保持已有直线光路。
- Basler：[ace 工业相机](https://www.baslerweb.com/en/cameras/ace/)。用于核对工业相机壳体、前接口与后部连接；模型前部为 C 接口和感光窗，不额外加入改变原理的成像镜头。
