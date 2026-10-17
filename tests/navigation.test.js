import test from 'node:test';
import assert from 'node:assert/strict';
import { adjacentChapter } from '../assets/navigation.js';
import * as navigation from '../assets/navigation.js';
import { registerChapter } from '../assets/bible-data.js';
import { createVerseStore } from '../assets/store.js';
const at=(book,chapter)=>({translation:'GAE',book,chapter,verse:null});
test('previous book boundary lands on its last chapter even when it is longer than the current book',()=>{
 assert.deepEqual(adjacentChapter(at('exo',1),-1),at('gen',50));
});
test('next book and the two ends of the Bible do not skip or invent chapters',()=>{
 assert.deepEqual(adjacentChapter(at('mal',4),1),at('mat',1));
 assert.equal(adjacentChapter(at('gen',1),-1),null);
 assert.equal(adjacentChapter(at('rev',22),1),null);
});

test('book navigation always starts the adjacent book at its first chapter',()=>{
 assert.equal(typeof navigation.adjacentBook,'function');
 assert.deepEqual(navigation.adjacentBook(at('exo',20),-1),at('gen',1));
 assert.deepEqual(navigation.adjacentBook(at('mal',4),1),at('mat',1));
 assert.deepEqual(navigation.adjacentBook(at('mat',10),-1),at('mal',1));
 assert.equal(navigation.adjacentBook(at('gen',50),-1),null);
 assert.equal(navigation.adjacentBook(at('rev',1),1),null);
});

test('book navigation rejects malformed locations and directions instead of skipping books',()=>{
 assert.equal(typeof navigation.adjacentBook,'function');
 for(const direction of [0,2,-2,'1',null,undefined]) {
  assert.throws(()=>navigation.adjacentBook(at('gen',1),direction),TypeError);
 }
 for(const location of [at('unknown',1),at('gen',0),at('gen',51),null]) {
  assert.throws(()=>navigation.adjacentBook(location,1),TypeError);
 }
});

test('verse DOM identifiers distinguish books and chapters while requiring a valid verse',()=>{
 assert.equal(typeof navigation.verseElementId,'function');
 assert.equal(navigation.verseElementId({...at('gen',1),verse:1}),'verse-gen-1-1');
 assert.equal(navigation.verseElementId({...at('gen',2),verse:1}),'verse-gen-2-1');
 assert.equal(navigation.verseElementId({...at('exo',1),verse:1}),'verse-exo-1-1');
 assert.equal(navigation.verseElementId({book:'1th',chapter:5,verse:18}),'verse-1th-5-18');
 for(const location of [at('gen',1),{...at('gen',1),verse:0},{...at('gen',1),verse:'1'},at('unknown',1)]) {
  assert.throws(()=>navigation.verseElementId(location),TypeError);
 }
});

test('clicking a merged row keeps the currently selected interior verse before another saved address',()=>{
 assert.equal(typeof navigation.verseForRange,'function');
 const selected={...at('gen',1),verse:2};
 const saved=[{...at('gen',1),verse:1}];
 assert.equal(navigation.verseForRange(selected,{chapter:1,verse:1,endVerse:3},saved),2);
});

test('a merged row reuses a saved address only from the same translation book chapter and range',()=>{
 assert.equal(typeof navigation.verseForRange,'function');
 const selected={...at('gen',2),verse:2};
 const saved=[
  {...at('exo',1),verse:2},
  {...at('gen',2),verse:2},
  {...at('gen',1),translation:'OTHER',verse:2},
  {...at('gen',1),verse:4},
  {...at('gen',1),verse:3},
 ];
 assert.equal(navigation.verseForRange(selected,{chapter:1,verse:1,endVerse:3},saved),3);
 assert.equal(navigation.verseForRange(at('gen',1),{chapter:1,verse:1,endVerse:3},[]),1);
 assert.equal(navigation.verseForRange(at('gen',1),{chapter:1,verse:4},saved),4);
});

test('reselecting a merged saved row cannot create a second record or change its reflection',()=>{
 assert.equal(typeof navigation.verseForRange,'function');
 registerChapter('gen',21,[{verse:1,endVerse:2,text:'합절 fixture'}]);
 const values=new Map();
 const store=createVerseStore({getItem:name=>values.get(name)??null,setItem:(name,value)=>values.set(name,value)});
 const original={...at('gen',21),verse:2};
 store.save(original);
 store.saveReflection(original,'유지할 개인 묵상');
 const before=store.list();
 const selected=navigation.verseForRange(at('gen',21),{chapter:21,verse:1,endVerse:2},before);
 assert.equal(selected,2);
 store.save({...original,verse:selected});
 assert.deepEqual(store.list(),before);
 assert.equal(store.list()[0].reflection,'유지할 개인 묵상');
});
