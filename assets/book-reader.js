import { verseElementId } from './navigation.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function bookChaptersMarkup(book, chapters, selected, saved) {
  const marked = new Set(saved.filter(row=>row.translation==='GAE'&&row.book===book).map(row=>`${row.chapter}:${row.verse}`));
  return chapters.filter(chapter=>chapter.available).map(chapter=>`<section class="chapter-section" aria-labelledby="chapter-${chapter.chapter}"><h2 id="chapter-${chapter.chapter}" class="chapter-title" tabindex="-1">${chapter.chapter}장</h2><div class="verse-list">${chapter.verses.map(verse=>{
    const location = {translation:'GAE',book,chapter:chapter.chapter,verse:verse.verse};
    const isSaved = marked.has(`${chapter.chapter}:${verse.verse}`);
    const isCurrent = selected.chapter===chapter.chapter && selected.verse===verse.verse;
    return `<button type="button" id="${verseElementId(location)}" class="verse${isSaved?' is-saved':''}${isCurrent?' is-current':''}" data-chapter="${chapter.chapter}" data-verse="${verse.verse}" aria-label="${chapter.chapter}장 ${verse.verse}절 ${escapeHtml(verse.text)}. 배경 보기${isSaved?', 표시한 구절':''}" aria-pressed="${isCurrent}"><span class="verse-number" aria-hidden="true">${verse.verse}</span><span class="verse-copy"><span class="verse-words">${escapeHtml(verse.text)}</span></span></button>`;
  }).join('')}</div></section>`).join('');
}
