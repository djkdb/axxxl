// 공공AX 아이디어 랩 — Cloudflare Worker
// /api/* 는 D1 공유 저장 + AI 구체화, 나머지는 dist/ 정적 파일(ASSETS).
import Anthropic from "@anthropic-ai/sdk";

const MAX_IDEAS = 200;
const MAX_BODY = 32 * 1024;
const DOMAIN_IDS = ["welfare","health","traffic","safety","env","youth","edu","admin","culture","life","pet","house"];
const CHECK_KEYS = ["data", "ai", "scope"];
const ROLE_KEYS = ["pm", "user", "case", "func", "ai", "data", "ui", "tech", "risk", "doc", "present"];
const MODEL = "claude-opus-5-5";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const fail = (code, status = 400) => json({ error: code }, status);

const members = env => String(env.MEMBERS || "").split(",").map(s => s.trim()).filter(Boolean);
const str = (v, max) => String(v ?? "").trim().slice(0, max);
const parse = (s, d) => { try { return s == null ? d : JSON.parse(s); } catch { return d; } };

async function body(req) {
  const len = +req.headers.get("content-length") || 0;
  if (len > MAX_BODY) throw new HttpError("too_large", 413);
  const text = await req.text();
  if (text.length > MAX_BODY) throw new HttpError("too_large", 413);
  try { return JSON.parse(text || "{}"); } catch { throw new HttpError("bad_json"); }
}
class HttpError extends Error { constructor(code, status = 400) { super(code); this.code = code; this.status = status; } }

/* ideas */
function ideaFields(b, partial) {
  const out = {};
  const put = (k, col, max) => { if (!partial || k in b) out[col] = str(b[k], max); };
  put("author", "author", 20); put("title", "title", 60); put("who", "who", 80); put("desc", "descr", 400);
  put("better", "better", 300); put("ai", "ai", 30); put("aiHow", "ai_how", 160); put("type", "type", 20); put("data", "data", 120);
  if (!partial || "core" in b) out.core = JSON.stringify((Array.isArray(b.core) ? b.core : []).map(x => str(x, 120)).filter(Boolean).slice(0, 6));
  if (!partial || "domain" in b) out.domain = DOMAIN_IDS.includes(b.domain) ? b.domain : "welfare";
  return out;
}
function rowToIdea(r) {
  return {
    id: r.id, author: r.author, title: r.title, who: r.who, desc: r.descr, better: r.better, ai: r.ai, aiHow: r.ai_how,
    core: parse(r.core, []), domain: r.domain, type: r.type, data: r.data, checks: parse(r.checks, {}),
    draft: parse(r.draft, undefined), createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

async function getState(env) {
  const [ideas, votes, plan] = await env.DB.batch([
    env.DB.prepare("SELECT * FROM ideas ORDER BY created_at"),
    env.DB.prepare("SELECT member, picks FROM votes"),
    env.DB.prepare("SELECT roles, done FROM plan WHERE id='main'"),
  ]);
  const v = {};
  for (const r of votes.results) v[r.member] = parse(r.picks, []);
  const p = plan.results[0];
  return {
    ideas: ideas.results.map(rowToIdea),
    votes: v,
    plan: p ? { roles: parse(p.roles, {}), done: parse(p.done, {}) } : null,
    members: members(env),
    ai: !!env.ANTHROPIC_API_KEY,
  };
}

async function addIdea(env, b) {
  const f = ideaFields(b, false);
  if (!members(env).includes(f.author)) throw new HttpError("bad_author");
  if (!f.title || !f.who || !f.descr) throw new HttpError("missing_fields");
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM ideas").first();
  if (n >= MAX_IDEAS) throw new HttpError("quota_exceeded", 409);
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const now = Date.now();
  const draft = b.draft && typeof b.draft === "object" ? JSON.stringify(b.draft).slice(0, 8000) : null;
  await env.DB.prepare(`INSERT INTO ideas (id,author,title,who,descr,better,ai,ai_how,core,domain,type,data,checks,draft,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'{}',?,?,?)`)
    .bind(id, f.author, f.title, f.who, f.descr, f.better, f.ai, f.ai_how, f.core, f.domain, f.type, f.data, draft, now, now).run();
  return { id };
}

async function updateIdea(env, id, b) {
  const row = await env.DB.prepare("SELECT checks FROM ideas WHERE id=?").bind(id).first();
  if (!row) throw new HttpError("not_found", 404);
  const f = ideaFields(b, true);
  if ("author" in f && !members(env).includes(f.author)) throw new HttpError("bad_author");
  for (const k of ["title", "who", "descr"]) if (k in f && !f[k]) throw new HttpError("missing_fields");
  if (b.checks && typeof b.checks === "object") {
    const c = parse(row.checks, {});
    for (const k of CHECK_KEYS) if (k in b.checks) c[k] = !!b.checks[k];
    f.checks = JSON.stringify(c);
  }
  const cols = Object.keys(f);
  if (!cols.length) return { ok: true };
  await env.DB.prepare(`UPDATE ideas SET ${cols.map(c => c + "=?").join(",")}, updated_at=? WHERE id=?`)
    .bind(...cols.map(c => f[c]), Date.now(), id).run();
  return { ok: true };
}

async function deleteIdea(env, id) {
  const votes = await env.DB.prepare("SELECT member, picks FROM votes").all();
  const stmts = [env.DB.prepare("DELETE FROM ideas WHERE id=?").bind(id)];
  for (const r of votes.results) {
    const p = parse(r.picks, []);
    if (p.includes(id)) stmts.push(env.DB.prepare("UPDATE votes SET picks=? WHERE member=?").bind(JSON.stringify(p.filter(x => x !== id)), r.member));
  }
  await env.DB.batch(stmts);
  return { ok: true };
}

/* votes / plan */
async function setVotes(env, member, b) {
  if (!members(env).includes(member)) throw new HttpError("bad_member");
  let picks = [...new Set((Array.isArray(b.picks) ? b.picks : []).map(String))];
  if (picks.length > 3) throw new HttpError("too_many_votes");
  if (picks.length) {
    const rows = await env.DB.prepare(`SELECT id FROM ideas WHERE id IN (${picks.map(() => "?").join(",")})`).bind(...picks).all();
    const ok = new Set(rows.results.map(r => r.id));
    picks = picks.filter(x => ok.has(x));
  }
  await env.DB.prepare("INSERT INTO votes (member,picks,at) VALUES (?,?,?) ON CONFLICT(member) DO UPDATE SET picks=excluded.picks, at=excluded.at")
    .bind(member, JSON.stringify(picks), Date.now()).run();
  return { picks };
}

async function setPlan(env, b) {
  const ms = members(env);
  const roles = {};
  for (const k of ROLE_KEYS) { const m = b.roles?.[k]; if (m && ms.includes(m)) roles[k] = m; }
  const done = {};
  for (let i = 0; i < 16; i++) if (b.done?.["i" + i]) done["i" + i] = true;
  await env.DB.prepare("INSERT INTO plan (id,roles,done,at) VALUES ('main',?,?,?) ON CONFLICT(id) DO UPDATE SET roles=excluded.roles, done=excluded.done, at=excluded.at")
    .bind(JSON.stringify(roles), JSON.stringify(done), Date.now()).run();
  return { ok: true };
}

/* AI 구체화 — 프롬프트는 서버에서 조립해서, 이 엔드포인트가 범용 프록시로 쓰이지 않게 한다 */
const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ideas"],
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name","oneLine","target","problem","type","existing","better","aiRole","data","must","optional","flow","risk"],
        properties: {
          name: { type: "string" }, oneLine: { type: "string" }, target: { type: "string" }, problem: { type: "string" },
          type: { type: "string", enum: ["기존 공공서비스 개선", "신규 공공서비스 개발"] },
          existing: { type: "string" }, better: { type: "string" }, aiRole: { type: "string" }, data: { type: "string" },
          must: { type: "array", items: { type: "string" } }, optional: { type: "array", items: { type: "string" } },
          flow: { type: "array", items: { type: "string" } }, risk: { type: "string" },
        },
      },
    },
  },
};

function draftPrompt(b) {
  const s = k => str(b[k], 120);
  return `당신은 대학생 팀의 공공서비스 기획을 돕는 멘토입니다.
아래 조합으로 "AI를 활용한 공공서비스" 아이디어 3개를 한국어로 제안하세요. 세 아이디어는 접근 방식이 서로 달라야 합니다.

- 분야: ${s("domain")}
- 대상: ${s("target")}
- 불편 상황: ${s("sit")} 생기는 불편
- 활용 데이터 후보: ${s("data")} (${s("dataOrg")}) — 필요하면 같은 분야의 다른 공공데이터(${str(b.otherData, 300)})도 사용 가능
- AI 기능: ${s("ai")} (${s("aiHow")})

제약:
- 개발 경험이 다양한 대학생 5명 팀이 약 3~4주 안에 웹서비스로 실제 구현해 공공 GitLab에 올릴 수 있는 범위
- 공공데이터포털 등에서 무료로 받을 수 있는 데이터 위주, 개인정보 수집은 최소화
- 필수 기능(must) 2~3개는 "입력→처리→출력" 한 줄씩, 선택 기능(optional) 1~2개, 이용 흐름(flow)은 ①②③ 단계
- 기존 공공서비스 개선이면 무엇을 어떻게 개선하는지 분명히
- existing에는 비교 대상 기존 공공서비스와 그 한계, risk에는 구현 시 주의할 점 한 문장`;
}

async function draft(env, b) {
  if (!env.ANTHROPIC_API_KEY) throw new HttpError("ai_off", 503);
  const cap = +env.AI_DAILY_LIMIT || 60;
  const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // KST 기준
  const used = await env.DB.prepare("INSERT INTO ai_usage (day,n) VALUES (?,1) ON CONFLICT(day) DO UPDATE SET n=n+1 RETURNING n").bind(day).first();
  if (used.n > cap) throw new HttpError("rate_limited", 429);

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  let res;
  try {
    res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: DRAFT_SCHEMA } },
      messages: [{ role: "user", content: draftPrompt(b) }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new HttpError("rate_limited", 429);
    if (e instanceof Anthropic.APIError) { console.error("anthropic", e.status, e.message); throw new HttpError("ai_error", 502); }
    throw e;
  }
  if (res.stop_reason === "refusal") throw new HttpError("ai_refused", 422);
  const text = res.content.filter(c => c.type === "text").map(c => c.text).join("");
  const out = parse(text, null);
  const ideas = (out?.ideas || []).filter(x => x && x.name).slice(0, 3);
  if (!ideas.length) throw new HttpError("invalid_json", 502);
  return { ideas };
}

/* router */
async function api(req, env, path) {
  const m = req.method;
  if (path === "/api/state" && m === "GET") return getState(env);
  if (path === "/api/ideas" && m === "POST") return addIdea(env, await body(req));
  let r = path.match(/^\/api\/ideas\/([\w-]{1,40})$/);
  if (r && m === "PATCH") return updateIdea(env, r[1], await body(req));
  if (r && m === "DELETE") return deleteIdea(env, r[1]);
  r = path.match(/^\/api\/votes\/(.{1,40})$/);
  if (r && m === "PUT") return setVotes(env, decodeURIComponent(r[1]), await body(req));
  if (path === "/api/plan" && m === "PUT") return setPlan(env, await body(req));
  if (path === "/api/draft" && m === "POST") return draft(env, await body(req));
  throw new HttpError("not_found", 404);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    // 쓰기 요청은 같은 출처에서만 받는다
    if (req.method !== "GET") {
      const origin = req.headers.get("origin");
      if (origin && origin !== url.origin) return fail("bad_origin", 403);
    }
    try {
      return json(await api(req, env, url.pathname));
    } catch (e) {
      if (e instanceof HttpError) return fail(e.code, e.status);
      console.error(e);
      return fail("server_error", 500);
    }
  },
};
