import test from 'node:test';
import assert from 'node:assert/strict';
import { BOOKS, DEFAULT_LOCATION, getBook, getChapter, getVerse, getContext, officialBibleUrl, parseReadingLocation, readingUrl, compareLocations } from '../assets/bible-data.js';
import * as bibleData from '../assets/bible-data.js';

test('a whole book supplies every chapter in reading order without inventing unavailable text', () => {
  assert.equal(typeof bibleData.getBookChapters, 'function');
  let chapterCount = 0;
  for (const book of BOOKS) {
    const chapters = bibleData.getBookChapters(book.id);
    assert.equal(chapters.length, book.chapters);
    chapterCount += chapters.length;
    for (const [index, chapter] of chapters.entries()) {
      assert.equal(chapter.book, book.id);
      assert.equal(chapter.chapter, index + 1);
      assert.equal(new URL(chapter.officialUrl).searchParams.get('chap'), String(index + 1));
      if (book.id !== '1th' || chapter.chapter !== 5) {
        assert.equal(chapter.available, false);
        assert.equal(chapter.partial, false);
        assert.deepEqual(chapter.verses, []);
      }
    }
  }
  assert.equal(chapterCount, 1189);
  const excerpt = bibleData.getBookChapters('1th')[4];
  assert.equal(excerpt.available, true);
  assert.equal(excerpt.partial, true);
  assert.deepEqual(excerpt.verses.map(({verse}) => verse), [16, 17, 18, 19, 20]);
  assert.throws(() => bibleData.getBookChapters('unknown'), TypeError);
});

test('mutating one whole-book result cannot corrupt subsequent reading or saved verse lookups', () => {
  assert.equal(typeof bibleData.getBookChapters, 'function');
  const chapters = bibleData.getBookChapters('1th');
  chapters[4].verses[0].text = '변경';
  chapters[4].verses.pop();
  chapters[4].excerpt.from = 1;
  chapters[0].available = true;
  chapters.pop();
  const fresh = bibleData.getBookChapters('1th');
  assert.equal(fresh.length, 5);
  assert.equal(fresh[0].available, false);
  assert.equal(fresh[4].verses[0].text, '항상 기뻐하라');
  assert.equal(fresh[4].verses.length, 5);
  assert.deepEqual(fresh[4].excerpt, {from:16, to:20});
  assert.equal(getVerse({book:'1th', chapter:5, verse:16}).text, '항상 기뻐하라');
});

test('all 66 books are selectable with canonical ordering and chapter boundaries', () => {
  assert.equal(BOOKS.length, 66);
  assert.equal(new Set(BOOKS.map((book) => book.id)).size, 66);
  assert.equal(BOOKS.filter((book) => book.testament === 'OT').length, 39);
  assert.equal(BOOKS.filter((book) => book.testament === 'NT').length, 27);
  assert.equal(BOOKS.reduce((sum, book) => sum + book.chapters, 0), 1189);
  assert.equal(getBook('gen').name, '창세기');
  assert.equal(getBook('psa').chapters, 150);
  assert.equal(getBook('1th').chapters, 5);
  assert.equal(getBook('rev').order, 66);
  assert.equal(getBook('unknown'), null);
});

test('the verified excerpt is continuous and never masquerades as a complete chapter', () => {
  const chapter = getChapter('1th', 5);
  assert.equal(chapter.available, true);
  assert.equal(chapter.partial, true);
  assert.deepEqual(chapter.excerpt, { from: 16, to: 20 });
  assert.equal(chapter.totalVerses, 28);
  assert.deepEqual(chapter.verses.map(({ verse }) => verse), [16, 17, 18, 19, 20]);
  assert.equal(getVerse({ book: '1th', chapter: 5, verse: 17 }).text, '쉬지 말고 기도하라');
  assert.equal(getVerse({ book: '1th', chapter: 5, verse: 15 }), null);
});

test('unregistered chapters return an honest empty state and the exact official chapter link', () => {
  const chapter = getChapter('gen', 1);
  assert.equal(chapter.available, false);
  assert.equal(chapter.partial, false);
  assert.deepEqual(chapter.verses, []);
  const url = new URL(chapter.officialUrl);
  assert.equal(url.hostname, 'www.bskorea.or.kr');
  assert.equal(url.searchParams.get('book'), 'gen');
  assert.equal(url.searchParams.get('chap'), '1');
  assert.equal(url.searchParams.get('version'), 'GAE');
});

test('a chapter-only location has no selected verse or context', () => {
  const chapterOnly = { book: '1th', chapter: 5, verse: null };
  assert.equal(getVerse(chapterOnly), null);
  assert.equal(getContext(chapterOnly), null);
});

test('invalid chapter requests cannot fall through to another book or chapter', () => {
  for (const args of [['gen', 0], ['1th', 6], ['unknown', 1], ['psa', '1x']]) {
    assert.throws(() => getChapter(...args), TypeError);
    assert.throws(() => officialBibleUrl(...args), TypeError);
  }
});

test('each available verse context carries fact-based sections and traceable references', () => {
  for (const verse of [16, 17, 18, 19, 20]) {
    const context = getContext({ translation: 'GAE', book: '1th', chapter: 5, verse });
    for (const field of ['title', 'summary', 'before', 'after', 'summaryRef', 'beforeRef', 'afterRef']) assert.equal(typeof context[field], 'string');
    assert.ok(context.references.length >= 2);
    assert.ok(context.references.every((ref) => ref.label && new URL(ref.url).hostname === 'www.bskorea.or.kr'));
  }
  assert.equal(getContext({ book: 'gen', chapter: 1, verse: 1 }), null);
});

test('deep links round-trip a selected verse on a GitHub project pathname', () => {
  const path = readingUrl({ translation: 'GAE', book: '1th', chapter: 5, verse: 18 }, '/biblejeong/');
  assert.equal(path, '/biblejeong/?book=1th&chapter=5&verse=18&translation=GAE');
  assert.deepEqual(parseReadingLocation(path.slice(path.indexOf('?'))), DEFAULT_LOCATION);
  assert.deepEqual(parseReadingLocation('?book=gen&chapter=1'), { translation: 'GAE', book: 'gen', chapter: 1, verse: null });
  assert.deepEqual(parseReadingLocation(''), DEFAULT_LOCATION);
  assert.equal(readingUrl({ book: 'gen', chapter: 1, verse: null }, './'), './?book=gen&chapter=1&translation=GAE');
});

test('malformed deep links produce a readable address error instead of a silent fallback', () => {
  for (const query of ['?book=unknown&chapter=1', '?book=gen&chapter=51', '?book=1th&chapter=5&verse=29', '?book=gen&chapter=1x', '?book=gen', '?chapter=1', '?book=gen&chapter=1&translation=UNKNOWN', '?book=gen&chapter=1&verse=0', '?book=gen&chapter=1&verse=177']) {
    assert.throws(() => parseReadingLocation(query), (error) => error instanceof TypeError && /[가-힣]/.test(error.message));
  }
});

test('canonical sort compares book, chapter and verse rather than display names', () => {
  const input = [{ book: 'rev', chapter: 1, verse: 1 }, { book: '1th', chapter: 5, verse: 18 }, { book: 'gen', chapter: 2, verse: 1 }, { book: 'gen', chapter: 1, verse: 20 }];
  assert.deepEqual(input.sort(compareLocations).map((item) => `${item.book}:${item.chapter}:${item.verse}`), ['gen:1:20', 'gen:2:1', '1th:5:18', 'rev:1:1']);
});
