export const fixture={title:'本地探索',items:[
 {type:'card',title:'数据比较',items:[{type:'input',id:'search',label:'筛选商品',placeholder:'输入商品名'},{type:'table',columns:['商品','数量'],rows:[['Alpha',12],['Beta',2],['Gamma',100]],types:['text','num'],filter:'search'},{type:'chart',kind:'donut',data:[{label:'Alpha',value:12},{label:'Beta',value:2},{label:'Gamma',value:100}]}]},
 {type:'plot',id:'curve',title:'振幅变化',xMin:-6.28,xMax:6.28,series:[{expr:'a*sin(x)',label:'正弦曲线',params:[{name:'a',value:1,min:0,max:3}]}]},
 {type:'quiz',id:'quiz',question:'哪种交互无需模型？',options:[{label:'调整本地曲线',correct:true,feedback:'本地立即重绘。'},{label:'查询天气',feedback:'需要联网。'}],explanation:'本地交互优先。'},
 {type:'tabs',id:'sections',tabs:[{label:'概览',items:[{type:'text',content:'$E=mc^2$ 是公式示例。'}]},{label:'细节',items:[{type:'keyvalue',pairs:[{key:'计算位置',value:'浏览器本地'}]}]}]},
 {type:'radio',group:'q1',label:'一加一等于？',options:['一','二'],answer:1,explanation:'基础加法。'},{type:'submit',label:'检查答案',groups:['q1']}
]};
export const engines={title:'按需图形',items:[
 {type:'echart',title:'示例数据',preset:'bar',data:[{label:'A',value:12},{label:'B',value:18}]},
 {type:'echart',title:'词云示例',preset:'wordCloud',data:[{label:'Motion UI',value:12},{label:'可视化',value:8},{label:'本地交互',value:6}]},
 {type:'mermaid',code:'graph LR\nA[输入] --> B[计算] --> C[结果]'},
 {type:'scene3d',title:'立体示例',meshes:[{shape:'box',color:'#7452ef',size:1,position:[0,0,0]}]}
]};
export const form={title:'一次提交',items:[{type:'input',id:'name',label:'名称'},{type:'checkbox',group:'channels',label:'GitHub'},{type:'checkbox',group:'channels',label:'npm'},{type:'submit',label:'根据选择继续',groups:['name','channels'],action:'根据用户填写的信息整理发布计划'}]};
