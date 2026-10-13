// Regression: expanded repeated formulas and positional table cells from a real model call.
export const expandedBudget={
  "version": 1,
  "title": "旅行预算计算器",
  "fallback": "默认 2 人 5 天：餐饮 1000 元、住宿 1600 元（1 间 × 4 晚 × 400 元）、往返交通 1600 元，小计 4200 元，备用金 10% 共 420 元，总预算 4620 元，人均 2310 元。房间数按每间最多 2 人向上取整，住宿晚数 = 天数 − 1。",
  "presentation": {
    "layout": "workbench",
    "accent": "blue",
    "density": "comfortable"
  },
  "state": {
    "people": {
      "type": "number",
      "default": 2,
      "min": 1,
      "max": 20,
      "step": 1
    },
    "days": {
      "type": "number",
      "default": 5,
      "min": 1,
      "max": 30,
      "step": 1
    },
    "mealPerDay": {
      "type": "number",
      "default": 100,
      "min": 0,
      "max": 2000,
      "step": 10
    },
    "roomPerNight": {
      "type": "number",
      "default": 400,
      "min": 0,
      "max": 5000,
      "step": 20
    },
    "transportPerPerson": {
      "type": "number",
      "default": 800,
      "min": 0,
      "max": 20000,
      "step": 50
    },
    "reservePercent": {
      "type": "number",
      "default": 10,
      "min": 0,
      "max": 50,
      "step": 1
    }
  },
  "derived": {
    "rooms": {
      "expr": "ceil(state.people / 2)"
    },
    "nights": {
      "expr": "max(0, state.days - 1)"
    },
    "mealCost": {
      "expr": "state.people * state.days * state.mealPerDay"
    },
    "lodgingCost": {
      "expr": "ceil(state.people / 2) * max(0, state.days - 1) * state.roomPerNight"
    },
    "transportCost": {
      "expr": "state.people * state.transportPerPerson"
    },
    "subtotal": {
      "expr": "state.people * state.days * state.mealPerDay + ceil(state.people / 2) * max(0, state.days - 1) * state.roomPerNight + state.people * state.transportPerPerson"
    },
    "reserveCost": {
      "expr": "(state.people * state.days * state.mealPerDay + ceil(state.people / 2) * max(0, state.days - 1) * state.roomPerNight + state.people * state.transportPerPerson) * state.reservePercent / 100"
    },
    "totalCost": {
      "expr": "(state.people * state.days * state.mealPerDay + ceil(state.people / 2) * max(0, state.days - 1) * state.roomPerNight + state.people * state.transportPerPerson) * (100 + state.reservePercent) / 100"
    },
    "perPerson": {
      "expr": "(state.people * state.days * state.mealPerDay + ceil(state.people / 2) * max(0, state.days - 1) * state.roomPerNight + state.people * state.transportPerPerson) * (100 + state.reservePercent) / 100 / state.people"
    }
  },
  "nodes": [
    {
      "id": "title",
      "type": "heading",
      "text": "旅行预算计算器",
      "size": 24,
      "color": "accent"
    },
    {
      "id": "rule",
      "type": "text",
      "text": "每间房最多住 2 人，房间数向上取整；住宿晚数 = 天数 − 1；备用金按各项小计的比例预留。改动滑块后下方结果立即重算。",
      "size": 14,
      "color": "muted"
    },
    {
      "id": "ctrlRow",
      "type": "row",
      "columns": 2,
      "gap": 20,
      "children": [
        {
          "id": "ctrlPeople",
          "type": "column",
          "gap": 12,
          "children": [
            {
              "id": "people",
              "type": "slider",
              "label": "出行人数（人）",
              "bind": "state.people"
            },
            {
              "id": "days",
              "type": "slider",
              "label": "旅行天数（天）",
              "bind": "state.days"
            },
            {
              "id": "meal",
              "type": "slider",
              "label": "餐饮（元 / 人 / 天）",
              "bind": "state.mealPerDay"
            }
          ]
        },
        {
          "id": "ctrlCost",
          "type": "column",
          "gap": 12,
          "children": [
            {
              "id": "room",
              "type": "slider",
              "label": "住宿（元 / 间 / 晚）",
              "bind": "state.roomPerNight"
            },
            {
              "id": "transport",
              "type": "slider",
              "label": "往返交通（元 / 人）",
              "bind": "state.transportPerPerson"
            },
            {
              "id": "reserve",
              "type": "slider",
              "label": "备用金比例（%）",
              "bind": "state.reservePercent"
            }
          ]
        }
      ]
    },
    {
      "id": "keyMetrics",
      "type": "row",
      "columns": 3,
      "gap": 16,
      "children": [
        {
          "id": "mTotal",
          "type": "metric",
          "label": "总预算",
          "value": {
            "ref": "derived.totalCost"
          },
          "unit": "元",
          "decimals": 0,
          "tone": "accent"
        },
        {
          "id": "mPer",
          "type": "metric",
          "label": "人均预算",
          "value": {
            "ref": "derived.perPerson"
          },
          "unit": "元",
          "decimals": 2
        },
        {
          "id": "mReserve",
          "type": "metric",
          "label": "备用金",
          "value": {
            "ref": "derived.reserveCost"
          },
          "unit": "元",
          "decimals": 0
        }
      ]
    },
    {
      "id": "stayRow",
      "type": "row",
      "columns": 3,
      "gap": 16,
      "children": [
        {
          "id": "mRooms",
          "type": "metric",
          "label": "房间数",
          "value": {
            "ref": "derived.rooms"
          },
          "unit": "间",
          "decimals": 0
        },
        {
          "id": "mNights",
          "type": "metric",
          "label": "住宿晚数",
          "value": {
            "ref": "derived.nights"
          },
          "unit": "晚",
          "decimals": 0
        },
        {
          "id": "mSub",
          "type": "metric",
          "label": "小计（不含备用金）",
          "value": {
            "ref": "derived.subtotal"
          },
          "unit": "元",
          "decimals": 0
        }
      ]
    },
    {
      "id": "chart",
      "type": "chart",
      "kind": "bar",
      "label": "费用构成（元）",
      "labelKey": "label",
      "valueKey": "value",
      "rows": [
        {
          "label": "餐饮",
          "value": {
            "ref": "derived.mealCost"
          }
        },
        {
          "label": "住宿",
          "value": {
            "ref": "derived.lodgingCost"
          }
        },
        {
          "label": "往返交通",
          "value": {
            "ref": "derived.transportCost"
          }
        },
        {
          "label": "备用金",
          "value": {
            "ref": "derived.reserveCost"
          }
        }
      ]
    },
    {
      "id": "table",
      "type": "table",
      "label": "费用明细",
      "columns": [
        {
          "key": "item",
          "label": "项目"
        },
        {
          "key": "rule",
          "label": "计算方式"
        },
        {
          "key": "amount",
          "label": "金额（元）"
        }
      ],
      "rows": [
        [
          "餐饮",
          "人数 × 天数 × 每人每天餐饮",
          {
            "ref": "derived.mealCost"
          }
        ],
        [
          "住宿",
          "房间数 × (天数 − 1) × 每间每晚",
          {
            "ref": "derived.lodgingCost"
          }
        ],
        [
          "往返交通",
          "人数 × 每人往返票价",
          {
            "ref": "derived.transportCost"
          }
        ],
        [
          "小计",
          "以上三项之和",
          {
            "ref": "derived.subtotal"
          }
        ],
        [
          "备用金",
          "小计 × 备用金比例",
          {
            "ref": "derived.reserveCost"
          }
        ],
        [
          "总预算",
          "小计 + 备用金",
          {
            "ref": "derived.totalCost"
          }
        ]
      ]
    },
    {
      "id": "note",
      "type": "text",
      "text": "说明：住宿晚数按「天数 − 1」计（如 5 天算 4 晚，当天返程不再过夜）；人数为奇数时会产生一间只住 1 人的房间，房间数与人均预算会同步变化。备用金按小计比例计算，属于估算，实际以行程为准。",
      "size": 14,
      "color": "muted"
    }
  ]
};
