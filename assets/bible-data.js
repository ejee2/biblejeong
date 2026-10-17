export const TRANSLATION = 'GAE';
export const DEFAULT_LOCATION = Object.freeze({ translation: TRANSLATION, book: '1th', chapter: 5, verse: 18 });

const books = [
  ['gen', '창세기', 50], ['exo', '출애굽기', 40], ['lev', '레위기', 27], ['num', '민수기', 36], ['deu', '신명기', 34],
  ['jos', '여호수아', 24], ['jdg', '사사기', 21], ['rut', '룻기', 4], ['1sa', '사무엘상', 31], ['2sa', '사무엘하', 24],
  ['1ki', '열왕기상', 22], ['2ki', '열왕기하', 25], ['1ch', '역대상', 29], ['2ch', '역대하', 36], ['ezr', '에스라', 10],
  ['neh', '느헤미야', 13], ['est', '에스더', 10], ['job', '욥기', 42], ['psa', '시편', 150], ['pro', '잠언', 31],
  ['ecc', '전도서', 12], ['sng', '아가', 8], ['isa', '이사야', 66], ['jer', '예레미야', 52], ['lam', '예레미야애가', 5],
  ['ezk', '에스겔', 48], ['dan', '다니엘', 12], ['hos', '호세아', 14], ['jol', '요엘', 3], ['amo', '아모스', 9],
  ['oba', '오바댜', 1], ['jon', '요나', 4], ['mic', '미가', 7], ['nam', '나훔', 3], ['hab', '하박국', 3],
  ['zep', '스바냐', 3], ['hag', '학개', 2], ['zec', '스가랴', 14], ['mal', '말라기', 4],
  ['mat', '마태복음', 28], ['mrk', '마가복음', 16], ['luk', '누가복음', 24], ['jhn', '요한복음', 21], ['act', '사도행전', 28],
  ['rom', '로마서', 16], ['1co', '고린도전서', 16], ['2co', '고린도후서', 13], ['gal', '갈라디아서', 6], ['eph', '에베소서', 6],
  ['php', '빌립보서', 4], ['col', '골로새서', 4], ['1th', '데살로니가전서', 5], ['2th', '데살로니가후서', 3], ['1ti', '디모데전서', 6],
  ['2ti', '디모데후서', 4], ['tit', '디도서', 3], ['phm', '빌레몬서', 1], ['heb', '히브리서', 13], ['jas', '야고보서', 5],
  ['1pe', '베드로전서', 5], ['2pe', '베드로후서', 3], ['1jn', '요한일서', 5], ['2jn', '요한이서', 1], ['3jn', '요한삼서', 1],
  ['jud', '유다서', 1], ['rev', '요한계시록', 22],
];

export const BOOKS = Object.freeze(books.map(([id, name, chapters], index) => Object.freeze({ id, name, chapters, order: index + 1, testament: index < 39 ? 'OT' : 'NT' })));

const excerpt = Object.freeze([
  Object.freeze({ verse: 16, text: '항상 기뻐하라' }),
  Object.freeze({ verse: 17, text: '쉬지 말고 기도하라' }),
  Object.freeze({ verse: 18, text: '범사에 감사하라 이것이 그리스도 예수 안에서 너희를 향하신 하나님의 뜻이니라' }),
  Object.freeze({ verse: 19, text: '성령을 소멸하지 말며' }),
  Object.freeze({ verse: 20, text: '예언을 멸시하지 말고' }),
]);

export function getBook(id) {
  return BOOKS.find((book) => book.id === id) ?? null;
}

export function normalizeLocation(location, { requireVerse = false } = {}) {
  if (!location || typeof location !== 'object' || Array.isArray(location)) throw new TypeError('성경 주소를 확인해 주세요.');
  const translation = location.translation ?? TRANSLATION;
  const book = getBook(location.book);
  const chapter = location.chapter;
  const verse = location.verse ?? null;
  if (translation !== TRANSLATION || !book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) {
    throw new TypeError('성경 주소의 번역·책·장을 확인해 주세요.');
  }
  // shortcut: 미등록 장은 장 경계와 최대 절수만 검증하며, 본문 도입 때 각 장의 절수도 등록한다.
  const maximumVerse = book.id === '1th' && chapter === 5 ? 28 : 176;
  if ((requireVerse && verse === null) || (verse !== null && (!Number.isInteger(verse) || verse < 1 || verse > maximumVerse))) {
    throw new TypeError('성경 주소의 절 번호를 확인해 주세요.');
  }
  return { translation, book: book.id, chapter, verse };
}

export function officialBibleUrl(book, chapter) {
  const location = normalizeLocation({ book, chapter });
  const url = new URL('https://www.bskorea.or.kr/bible/korbibReadpage.php');
  url.search = new URLSearchParams({ book: location.book, chap: String(location.chapter), version: TRANSLATION });
  return url.href;
}

export function getChapter(book, chapter) {
  const location = normalizeLocation({ book, chapter });
  const available = location.book === '1th' && location.chapter === 5;
  return {
    ...location,
    available,
    partial: available,
    verses: available ? excerpt.map((verse) => ({ ...verse })) : [],
    excerpt: available ? { from: 16, to: 20 } : null,
    totalVerses: available ? 28 : null,
    officialUrl: officialBibleUrl(location.book, location.chapter),
  };
}

export function getVerse(location) {
  const normalized = normalizeLocation(location);
  if (normalized.verse === null) return null;
  if (normalized.book !== '1th' || normalized.chapter !== 5) return null;
  const verse = excerpt.find((item) => item.verse === normalized.verse);
  return verse ? { ...normalized, text: verse.text } : null;
}

const contextSections = {
  16: {
    title: '기쁨에 대한 권면',
    summary: '16절은 기쁨에 관해 권합니다. 편지 첫머리는 보내는 이들로 바울·실루아노·디모데, 받는 이들로 데살로니가 교회를 적고 있습니다.',
    before: '14–15절에서는 약한 사람을 돕고 서로 격려하며, 보복하는 대신 선을 따르는 태도를 권합니다.',
    after: '17–18절의 기도와 감사에 관한 권면, 19–20절의 성령과 예언에 관한 권면이 이어집니다.',
    beforeRange: [14, 15], afterRange: [17, 20],
  },
  17: {
    title: '기도에 대한 권면',
    summary: '17절은 기도를 계속할 것을 권합니다. 편지 첫머리는 보내는 이들로 바울·실루아노·디모데, 받는 이들로 데살로니가 교회를 적고 있습니다.',
    before: '14–15절에서 공동체 안의 돌봄과 선을 따르는 태도를 권한 뒤, 16절에서 기쁨을 말합니다.',
    after: '18절은 감사를 권하고, 19–20절은 성령과 예언을 대하는 태도에 관해 이어 말합니다.',
    beforeRange: [14, 16], afterRange: [18, 20],
  },
  18: {
    title: '감사에 대한 권면',
    summary: '18절은 감사에 관한 권면을 그리스도 예수 안에서 수신자들을 향한 하나님의 뜻으로 설명합니다. 편지 첫머리에 보내는 이들로 바울·실루아노·디모데, 받는 이들로 데살로니가 교회가 적혀 있습니다.',
    before: '14–15절은 서로 격려하고 약한 사람을 돕는 일, 보복하지 않고 선을 따르는 일을 권합니다. 이어 16–17절에서 기쁨과 기도를 말합니다.',
    after: '19–20절에서는 성령과 예언을 대하는 태도에 관한 권면이 이어집니다.',
    beforeRange: [14, 17], afterRange: [19, 20],
  },
  19: {
    title: '성령에 관한 권면',
    summary: '19절은 성령을 소멸하지 말 것을 권합니다. 편지 첫머리는 보내는 이들로 바울·실루아노·디모데, 받는 이들로 데살로니가 교회를 적고 있습니다.',
    before: '14–15절의 서로를 돌보라는 권면에 이어, 16–18절에서는 기쁨·기도·감사를 말합니다.',
    after: '20절에서 예언을 멸시하지 말라는 권면이 이어집니다.',
    beforeRange: [14, 18], afterRange: [20, 20],
  },
  20: {
    title: '예언에 관한 권면',
    summary: '20절은 예언을 멸시하지 말 것을 권합니다. 편지 첫머리는 보내는 이들로 바울·실루아노·디모데, 받는 이들로 데살로니가 교회를 적고 있습니다.',
    before: '14–15절의 서로를 돌보라는 권면, 16–18절의 기쁨·기도·감사에 관한 권면 뒤에 19절의 성령에 관한 권면이 나옵니다.',
    after: '이 화면의 발췌는 20절에서 끝납니다. 이어지는 문맥은 공식 본문에서 확인할 수 있습니다.',
    beforeRange: [14, 19], afterRange: [20, 20],
  },
};

function reference(chapter, from, to = from) {
  const range = from === to ? String(from) : `${from}–${to}`;
  return { label: `데살로니가전서 ${chapter}:${range}`, book: '1th', chapter, verse: from, endVerse: to, url: officialBibleUrl('1th', chapter) };
}

export function getContext(location) {
  const verse = getVerse(location);
  if (!verse) return null;
  const section = contextSections[verse.verse];
  const first = reference(1, 1);
  const selected = reference(5, verse.verse);
  const before = reference(5, ...section.beforeRange);
  const after = reference(5, ...section.afterRange);
  return {
    title: section.title, summary: section.summary, before: section.before, after: section.after,
    summaryRef: `${first.label}; ${selected.label}`, beforeRef: before.label, afterRef: after.label,
    references: [first, selected, before, after],
  };
}

export function parseReadingLocation(search = '') {
  const params = new URLSearchParams(search);
  if (![...params].length) return { ...DEFAULT_LOCATION };
  const book = params.get('book');
  const chapterString = params.get('chapter');
  const verseString = params.get('verse');
  if (!book || !/^\d+$/.test(chapterString ?? '') || (verseString !== null && !/^\d+$/.test(verseString))) {
    throw new TypeError('성경 주소의 책·장·절을 확인해 주세요.');
  }
  return normalizeLocation({
    translation: params.get('translation') ?? TRANSLATION,
    book, chapter: Number(chapterString), verse: verseString === null ? null : Number(verseString),
  });
}

export function readingUrl(location, base = './') {
  const normalized = normalizeLocation(location);
  const params = new URLSearchParams({ book: normalized.book, chapter: String(normalized.chapter) });
  if (normalized.verse !== null) params.set('verse', String(normalized.verse));
  params.set('translation', normalized.translation);
  return `${base.split(/[?#]/, 1)[0]}?${params}`;
}

export function compareLocations(a, b) {
  return getBook(a.book).order - getBook(b.book).order || a.chapter - b.chapter || (a.verse ?? 0) - (b.verse ?? 0);
}
