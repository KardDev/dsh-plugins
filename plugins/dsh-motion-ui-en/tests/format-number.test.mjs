import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {formatNumber} from '../lib/format-number.js';
import {fallbackText,validateDocument} from '../lib/protocol.js';
import {ValidatedView} from '../src/view.js';
test('decimal ties and grouping agree across native metric and text fallback',()=>{
 for(const [value,decimals,expected] of [[4.225,2,'4.23'],[-2.675,2,'-2.68'],[1000.5,2,'1,000.50'],[0,0,'0'],[.1234567,6,'0.123457']]){
  assert.equal(formatNumber(value,decimals),expected);
  const document=validateDocument({version:1,title:'舍入一致性',fallback:'数值',nodes:[{id:'value',type:'metric',label:'读数',value,decimals,unit:'W'}]});
  assert.ok(fallbackText(document).includes('读数: '+expected+' W'));
  const html=renderToStaticMarkup(React.createElement(ValidatedView,{raw:{version:1,callId:'rounding',documentId:'00000000-0000-4000-8000-000000000000',sessionId:'s',document},sessionId:'s'}));
  assert.ok(html.includes(expected));
 }
 for(const value of [NaN,Infinity,'4.225',null])assert.throws(()=>formatNumber(value),/finite number/);
 for(const decimals of [-1,7,1.5])assert.throws(()=>formatNumber(1,decimals),/0 to 6/);
});
