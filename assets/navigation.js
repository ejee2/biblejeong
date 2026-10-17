import { BOOKS, getBook } from './bible-data.js';

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
