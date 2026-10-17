import test from 'node:test';
import assert from 'node:assert/strict';
import * as data from '../assets/bible-data.js';

const apiModule = () => import('../assets/bible-api.js');
const verses = text => [{verse:1,endVerse:1,text}];
const response = (book,chapter,text='테스트 본문') => new Response(JSON.stringify({book,chapter,verses:verses(text),source:'logos'}),{headers:{'Content-Type':'application/json'}});
const tick = () => new Promise(resolve=>setImmediate(resolve));
const fakeTime = () => {
  let clock=1000;
  return {now:()=>clock,sleepImpl:async delay=>{clock+=delay;}};
};

test('registered full chapters copy input and resolve merged verse addresses without duplicating text',()=>{
  assert.equal(typeof data.registerChapter,'function');
  const input=[{verse:1,endVerse:1,text:'첫 번째 테스트 절'},{verse:2,endVerse:3,text:'둘째와 셋째를 합친 테스트 절'}];
  data.registerChapter('gen',1,input);
  input[0].text='오염';input.pop();
  const chapter=data.getChapter('gen',1);
  assert.equal(chapter.available,true);
  assert.equal(chapter.partial,false);
  assert.equal(chapter.source,'logos');
  assert.equal(chapter.totalVerses,3);
  assert.equal(chapter.verses.length,2);
  assert.equal(chapter.verses[0].text,'첫 번째 테스트 절');
  chapter.verses[0].text='다시 오염';
  assert.equal(data.getChapter('gen',1).verses[0].text,'첫 번째 테스트 절');
  assert.deepEqual(data.getVerse({book:'gen',chapter:1,verse:3}),{translation:'GAE',book:'gen',chapter:1,verse:3,verseStart:2,endVerse:3,text:'둘째와 셋째를 합친 테스트 절'});
  assert.equal(data.getContext({book:'gen',chapter:1,verse:1}),null);
  assert.throws(()=>data.normalizeLocation({book:'gen',chapter:1,verse:4}),TypeError);
});

test('invalid full chapters never replace the excerpt or partially register a chapter',()=>{
  assert.equal(typeof data.registerChapter,'function');
  const badInputs=[[],null,[{verse:2,endVerse:2,text:'잘못된 시작'}],[{verse:1,endVerse:2,text:'겹침'},{verse:2,endVerse:3,text:'겹침'}],[{verse:1,endVerse:1,text:'빈틈'},{verse:3,endVerse:3,text:'빈틈'}],[{verse:1,endVerse:177,text:'범위 초과'}],[{verse:1,endVerse:1,text:''}],[{verse:'1',endVerse:1,text:'숫자 아님'}],[{verse:1,endVerse:0,text:'역전'}]];
  for(const input of badInputs)assert.throws(()=>data.registerChapter('1th',5,input),TypeError);
  assert.equal(data.getChapter('1th',5).partial,true);
  assert.equal(data.getVerse({book:'1th',chapter:5,verse:18}).text.startsWith('범사에 감사하라'),true);
  assert.throws(()=>data.registerChapter('unknown',1,verses('테스트')),TypeError);
  assert.throws(()=>data.registerChapter('gen',0,verses('테스트')),TypeError);
});

test('loader requires a public relay URL and reports readable configuration errors',async()=>{
  const {createBibleLoader}=await apiModule();
  for(const baseUrl of ['',undefined,'not a URL','https://secret@example.com','https://relay.example/?key=secret']){
    assert.throws(()=>createBibleLoader({baseUrl}),error=>error instanceof TypeError&&/[가-힣]/.test(error.message));
  }
});

test('loads are serialized at least 1100ms apart, deduplicated, and reused after success',async()=>{
  const {createBibleLoader}=await apiModule();
  const time=fakeTime(),starts=[],changed=[];
  let release;
  const firstResponse=new Promise(resolve=>{release=resolve;});
  const loader=createBibleLoader({baseUrl:'https://relay.example/',...time,onChange:(...args)=>changed.push(args),fetchImpl:async(url,options)=>{
    starts.push({url,time:time.now(),options});
    if(starts.length===1)return firstResponse;
    return response('gen',4);
  }});
  assert.deepEqual(loader.status('gen',3),{state:'idle'});
  const first=loader.load('gen',3);
  assert.strictEqual(loader.load('gen',3),first);
  const second=loader.load('gen',4);
  await tick();
  assert.equal(starts.length,1);
  assert.equal(loader.status('gen',3).state,'loading');
  assert.equal(loader.status('gen',4).state,'loading');
  release(response('gen',3));
  await Promise.all([first,second]);
  assert.equal(starts[1].time-starts[0].time>=1100,true);
  assert.equal(starts[0].url,'https://relay.example/v1/books/gen/chapters/3');
  assert.equal(starts[0].options.credentials,'omit');
  assert.equal(starts[0].options.headers.Authorization,undefined);
  assert.equal(loader.status('gen',3).state,'loaded');
  await loader.load('gen',3);
  assert.equal(starts.length,2);
  const state=loader.status('gen',3);state.state='error';
  assert.equal(loader.status('gen',3).state,'loaded');
  assert.ok(changed.some(([book,chapter])=>book==='gen'&&chapter===3));
});

test('identity and range validation fail before registration and allow an explicit retry',async()=>{
  const {createBibleLoader}=await apiModule();
  let calls=0;
  const loader=createBibleLoader({baseUrl:'https://relay.example',...fakeTime(),fetchImpl:async()=>++calls===1?response('exo',5):response('gen',5)});
  await assert.rejects(loader.load('gen',5),/[가-힣]/);
  assert.equal(loader.status('gen',5).state,'error');
  assert.equal(data.getChapter('gen',5).available,false);
  await loader.load('gen',5);
  assert.equal(loader.status('gen',5).state,'loaded');
  assert.equal(calls,2);
  const malformed=createBibleLoader({baseUrl:'https://relay.example',...fakeTime(),fetchImpl:async()=>new Response(JSON.stringify({book:'gen',chapter:6,source:'logos',verses:[{verse:1,endVerse:2,text:'첫 범위'},{verse:2,endVerse:3,text:'중복'}]}))});
  await assert.rejects(malformed.load('gen',6),/[가-힣]/);
  assert.equal(data.getChapter('gen',6).available,false);
});

test('429 is a bounded manual retry state and never loops automatically',async()=>{
  const {createBibleLoader}=await apiModule();
  let calls=0;
  const loader=createBibleLoader({baseUrl:'https://relay.example',...fakeTime(),fetchImpl:async()=>{calls++;return new Response('',{status:429,headers:{'Retry-After':'9999'}});}});
  await assert.rejects(loader.load('gen',7),/[가-힣]/);
  assert.deepEqual(loader.status('gen',7),{state:'error',message:'요청이 잠시 많습니다. 잠시 후 다시 시도해 주세요.',retryAfter:60});
  await tick();assert.equal(calls,1);
});

test('cancelPending removes queued work while preserving an already active response',async()=>{
  const {createBibleLoader}=await apiModule();
  let release,calls=0;
  const loader=createBibleLoader({baseUrl:'https://relay.example',...fakeTime(),fetchImpl:async()=>{calls++;return new Promise(resolve=>{release=resolve;});}});
  const active=loader.load('gen',8);
  const canceled=loader.load('gen',9);
  const rejection=assert.rejects(canceled,error=>error.name==='AbortError');
  await tick();loader.cancelPending();
  await rejection;
  assert.deepEqual(loader.status('gen',9),{state:'idle'});
  release(response('gen',8));await active;
  assert.equal(loader.status('gen',8).state,'loaded');
  assert.equal(calls,1);
});

test('a timed out network request becomes a retryable error instead of blocking the queue',async()=>{
  const {createBibleLoader}=await apiModule();
  const loader=createBibleLoader({baseUrl:'https://relay.example',...fakeTime(),timeoutMs:15,fetchImpl:async()=>new Promise(()=>{})});
  await assert.rejects(loader.load('gen',10),/시간/);
  assert.equal(loader.status('gen',10).state,'error');
  assert.equal(data.getChapter('gen',10).available,false);
});
