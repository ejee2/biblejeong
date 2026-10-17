# 성경 곁에서 Implementation Plan

> For agentic workers: implement assigned tasks in this session, using explicit file ownership and review before publication.

**Goal:** 승인된 Figma의 반응형 읽기·마이페이지를 구현하고, 구절별 묵상을 브라우저에 저장하며 사용자 지정 GitHub 저장소와 Pages에 게시한다.

**Architecture:** 의존성 없는 두 HTML 페이지와 공유 CSS·브라우저 ES modules. 성경 콘텐츠와 저장 계층을 UI에서 분리한다. GitHub Actions는 검증 후 정적 dist를 Pages로 배포한다.

**Tech Stack:** HTML, CSS, JavaScript ES modules, Node built-in tests/build, GitHub Pages.

**Spec:** docs/product-spec.md 및 기존 승인 기획서 v1.1, Figma hQbl6jr9r5yA4BsZj81jpV 4:354/24:987. 새 요구는 마이페이지의 구절별 묵상과 별도 페이지 URL이다.

## Global Constraints

- PC 외곽 48px, 본문 시작 72px, 오른쪽 도움 416px. 모바일은 도움 전체화면.
- 개역개정만 사용. 게시 권리 확인 전 검증된 5:16–20 발췌만 내장, 나머지는 공식 본문 링크와 정확한 미등록 안내.
- 선택은 설명만 열고, 개인 표시는 밑줄·세이지 배경. 초기 가짜 저장 데이터 없음.
- 묵상 plain text 최대 10000자. 명시적 저장·취소, 실패 시 초안 유지, 작성 글을 GitHub·서버로 보내지 않음.
- 페이지는 루트 읽기 /biblejeong/와 /biblejeong/mypage/. 새로고침·직접 링크·하위경로 동작.
- 로그인·진도·그룹·태그·추적 기능 없음.

## Review Focus

1. 저장 차단·손상·quota 실패에서 기존 값이나 초안이 사라지지 않는가.
2. 묵상이 있는 구절을 해제하거나 페이지를 벗어날 때 의도하지 않은 손실이 없는가.
3. 사용자 작성 글이 HTML로 실행되지 않는가.
4. GitHub 프로젝트 하위경로에서 자원·페이지·구절 링크가 깨지지 않는가.
5. 320px·키보드·모바일 도움 복귀에서 핵심 조작이 가능한가.

## Task 1 — 데이터와 저장 연결 (연결 개발자)

Files: assets/bible-data.js, assets/store.js, tests/data.test.js, tests/store.test.js.

- [ ] 먼저 구절 중복 방지·새로고침 유지·묵상 저장/수정/삭제·해제/복원·저장 실패·손상·장절 검증 테스트를 쓰고 실패를 확인.
- [ ] createVerseStore(storage), getChapter/getVerse/getContext, BOOKS, parseReadingLocation/readingUrl API 구현.
- [ ] Node --test로 검증하고 UI 리드에게 계약·오류 코드를 전달.

## Task 2 — 화면과 페이지 (메인 리드)

Files: index.html, mypage/index.html, assets/app.js, assets/app.css.

- [ ] Figma context와 렌더를 읽고 핵심 사용자 흐름의 브라우저 검증 스크립트를 먼저 준비.
- [ ] PC/모바일 연속 본문·선택별 도움·공식 근거·성경/장 선택·설정과 본문 복귀 구현.
- [ ] 마이페이지 정렬·책 필터·구절별 묵상 편집·취소·실패 유지·해제 확인·되돌리기 구현.
- [ ] 실제 브라우저에서 작성·수정·재접속·XSS·페이지 복귀·모바일을 확인하고 화면과 비교.

## Task 3 — 빌드·배포 (배포 개발자)

Files: package.json, scripts/build.mjs, scripts/serve.mjs, .github/workflows/pages.yml, .gitignore, README.md.

- [ ] 정적 dist 구성 및 프로젝트 하위경로를 로컬 서버에서 검증.
- [ ] Node 테스트·build·최소 권한 Pages workflow 연결.
- [ ] 통합 검증 후 리드가 커밋·push. 배포 권한과 실행 결과를 확인하고 실제 URL로 검증.

## Task 4 — 묵상 기획·Figma 및 전체 검토

Files: docs/product-spec.md 및 별도 outputs 기획서·Figma ledger.

- [ ] 디자이너가 묵상 읽기·작성·저장·오류와 데이터 손실 규칙을 기획·Figma에 반영.
- [ ] 구현 코드와 승인 범위를 교차 검토, 실제 결함 수정 후 필요한 검증만 재실행.
- [ ] 공개 코드·실행 URL·본문 제공 범위·브라우저 저장의 한계를 사용자에게 전달.
