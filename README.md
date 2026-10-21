# 공공AX 아이디어 랩 · TEAM AXXXL

청년 공공AX 서포터즈 2차 활동(AI를 활용한 공공서비스 개발계획 수립)용 팀 아이디어 웹앱이에요.

분야 지도 → 아이디어 뽑기 → 팀 보드(투표) → 역할·일정 → 계획서 문구 정리

| 일정 | 할 일 |
|---|---|
| ~10/25(일) | 각자 아이디어 1개 이상 올리기 |
| 10/26(월)~27(화) | 집중 작업: 투표, 아이디어 확정, 중간보고 자료 |
| 10/28(수) | 중간보고 · 선정 아이디어 제출 |
| 11/1(일) | 최종 계획서 제출 |

## 실행

- 팀 링크: https://axxxl.tjdwns2121.workers.dev (로그인 없이 이름만 고르면 돼요)

```sh
npm install
npm run db:migrate:local && npm run dev   # 로컬 Worker + D1
npm run deploy                            # Cloudflare에 배포 (build.sh 자동 실행)
```

원본은 `artifact.html` 하나예요. claude.ai Artifact에서 열면 Artifact 저장소를, Worker 링크로 열면 D1을 써요. 자세한 내용은 `CLAUDE.md`를 보세요.
