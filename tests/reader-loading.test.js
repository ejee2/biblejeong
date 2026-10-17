import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { DEFAULT_LOCATION, getVerse, parseReadingLocation, readingUrl, registerChapter } from '../assets/bible-data.js';

const appSource = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');

function appFunction(name, nextName) {
  const start = appSource.indexOf(`function ${name}(`);
  const end = appSource.indexOf(`function ${nextName}(`, start);
  assert.ok(start >= 0 && end > start, `Cannot find app function ${name}`);
  return appSource.slice(start, end);
}

test('a deep link past the loaded chapter end renders an address error and closes its context', () => {
  const location = parseReadingLocation('?book=gen&chapter=1&verse=176');
  assert.equal(getVerse(location), null);
  const frames = [], main = { innerHTML:'' };
  const header = { inert:true }, skipLink = { inert:true };
  const classes = new Set(['context-open']);
  const context = createContext({
    location, getVerse, DEFAULT_LOCATION, readingUrl, rootUrl:{pathname:'/biblejeong/'}, main,
    isMyPage:false, addressError:null, dataRenderQueued:false, awaitingDeepLink:true, mobileOpen:true,
    requestAnimationFrame:callback=>frames.push(callback),
    window:{matchMedia:()=>({matches:true})},
    document:{
      body:{classList:{toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); }}},
      querySelector(selector) {
        if (selector === '.app-header') return header;
        if (selector === '.skip-link') return skipLink;
        throw new Error(`Unexpected DOM access: ${selector}`);
      },
    },
  });
  runInContext([
    appSource.match(/^const escapeHtml = .*$/m)[0],
    appSource.match(/^const linkTo = .*$/m)[0],
    appFunction('handleBibleChange', 'observeChapters'),
    appFunction('renderReader', 'editorMarkup'),
  ].join('\n'), context);
  runInContext('handleBibleChange("gen")', context);
  assert.equal(frames.length, 1);

  registerChapter('gen', 1, Array.from({length:31}, (_, index)=>({
    verse:index + 1, endVerse:index + 1, text:`테스트 본문 ${index + 1}`,
  })));
  assert.doesNotThrow(()=>frames.shift()());
  assert.match(main.innerHTML, /class="address-error"/);
  assert.match(main.innerHTML, /이 본문 주소를 찾을 수 없습니다\./);
  assert.equal(context.addressError.name, 'TypeError');
  assert.equal(context.awaitingDeepLink, false);
  assert.equal(context.mobileOpen, false);
  assert.equal(context.dataRenderQueued, false);
  assert.equal(classes.has('context-open'), false);
  assert.equal(header.inert, false);
  assert.equal(skipLink.inert, false);
});
