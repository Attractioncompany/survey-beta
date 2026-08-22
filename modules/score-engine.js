// 설문 채점 엔진 — index.html 인라인에서 추출 (전략팀 R1, 2026-08-21)
//
// **로직을 고치지 않고 옮긴 것이다.** 추출이 목적이지 개선이 목적이 아니다.
// 옮기면서 값이 달라지면 추출인지 개악인지 가려낼 수 없다.
//
// 왜 빼는가: 같은 채점이 세 곳에서 필요해졌다 —
//   ① index.html 진단 화면  ② M2a 앱  ③ 소급 백필(과거 answers 재채점)
// 세 벌이 되면 값이 조용히 갈라진다.
//
// **순수 함수다.** 전역(GENDER·Q·MOODS)에 손대지 않고 전부 인자로 받는다.
// 그래야 브라우저 밖(node 백필)에서도 같은 코드가 돈다.

const AXMAP = {
  warm: ["romantic", "energetic", "gorgeous", "classic"],
  cool: ["pure", "elegant", "charisma", "chic"],
  soft: ["romantic", "pure", "elegant", "energetic"],
  deep: ["gorgeous", "classic", "charisma", "chic"],
};

/** 성별 분기 — index.html의 qOpts/qTxt와 같은 규칙 */
const optsOf = (q, gender) => (gender === "m" && q.optsm) ? q.optsm : q.opts;

/**
 * 원점수 — index.html scoreAll()을 그대로 옮긴 것.
 * @returns {scoreWant, scoreHave, axisWant, axisHave}
 */
export function rawScores(answers, { Q, MOODS, TKEYS, gender = "f" }) {
  const scoreWant = {}, scoreHave = {};
  TKEYS.forEach(k => { scoreWant[k] = 0; scoreHave[k] = 0; });
  const axisWant = { warm: 0, cool: 0, soft: 0, deep: 0 };
  const axisHave = { warm: 0, cool: 0 };

  Q.forEach(q => {
    if (!q.id || answers[q.id] === undefined) return;
    const tgt = q.want ? scoreWant : scoreHave;
    if (q.kind === "mood") {
      (answers[q.id] || []).forEach(i => {
        const m = (MOODS[q.set] || [])[i];
        if (m) tgt[m[0]] += 1.2;
      });
    } else {
      const opts = optsOf(q, gender);
      const sel = q.multi ? (answers[q.id] || []) : [answers[q.id]];
      sel.forEach(i => {
        const o = opts && opts[i]; if (!o) return;
        if (o.w) Object.entries(o.w).forEach(([k, v]) => { if (tgt[k] !== undefined) tgt[k] += v; });
        if (o.axis) {
          const ax = q.want ? axisWant : axisHave;
          Object.entries(o.axis).forEach(([k, v]) => { if (ax[k] !== undefined) ax[k] += v; });
        }
      });
    }
  });

  Object.entries(axisWant).forEach(([ax, v]) => { AXMAP[ax].forEach(k => scoreWant[k] += v * 0.8); });
  // B7 폐지(확정서 2026-07-22 §3): axisHave.warm/cool 소스 소멸 → 항상 0.
  // HAVE 웜쿨은 결측(미측정)이며 photo-module 드레이핑이 전담. 0을 "중립"으로 표시 금지.
  Object.entries(axisHave).forEach(([ax, v]) => { AXMAP[ax].forEach(k => scoreHave[k] += v * 0.8); });

  return { scoreWant, scoreHave, axisWant, axisHave };
}

/**
 * 천장 — 그 타입에 가장 유리하게 답했을 때의 총점. 성별마다 다르다(선택지가 다르다).
 * index.html ceilOf()를 그대로 옮긴 것. 문항이 바뀌면 천장도 따라 바뀌므로 상수로 박지 않는다.
 */
export function ceilOf(want, { Q, MOODS, TKEYS, gender = "f" }) {
  const c = {}; TKEYS.forEach(t => c[t] = 0);
  Q.forEach(q => {
    if (!!q.want !== !!want) return;
    const n = q.max || 1;
    if (q.kind === "mood") {
      const M = MOODS[q.set] || [];
      TKEYS.forEach(t => { c[t] += Math.min(M.filter(m => m[0] === t).length, n) * 1.2; });
      return;
    }
    const opts = optsOf(q, gender); if (!opts) return;
    TKEYS.forEach(t => {
      const w = opts.map(o => (o.w && o.w[t]) || 0).sort((a, b) => b - a);
      c[t] += w.slice(0, n).reduce((a, b) => a + b, 0);
    });
    TKEYS.forEach(t => {           // 축 문항이 그 타입에 얹어줄 수 있는 최대
      let best = 0;
      opts.forEach(o => {
        if (!o.axis) return;
        let v = 0;
        Object.entries(o.axis).forEach(([ax, amt]) => { if (AXMAP[ax] && AXMAP[ax].includes(t)) v += amt * 0.8; });
        if (v > best) best = v;
      });
      c[t] += best;
    });
  });
  return c;
}

/**
 * 정규화 — 원점수를 천장으로 나눠 20점 만점으로. E파트 보너스는 **나눈 뒤에** 더한다.
 * (이론팀 판정 2026-08-20: 원점수에 더하면 천장 나눗셈에서 타입마다 무게가 1.5배까지 벌어진다)
 */
export function normalize(raw, cap, bonus, TKEYS) {
  const o = {};
  TKEYS.forEach(k => { o[k] = (cap[k] ? raw[k] / cap[k] * 20 : raw[k]) + ((bonus && bonus[k]) || 0); });
  return o;
}

/** 채점 한 번에 — 화면·백필이 공통으로 부르는 입구 */
export function score(answers, ctx) {
  const { TKEYS } = ctx;
  const r = rawScores(answers, ctx);
  const want = normalize(r.scoreWant, ceilOf(true, ctx), ctx.bonusWant, TKEYS);
  const have = normalize(r.scoreHave, ceilOf(false, ctx), ctx.bonusHave, TKEYS);
  const rank = s => TKEYS.map(k => [k, s[k]]).sort((a, b) => b[1] - a[1]);
  return { raw: r, want, have, rankWant: rank(want), rankHave: rank(have) };
}

export const ENGINE_VERSION = "score_v1";
