# 책 단위 이어 읽기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task.

**Goal:** 장마다 페이지를 나누지 않고 선택한 책의 등록된 본문 전체를 순서대로 스크롤하며 읽는다.

**Architecture:** 기존 정적 ES 모듈과 66권 메타데이터를 재사용한다. 책의 장들을 한 읽기 영역에 렌더링하고, 장·절 주소는 선택 및 스크롤 위치로 사용한다. 공개 사용허락 및 제공 자료가 없는 개역개정 전문은 내려받거나 게시하지 않는다.

**Tech Stack:** HTML/CSS/browser ES modules, Node.js 22 builtin tests, GitHub Pages.

**Spec:** 사용자의 2026-10-17 추가 요청(책 전체 스크롤 / 구약·신약 연결) 및 docs/product-spec.md. 사용자는 전문 이용허락 미확보 상태이며 확보 방법 안내를 요청했다.

## Global Constraints
- 기존 구절 표시·개인 묵상과 저장 키를 보존한다.
- 개역개정을 다른 번역으로 임의 변경하지 않는다.
- 현재 본문 수록 범위와 미수록 상태를 정확히 표시한다.
- 장 구분은 책 안의 소제목이며 장마다 별도 읽기 페이지로 나누지 않는다.

## Review Focus
- 서로 다른 장의 같은 절 번호가 선택·저장·복귀에서 충돌하지 않아야 한다.
- 기존 장절 링크와 마이페이지 복귀가 같은 책 안의 해당 위치로 이동해야 한다.
- 책을 바꿀 때 이전 책의 스크롤 위치를 재사용하지 않아야 한다.
- 미수록 책에 수십 개의 가짜 본문이나 빈 장 화면을 나열하지 않는다.
- 모바일 배경창을 닫으면 선택 장절과 원래 읽기 위치를 유지한다.

## Tasks
- [ ] 데이터/탐색: getBookChapters(book), adjacentBook(location,direction), verseElementId(location) 동작 테스트를 먼저 실패시킨 뒤 구현한다. 66권 장 순서, 반환값 격리, 같은 절 번호의 장 구분, 정경 경계 검증.
- [ ] 읽기 UI: 책 제목, 등록된 장들의 연속 본문, 장 소제목, 선택적 장 바로가기, 이전·다음 책. 각 절에 data-chapter와 유일한 ID를 연결한다. 기존 장절 URL을 유지한다.
- [ ] 검증: 전체 Node 테스트와 빌드, PC/모바일 실제 브라우저에서 장절 선택·저장·묵상·복귀 확인. 다중 장은 저작권 본문을 추가하지 않는 테스트 fixture로 검증한다.
- [ ] 문서/게시: 수록 제한을 갱신하고 이용허락 문의 초안을 outputs에 제공한다. GitHub 게시 후 Actions와 실제 페이지 변경을 확인한다.
