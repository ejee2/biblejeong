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
