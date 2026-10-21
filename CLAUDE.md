# axxxl

TEAM AXXXL(청년 공공AX 서포터즈)이 2차 활동 「AI를 활용한 공공서비스 직접개발 계획서」를 쓰기 위해 쓰는 아이디어 발굴 웹앱.

- 팀원: 주연서(팀장), 이성준, 구민정, 김동현, 박수홍
- 일정: 10/28(수) 중간보고(선정 아이디어 제출), 11/1(일) 최종 계획서 제출. 시험기간이라 10/26~27에 집중 작업.
- 계획서 양식: `docs/AI활용_공공서비스_직접개발_계획서_양식.hwpx`

## 파일 구조

- `artifact.html` — **원본(이 파일만 수정)**. claude.ai Artifact 형식이라 `<!doctype>/<html>/<head>/<body>` 없이 `<title>`, `<style>`, 마크업, `<script>`가 바로 이어진다. 빌드 도구 없음, 바닐라 JS 한 파일.
- `build.sh` — `artifact.html`을 감싸서 `dist/index.html`(독립 실행용)을 만든다. Cloudflare Pages: 빌드 명령 `sh build.sh`, 출력 폴더 `dist`.
- `docs/` — 계획서 양식.

## 화면(탭) 구성

hash 토큰: `#map`, `#spin`, `#board`, `#plan`, `#doc`

1. 분야 지도 — `DOMAINS`(12개 분야: 대상, 불편, 공공데이터, 아이디어 씨앗)와 `AIS`(AI 활용 방식 8개, 구동 방식·완료 기준 예시)
2. 아이디어 뽑기 — 분야/대상/불편/데이터/AI 5칸 슬롯. 칸 고정·직접 고르기. "AI로 구체화"는 `sample` 기능으로 아이디어 3개를 JSON으로 받음
3. 팀 보드 — 아이디어 등록·수정, 검토 5항목(대상·불편·기존 대비·AI 활용·핵심 기능), 1인 3표 투표, 실현 가능성 체크
4. 역할·일정 — `ROLES` 담당자 지정, `TIMELINE` 체크, 상단 "지금 할 일" 바(`renderNow`)
5. 계획서 정리 — 1위(또는 선택) 아이디어를 계획서 1·2·4·5번 + 실행계획 문구로 출력

## 런타임 의존성 (중요)

공유 저장은 claude.ai Artifact 런타임의 `window.claude.use(...)`에 기대고 있다.

- `db` — 공유 문서 DB
  - `ideas/<autoId>`: `{author, title, who, desc, better, ai, aiHow, core[], domain, type, data, createdAt, authorId, checks:{data,ai,scope}, draft?}`
  - `votes/<userId>`: `{picks:[ideaId…최대3], at}` — 규칙: `votes` read view / write owner, `votes/{self}` write interact
  - `plan/main`: `{roles:{case,func,data,ui,doc}, done:{i0..i7}, at}`
- `user` — `id()`, `isOwner()`, `can("data.write")`
- `sample` — AI 구체화 버튼 (보는 사람 본인의 Claude 사용량 사용)

`window.claude`가 없으면(= `dist/index.html`을 Cloudflare 등에 올려서 열면) **localMode**로 돌아간다: 아이디어·투표가 그 브라우저 메모리에만 있고 팀원과 공유되지 않으며, AI 구체화도 꺼진다. 독립 배포에서도 팀 공유가 필요하면 `init` 블록과 `db.collection/doc` 호출부를 Supabase나 Cloudflare D1/KV + Worker로 옮겨야 한다. AI 구체화는 서버 쪽(Worker)에서 API 키를 숨긴 채 호출할 것. 키를 프론트엔드 코드에 넣지 말 것.

## 현재 배포

- claude.ai Artifact(팀 공유·투표가 실제로 동작하는 버전): https://claude.ai/artifact/FNmGFLi2zYmcL91ZiCcP7P
  - 팀원이 쓰려면 Share 메뉴에서 이메일로 Editor 초대 필요(공개 링크만으로는 읽기 전용).
  - `artifact.html`을 수정한 뒤 이 Artifact에 다시 게시하면 같은 링크에 반영된다.

## 작업 규칙

- UI 문구는 한국어, 해요체, 짧고 구체적으로. 조사는 `jo()`/`ro()` 헬퍼로 받침에 맞춘다.
- 색은 `:root` 토큰만 쓰고 다크 모드 블록 두 곳(`prefers-color-scheme`, `[data-theme="dark"]`)을 함께 고친다.
- 390px 폭에서 가로 스크롤이 생기면 안 된다.
- DB에서 읽은 문자열은 반드시 `esc()`를 거쳐 innerHTML에 넣는다.
