import test from 'node:test';
import assert from 'node:assert/strict';
import {voiceTimings} from '../lib/voice.js';
import {audioTrackSpec} from '../lib/video.js';
import {PROMO_GUIDE} from '../lib/motion-craft.js';
import {canvasDocument} from '../lib/freeform.js';
import {toolJson,optionalToolJson} from '../lib/tool-json.js';
test('empty optional JSON is omission; required or malformed JSON stays strict',()=>{
 const doc=canvasDocument({title:'静态短片',fallback:'说明',html:'<div id="stage">内容</div>',state:'',data:' ',derived:''});
 assert.deepEqual(doc.state,{});assert.deepEqual(doc.data,{});assert.deepEqual(doc.derived,{});
 assert.equal(optionalToolJson('', 'theme',undefined),undefined);
 assert.throws(()=>toolJson('','document'),/valid JSON/);assert.throws(()=>optionalToolJson('{','state',{}),/valid JSON/);
 assert.throws(()=>canvasDocument({title:'a',fallback:'a',html:'a',state:'[]'}),/must be an object/);
});
test('voice timing is provider measured and retains silent caption gaps',()=>{
 const result=voiceTimings([{time_begin:100,time_end:900,text:'第一句',timestamped_words:[{time_begin:100,time_end:300,word:'第'}]},{time_begin:2000,time_end:2900,text:'第二句'}],3);
 assert.equal(result.captions[0].end,.9);assert.equal(result.captions[1].start,2);assert.equal(result.words[0].end,.3);
 assert.throws(()=>voiceTimings([{time_begin:0,time_end:4000,text:'超长'}],3),/invalid provider/);
 assert.throws(()=>voiceTimings([{time_begin:0,time_end:1000,text:'a'},{time_begin:900,time_end:2000,text:'b'}],3),/invalid provider/);
 assert.throws(()=>voiceTimings([{time_begin:0,time_end:1000,text:'a',timestamped_words:[{time_begin:-2,time_end:100,word:'a'}]}],3),/invalid word/);
});
test('paragraph subtitles become readable cues using complete actual word times',()=>{
 const raw=[{time_begin:0,time_end:5000,text:'你好，欢迎。',timestamped_words:[{word:'你',time_begin:0,time_end:400},{word:'好',time_begin:400,time_end:800},{word:'，',time_begin:800,time_end:900},{word:'欢',time_begin:2000,time_end:2400},{word:'迎',time_begin:2400,time_end:2800},{word:'。',time_begin:2800,time_end:2900}]}];
 const r=voiceTimings(raw,5);assert.deepEqual(r.captions,[{start:0,end:.9,text:'你好，'},{start:2,end:2.9,text:'欢迎。'}]);assert.equal(r.providerCaptions[0].end,5);
});
test('audio mix validates finite gains, offsets and bounded input count',()=>{
 assert.deepEqual(audioTrackSpec([{path:'/voice.mp3',role:'voice'}],5)[0],{path:'/voice.mp3',role:'voice',volume:1,offset:0,fadeIn:0,fadeOut:0,loop:false});
 assert.throws(()=>audioTrackSpec([{path:'/a',volume:NaN}],5),/volume/);
 assert.throws(()=>audioTrackSpec([{path:'/a',offset:6}],5),/offset/);
 assert.throws(()=>audioTrackSpec([{path:'/a',loop:'true'}],5),/invalid audio/);
 assert.throws(()=>audioTrackSpec(Array(5).fill({path:'/a'}),5),/1..4/);
 assert.match(PROMO_GUIDE,/measured/);assert.match(PROMO_GUIDE,/Vary compositions/);
});
test('numeric syllables sharing one source word range do not duplicate displayed version',()=>{
 const r=voiceTimings([{time_begin:0,time_end:2000,text:'0.8.0 发布。',timestamped_words:[{word:'0.8.0',word_begin:0,word_end:5,time_begin:0,time_end:500},{word:'0.8.0',word_begin:0,word_end:5,time_begin:500,time_end:1000},{word:'发布。',word_begin:6,word_end:9,time_begin:1000,time_end:2000}]}],2);
 assert.equal(r.words.length,2);assert.equal(r.words[0].end,1);assert.equal(r.captions[0].text,'0.8.0 发布。');
});
test('English phonetic fragments preserve original spaces without splitting names',()=>{
 const words=['M','ot','ion','U','I','能','动','。'].map((word,i)=>({word,time_begin:i*100,time_end:(i+1)*100}));
 const r=voiceTimings([{time_begin:0,time_end:800,text:'Motion UI 能动。',timestamped_words:words}],1);
 assert.equal(r.captions[0].text,'Motion UI 能动。');assert.equal(r.words[1].text,'ot');
});
