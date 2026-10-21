# axxxl

TEAM AXXXL(청년 공공AX 서포터즈)이 2차 활동 「AI를 활용한 공공서비스 직접개발 계획서」를 쓰기 위해 쓰는 아이디어 발굴 웹앱.

- 팀원: 주연서(팀장), 이성준, 구민정, 김동현, 박수홍
- 일정: 10/28(수) 중간보고(선정 아이디어 제출), 11/1(일) 최종 계획서 제출. 시험기간이라 10/26~27에 집중 작업.
- 계획서 양식: `docs/AI활용_공공서비스_직접개발_계획서_양식.hwpx`

## 파일 구조

- `artifact.html` — **원본(프론트는 이 파일만 수정)**. claude.ai Artifact 형식이라 `<!doctype>/<html>/<head>/<body>` 없이 `<title>`, `<style>`, 마크업, `<script>`가 바로 이어진다. 빌드 도구 없음, 바닐라 JS 한 파일.
- `build.sh` — `artifact.html`을 감싸서 `dist/index.html`(독립 실행용)을 만든다. Pretendard 폰트 링크도 여기서만 넣는다(Artifact 쪽은 IBM Plex Sans KR로 대체).
- `worker/index.js` — Cloudflare Worker. `/api/*`는 D1 공유 저장, 나머지 경로는 `dist/` 정적 파일.
- `migrations/` — D1 스키마. 바꿀 땐 새 번호 파일을 추가하고 `npm run db:migrate`.
- `wrangler.jsonc` — Worker 설정(D1 바인딩 `DB`, `MEMBERS`). 배포 시 `sh build.sh`가 자동 실행된다.
- `docs/` — 계획서 양식.

## 화면(탭) 구성

hash 토큰: `#map`, `#spin`, `#board`, `#plan`, `#doc`

1. 분야 지도 — `DOMAINS`(12개 분야: 대상, 불편, 공공데이터, 아이디어 씨앗)와 `AIS`(AI 활용 방식 10개, 구동 방식·완료 기준 예시)
2. 아이디어 뽑기 — 분야/대상/불편/데이터/AI 5칸 슬롯. 칸 고정·직접 고르기·"선택 안 함"(`reels[k].off`, `combo()`가 null/""로 돌려줌). "AI로 구체화할 프롬프트 받기"는 앱 안에서 AI를 부르지 않고, 조합으로 프롬프트(`draftPrompt()`)를 만들어 복사하게 한다. 팀원이 ChatGPT·Claude 등에 붙여 넣고, 받은 답을 다시 붙여 넣으면 `parseDrafts()`가 JSON 배열을 찾아 카드로 보여주고 보드에 올릴 수 있다
3. 팀 보드 — 아이디어 등록·수정, 검토 5항목(대상·불편·기존 대비·AI 활용·핵심 기능), 1인 3표 투표, 실현 가능성 체크
4. 역할·일정 — `ROLES` 담당자 지정, `TIMELINE` 체크, 상단 "지금 할 일" 바(`renderNow`)
5. 계획서 정리 — 1위(또는 선택) 아이디어를 계획서 1·2·4·5번 + 실행계획 문구로 출력

## 저장 방식 (중요)

프론트는 시작할 때 저장 방식(`mode`)을 고른다. 쓰기는 모두 `B`(add/update/del/vote/plan) 객체를 거친다.

1. `claude` — `window.claude.use("db")`가 있으면 기존 Artifact 런타임 사용
   - `ideas/<autoId>`, `votes/<userId>`(사용자 ID 기준 3표), `plan/main`
2. `api` — `window.claude`가 없고 `GET /api/state`가 응답하면 Cloudflare Worker + D1 사용
   - 로그인 없이 링크만으로 사용. 투표는 상단 "나는 [이름]" 선택(`MEMBERS`) 기준 1인 3표, 이름은 localStorage `axlab.name`
   - 5초마다(탭이 보일 때만) `/api/state`를 다시 읽어 팀원 변경을 반영
3. `local` — 둘 다 안 되면 이 브라우저 메모리에만 저장(공유 안 됨)

### Worker API

| 메서드 | 경로 | 내용 |
|---|---|---|
| GET | `/api/state` | `{ideas, votes:{이름:[id…]}, plan, members}` |
| POST | `/api/ideas` | 아이디어 추가 (author는 MEMBERS 중 하나) |
| PATCH | `/api/ideas/:id` | 필드 수정, `checks`는 병합 |
| DELETE | `/api/ideas/:id` | 삭제 + 모든 투표에서 제거 |
| PUT | `/api/votes/:이름` | `{picks}` 최대 3개, 없는 id는 버림 |
| PUT | `/api/plan` | `{roles, done}` |

쓰기 요청은 같은 출처(Origin)만 받는다. D1 테이블: `ideas`, `votes`, `plan` (`ai_usage`는 예전 AI 호출 상한용으로 남아 있지만 쓰지 않음). 앱 안에서 AI API를 부르지 않으므로 API 키도 필요 없다.

## 현재 배포

- Cloudflare Worker(링크만으로 팀 공유·투표): https://axxxl.tjdwns2121.workers.dev
  - 배포: `npm run deploy` (D1 `axxxl`, APAC)
  - 로컬: `npm run db:migrate:local && npm run dev`
- claude.ai Artifact(기존 버전): https://claude.ai/artifact/FNmGFLi2zYmcL91ZiCcP7P
  - 팀원이 쓰려면 Share 메뉴에서 이메일로 Editor 초대 필요(공개 링크만으로는 읽기 전용).
  - 두 배포는 저장소가 달라서 데이터가 섞이지 않는다. 팀에는 한 링크만 안내할 것.

## 디자인 방향

범정부 UI/UX 디자인 시스템(KRDS) 톤: 네이비 상단 띠, 파랑 `--accent`(#256ef4), 흰 카드 + 12px 라운드 + 옅은 그림자, Pretendard. 팀 보드 카드는 GitLab 이슈 카드처럼 `#번호`, 분야 scoped 라벨, 검토 진행 막대.

## 작업 규칙

- UI 문구는 한국어, 해요체, 짧고 구체적으로. 조사는 `jo()`/`ro()` 헬퍼로 받침에 맞춘다.
- 색은 `:root` 토큰만 쓰고 다크 모드 블록 두 곳(`prefers-color-scheme`, `[data-theme="dark"]`)을 함께 고친다.
- 390px 폭에서 가로 스크롤이 생기면 안 된다.
- DB에서 읽은 문자열은 반드시 `esc()`를 거쳐 innerHTML에 넣는다.
