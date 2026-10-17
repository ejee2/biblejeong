import test from 'node:test';
import assert from 'node:assert/strict';
import { createVerseStore, STORAGE_KEY, StorageError } from '../assets/store.js';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const location = { translation: 'GAE', book: '1th', chapter: 5, verse: 18 };
const firstTime = '2026-10-17T01:00:00.000Z';
const secondTime = '2026-10-17T02:00:00.000Z';
const row = { ...location, savedAt: firstTime, reflection: '', reflectionUpdatedAt: null };
const errorCode = (code) => (error) => error instanceof StorageError && error.code === code && /[가-힣]/.test(error.message);

test('a new browser starts empty without creating seed records', () => {
  const storage = new MemoryStorage();
  assert.deepEqual(createVerseStore(storage).list(), []);
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test('saving the same verse preserves one record, its time and its reflection', () => {
  const storage = new MemoryStorage();
  const store = createVerseStore(storage, { now: () => firstTime });
  assert.deepEqual(store.save(location), row);
  store.saveReflection(location, '하루의 작은 일도 기억하기.');
  const saved = createVerseStore(storage, { now: () => secondTime }).save(location);
  assert.equal(saved.savedAt, firstTime);
  assert.equal(saved.reflection, '하루의 작은 일도 기억하기.');
  assert.equal(store.list().length, 1);
  assert.equal(store.has(location), true);
});

test('saved verses are returned newest first and survive a new store instance', () => {
  const storage = new MemoryStorage();
  createVerseStore(storage, { now: () => firstTime }).save(location);
  createVerseStore(storage, { now: () => secondTime }).save({ ...location, verse: 17 });
  const result = createVerseStore(storage).list();
  assert.deepEqual(result.map((item) => item.verse), [17, 18]);
  result[0].reflection = '반환 객체를 바꾸어도 저장값은 보호됨';
  assert.equal(createVerseStore(storage).list()[0].reflection, '');
});

test('removing a verse removes its reflection and undo restores the complete record', () => {
  const storage = new MemoryStorage();
  const store = createVerseStore(storage, { now: () => firstTime });
  store.save(location);
  const reflected = store.saveReflection(location, '기억하고 싶은 묵상');
  assert.deepEqual(store.remove(location), reflected);
  assert.deepEqual(store.list(), []);
  assert.equal(store.has(location), false);
  assert.deepEqual(store.restore(reflected), reflected);
  assert.deepEqual(store.list(), [reflected]);
  assert.equal(store.remove({ ...location, verse: 16 }), null);
});

test('reflection is plain text, explicit and can be cleared without removing its verse', () => {
  const storage = new MemoryStorage();
  const store = createVerseStore(storage, { now: () => firstTime });
  store.save(location);
  const text = '<script>alert("test")</script>\n있는 그대로';
  const result = store.saveReflection(location, text);
  assert.equal(result.reflection, text);
  assert.equal(result.reflectionUpdatedAt, firstTime);
  assert.equal(store.saveReflection(location, '').reflection, '');
  assert.equal(store.list().length, 1);
});

test('reflection length is limited without discarding the previous text', () => {
  const storage = new MemoryStorage();
  const store = createVerseStore(storage, { now: () => firstTime });
  store.save(location);
  store.saveReflection(location, '가'.repeat(10000));
  const previous = storage.getItem(STORAGE_KEY);
  assert.throws(() => store.saveReflection(location, '가'.repeat(10001)), errorCode('INVALID_REFLECTION'));
  assert.throws(() => store.saveReflection(location, null), errorCode('INVALID_REFLECTION'));
  assert.equal(storage.getItem(STORAGE_KEY), previous);
});

test('reflection cannot silently create a verse that was never saved', () => {
  const storage = new MemoryStorage();
  const store = createVerseStore(storage);
  assert.throws(() => store.saveReflection(location, '초안'), errorCode('NOT_SAVED'));
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test('a failed write keeps both previous stored data and the unsaved draft unchanged', () => {
  const storage = new MemoryStorage();
  const store = createVerseStore(storage, { now: () => firstTime });
  store.save(location);
  store.saveReflection(location, '기존 묵상');
  const previous = storage.getItem(STORAGE_KEY);
  storage.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
  assert.throws(() => store.saveReflection(location, '새로운 묵상 초안'), errorCode('WRITE_FAILED'));
  assert.throws(() => store.remove(location), errorCode('WRITE_FAILED'));
  assert.throws(() => store.save({ ...location, verse: 17 }), errorCode('WRITE_FAILED'));
  assert.equal(storage.getItem(STORAGE_KEY), previous);
  assert.equal(store.list()[0].reflection, '기존 묵상');
});

test('blocked storage reads fail clearly instead of pretending an empty list', () => {
  const storage = new MemoryStorage();
  storage.getItem = () => { throw new DOMException('blocked', 'SecurityError'); };
  const store = createVerseStore(storage);
  assert.throws(() => store.list(), errorCode('READ_FAILED'));
  assert.throws(() => store.save(location), errorCode('READ_FAILED'));
});

test('malformed, unknown-version and duplicate saved data are never overwritten', () => {
  for (const raw of ['{broken', 'null', '{"version":99,"verses":[]}', JSON.stringify({ version: 1, verses: [row, row] })]) {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, raw);
    const store = createVerseStore(storage);
    assert.throws(() => store.list(), errorCode('CORRUPT_DATA'));
    assert.throws(() => store.save(location), errorCode('CORRUPT_DATA'));
    assert.throws(() => store.remove(location), errorCode('CORRUPT_DATA'));
    assert.equal(storage.getItem(STORAGE_KEY), raw);
  }
});

test('saved records with invalid reflection or location are not partially recovered and overwritten', () => {
  for (const damaged of [{ ...row, reflection: 123 }, { ...row, chapter: -1 }, { ...row, book: 'unknown' }, { ...row, reflectionUpdatedAt: 'yesterday' }]) {
    const storage = new MemoryStorage();
    const raw = JSON.stringify({ version: 1, verses: [damaged] });
    storage.setItem(STORAGE_KEY, raw);
    const store = createVerseStore(storage);
    assert.throws(() => store.save(location), errorCode('CORRUPT_DATA'));
    assert.equal(storage.getItem(STORAGE_KEY), raw);
  }
});

test('undo cannot overwrite a verse saved again with a newer reflection', () => {
  const storage = new MemoryStorage();
  const store = createVerseStore(storage, { now: () => firstTime });
  const removed = store.save(location);
  store.remove(location);
  store.save(location);
  store.saveReflection(location, '새 묵상');
  assert.throws(() => store.restore(removed), errorCode('ALREADY_SAVED'));
  assert.equal(store.list()[0].reflection, '새 묵상');
});

test('invalid verse identities cannot write records', () => {
  const storage = new MemoryStorage();
  const store = createVerseStore(storage);
  for (const invalid of [{ ...location, book: 'none' }, { ...location, chapter: 6 }, { ...location, verse: 0 }, { ...location, verse: 29 }, { ...location, translation: 'other' }]) {
    assert.throws(() => store.save(invalid), errorCode('INVALID_LOCATION'));
  }
  assert.equal(storage.getItem(STORAGE_KEY), null);
});
