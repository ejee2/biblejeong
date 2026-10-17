# 성경 곁에서

성경의 전후 맥락을 본문 근거와 함께 살피고, 마음에 남는 구절에 표시와 개인 묵상을 남기는 반응형 웹페이지입니다. 숙제, 통독 진도, 순위, 모임 관리는 없습니다.

## 페이지와 기능

- **읽기** `/biblejeong/`: 책 단위로 등록된 모든 장의 본문을 한 영역에서 이어 읽습니다. 장은 본문 안의 소제목이며, ‘책 선택’에서 선택적으로 바로 이동할 수 있습니다. 하단에서는 이전·다음 책으로 이동합니다. 구절을 선택하면 배경과 근거를 확인하고, 의미 있는 구절은 밑줄과 옅은 배경색으로 표시할 수 있습니다.
- **마이페이지** `/biblejeong/mypage/`: 표시한 구절을 모아 보고, 각 구절에 묵상을 작성·수정하며 본문으로 돌아갑니다.

로그인과 별도 서버는 사용하지 않습니다. 표시와 묵상은 **현재 기기·브라우저의 사이트 저장소(localStorage)** 에만 남습니다. 개인 묵상은 GitHub 저장소나 서버로 전송되지 않습니다. 다른 기기와 자동 동기화되지 않으며, 브라우저의 사이트 데이터를 지우면 사라집니다. 비공개 창이나 저장 차단 환경에서는 저장이 유지되지 않을 수 있습니다.

## 성경 본문과 설명

현재 개역개정 본문은 **데살로니가전서 5:16–20의 짧은 발췌**를 제공합니다. 66권 선택과 책 단위 이어 읽기 구조는 제공하지만, 전체 본문이 수록된 서비스로 표시하지 않습니다. 미수록 책에 빈 장을 나열하지 않으며 공식 본문으로 연결합니다. 전체 본문을 공개하려면 해당 이용 권한과 제공 자료를 확보한 후 `assets/bible-data.js`를 확장해야 합니다. 권한을 확인하지 않은 본문 파일을 공개 저장소에 올리지 않습니다. 웹 성경본문 서비스는 [대한성서공회 사용허가 안내](https://www.bskorea.or.kr/bbs/board.php?bo_table=copyright_faq&wr_id=9)와 실제 계약조건을 확인해야 합니다.

책·장·절 주소는 기존 링크와 호환됩니다. 장절 링크는 해당 책을 열고 본문 안의 위치로 이동하며, 각 절의 선택·표시는 책과 장까지 구분합니다. `assets/book-reader.js`가 모든 등록된 장을 순서대로 표시하고, 미등록 설명은 다른 구절의 설명으로 대체하지 않습니다.

본문 확인: [대한성서공회 개역개정 데살로니가전서 5장](https://www.bskorea.or.kr/bible/korbibReadpage.php?book=1th&chap=5&version=GAE). 설명은 성경에 직접 기록된 내용과 장·절 근거로 제한합니다. 시기·동기·문화에 관한 추측을 사실로 소개하지 않습니다. 현재 발췌에는 이해를 위해 필요한 이미지가 없어 별도 이미지를 넣지 않았습니다. 추후 이미지를 추가할 때는 원본 출처에서 재사용 허용 범위와 표시 조건을 확인하고 함께 기록합니다.

## 로컬 실행

Node.js 22 이상이 필요합니다. 외부 패키지 설치는 필요하지 않습니다.

```sh
npm run dev
```

읽기 페이지: <http://127.0.0.1:4173/biblejeong/>

마이페이지: <http://127.0.0.1:4173/biblejeong/mypage/>

서버는 현재 컴퓨터의 `127.0.0.1`에만 연결합니다. 기본 포트는 4173이며 `PORT=4174 npm run dev`처럼 변경할 수 있습니다. 로컬에서는 `/`와 `/mypage/`도 지원합니다. 각 페이지와 자원은 상대 경로를 사용합니다.

```sh
npm test
npm run build
```

빌드는 공개용 HTML, `mypage/`, `assets/`, `robots.txt`, 선택적으로 `404.html`만 `dist/`에 복사합니다. 묵상 데이터, 개발 스크립트, 테스트, 저장소 설정은 배포 파일에 포함하지 않습니다. 빌드할 때 `dist/`만 새로 생성하며 소스 파일은 보존합니다.

## GitHub Pages 배포

배포 대상 저장소는 [ejee2/biblejeong](https://github.com/ejee2/biblejeong)입니다. 해당 저장소의 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정합니다. 이후 `main`에 반영하면 `.github/workflows/pages.yml`이 테스트, 정적 빌드, Pages 업로드와 배포를 차례로 실행합니다. 별도의 개인 액세스 토큰이나 외부 배포 서비스는 필요하지 않습니다.

배포가 완료되면 기본 공개 주소는 <https://ejee2.github.io/biblejeong/>이며 마이페이지는 <https://ejee2.github.io/biblejeong/mypage/>입니다. 이 주소의 실제 게시 여부는 저장소 Actions의 배포 결과로 확인합니다.

워크플로는 빌드 작업에 `contents: read`와 사이트 설정 조회용 `pages: read`, 배포 작업에만 `pages: write`와 `id-token: write`를 사용합니다. 원본과 묵상 내용에 HTML을 직접 삽입하지 않고 화면에 일반 텍스트로 표시해야 합니다.

배포 방식 참고: [GitHub Pages 사용자 지정 워크플로](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [공식 setup-node](https://github.com/actions/setup-node).
