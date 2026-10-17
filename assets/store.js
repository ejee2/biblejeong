import { normalizeLocation } from './bible-data.js';

export const STORAGE_KEY = 'biblejeong:verses:v1';

export class StorageError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = 'StorageError';
    this.code = code;
  }
}

const key = (location) => `${location.translation}:${location.book}:${location.chapter}:${location.verse}`;
const validTimestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

function identity(location) {
  try {
    return normalizeLocation(location, { requireVerse: true });
  } catch (cause) {
    throw new StorageError('INVALID_LOCATION', '저장할 구절의 주소를 확인해 주세요.', { cause });
  }
}

function validateRow(value) {
  const location = identity(value);
  if (value.translation !== location.translation || !validTimestamp(value.savedAt) || typeof value.reflection !== 'string' || value.reflection.length > 10000 || (value.reflectionUpdatedAt !== null && !validTimestamp(value.reflectionUpdatedAt))) {
    throw new TypeError('저장 구절 형식이 올바르지 않습니다.');
  }
  return { ...location, savedAt: value.savedAt, reflection: value.reflection, reflectionUpdatedAt: value.reflectionUpdatedAt };
}

export function createVerseStore(storage, { now = () => new Date().toISOString() } = {}) {
  function read() {
    let raw;
    try {
      raw = storage.getItem(STORAGE_KEY);
    } catch (cause) {
      throw new StorageError('READ_FAILED', '표시한 구절을 불러오지 못했습니다. 브라우저의 저장소 허용 설정을 확인한 뒤 다시 시도해 주세요.', { cause });
    }
    if (raw === null) return [];
    try {
      const data = JSON.parse(raw);
      if (!data || data.version !== 1 || !Array.isArray(data.verses)) throw new TypeError('알 수 없는 저장 형식');
      const rows = data.verses.map(validateRow);
      if (new Set(rows.map(key)).size !== rows.length) throw new TypeError('중복된 저장 구절');
      return rows;
    } catch (cause) {
      throw new StorageError('CORRUPT_DATA', '저장된 구절 데이터를 읽을 수 없습니다. 기존 데이터는 그대로 보존했으며 자동으로 덮어쓰지 않습니다.', { cause });
    }
  }

  function write(rows) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, verses: rows }));
    } catch (cause) {
      throw new StorageError('WRITE_FAILED', '변경 내용을 저장하지 못했습니다. 기존 데이터와 작성 중인 묵상을 유지한 채 다시 시도해 주세요.', { cause });
    }
  }

  return {
    list() {
      return read().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    },
    has(location) {
      const target = key(identity(location));
      return read().some((row) => key(row) === target);
    },
    save(location) {
      const normalized = identity(location);
      const rows = read();
      const existing = rows.find((row) => key(row) === key(normalized));
      if (existing) return existing;
      const row = validateRow({ ...normalized, savedAt: now(), reflection: '', reflectionUpdatedAt: null });
      write([...rows, row]);
      return row;
    },
    remove(location) {
      const target = key(identity(location));
      const rows = read();
      const existing = rows.find((row) => key(row) === target);
      if (!existing) return null;
      write(rows.filter((row) => key(row) !== target));
      return existing;
    },
    restore(value) {
      const row = validateRow(value);
      const rows = read();
      if (rows.some((existing) => key(existing) === key(row))) {
        throw new StorageError('ALREADY_SAVED', '이 구절이 이미 다시 표시되어 있습니다. 새로 저장한 묵상을 보존하기 위해 이전 항목으로 덮어쓰지 않았습니다.');
      }
      write([...rows, row]);
      return row;
    },
    saveReflection(location, reflection) {
      if (typeof reflection !== 'string' || reflection.length > 10000) {
        throw new StorageError('INVALID_REFLECTION', '묵상은 10,000자 이내의 글로 입력해 주세요.');
      }
      const target = key(identity(location));
      const rows = read();
      const index = rows.findIndex((row) => key(row) === target);
      if (index === -1) throw new StorageError('NOT_SAVED', '먼저 뜻깊은 구절로 표시한 뒤 묵상을 저장해 주세요.');
      const row = validateRow({ ...rows[index], reflection, reflectionUpdatedAt: now() });
      rows[index] = row;
      write(rows);
      return row;
    },
  };
}
