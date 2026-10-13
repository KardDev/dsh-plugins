// Visual grammar, shared by native rendering, previews and model guidance.
// IDs are stable configuration values; no additional user switches are introduced.
export const STYLE_SYSTEM=Object.freeze({
 editorial:{description:'开放正文 · 杂志层级 · 细线分组',grammar:'编辑式阅读',composition:'先给一个明确结论，再用开放正文、左右对齐比较和细线段落展开。用 column 组织文章，card 在此风格中是章节，不是封闭面板；不要给每段套框。指标嵌在解释旁，流程像文中的编号提纲。',typography:'标题有衬线阅读感，正文行距舒展；标题、正文、注释至少三个层级，强调依赖字重和位置。',surfaces:'透明正文、细分隔线、低阴影或无阴影；保持结构性留白，不加大面积渐变。',controls:'表单像文章中的设置行，标签与当前值左右对齐；按钮紧凑，代码像有边注的摘录。',avoid:'避免大彩色卡片、每个数字一个盒子、粗重边框和装饰性背景。',native:{title:27,weight:650,gap:24,radius:12,metric:32,feedback:210,gain:.25}},
 soft:{description:'笔记色块 · 柔圆分组 · 舒缓节奏',grammar:'柔和彩色笔记',composition:'像清晰友好的笔记：把相关内容放在柔圆色块里，先提示主题，再给两三项要点。章节标题可以是小标签；比较项如并排便签，流程像一串有间距的笔记。',typography:'圆润标题和温和字重；正文清楚，数值与单位贴近，次要说明放在组内。',surfaces:'低饱和彩色便签、不同章节轻微交替色块、不对称的大圆角；使用实色底或少量柔和渐变。',controls:'控件内嵌在柔色分组，选择器像标签，操作有柔和回弹；避免每行都变成边框表单。',avoid:'避免工程网格、重黑海报、透明玻璃、泛白低对比度文字。',native:{title:25,weight:700,gap:20,radius:28,metric:36,feedback:390,gain:.7}},
 technical:{description:'工程网格 · 数据条带 · 编号连接',grammar:'技术说明与工程图',composition:'像工程说明：按输入→机制→输出组织；优先对齐的数据条带、编号流程、表格和有意义的连接线。指标放成紧凑测量带而非一排装饰卡；比较围绕相同维度对齐。',typography:'中文正文保持正常字号，数值/单位/序号用等宽字体与 tabular-nums；标题简短精确，明确基准、单位和假设。',surfaces:'细线网格、规则的小圆角、清晰边界和表头、无浮动投影。网格仅在图解背景使用，文字区域保持干净。',controls:'标签和输入严格对齐，参数区像仪表设置行；按钮和分段选项采用规则矩形，保留键盘及全局反馈。',avoid:'避免胶囊堆叠、巨大海报数字、彩色便签、装饰箭头、靠小字硬塞信息。',native:{title:22,weight:750,gap:16,radius:10,metric:28,feedback:180,gain:.3}},
 expressive:{description:'海报层级 · 非对称重点 · 醒目数字',grammar:'活力展示与重点海报',composition:'先选一个真正的视觉中心：大标题或关键数字，再用不对称分栏展开解释。主要结论占更大空间，次要比较退后；流程用醒目的序号与短句。不要把每一项都做成同等大小卡片。',typography:'短而有力的重标题、大数字、紧凑标题行距，正文仍易读。最多一个主要强调区，其余留白和细线辅助。',surfaces:'实色色块、粗细明确的边线、局部高对比强调；可用橙/珊瑚/暖黄，但不能整页争抢注意力。',controls:'主要操作醒目、次要操作轻量；表单和数据保持对齐，回弹比阅读风格明显但不空闲循环。',avoid:'避免六张等大的指标卡、满屏渐变、全屏大留白、无意义数字装饰。',native:{title:34,weight:850,gap:22,radius:20,metric:50,feedback:480,gain:1.1}},
 prismframe:{description:'应用模块 · 实色控件 · 偏移底面',grammar:'明亮扁平的轻量应用',composition:'像可直接使用的轻量应用：任务标题、输入模块、结果模块、解释区职责清楚。模块使用稳定网格，操作靠近对应结果；比较、流程和数据看板各自采用合适结构，不固定成同一套卡片。',typography:'圆润清晰的系统字体、明确模块标题、中等大数字；数字绑定名称和单位，图形承担关系说明。',surfaces:'浅彩底、白色实心模块、细彩色边线和扁平偏移底面；局部多色用来区分职责，避免每块同色同形。',controls:'整齐且有面积的实色表单行、清晰状态标签，主要操作有轻微偏移底面；不是磨砂玻璃。',avoid:'避免文档式满屏细线、海报式超大字、透明层叠、视频页码和字幕、重复标题。',native:{title:26,weight:780,gap:20,radius:24,metric:36,feedback:320,gain:.65}},
 aurora:{description:'产品层级 · 暖白曲面 · 局部渐彩',grammar:'柔光渐彩的精致产品界面',composition:'像精致的产品面板：暖白开放背景上安排少量实心表面，标题简洁、指标突出、控件顺手。用宽窄和疏密区分主要结果与次要说明；按钮、表单、表格、代码与文字要属于同一套语言。',typography:'近黑标题、清晰的字重差、大而利落的数字、柔和次要说明；不把文字都染成紫色。',surfaces:'暖白实色、24..30px 圆润表面、柔和投影、局部紫蓝青渐彩强调；不把整页铺成紫面板。',controls:'圆润内嵌输入、胶囊选择器、深色主操作与渐彩图标圆点；真实操作触发渐变扩散和弹性反馈。',avoid:'禁止玻璃/backdrop-filter、泛白低对比度、仅加一个演示按钮就算风格、空闲漂浮。',native:{title:28,weight:780,gap:24,radius:28,metric:42,feedback:460,gain:1}}
});
export function grammarPrompt(id){const g=STYLE_SYSTEM[id];return `视觉语言：${g.grammar}\n构图：${g.composition}\n文字层级：${g.typography}\n表面与边界：${g.surfaces}\n控件与反馈：${g.controls}\n避免：${g.avoid}\n同一任务在此风格下应具有可辨识的层级与构图，不能只换强调色。所有风格共用原生交互能力；动画只回应真实操作、支持 reduced motion。保持内容完整和 DOM 阅读顺序，不为了风格重排计算含义。用户明确指定的尺寸、颜色与布局优先。禁止玻璃材质。示例演示构图，不要求每次输出所有模块；简单需求用简短正文或一组数字，不能为了展示风格扩写内容。`;}
// Same facts, intentionally different content composition. Model examples are
// complete small documents; preview uses the same grammar without live controls.
export function grammarExample(id){
 const heading={type:'heading',text:'先交付一个可用版本'},body={type:'text',text:'把目标缩小，把关键体验做好。'},note={type:'text',text:'先验证，再逐步完善。',color:'muted'};
 const choice=(title,text)=>({type:'card',title,children:[{type:'text',text}]});
 const choices=[choice('先做小版本','验证重点'),choice('先铺全功能','覆盖需求')];
 const metrics=[{type:'metric',label:'推进阶段',value:3,unit:'步'},{type:'metric',label:'核心目标',value:1,unit:'个'}];
 const flow={type:'steps',items:[{title:'明确目标',description:'先抓住重点。'},{title:'解释关系',description:'用图形说明。'},{title:'给出行动',description:'收成下一步。'}]};
 let preset='brief',blocks;
 if(id==='editorial'){preset='reading';blocks=[heading,body,{type:'row',columns:2,children:choices},{type:'row',columns:2,children:metrics},flow,note]}
 else if(id==='soft'){blocks=[{type:'card',title:'今天的重点',children:[heading,body]},{type:'row',columns:2,children:choices},flow,{type:'row',columns:2,children:metrics},note]}
 else if(id==='technical'){blocks=[heading,body,{type:'row',columns:2,children:metrics},flow,{type:'table',label:'推进方式',columns:[{key:'method',label:'方案'},{key:'focus',label:'重点'}],rows:[{method:'先做小版本',focus:'验证重点'},{method:'先铺全功能',focus:'覆盖需求'}]},note]}
 else if(id==='expressive'){preset='minimal';blocks=[heading,{type:'row',columns:2,children:[{type:'column',children:[metrics[0],body]},{type:'column',children:[metrics[1],note]}]},{type:'row',columns:2,children:choices},flow]}
 else if(id==='prismframe'){blocks=[heading,body,{type:'row',columns:2,children:choices},{type:'row',columns:2,children:metrics},{type:'card',title:'行动路径',children:[flow]},note]}
 else{blocks=[heading,body,{type:'row',columns:2,children:metrics},{type:'row',columns:2,children:choices},flow,note]}
 return {tool:'render_text',args:{title:'把复杂问题讲清楚',preset,blocks}};
}
