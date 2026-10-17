import { BOOKS, DEFAULT_LOCATION, getBook, getChapter, getVerse, getContext, officialBibleUrl, parseReadingLocation, readingUrl, compareLocations } from './bible-data.js';
import { createVerseStore, STORAGE_KEY } from './store.js';
import { adjacentChapter } from './navigation.js';

const main = document.querySelector('#main');
const isMyPage = document.body.dataset.page === 'mypage';
const rootUrl = new URL('../', import.meta.url);
const myPageUrl = new URL('mypage/', rootUrl);
const returnKey = 'biblejeong:reading-position:v1';
const settingsKey = 'biblejeong:settings:v1';
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key = row => `${row.translation}:${row.book}:${row.chapter}:${row.verse}`;
const label = row => `${getBook(row.book).name} ${row.chapter}:${row.verse}`;
const linkTo = row => readingUrl(row, rootUrl.pathname);
let location = { ...DEFAULT_LOCATION };
let addressError = null;
let store;
let saved = [];
let storageError = null;
let activeVerse = null;
let mobileOpen = false;
let editor = null;
let sort = 'recent';
let filter = 'all';
let toastTimer;
let settings = { size:19, line:1.8, theme:'light' };

try { if (!isMyPage) location = parseReadingLocation(window.location.search); } catch (error) { addressError = error; }
activeVerse = location.verse;
mobileOpen = !isMyPage && new URLSearchParams(window.location.search).has('verse') && !!getVerse(location);
function readSaved() {
  try { store = createVerseStore(window.localStorage); saved = store.list(); storageError = null; return true; }
  catch (error) { storageError = error; return false; }
}
readSaved();
try {
  const value = JSON.parse(window.localStorage.getItem(settingsKey));
  if (value && [19,22,26].includes(value.size) && [1.8,2.1].includes(value.line) && ['light','dark'].includes(value.theme)) settings = value;
} catch { /* Reading still works when settings storage is unavailable. */ }
function applySettings() {
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.style.setProperty('--reading-size', `${settings.size}px`);
  document.documentElement.style.setProperty('--reading-line', settings.line);
}
applySettings();
function lastReading() {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(returnKey));
    if (value?.url) {
      const url = new URL(value.url, window.location.href);
      if (url.origin === window.location.origin && url.pathname === rootUrl.pathname) return {url:url.href,scroll:Math.max(0,Number(value.scroll)||0)};
    }
  } catch { /* A missing temporary return position is harmless. */ }
  return {url:linkTo(DEFAULT_LOCATION),scroll:0};
}
function rememberReading() {
  if (isMyPage || addressError) return;
  const scroll = document.querySelector('.scripture-column')?.scrollTop || window.scrollY;
  try { window.sessionStorage.setItem(returnKey, JSON.stringify({url:linkTo(location),scroll})); } catch { /* Return falls back to the default chapter. */ }
}
function dirty() { return editor && editor.value !== editor.initial; }
function discardDraft() {
  if (dirty() && !window.confirm('저장하지 않은 묵상이 있습니다. 작성한 내용을 버리고 이동할까요?')) return false;
  editor = null; return true;
}
function toast(message, {action, onAction, error=false}={}) {
  const box = document.querySelector('#toast'); clearTimeout(toastTimer);
  box.replaceChildren(); box.classList.toggle('is-error',error); box.hidden=false;
  const text=document.createElement('span'); text.textContent=message; box.append(text);
  if (action) { const button=document.createElement('button'); button.type='button';button.textContent=action;button.addEventListener('click',onAction);box.append(button); }
  else toastTimer = setTimeout(()=>{box.hidden=true;},6000);
}
function hideToast() { document.querySelector('#toast').hidden=true; }
function storageBanner() {
  if (!storageError) return '';
  return `<section class="storage-error" role="alert"><p>${escapeHtml(storageError.message || '표시한 구절을 불러오지 못했습니다.')}</p><button class="text-button" data-action="retry-storage">다시 시도</button></section>`;
}
function footerDisclosure() {
  return `<details class="content-footnote"><summary class="meta">본문과 설명에 관하여</summary><p>현재 내장 본문은 개역개정 데살로니가전서 5:16–20의 짧은 발췌입니다. 전체 장은 대한성서공회 공식 본문에서 확인할 수 있습니다.</p><p>본문 도움은 성경에 기록된 내용과 근거 장절을 연결한 설명입니다. 개인의 묵상은 마이페이지에 따로 보관합니다.</p><p>표시한 구절과 묵상은 이 브라우저에만 저장되며 서버로 전송하지 않습니다.</p></details>`;
}
function contextMarkup() {
  const current = {...location,verse:activeVerse};
  const verse = activeVerse ? getVerse(current) : null;
  const context = verse ? getContext(current) : null;
  const row = verse ? saved.find(r=>key(r)===key(current)) : null;
  const bar = `<div class="mobile-context-bar"><button class="text-button" data-action="close-context">← 본문</button><a data-mypage-link href="${myPageUrl.pathname}">마이페이지</a></div>`;
  if (!verse) return `${bar}<div class="context-placeholder"><p class="eyebrow">본문 곁의 도움</p><h2>궁금한 구절을<br>눌러 보세요.</h2><p>선택한 구절의 앞뒤 흐름과 근거를 이곳에서 확인할 수 있습니다.</p><hr><p class="meta">마음에 남는 구절은 밑줄과 배경색으로 표시해 두세요.</p></div>`;
  return `${bar}<div class="context-lead"><p class="eyebrow">선택한 구절</p><h2 id="context-title" class="context-title" tabindex="-1">${escapeHtml(label(current))}</h2><p class="meta">본문에 근거한 설명</p><button class="${row?'primary-button':'outline-button'} save-button" data-action="toggle-save" ${storageError?'disabled':''}>${row?'표시됨 · 표시 해제':'뜻깊은 구절로 표시'}</button><p class="meta">${row?'밑줄과 배경색으로 표시했습니다.':'밑줄과 배경색으로 표시하고 모아 보세요.'}</p></div><hr class="context-divider">${context ? `
    <section class="context-section"><h3>이 구절의 내용</h3><p>${escapeHtml(context.summary)}</p><p class="ref-note">근거 · ${escapeHtml(context.summaryRef)}</p></section>
    <section class="context-section"><h3>바로 앞의 흐름</h3><p>${escapeHtml(context.before)}</p><p class="ref-note">근거 · ${escapeHtml(context.beforeRef)}</p></section>
    <details class="evidence-detail"><summary>근거 장절 확인</summary><div class="evidence-box"><p class="small">대한성서공회 · 개역개정</p>${context.references.map(ref=>`<a class="text-link" href="${escapeHtml(ref.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ref.label)} ↗<span class="visually-hidden"> — 새 탭</span></a>`).join('')}<p class="small">근거 확인은 새 탭에서 열리며 읽던 본문은 유지됩니다.</p></div></details>
    <details class="future-detail"><summary>이후 본문 연결 펼치기</summary><div class="stack"><p>${escapeHtml(context.after)}</p><p class="meta">근거 · ${escapeHtml(context.afterRef)}</p></div></details>` : '<p>이 구절에 등록된 설명이 아직 없습니다.</p><p class="meta">본문 읽기와 구절 표시는 계속할 수 있습니다.</p>'}`;
}
function renderReader() {
  const modal = !addressError && mobileOpen && window.matchMedia('(max-width:1023px)').matches;
  document.body.classList.toggle('context-open',modal);
  document.querySelector('.app-header').inert=modal;
  document.querySelector('.skip-link').inert=modal;
  if (addressError) {
    main.innerHTML=`<section class="address-error"><p class="eyebrow">본문 주소 확인</p><h1>이 본문 주소를 찾을 수 없습니다.</h1><p>${escapeHtml(addressError.message)}</p><a class="outline-button" href="${escapeHtml(linkTo(DEFAULT_LOCATION))}">본문 선택으로 돌아가기</a></section>`; return;
  }
  const chapter=getChapter(location.book,location.chapter),book=getBook(location.book);
  const prev=adjacentChapter(location,-1),next=adjacentChapter(location,1);
  const oldScroll=document.querySelector('.scripture-column')?.scrollTop || 0;
  main.innerHTML=`<div class="reading-layout"><section class="scripture-column" aria-label="성경 본문" ${modal?'inert':''}>${storageBanner()}<p class="eyebrow">개역개정 · ${book.testament==='OT'?'구약':'신약'}</p><div class="chapter-heading"><h1>${escapeHtml(book.name)} ${location.chapter}장</h1><button class="text-button chapter-trigger" data-action="chapter" aria-label="성경과 장 선택">⌄</button></div>
    <p class="small chapter-note">${chapter.partial?'16–20절 · 짧은 발췌':'공식 개역개정 본문 안내'}</p>
    ${chapter.available?`<div class="verse-list">${chapter.verses.map(v=>{const current={...location,verse:v.verse};const marked=saved.some(r=>key(r)===key(current));return `<button type="button" id="verse-${v.verse}" class="verse${marked?' is-saved':''}${activeVerse===v.verse?' is-current':''}" data-verse="${v.verse}" aria-label="${v.verse}절 ${escapeHtml(v.text)}. 배경 보기${marked?', 표시한 구절':''}" aria-pressed="${activeVerse===v.verse}"><span class="verse-number" aria-hidden="true">${v.verse}</span><span class="verse-copy"><span class="verse-words">${escapeHtml(v.text)}</span></span></button>`;}).join('')}</div><p class="meta">구절을 누르면 배경과 근거를 볼 수 있습니다.</p>`:`<div class="unavailable"><h2>이 장의 본문은 공식 사이트에서 읽을 수 있습니다.</h2><p>아직 이 페이지에 내장하지 않은 본문입니다. 전체 본문을 임의로 채우지 않고 공식 개역개정 본문으로 연결합니다.</p><a class="outline-button" href="${escapeHtml(chapter.officialUrl)}" target="_blank" rel="noopener noreferrer">공식 본문에서 읽기 ↗<span class="visually-hidden"> — 새 탭</span></a><p class="meta">등록된 도움 예시: 데살로니가전서 5:16–20</p><a class="text-link" href="${escapeHtml(linkTo(DEFAULT_LOCATION))}">본문 도움 예시로 돌아가기 →</a></div>`}
    <nav class="chapter-footer" aria-label="장 이동">${prev?`<a class="text-button" href="${escapeHtml(linkTo(prev))}">← 이전 장</a>`:'<span></span>'}${next?`<a class="text-button" href="${escapeHtml(linkTo(next))}">다음 장 →</a>`:'<span></span>'}</nav>${chapter.available?`<a class="text-link small" href="${escapeHtml(chapter.officialUrl)}" target="_blank" rel="noopener noreferrer">이 장 전체를 공식 본문에서 읽기 ↗<span class="visually-hidden"> — 새 탭</span></a>`:''}${footerDisclosure()}</section><aside class="context-panel" ${modal?'role="dialog" aria-modal="true" aria-labelledby="context-title"':'aria-label="선택한 구절의 배경"'}>${contextMarkup()}</aside></div>`;
  document.querySelector('.scripture-column').scrollTop=oldScroll;
}
function editorMarkup(row) {
  const isEditing=editor?.id===key(row);
  if (isEditing) return `<form class="reflection reflection-editor" data-editor="${key(row)}"><label for="reflection-input">나의 묵상</label><textarea id="reflection-input" name="reflection" maxlength="10000" aria-describedby="reflection-help reflection-count" spellcheck="false">${escapeHtml(editor.value)}</textarea><div class="editor-meta"><span id="reflection-help">이 브라우저에만 저장됩니다.</span><span id="reflection-count">${editor.value.length.toLocaleString()} / 10,000자</span></div><div class="reflection-error" role="alert" ${editor.error?'':'hidden'}>${escapeHtml(editor.error || '')}</div><div class="actions"><button class="primary-button" type="submit" ${editor.external?'disabled':''}>묵상 저장</button><button class="text-button" type="button" data-action="cancel-reflection">취소</button></div></form>`;
  return `<section class="reflection" aria-label="${escapeHtml(label(row))} 나의 묵상"><h3>나의 묵상</h3>${row.reflection?`<p class="reflection-text">${escapeHtml(row.reflection)}</p>`:'<p class="reflection-empty">이 구절을 읽으며 남기고 싶은 생각을 적어 보세요.</p>'}<button class="text-button" data-edit="${key(row)}">${row.reflection?'묵상 수정':'묵상 쓰기'}</button></section>`;
}
function renderMyPage() {
  const books=BOOKS.filter(b=>saved.some(row=>row.book===b.id));
  const rows=saved.filter(row=>filter==='all'||row.book===filter).sort(sort==='bible'?compareLocations:(a,b)=>b.savedAt.localeCompare(a.savedAt));
  main.innerHTML=`<section class="collection"><div class="collection-heading"><p class="eyebrow">마이페이지</p><h1>뜻깊은 구절</h1><p class="meta">이 브라우저에 저장된 구절과 나의 묵상입니다.</p></div>${storageBanner()}
    ${!storageError&&saved.length?`<div class="collection-controls"><div class="sort-controls" role="group" aria-label="구절 정렬"><button class="${sort==='recent'?'primary-button':'text-button'}" data-sort="recent" aria-pressed="${sort==='recent'}">최근 표시순${sort==='recent'?' ✓':''}</button><button class="${sort==='bible'?'primary-button':'text-button'}" data-sort="bible" aria-pressed="${sort==='bible'}">성경 순서${sort==='bible'?' ✓':''}</button></div><label class="visually-hidden" for="book-filter">저장된 성경 책 필터</label><select class="book-filter" id="book-filter"><option value="all">전체 성경</option>${books.map(b=>`<option value="${b.id}" ${filter===b.id?'selected':''}>${escapeHtml(b.name)}</option>`).join('')}</select></div>`:''}
    ${storageError?'':rows.length?`<div class="saved-list">${rows.map(row=>{const verse=getVerse(row);return `<article class="saved-item" data-item="${key(row)}"><h2>${escapeHtml(label(row))}</h2><div class="saved-quote"><span class="verse-number" aria-hidden="true">${row.verse}</span><p class="verse-copy"><span class="verse-words">${escapeHtml(verse?.text||'이 구절의 본문은 공식 개역개정 본문에서 확인해 주세요.')}</span></p></div><div class="actions item-actions"><a class="text-button" href="${escapeHtml(linkTo(row))}">본문에서 보기 →</a><button class="text-button" data-remove="${key(row)}">표시 해제</button></div>${editorMarkup(row)}</article>`;}).join('')}</div>`:`<div class="empty-state"><h2>${saved.length?'이 책에 표시한 구절이 없습니다.':'표시한 구절이 아직 없습니다.'}</h2><p>성경을 읽으며 뜻깊은 구절을 표시하고 묵상을 남겨 보세요.</p>${saved.length?'<button class="outline-button" data-action="all-books">전체 보기</button>':`<a class="outline-button" href="${escapeHtml(lastReading().url)}">성경 읽으러 가기 →</a>`}</div>`}
    <p class="collection-notice">구절과 묵상은 같은 브라우저에만 저장됩니다. 다른 기기로 자동 동기화되지 않으며, 브라우저 데이터를 지우면 함께 삭제됩니다.</p></section>`;
}
function render() { if (isMyPage) renderMyPage(); else renderReader(); updateHeader(); }
function updateHeader() {
  document.querySelectorAll('[data-reading-link]').forEach(a=>{a.href=isMyPage?lastReading().url:linkTo(location);});
  document.querySelectorAll('[data-mypage-link]').forEach(a=>{a.href=myPageUrl.pathname;});
}
function removeRow(row) {
  if (dirty() && !window.confirm('저장하지 않은 묵상이 있습니다. 작성한 내용을 버리고 표시를 해제할까요?')) return;
  if (row.reflection && !window.confirm('이 구절의 표시와 작성한 묵상이 함께 삭제됩니다. 표시를 해제할까요?')) return;
  try {
    const removed=store.remove(row); if (!removed) return;
    editor=null; readSaved(); render();
    toast('구절 표시를 해제했습니다.',{action:'되돌리기',onAction:()=>{try{store.restore(removed);readSaved();render();hideToast();toast('구절과 묵상을 되돌렸습니다.');}catch(error){toast(error.message,{error:true});}}});
  } catch (error) { toast(error.message,{error:true}); }
}
function toggleSave() {
  const target={...location,verse:activeVerse};const row=saved.find(r=>key(r)===key(target));
  if (row) {removeRow(row);return;}
  try {store.save(target);readSaved();renderReader();toast('뜻깊은 구절로 표시했습니다.');document.querySelector('[data-action=toggle-save]')?.focus({preventScroll:true});}
  catch(error){toast(error.message || '구절을 저장하지 못했습니다.',{error:true});}
}
function openEditor(id) {
  if (editor?.id===id) return;
  if (!discardDraft()) return;
  const row=saved.find(r=>key(r)===id);if (!row) return;
  editor={id,value:row.reflection,initial:row.reflection,error:null,external:false};
  renderMyPage();document.querySelector('#reflection-input')?.focus({preventScroll:true});
}
function saveReflection(event) {
  event.preventDefault(); if (!editor || editor.external) return;
  const row=saved.find(r=>key(r)===editor.id);if (!row) return;
  try {store.saveReflection(row,editor.value.trim()?editor.value:'');editor=null;readSaved();renderMyPage();toast('묵상을 저장했습니다.');document.querySelector(`[data-edit="${key(row)}"]`)?.focus({preventScroll:true});}
  catch(error){editor.error=error.message;const box=document.querySelector('.reflection-error');box.hidden=false;box.textContent=error.message;}
}
function chapterDialog() {
  const dialog=document.querySelector('#chapter-dialog');
  dialog.innerHTML=`<form id="chapter-form"><div class="dialog-head"><h2 id="chapter-dialog-title">본문 선택</h2><button type="button" class="close-button" data-close-dialog aria-label="닫기">×</button></div><div class="field"><label for="book-choice">성경</label><select id="book-choice" name="book"><optgroup label="구약">${BOOKS.filter(b=>b.testament==='OT').map(bookOption).join('')}</optgroup><optgroup label="신약">${BOOKS.filter(b=>b.testament==='NT').map(bookOption).join('')}</optgroup></select></div><div class="field"><label for="chapter-choice">장</label><select id="chapter-choice" name="chapter"></select></div><p class="meta">원하는 책과 장을 자유롭게 살펴보세요.</p><div class="dialog-actions"><button type="button" class="text-button" data-close-dialog>취소</button><button class="primary-button" type="submit">이 장 읽기</button></div></form>`;
  function bookOption(b) {return `<option value="${b.id}" ${b.id===location.book?'selected':''}>${escapeHtml(b.name)}</option>`;}
  function chapters(value) { const book=getBook(document.querySelector('#book-choice').value);document.querySelector('#chapter-choice').innerHTML=Array.from({length:book.chapters},(_,i)=>`<option value="${i+1}" ${i+1===value?'selected':''}>${i+1}장</option>`).join(''); }
  chapters(location.chapter);document.querySelector('#book-choice').addEventListener('change',()=>chapters(1));
  document.querySelector('#chapter-form').addEventListener('submit',event=>{event.preventDefault();if (!discardDraft())return;const data=new FormData(event.currentTarget);window.location.href=linkTo({translation:'GAE',book:data.get('book'),chapter:Number(data.get('chapter')),verse:null});});
  dialog.showModal();
}
function settingsDialog() {
  const dialog=document.querySelector('#settings-dialog');
  const options=(name,values)=>values.map(([value,caption])=>`<label><input type="radio" name="${name}" value="${value}" ${String(settings[name])===String(value)?'checked':''}>${caption}</label>`).join('');
  dialog.innerHTML=`<form id="settings-form"><div class="dialog-head"><h2 id="settings-title">읽기 설정</h2><button class="close-button" type="button" data-close-dialog aria-label="닫기">×</button></div><fieldset><legend>본문 글자 크기</legend><div class="option-row">${options('size',[[19,'기본'],[22,'크게'],[26,'더 크게']])}</div></fieldset><fieldset><legend>줄 간격</legend><div class="option-row">${options('line',[[1.8,'기본'],[2.1,'넓게']])}</div></fieldset><fieldset><legend>화면</legend><div class="option-row">${options('theme',[['light','밝게'],['dark','어둡게']])}</div></fieldset><p class="settings-note">읽기 설정은 같은 브라우저에 보관합니다.</p><div class="dialog-actions"><button type="button" class="text-button" data-close-dialog>취소</button><button class="primary-button" type="submit">설정 적용</button></div></form>`;
  document.querySelector('#settings-form').addEventListener('submit',event=>{event.preventDefault();const data=new FormData(event.currentTarget);settings={size:Number(data.get('size')),line:Number(data.get('line')),theme:data.get('theme')};applySettings();dialog.close();try{window.localStorage.setItem(settingsKey,JSON.stringify(settings));}catch{toast('설정을 저장하지 못해 현재 탭에만 적용했습니다.',{error:true});}});dialog.showModal();
}

document.addEventListener('click',event=>{
  const close=event.target.closest('[data-close-dialog]');if(close){close.closest('dialog').close();return;}
  const settingsButton=event.target.closest('.settings-trigger');if(settingsButton){settingsDialog();return;}
  const verseButton=event.target.closest('[data-verse]');if(verseButton){activeVerse=Number(verseButton.dataset.verse);location={...location,verse:activeVerse};mobileOpen=window.matchMedia('(max-width:1023px)').matches;if(mobileOpen)window.history.pushState({biblejeongContext:true},'',linkTo(location));else window.history.replaceState(null,'',linkTo(location));rememberReading();renderReader();updateHeader();if(mobileOpen)document.querySelector('#context-title')?.focus({preventScroll:true});else document.querySelector(`[data-verse="${activeVerse}"]`)?.focus({preventScroll:true});return;}
  const edit=event.target.closest('[data-edit]');if(edit){openEditor(edit.dataset.edit);return;}
  const remove=event.target.closest('[data-remove]');if(remove){const row=saved.find(r=>key(r)===remove.dataset.remove);if(row)removeRow(row);return;}
  const sorting=event.target.closest('[data-sort]');if(sorting){if(!discardDraft())return;sort=sorting.dataset.sort;renderMyPage();return;}
  const action=event.target.closest('[data-action]')?.dataset.action;
  if(action==='chapter')chapterDialog();
  if(action==='toggle-save')toggleSave();
  if(action==='retry-storage'){if(readSaved())render();else render();}
  if(action==='all-books'){filter='all';renderMyPage();}
  if(action==='cancel-reflection'){if(discardDraft()){readSaved();renderMyPage();}}
  if(action==='close-context')closeContext();
  const anchor=event.target.closest('a[href]');
  if(anchor && anchor.target!=='_blank' && !anchor.getAttribute('href').startsWith('#')){
    if(isMyPage && !discardDraft()){event.preventDefault();return;}
    if(!isMyPage)rememberReading();
  }
});
document.addEventListener('input',event=>{
  if(event.target.id!=='reflection-input'||!editor)return;
  editor.value=event.target.value;document.querySelector('#reflection-count').textContent=`${editor.value.length.toLocaleString()} / 10,000자`;
});
document.addEventListener('change',event=>{
  if(event.target.id!=='book-filter')return;
  const next=event.target.value;if(!discardDraft()){event.target.value=filter;return;}filter=next;renderMyPage();
});
document.addEventListener('submit',event=>{if(event.target.matches('.reflection-editor'))saveReflection(event);});
window.addEventListener('beforeunload',event=>{if(dirty()){event.preventDefault();event.returnValue='';}});
window.addEventListener('pagehide',rememberReading);
window.addEventListener('storage',event=>{
  if(event.key!==STORAGE_KEY)return;
  if(editor){editor.external=true;editor.error='다른 탭에서 저장 내용이 바뀌었습니다. 작성 중인 글은 유지했습니다. 글을 복사해 두고 취소한 뒤 최신 내용을 확인해 주세요.';const box=document.querySelector('.reflection-error');if(box){box.hidden=false;box.textContent=editor.error;}document.querySelector('.reflection-editor [type=submit]')?.setAttribute('disabled','');return;}
  readSaved();render();
});
function closeContext(){
  if(window.history.state?.biblejeongContext){window.history.back();return;}
  mobileOpen=false;renderReader();document.querySelector(`[data-verse="${activeVerse}"]`)?.focus({preventScroll:true});
}
window.addEventListener('popstate',()=>{
  if(isMyPage)return;
  const previous={...location,verse:activeVerse};const wasOpen=mobileOpen;
  mobileOpen=window.history.state?.biblejeongContext===true;
  try{
    location=parseReadingLocation(window.location.search);activeVerse=location.verse;addressError=null;
    if(wasOpen&&!mobileOpen&&previous.book===location.book&&previous.chapter===location.chapter&&getVerse(previous)){
      location={...location,verse:previous.verse};activeVerse=previous.verse;window.history.replaceState(null,'',linkTo(location));
    }
  }catch(error){addressError=error;}
  renderReader();updateHeader();
  if(mobileOpen)document.querySelector('#context-title')?.focus({preventScroll:true});
  else document.querySelector(`[data-verse="${activeVerse}"]`)?.focus({preventScroll:true});
});
window.matchMedia('(max-width:1023px)').addEventListener('change',()=>{if(!isMyPage)renderReader();});
document.addEventListener('keydown',event=>{
  if(!mobileOpen||!window.matchMedia('(max-width:1023px)').matches||document.querySelector('dialog[open]'))return;
  if(event.key==='Escape'){closeContext();return;}
  if(event.key!=='Tab')return;
  const items=[...document.querySelectorAll('.context-panel button,.context-panel a[href],.context-panel summary')].filter(n=>!n.disabled&&n.getClientRects().length);
  const first=items[0],last=items.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
});
render();
if(!isMyPage&&!addressError){
  const previous=lastReading();
  if(previous.url===new URL(linkTo(location),window.location.href).href&&previous.scroll){requestAnimationFrame(()=>{const col=document.querySelector('.scripture-column');if(window.matchMedia('(min-width:1024px)').matches)col.scrollTop=previous.scroll;else window.scrollTo(0,previous.scroll);});}
  if(mobileOpen)document.querySelector('#context-title')?.focus({preventScroll:true});
}
