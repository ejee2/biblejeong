import { BOOKS, getBook, normalizeLocation } from './bible-data.js';

export function adjacentBook(location, direction) {
  const normalized = normalizeLocation(location);
  if (direction !== -1 && direction !== 1) throw new TypeError('책 이동 방향을 확인해 주세요.');
  const book = getBook(normalized.book);
  const next = BOOKS[book.order - 1 + direction];
  return next ? { translation:'GAE', book:next.id, chapter:1, verse:null } : null;
}

export function verseElementId(location) {
  const { book, chapter, verse } = normalizeLocation(location, { requireVerse:true });
  return `verse-${book}-${chapter}-${verse}`;
}

export function verseForRange(location, { chapter, verse, endVerse = verse }, saved = []) {
  const current = normalizeLocation(location);
  const target = normalizeLocation({ ...current, chapter, verse }, { requireVerse:true });
  normalizeLocation({ ...target, verse:endVerse }, { requireVerse:true });
  if (endVerse < verse) throw new TypeError('성경 구절의 범위를 확인해 주세요.');
  const includes = value => Number.isInteger(value) && value >= verse && value <= endVerse;
  if (current.chapter === chapter && includes(current.verse)) return current.verse;
  return saved.find(row => row.translation === target.translation && row.book === target.book && row.chapter === chapter && includes(row.verse))?.verse ?? verse;
}

export function adjacentChapter(location, direction) {
  const book = getBook(location.book);
  let chapter = location.chapter + direction;
  let next = book;
  if (chapter < 1) {
    next = BOOKS[book.order - 2];
    if (!next) return null;
    chapter = next.chapters;
  } else if (chapter > book.chapters) {
    next = BOOKS[book.order];
    if (!next) return null;
    chapter = 1;
  }
  return { translation:'GAE', book:next.id, chapter, verse:null };
}
