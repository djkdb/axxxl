-- 공공AX 아이디어 랩 공유 저장소 (Cloudflare D1)
CREATE TABLE IF NOT EXISTS ideas (
  id          TEXT PRIMARY KEY,
  author      TEXT NOT NULL,
  title       TEXT NOT NULL,
  who         TEXT NOT NULL DEFAULT '',
  descr       TEXT NOT NULL DEFAULT '',
  better      TEXT NOT NULL DEFAULT '',
  ai          TEXT NOT NULL DEFAULT '',
  ai_how      TEXT NOT NULL DEFAULT '',
  core        TEXT NOT NULL DEFAULT '[]',  -- JSON 배열
  domain      TEXT NOT NULL DEFAULT 'welfare',
  type        TEXT NOT NULL DEFAULT '',
  data        TEXT NOT NULL DEFAULT '',
  checks      TEXT NOT NULL DEFAULT '{}',  -- JSON {data,ai,scope}
  draft       TEXT,                        -- AI 구체화 원본 JSON
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

-- 투표: 이름(MEMBERS) 하나당 한 행, 최대 3표
CREATE TABLE IF NOT EXISTS votes (
  member  TEXT PRIMARY KEY,
  picks   TEXT NOT NULL DEFAULT '[]',
  at      INTEGER NOT NULL
);

-- 역할·일정: id='main' 한 행
CREATE TABLE IF NOT EXISTS plan (
  id     TEXT PRIMARY KEY,
  roles  TEXT NOT NULL DEFAULT '{}',
  done   TEXT NOT NULL DEFAULT '{}',
  at     INTEGER NOT NULL
);

-- AI 구체화 하루 호출 수 (링크만 있으면 누구나 쓸 수 있어서 상한을 둔다)
CREATE TABLE IF NOT EXISTS ai_usage (
  day  TEXT PRIMARY KEY,
  n    INTEGER NOT NULL DEFAULT 0
);
