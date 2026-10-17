const DEFAULT_ORIGIN = 'https://ejee2.github.io';
const CACHE_TTL = 5 * 60_000;
const CACHE_CAPACITY = 64;
const REQUEST_LIMIT = 60;
const WINDOW_MS = 60_000;

// Kept self-contained so this file can be deployed as a standard Worker module.
const BOOKS = new Map([
  ['gen', ['창세기', 50]], ['exo', ['출애굽기', 40]], ['lev', ['레위기', 27]], ['num', ['민수기', 36]], ['deu', ['신명기', 34]],
  ['jos', ['여호수아', 24]], ['jdg', ['사사기', 21]], ['rut', ['룻기', 4]], ['1sa', ['사무엘상', 31]], ['2sa', ['사무엘하', 24]],
  ['1ki', ['열왕기상', 22]], ['2ki', ['열왕기하', 25]], ['1ch', ['역대상', 29]], ['2ch', ['역대하', 36]], ['ezr', ['에스라', 10]],
  ['neh', ['느헤미야', 13]], ['est', ['에스더', 10]], ['job', ['욥기', 42]], ['psa', ['시편', 150]], ['pro', ['잠언', 31]],
  ['ecc', ['전도서', 12]], ['sng', ['아가', 8]], ['isa', ['이사야', 66]], ['jer', ['예레미야', 52]], ['lam', ['예레미야애가', 5]],
  ['ezk', ['에스겔', 48]], ['dan', ['다니엘', 12]], ['hos', ['호세아', 14]], ['jol', ['요엘', 3]], ['amo', ['아모스', 9]],
  ['oba', ['오바댜', 1]], ['jon', ['요나', 4]], ['mic', ['미가', 7]], ['nam', ['나훔', 3]], ['hab', ['하박국', 3]],
  ['zep', ['스바냐', 3]], ['hag', ['학개', 2]], ['zec', ['스가랴', 14]], ['mal', ['말라기', 4]],
  ['mat', ['마태복음', 28]], ['mrk', ['마가복음', 16]], ['luk', ['누가복음', 24]], ['jhn', ['요한복음', 21]], ['act', ['사도행전', 28]],
  ['rom', ['로마서', 16]], ['1co', ['고린도전서', 16]], ['2co', ['고린도후서', 13]], ['gal', ['갈라디아서', 6]], ['eph', ['에베소서', 6]],
  ['php', ['빌립보서', 4]], ['col', ['골로새서', 4]], ['1th', ['데살로니가전서', 5]], ['2th', ['데살로니가후서', 3]], ['1ti', ['디모데전서', 6]],
  ['2ti', ['디모데후서', 4]], ['tit', ['디도서', 3]], ['phm', ['빌레몬서', 1]], ['heb', ['히브리서', 13]], ['jas', ['야고보서', 5]],
  ['1pe', ['베드로전서', 5]], ['2pe', ['베드로후서', 3]], ['1jn', ['요한1서', 5]], ['2jn', ['요한2서', 1]], ['3jn', ['요한3서', 1]],
  ['jud', ['유다서', 1]], ['rev', ['요한계시록', 22]],
]);

function jsonResult(status, payload, headers = {}) {
  return { status, body: JSON.stringify(payload), headers };
}

function errorResult(status, error, headers) {
  return jsonResult(status, { error }, headers);
}

function respond(result, allowedOrigin) {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
    ...result.headers,
  });
  if (allowedOrigin) {
    headers.set('Access-Control-Allow-Origin', allowedOrigin);
    headers.set('Access-Control-Expose-Headers', 'Retry-After');
  }
  return new Response(result.status === 204 ? null : result.body, { status: result.status, headers });
}

function normalizeVerses(payload) {
  if (!Array.isArray(payload) || payload.length === 0 || payload.length > 176) throw new TypeError('Invalid chapter');
  const verses = payload.map((item) => {
    if (!item || typeof item.verse !== 'string' || !/^[1-9]\d{0,2}(?:-[1-9]\d{0,2})?$/.test(item.verse)
      || typeof item.text !== 'string' || !item.text.trim()) throw new TypeError('Invalid verse');
    const [verse, endVerse = verse] = item.verse.split('-').map(Number);
    if (verse > 176 || endVerse < verse || endVerse > 176) throw new TypeError('Invalid range');
    return { verse, endVerse, text: item.text };
  }).sort((a, b) => a.verse - b.verse);
  for (let index = 1; index < verses.length; index += 1) {
    if (verses[index].verse <= verses[index - 1].endVerse) throw new TypeError('Overlapping range');
  }
  return verses;
}

function retryDelay(value, currentTime) {
  let seconds = value === null ? NaN : Number(value);
  if (!Number.isFinite(seconds) && value) seconds = (Date.parse(value) - currentTime) / 1000;
  return String(Number.isFinite(seconds) ? Math.max(1, Math.min(60, Math.ceil(seconds))) : 60);
}

export function createLogosProxy({ fetchImpl = fetch, now = Date.now } = {}) {
  // shortcut: cache and request limits are per isolate; use shared storage when scaling to multiple isolates.
  let state;

  async function loadChapter(book, chapter, upstreamName, currentState) {
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve(errorResult(504, 'upstream_timeout'));
      }, 15_000);
    });
    const operation = (async () => {
      try {
        const upstream = await fetchImpl(`https://logos-api.com/api/books/${encodeURIComponent(upstreamName)}/chapters/${chapter}`, {
          method: 'GET',
          headers: { Accept: 'application/json', 'X-API-KEY': currentState.apiKey },
          redirect: 'error',
          signal: controller.signal,
        });
        if (upstream.status === 429) {
          const delay = upstream.headers.get('Retry-After') ?? upstream.headers.get('X-RateLimit-Retry-After');
          return errorResult(429, 'rate_limited', { 'Retry-After': retryDelay(delay, now()) });
        }
        if (upstream.status !== 200) return errorResult(502, 'upstream_error');
        const verses = normalizeVerses(await upstream.json());
        return jsonResult(200, { book, chapter, verses, source: 'logos' });
      } catch {
        return controller.signal.aborted ? errorResult(504, 'upstream_timeout') : errorResult(502, 'upstream_error');
      }
    })();
    try {
      const result = await Promise.race([operation, timeout]);
      if (result.status === 200) {
        currentState.cache.set(`${book}:${chapter}`, { result, expiresAt: now() + CACHE_TTL });
        while (currentState.cache.size > CACHE_CAPACITY) currentState.cache.delete(currentState.cache.keys().next().value);
      }
      return result;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async fetch(request, env = {}) {
      const url = new URL(request.url);
      const allowedOrigin = env.ALLOWED_ORIGIN || DEFAULT_ORIGIN;
      const origin = request.headers.get('Origin');
      const corsOrigin = origin === allowedOrigin ? allowedOrigin : null;
      const send = (result) => respond(result, corsOrigin);
      if (url.pathname === '/health' && !url.search && request.method === 'GET') return send(jsonResult(200, { ok: true }));

      const match = /^\/v1\/books\/([a-z0-9]+)\/chapters\/([1-9]\d{0,2})$/.exec(url.pathname);
      const bookInfo = match && BOOKS.get(match[1]);
      const chapter = match ? Number(match[2]) : 0;
      if (url.search || !bookInfo || chapter > bookInfo[1]) return send(errorResult(404, 'not_found'));
      if (!corsOrigin) return send(errorResult(403, 'forbidden_origin'));
      const methodError = () => send(errorResult(405, 'method_not_allowed', { Allow: 'GET, OPTIONS' }));
      if (request.method === 'OPTIONS') {
        const method = request.headers.get('Access-Control-Request-Method');
        if (method && method !== 'GET') return methodError();
        return send({ status: 204, headers: { 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '600' } });
      }
      if (request.method !== 'GET') return methodError();
      const apiKey = env.LOGOS_API_KEY;
      if (typeof apiKey !== 'string' || !apiKey.trim()) return send(errorResult(503, 'service_unavailable'));

      const currentTime = now();
      if (!state || state.apiKey !== apiKey || state.origin !== allowedOrigin) {
        state = { apiKey, origin: allowedOrigin, cache: new Map(), pending: new Map(), count: 0, resetAt: currentTime + WINDOW_MS };
      }
      const currentState = state;
      for (const [key, cached] of currentState.cache) {
        if (cached.expiresAt <= currentTime) currentState.cache.delete(key);
      }
      const key = `${match[1]}:${chapter}`;
      const cached = currentState.cache.get(key);
      if (cached) return send(cached.result);
      let pending = currentState.pending.get(key);
      if (!pending) {
        if (currentTime >= currentState.resetAt) {
          currentState.count = 0;
          currentState.resetAt = currentTime + WINDOW_MS;
        }
        if (currentState.count >= REQUEST_LIMIT) {
          return send(errorResult(429, 'rate_limited', { 'Retry-After': retryDelay(String((currentState.resetAt - currentTime) / 1000), currentTime) }));
        }
        currentState.count += 1;
        pending = loadChapter(match[1], chapter, bookInfo[0], currentState);
        currentState.pending.set(key, pending);
      }
      try {
        return send(await pending);
      } finally {
        if (currentState.pending.get(key) === pending) currentState.pending.delete(key);
      }
    },
  };
}

export default createLogosProxy();
