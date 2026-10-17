import { verseElementId } from './navigation.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function bookChaptersMarkup(book, chapters, selected, saved, {remote=false,statusFor=()=>({state:'idle'})}={}) {
  const marked = saved.filter(row=>row.translation==='GAE'&&row.book===book);
  return chapters.filter(chapter=>remote||chapter.available).map(chapter=>{
    const needsRemote=remote&&(!chapter.available||chapter.partial);
    const status=statusFor(chapter.chapter);
    const loadAttribute=needsRemote&&status.state==='idle'?` data-load-chapter="${chapter.chapter}"`:'';
    const rows=chapter.verses.map(verse=>{
      const end=verse.endVerse??verse.verse;
      const range=verse.verse===end?String(verse.verse):`${verse.verse}–${end}`;
      const location = {translation:'GAE',book,chapter:chapter.chapter,verse:verse.verse};
      const isSaved = marked.some(row=>row.chapter===chapter.chapter&&row.verse>=verse.verse&&row.verse<=end);
      const isCurrent = selected.chapter===chapter.chapter&&selected.verse>=verse.verse&&selected.verse<=end;
      return `<button type="button" id="${verseElementId(location)}" class="verse${isSaved?' is-saved':''}${isCurrent?' is-current':''}" data-chapter="${chapter.chapter}" data-verse="${verse.verse}" data-end-verse="${end}" aria-label="${chapter.chapter}장 ${range}절 ${escapeHtml(verse.text)}. 배경 보기${isSaved?', 표시한 구절':''}" aria-pressed="${isCurrent}"><span class="verse-number" aria-hidden="true">${range}</span><span class="verse-copy"><span class="verse-words">${escapeHtml(verse.text)}</span></span></button>`;
    }).join('');
    const stateMarkup=needsRemote?`<div class="${chapter.available?'chapter-load-note':'chapter-placeholder'}" ${status.state==='loading'?'role="status"':''}><p class="meta">${status.state==='loading'?`${chapter.chapter}장 본문을 불러오고 있습니다.`:status.state==='error'?escapeHtml(status.message||'본문을 불러오지 못했습니다.'):'가까이 오면 본문을 이어서 불러옵니다.'}</p>${status.state!=='loading'?`<button class="text-button" data-retry-book="${book}" data-retry-chapter="${chapter.chapter}">${status.state==='error'?'다시 불러오기':'본문 불러오기'}</button>`:''}</div>`:'';
    return `<section class="chapter-section" aria-labelledby="chapter-${chapter.chapter}"${loadAttribute}><h2 id="chapter-${chapter.chapter}" class="chapter-title" tabindex="-1">${chapter.chapter}장</h2>${rows?`<div class="verse-list">${rows}</div>`:''}${stateMarkup}</section>`;
  }).join('');
}
