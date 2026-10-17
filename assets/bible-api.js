import { getChapter, normalizeLocation, registerChapter } from './bible-data.js';

const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));

export function createBibleLoader({baseUrl,onChange=()=>{},fetchImpl=fetch,now=Date.now,sleepImpl=delay,timeoutMs=15000}={}) {
  let endpoint;
  try {
    endpoint=new URL(baseUrl);
    if (!['https:','http:'].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new TypeError();
  } catch { throw new TypeError('성경 본문 중계 서버 주소가 설정되지 않았거나 올바르지 않습니다.'); }
  const base=endpoint.href.replace(/\/+$/,'');
  const records=new Map(),queue=[];
  let draining=false,lastStarted=-Infinity;
  const key=(book,chapter)=>`${book}:${chapter}`;
  const notify=(book,chapter)=>{try{onChange(book,chapter);}catch{/* A view update cannot invalidate a received chapter. */}};
  function status(book,chapter) {
    normalizeLocation({book,chapter});
    const record=records.get(key(book,chapter));
    if(record)return {...record.status};
    return {state:getChapter(book,chapter).source==='logos'?'loaded':'idle'};
  }
  function setStatus(item,value) {item.status=value;notify(item.book,item.chapter);}
  async function request(item) {
    const controller=new AbortController();
    let timeout;
    try {
      const expired=new Promise((_,reject)=>{timeout=setTimeout(()=>{
        reject(new Error('본문을 불러오는 시간이 초과되었습니다. 다시 시도해 주세요.'));controller.abort();
      },timeoutMs);});
      const body=await Promise.race([(async()=>{
        const result=await fetchImpl(`${base}/v1/books/${item.book}/chapters/${item.chapter}`,{signal:controller.signal,headers:{Accept:'application/json'},credentials:'omit'});
        if(result.status===429) {
          const raw=Number(result.headers.get('Retry-After'));
          const error=new Error('요청이 잠시 많습니다. 잠시 후 다시 시도해 주세요.');
          error.retryAfter=Number.isFinite(raw)&&raw>0?Math.min(60,Math.ceil(raw)):1;
          throw error;
        }
        if(!result.ok)throw new Error('본문을 불러오지 못했습니다. 다시 시도해 주세요.');
        return result.json();
      })(),expired]);
      if(!body || body.book!==item.book || body.chapter!==item.chapter || body.source!=='logos')throw new TypeError('요청한 장과 응답한 본문의 정보가 다릅니다. 다시 시도해 주세요.');
      const chapter=registerChapter(item.book,item.chapter,body.verses);
      setStatus(item,{state:'loaded'});item.resolve(chapter);
    } catch(cause) {
      const error=/[가-힣]/.test(cause?.message||'')?cause:new Error('본문 연결을 확인하지 못했습니다. 다시 시도해 주세요.',{cause});
      setStatus(item,{state:'error',message:error.message,...(error.retryAfter?{retryAfter:error.retryAfter}:{})});
      item.reject(error);
    } finally {clearTimeout(timeout);}
  }
  async function drain() {
    if(draining)return;
    draining=true;
    try {
      while(queue.length) {
        const item=queue[0];
        const wait=Math.max(0,1100-(now()-lastStarted));
        if(wait)await sleepImpl(wait);
        if(queue[0]!==item)continue;
        queue.shift();lastStarted=now();
        await request(item);
      }
    } finally {draining=false;}
  }
  function load(book,chapter) {
    normalizeLocation({book,chapter});
    const id=key(book,chapter),existing=records.get(id);
    if(existing?.status.state==='loading')return existing.promise;
    if(getChapter(book,chapter).source==='logos')return Promise.resolve(getChapter(book,chapter));
    const item={book,chapter,status:{state:'loading'}};
    item.promise=new Promise((resolve,reject)=>{item.resolve=resolve;item.reject=reject;});
    records.set(id,item);queue.push(item);notify(book,chapter);void drain();
    return item.promise;
  }
  function cancelPending() {
    for(const item of queue.splice(0)) {
      setStatus(item,{state:'idle'});
      item.reject(new DOMException('대기 중인 본문 요청을 취소했습니다.','AbortError'));
    }
  }
  return {load,status,cancelPending};
}
