import test from 'node:test';
import assert from 'node:assert/strict';

const chapters = [
  { chapter:1, available:true, partial:false, verses:[{verse:1,text:'첫 장의 테스트 문장'}] },
  { chapter:2, available:true, partial:false, verses:[{verse:1,text:'둘째 장의 테스트 문장'}] },
  { chapter:3, available:false, partial:false, verses:[] },
];

test('one book renders every available chapter in order with distinct verse addresses', async () => {
  const { bookChaptersMarkup } = await import('../assets/book-reader.js');
  const html = bookChaptersMarkup('gen',chapters,{chapter:2,verse:1},[]);
  assert.ok(html.indexOf('첫 장의 테스트 문장') < html.indexOf('둘째 장의 테스트 문장'));
  assert.match(html,/id="chapter-1"/);
  assert.match(html,/id="chapter-2"/);
  assert.doesNotMatch(html,/id="chapter-3"/);
  assert.match(html,/id="verse-gen-1-1"[^>]+data-chapter="1"[^>]+aria-pressed="false"/);
  assert.match(html,/id="verse-gen-2-1"[^>]+data-chapter="2"[^>]+aria-pressed="true"/);
});

test('a saved verse marks only the matching book chapter and verse and text stays escaped', async () => {
  const { bookChaptersMarkup } = await import('../assets/book-reader.js');
  const html = bookChaptersMarkup('gen',chapters,{chapter:1,verse:null},[
    {translation:'GAE',book:'gen',chapter:2,verse:1},
    {translation:'GAE',book:'exo',chapter:1,verse:1},
  ]);
  assert.match(html,/id="verse-gen-2-1" class="verse is-saved"/);
  assert.match(html,/id="verse-gen-1-1" class="verse"/);
  const escaped = bookChaptersMarkup('gen',[{...chapters[0],verses:[{verse:1,text:'<script>test</script> & "본문"'}]}],{},[]);
  assert.doesNotMatch(escaped,/<script>/);
  assert.match(escaped,/&lt;script&gt;test&lt;\/script&gt; &amp; &quot;본문&quot;/);
});

test('remote chapters keep inline loading and retry states without pretending text is available', async () => {
  const { bookChaptersMarkup } = await import('../assets/book-reader.js');
  const html = bookChaptersMarkup('gen',chapters,{chapter:1,verse:null},[],{
    remote:true,statusFor:chapter=>chapter===3?{state:'error',message:'잠시 후 다시 시도해 주세요.'}:{state:'loaded'},
  });
  assert.match(html,/id="chapter-3"/);
  assert.match(html,/잠시 후 다시 시도해 주세요\./);
  assert.match(html,/data-retry-chapter="3"/);
  const idle = bookChaptersMarkup('gen',[chapters[2]],{},[],{remote:true,statusFor:()=>({state:'idle'})});
  assert.match(idle,/data-load-chapter="3"/);
  assert.match(idle,/본문 불러오기/);
});

test('combined verse ranges remain one selectable row with a complete range label', async () => {
  const { bookChaptersMarkup } = await import('../assets/book-reader.js');
  const html=bookChaptersMarkup('gen',[{chapter:1,available:true,partial:false,verses:[{verse:1,endVerse:2,text:'합절 테스트 문장'}]}],{chapter:1,verse:2},[{translation:'GAE',book:'gen',chapter:1,verse:2}]);
  assert.match(html,/data-end-verse="2"/);
  assert.match(html,/1–2절/);
  assert.match(html,/class="verse is-saved is-current"/);
  assert.equal((html.match(/data-verse=/g)||[]).length,1);
});
