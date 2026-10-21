import {STYLE_SYSTEM,grammarPrompt,grammarExample} from './style-system.js';
// Stable user-facing IDs and palettes. Grammar and component tokens live together
// in style-system.js; the second example remains a small authored HTML/SVG surface.
export const DEFAULT_VISUAL_STYLE='prismframe';
const PALETTES=[
  {
    "id": "editorial",
    "name": "清爽阅读",
    "preview": {
      "bg": "#fff",
      "ink": "#182537",
      "accent": "#3e60d3",
      "soft": "#f4f6fa",
      "line": "#dfe5ed"
    },
    "canvasExample": {
      "tool": "render_canvas",
      "args": {
        "title": "三步发布",
        "fallback": "三步发布，静态排版示例。",
        "html": "<section><h2>把一件事讲清楚</h2><div class=\"steps\"><p><b>01 整理</b><span>补齐说明与许可</span></p><p><b>02 验证</b><span>检查安装与运行</span></p><p><b>03 发布</b><span>记录本次变化</span></p></div></section>",
        "css": "section{padding:20px;border:1px solid var(--canvas-line);border-radius:16px}h2{font-size:24px;margin:0 0 20px}.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}p{margin:0}b,span{display:block}span{color:var(--canvas-muted);margin-top:8px}@media(max-width:520px){.steps{grid-template-columns:1fr}}"
      }
    }
  },
  {
    "id": "soft",
    "name": "柔和彩色",
    "preview": {
      "bg": "#fbf8ff",
      "ink": "#32294c",
      "accent": "#7954bb",
      "soft": "#eee5fa",
      "line": "#e6dcf2"
    },
    "canvasExample": {
      "tool": "render_canvas",
      "args": {
        "title": "本周阅读计划",
        "fallback": "本周阅读计划，静态排版示例。",
        "html": "<section><span class=\"tag\">轻松开始</span><h2>每天一点，稳稳前进</h2><div class=\"plan\"><p><b>20 分钟</b><span>专注阅读</span></p><p><b>1 个收获</b><span>写下自己的理解</span></p></div></section>",
        "css": "section{padding:24px;border-radius:24px;border:1px solid var(--canvas-line);background:linear-gradient(130deg,color-mix(in srgb,#9567d4 12%,var(--canvas-bg)),color-mix(in srgb,#58b7ae 9%,var(--canvas-bg)));color:var(--canvas-ink)}.tag{display:inline-block;border-radius:999px;padding:5px 12px;background:var(--canvas-bg);color:var(--canvas-accent)}h2{font-size:26px;margin:14px 0 20px}.plan{display:flex;flex-wrap:wrap;gap:24px}.plan p{margin:0;flex:1 1 180px;padding:18px;border-radius:18px;background:color-mix(in srgb,var(--canvas-bg) 80%,transparent)}b,span{display:block}b{font-size:22px}.plan span{margin-top:8px;color:var(--canvas-muted)}"
      }
    }
  },
  {
    "id": "technical",
    "name": "技术图解",
    "preview": {
      "bg": "#f8fafb",
      "ink": "#1b3440",
      "accent": "#087e8b",
      "soft": "#e7f1f3",
      "line": "#cedde2"
    },
    "canvasExample": {
      "tool": "render_canvas",
      "args": {
        "title": "请求处理流程",
        "fallback": "请求处理流程，静态排版示例。",
        "html": "<section><header><small>REQUEST FLOW</small><h2>输入 → 处理 → 输出</h2></header><div class=\"flow\"><div><i>01</i><b>输入</b><p>接收需求</p></div><span>→</span><div><i>02</i><b>处理</b><p>校验与计算</p></div><span>→</span><div><i>03</i><b>输出</b><p>返回反馈</p></div></div></section>",
        "css": "section{padding:20px;border:1px solid var(--canvas-line);border-radius:10px}small,i{font:14px ui-monospace,monospace;color:var(--canvas-accent)}h2{font-size:24px;margin:8px 0 20px}.flow{display:flex;gap:12px;align-items:center}.flow div{flex:1;padding:16px;border:1px solid var(--canvas-line);border-radius:10px}.flow b,.flow i{display:block}.flow b{margin-top:10px;font-size:19px}p{margin:6px 0 0;color:var(--canvas-muted)}@media(max-width:520px){.flow{flex-direction:column}.flow div{width:100%}.flow>span{transform:rotate(90deg)}}"
      }
    }
  },
  {
    "id": "expressive",
    "name": "活力展示",
    "preview": {
      "bg": "#fff9f2",
      "ink": "#362820",
      "accent": "#bd4b26",
      "soft": "#ffead8",
      "line": "#edd7c5"
    },
    "canvasExample": {
      "tool": "render_canvas",
      "args": {
        "title": "从第一步开始",
        "fallback": "从第一步开始，静态排版示例。",
        "html": "<section><div class=\"number\">01</div><div class=\"copy\"><span>今天的重点</span><h2>先做出一个<br>能演示的版本</h2><p>只保留一条主线，尽早获得反馈。</p></div></section>",
        "css": "section{display:flex;align-items:center;gap:24px;padding:24px;border:1px solid var(--canvas-line);border-radius:22px;background:color-mix(in srgb,#f0984a 8%,var(--canvas-bg));color:var(--canvas-ink)}.number{font:800 54px/1 system-ui;padding:22px;border-radius:20px;color:var(--canvas-ink);background:color-mix(in srgb,#f0984a 28%,var(--canvas-bg))}.copy>span{font-size:14px;color:var(--canvas-muted)}h2{font-size:28px;line-height:1.3;margin:10px 0}p{margin:0;color:var(--canvas-muted)}@media(max-width:520px){section{align-items:flex-start;flex-direction:column}.number{font-size:36px;padding:16px}}"
      }
    }
  },
  {
    "id": "prismframe",
    "name": "明亮扁平",
    "preview": {
      "bg": "#ecf6ff",
      "ink": "#193858",
      "accent": "#3182d9",
      "soft": "#d3e8fc",
      "line": "#9ec9ef"
    },
    "canvasExample": {
      "tool": "render_canvas",
      "args": {
        "title": "三步让解释更清楚",
        "fallback": "三步让解释更清楚，静态排版示例。",
        "html": "<section><h2>把复杂问题讲清楚</h2><div class=\"cards\"><article><span>01</span><h3>明确目标</h3><p>先回答要解决什么。</p></article><article><span>02</span><h3>解释关系</h3><p>让图形承担说明。</p></article><article><span>03</span><h3>给出行动</h3><p>收成一个可执行步骤。</p></article></div></section>",
        "css": "section{padding:24px 24px 30px;border-radius:26px;background:color-mix(in srgb,#3182d9 9%,var(--canvas-bg));color:var(--canvas-ink);font-family:ui-rounded,system-ui,sans-serif}h2{font-size:26px;line-height:1.35;margin:0 0 20px}.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}article{padding:20px;border:1.5px solid color-mix(in srgb,#3182d9 45%,var(--canvas-line));border-radius:22px;background:var(--canvas-bg);box-shadow:4px 6px 0 color-mix(in srgb,#3182d9 18%,var(--canvas-bg)),0 8px 16px #1637590b}article>span{color:var(--canvas-accent);font-size:14px;font-weight:700}h3{font-size:20px;margin:12px 0 8px}p{margin:0;line-height:1.6;color:var(--canvas-muted)}@media(max-width:580px){.cards{grid-template-columns:1fr}}"
      }
    }
  },
  {
    "id": "aurora",
    "name": "柔光渐彩",
    "preview": {
      "bg": "#f4f2ee",
      "ink": "#16151b",
      "accent": "#6a57f2",
      "soft": "#f5f3ef",
      "line": "#e2dfda"
    },
    "canvasExample": {
      "tool": "render_canvas",
      "args": {
        "title": "选择一个方案",
        "fallback": "点击选择此方案，本地记录选择状态。",
        "state": {
          "selected": {
            "type": "boolean",
            "default": false
          }
        },
        "html": "<section class=\"choice\"><h2>先选择，再继续</h2><p>渐变扩散和文字换位由实际操作触发。</p><button class=\"action\" type=\"button\" aria-pressed=\"false\"><i aria-hidden=\"true\"></i><span class=\"label\"><b>选择此方案</b><b aria-hidden=\"true\">选择此方案</b></span><span class=\"orb\" aria-hidden=\"true\">→</span></button><p class=\"status\" role=\"status\">尚未选择</p></section>",
        "css": ".choice{padding:24px;border:1px solid var(--canvas-line);border-radius:26px;background:var(--canvas-bg);color:var(--canvas-ink)}h2{font-size:24px;margin:0 0 10px}p{color:var(--canvas-muted);line-height:1.7}.action{position:relative;isolation:isolate;overflow:hidden;display:inline-flex;align-items:center;gap:18px;min-height:54px;padding:8px 8px 8px 24px;border:0;border-radius:999px;background:var(--canvas-ink);color:var(--canvas-bg);translate:var(--x,0px) var(--y,0px);box-shadow:0 16px 28px -22px #54457988;transition:translate .7s cubic-bezier(.34,1.45,.64,1)}.action>i{position:absolute;inset:0;z-index:-1;background:linear-gradient(115deg,#7051ed,#326fce 55%,#188e97);clip-path:circle(21px at calc(100% - 29px) 50%);transition:clip-path .7s cubic-bezier(.2,.8,.2,1)}.action:is(:hover,:focus-visible){color:white}.action:is(:hover,:focus-visible)>i{clip-path:circle(160% at calc(100% - 29px) 50%)}.label{position:relative;overflow:hidden;line-height:1.5}.label b{display:block;transition:transform .55s cubic-bezier(.34,1.45,.64,1),opacity .3s}.label b+b{position:absolute;left:0;top:0;transform:translateY(130%);opacity:0}.action:is(:hover,:focus-visible) b:first-child{transform:translateY(-130%);opacity:0}.action:is(:hover,:focus-visible) b+b{transform:none;opacity:1}.orb{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#438eff,#27b6ba);color:white;font-size:22px}.status{margin-bottom:0}@media(prefers-reduced-motion:reduce){.action,.action *{transition:none!important;translate:none!important}}",
        "script": "const root=document.querySelector(\".choice\"),button=root.querySelector(\"button\");button.addEventListener(\"click\",()=>DSHUI.setState({selected:!DSHUI.snapshot.state.selected}));DSHUI.subscribe(({state})=>{button.setAttribute(\"aria-pressed\",String(state.selected));root.querySelectorAll(\"b\").forEach(b=>b.textContent=state.selected?\"取消选择\":\"选择此方案\");root.querySelector(\".status\").textContent=state.selected?\"已选择此方案\":\"尚未选择\"});button.addEventListener(\"pointermove\",e=>{if(matchMedia(\"(prefers-reduced-motion: reduce)\").matches)return;const r=button.getBoundingClientRect();button.style.setProperty(\"--x\",((e.clientX-r.left-r.width/2)*.035)+\"px\");button.style.setProperty(\"--y\",((e.clientY-r.top-r.height/2)*.07)+\"px\")});button.addEventListener(\"pointerleave\",()=>{button.style.setProperty(\"--x\",\"0px\");button.style.setProperty(\"--y\",\"0px\")});"
      }
    }
  }
];
export const VISUAL_STYLES=Object.freeze(PALETTES.map(({canvasExample,...s})=>Object.freeze({...s,description:STYLE_SYSTEM[s.id].description,prompt:grammarPrompt(s.id),examples:[grammarExample(s.id),canvasExample]})));
export const VISUAL_STYLE_IDS=Object.freeze(VISUAL_STYLES.map(s=>s.id));
export function visualStyle(id=DEFAULT_VISUAL_STYLE){
 const style=VISUAL_STYLES.find(s=>s.id===id);
 if(!style)throw Error('DSH UI: unknown visualStyle; use '+VISUAL_STYLE_IDS.join('/'));
 return style;
}
export function stylePrompt(id){const s=visualStyle(id);return '## 用户选择的视觉风格：'+s.name+' ('+s.id+')\n采用'+s.name+'风格。\n'+s.prompt+'\n原生组件自动遵循此风格，通常省略size/weight/color和presentation.accent；明确要求或语义强调才覆盖。HTML/SVG与原生内容保持一致层级。通用指导不覆盖这里的配色、材质、圆角或阴影；按任务组织内容，不为展示风格增加画布或工具调用。'}
export function styleExamples(id){return visualStyle(id).examples.map(example=>JSON.stringify(example)).join('\n')}
