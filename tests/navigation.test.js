import test from 'node:test';
import assert from 'node:assert/strict';
import { adjacentChapter } from '../assets/navigation.js';
import * as navigation from '../assets/navigation.js';
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
