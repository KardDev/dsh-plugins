// Regression fixture: complete native calculator with inline reactive chart cells.
export const travelBudget={
  "version": 1,
  "title": "旅行预算计算器",
  "fallback": "默认 2 人 5 天：餐饮 100 元/人/天共 1000 元，住宿 1 间 4 晚共 1600 元，往返交通 800 元/人共 1600 元，小计 4200 元，备用金 10% 即 420 元，总预算 4620 元，人均 2310 元。全部参数均可在界面中调整。",
  "presentation": {
    "accent": "violet",
    "density": "comfortable",
    "layout": "workbench"
  },
  "state": {
    "days": {
      "default": 5,
      "max": 15,
      "min": 1,
      "step": 1,
      "type": "number"
    },
    "meal": {
      "default": 100,
      "max": 600,
      "min": 0,
      "step": 10,
      "type": "number"
    },
    "people": {
      "default": 2,
      "max": 12,
      "min": 1,
      "step": 1,
      "type": "number"
    },
    "reserve": {
      "default": 10,
      "max": 30,
      "min": 0,
      "step": 1,
      "type": "number"
    },
    "room": {
      "default": 400,
      "max": 2000,
      "min": 0,
      "step": 20,
      "type": "number"
    },
    "transit": {
      "default": 800,
      "max": 4000,
      "min": 0,
      "step": 50,
      "type": "number"
    }
  },
  "derived": {
    "hotelTotal": {
      "expr": "derived.rooms * derived.nights * state.room"
    },
    "mealTotal": {
      "expr": "state.people * state.days * state.meal"
    },
    "nights": {
      "expr": "state.days - 1"
    },
    "perPerson": {
      "expr": "derived.total / state.people"
    },
    "reserveAmt": {
      "expr": "derived.subtotal * state.reserve / 100"
    },
    "rooms": {
      "expr": "ceil(state.people / 2)"
    },
    "subtotal": {
      "expr": "derived.mealTotal + derived.hotelTotal + derived.transitTotal"
    },
    "total": {
      "expr": "derived.subtotal + derived.reserveAmt"
    },
    "transitTotal": {
      "expr": "state.people * state.transit"
    }
  },
  "nodes": [
    {
      "id": "title",
      "text": "旅行预算计算器",
      "type": "heading"
    },
    {
      "color": "muted",
      "id": "sub",
      "text": "拖动参数，费用构成、总预算与人均预算立即更新。",
      "type": "text"
    },
    {
      "children": [
        {
          "children": [
            {
              "bind": "state.people",
              "id": "s_people",
              "label": "出行人数（人）",
              "type": "slider"
            },
            {
              "bind": "state.days",
              "id": "s_days",
              "label": "旅行天数（天）",
              "type": "slider"
            },
            {
              "bind": "state.meal",
              "id": "s_meal",
              "label": "餐饮（元 / 人 / 天）",
              "type": "slider"
            }
          ],
          "gap": 14,
          "id": "colA",
          "type": "column"
        },
        {
          "children": [
            {
              "bind": "state.room",
              "id": "s_room",
              "label": "住宿（元 / 间 / 晚）",
              "type": "slider"
            },
            {
              "bind": "state.transit",
              "id": "s_transit",
              "label": "往返交通（元 / 人）",
              "type": "slider"
            },
            {
              "bind": "state.reserve",
              "id": "s_reserve",
              "label": "备用金比例（%）",
              "type": "slider"
            }
          ],
          "gap": 14,
          "id": "colB",
          "type": "column"
        }
      ],
      "columns": 2,
      "gap": 24,
      "id": "knobs",
      "type": "row"
    },
    {
      "children": [
        {
          "decimals": 0,
          "id": "m_total",
          "label": "总预算",
          "tone": "accent",
          "type": "metric",
          "unit": "元",
          "value": {
            "ref": "derived.total"
          }
        },
        {
          "decimals": 0,
          "id": "m_pp",
          "label": "人均预算",
          "type": "metric",
          "unit": "元",
          "value": {
            "ref": "derived.perPerson"
          }
        }
      ],
      "columns": 2,
      "gap": 16,
      "id": "headline",
      "type": "row"
    },
    {
      "children": [
        {
          "decimals": 0,
          "id": "m_reserve",
          "label": "备用金",
          "type": "metric",
          "unit": "元",
          "value": {
            "ref": "derived.reserveAmt"
          }
        },
        {
          "decimals": 0,
          "id": "m_rooms",
          "label": "房间数",
          "type": "metric",
          "unit": "间",
          "value": {
            "ref": "derived.rooms"
          }
        },
        {
          "decimals": 0,
          "id": "m_nights",
          "label": "住宿晚数",
          "type": "metric",
          "unit": "晚",
          "value": {
            "ref": "derived.nights"
          }
        }
      ],
      "columns": 3,
      "gap": 16,
      "id": "subline",
      "type": "row"
    },
    {
      "id": "chart",
      "kind": "bar",
      "labelKey": "label",
      "label": "费用构成（元）",
      "rows": [
        {
          "label": "餐饮",
          "value": {
            "ref": "derived.mealTotal"
          }
        },
        {
          "label": "住宿",
          "value": {
            "ref": "derived.hotelTotal"
          }
        },
        {
          "label": "往返交通",
          "value": {
            "ref": "derived.transitTotal"
          }
        },
        {
          "label": "备用金",
          "value": {
            "ref": "derived.reserveAmt"
          }
        }
      ],
      "type": "chart",
      "unit": "元",
      "valueKey": "value"
    },
    {
      "color": "muted",
      "id": "note",
      "text": "每间房最多住 2 人，房间数向上取整；住宿晚数 = 天数 − 1；备用金按「餐饮 + 住宿 + 往返交通」之和的所设比例预留。金额按你填写的单价估算，非实际报价。",
      "type": "text"
    }
  ]
};
