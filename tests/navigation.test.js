import test from 'node:test';
import assert from 'node:assert/strict';
import { adjacentChapter } from '../assets/navigation.js';
const at=(book,chapter)=>({translation:'GAE',book,chapter,verse:null});
test('previous book boundary lands on its last chapter even when it is longer than the current book',()=>{
 assert.deepEqual(adjacentChapter(at('exo',1),-1),at('gen',50));
});
test('next book and the two ends of the Bible do not skip or invent chapters',()=>{
 assert.deepEqual(adjacentChapter(at('mal',4),1),at('mat',1));
 assert.equal(adjacentChapter(at('gen',1),-1),null);
 assert.equal(adjacentChapter(at('rev',22),1),null);
});
