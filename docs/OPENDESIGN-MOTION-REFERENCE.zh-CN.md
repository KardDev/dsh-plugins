# OpenDesign 设计指导参考

2026-10-17 查阅当前 main。以下是源码观察及 Motion UI 的适配决定，不是上游质量或兼容性保证。

| 来源 | 值得吸收的设计方法 | Motion UI 适配 |
| --- | --- | --- |
| [motion-design](https://github.com/nexu-io/open-design/blob/main/skills/motion-design/SKILL.md) | 先解决代表构图，再扩展镜头；镜头表包含观众理解、主物、变形、声音与退出；贯穿物体连接镜头；区分 UI、讲解、品牌片的视觉语法 | 按需宣传片指导区分口播讲解与音乐驱动的产品片；加入具体能力变化及转场检查 |
| [huashu-art-motion](https://github.com/nexu-io/open-design/blob/main/skills/huashu-art-motion/SKILL.md) | 艺术材料、构图、特征运动共同定义风格；一帧先行；确定性绘制与缓存 | 不复制整套 35 种风格或上游工具；依照当前 brief 选择画面语言，沿用 DSHUI.timeline |
| [frontend-design](https://github.com/nexu-io/open-design/blob/main/skills/frontend-design/SKILL.md) | 具体美术方向落在排版、密度、颜色角色和组件形状；检查同质化 | 品牌片不机械套用日常卡片布局；用户明确参考优先 |
| [emilkowalski-motion](https://github.com/nexu-io/open-design/blob/main/skills/emilkowalski-motion/SKILL.md) | 界面反馈保持快速、有用，采用统一运动语言与减少动态效果回退 | 与影片的大幅构图变化分开处理，保留现有 UI 交互规则 |

上游 `skills/AGENTS.md` 说明部分目录是指向外部技能的轻量入口。不能把目录数量等同于完整内置工作流。

## 适配边界

- 保留 Motion UI 的工具、文档身份、独立时间轴和导出契约；不要求模型调用 OpenDesign CLI、GSAP 或不存在的资源。
- 指导按需获取，不把全部上游文档注入每轮对话；自由模式保持模型自主设计。
- 不引入上游固定检查次数、审批或推理限制，遵循当前用户的测试要求。
- 不把脉冲动画称为音频分析；估计节奏要标记为估计，缺少试听能力就不声称试听。
- 影片必须交付实际 MP4 和可编辑源码。真实能力用可见因果运动表达，不靠一串功能名称代替演示。
- 实现代码与原创案例独立编写；完整 motion-design 技能已按固定版本内置，保留原文、来源和 Apache-2.0 许可，详见 skills/motion-design/SOURCES.md。未复制上游播放器或素材。
