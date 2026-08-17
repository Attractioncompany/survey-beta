// 퀘스트 발행·판정 엔진
// 근거: theory/이론설계_퀘스트사전_v1_[가설]_2026-08-15.md §4(발행 규칙) · §2(완료 판정)
//       docs/superpowers/specs/2026-08-16-app-foundation-v1-design.md §4
//
// 이 파일은 사전을 인출할 뿐 걸음·상수를 만들지 않는다.
// 상수는 사전에서 온 것 하나뿐이다 — 도착 밴드 0.2 (quest-dict.json:arrival_band).

// ── 측정 결과 평탄화 ─────────────────────────────────────────
// 촬영이 내는 모양과 이론 필드명 사이의 다리는 **계약층이 소유한다**(modules/czm-core.js).
// 여기 복사본을 두면 한쪽만 고쳐져서 판정이 조용히 결측으로 흐른다 — 실제로 그렇게 샜다(오류대장 053).
export function flatten(m) {
  const core = (typeof window !== "undefined" ? window : globalThis).CZM;
  if (!core) { console.warn("계약층(czm-core.js)이 없다 — 측정 판정을 건너뛴다"); return null; }
  return core.measure.flatten(m);
}

// 사전이 지시한 조합만 계산한다. 여기서 새 지표를 만들지 않는다.
const DERIVED = {
  lip_sum:      m => nz(m.lip_upper) + nz(m.lip_lower),
  eye_openness: m => (m.eye_len ? nz(m.eye_open) / m.eye_len : null),
  // 헤어 명도는 원값을 쓰면 안 된다 — 노출 보정(L_gain)이 곱셈이라
  // 방이 밝아진 것만으로 "밝게 했다"가 된다. skinL로 나누면 게인이 소거된다(이론 C3 2026-08-17).
  hair_L_ratio: m => (m.skinL ? nz(m.hair_L) / m.skinL : null),
};
const nz = v => (typeof v === "number" ? v : NaN);

export function readField(measurement, field) {
  if (!measurement || !field) return null;
  const m = flatten(measurement);
  const v = DERIVED[field] ? DERIVED[field](m) : m[field];
  return Number.isFinite(v) ? v : null;
}

// ── 학습 짝 칸 ───────────────────────────────────────────────
// 사전 §3-8: 실행 칸마다 1:1로 붙는 짝. 여기서 14줄을 사전에 복사하면 이론 파일과 갈리므로,
// 이론팀의 퀴즈 파일을 원천으로 두고 실행 시 합친다. 문항이 늘면 코드를 안 고쳐도 칸이 는다.
export function withKnowledge(dict, quiz) {
  const items = quiz?.items ?? [];
  const cells = items.map(q => {
    const base = dict.cells.find(c => c.id === q.quest_id);
    return {
      id: `learn.${q.quest_id}`, item: base?.item ?? "unknown", kind: "knowledge",
      axis: q.axis ?? base?.axis ?? null, dir: base?.dir ?? null,
      grade: "ok", offer: true, countable: true, ready: true, cost: "free",
      quiz: { qid: q.qid, question: q.question, choices: q.choices,
              answer_index: q.answer_index, why: q.why },
      // 문구를 새로 짓지 않는다 — 이론팀 문항을 그대로 쓴다 [마케팅 검수 전]
      copy: q.question, pair_of: q.quest_id, src: "quest_quiz_v1.json",
    };
  });
  return { ...dict, cells: [...dict.cells, ...cells] };
}

// ── 발행 ─────────────────────────────────────────────────────
/**
 * @param dict  quest-dict.json
 * @param gapAxis  {T,D,(M)} = WANT − HAVE. 없는 축은 빠져 있어도 된다
 * @param opts  {excluded:[questId], hasActive:boolean}
 * @returns {status, primary_axis, gap_value, candidate_pool, offered_quests, cells}
 *          status: arrived | no_axis | busy | ok
 */
export function issueOffer(dict, gapAxis, opts = {}) {
  const excluded = new Set(opts.excluded || []);
  const rank = Object.fromEntries(dict.items.map(i => [i.key, i.rank]));

  // §4-2 동시 실행 1건 — 단 **학습 짝 칸은 병행 허용**이다.
  // 지식 스탯은 좌표 귀속과 무관하므로 실행 1건과 같이 가도 효능 증거를 오염시키지 않는다.
  const gate = c => !opts.hasActive || c.kind === "knowledge";

  // §4-2 주축 = |gap_axis| 최대. 축이 하나도 없으면 방향 없는 걸음만 낸다.
  const entries = Object.entries(gapAxis || {}).filter(([, v]) => Number.isFinite(v));
  const top = entries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];

  const byRank = (a, b) => (rank[a.item] ?? 99) - (rank[b.item] ?? 99);
  // 방향 없는 걸음(아이템 등록)은 주축과 무관하게 항상 공급된다 — 목록 크기의 하한을 만든다(§5-2)
  const dirless = dict.cells.filter(c => c.offer && c.axis === null && gate(c));

  if (!top) {
    const cells = dirless.sort(byRank);
    return pack("no_axis", null, null, cells, excluded);
  }

  const [axis, gap] = top;
  // §4-1 도착 밴드 — 걸음을 지어내지 않는다
  if (Math.abs(gap) < dict.arrival_band) {
    return { status: "arrived", primary_axis: axis, gap_value: gap,
             candidate_pool: [], offered_quests: [], cells: [] };
  }

  const dir = gap > 0 ? "+" : "-";
  // §4-3·4-4 주축을 움직이는 칸만, offer=false(⛔·⚠️X·🟡 미개방)는 건너뛴다
  const aimed = dict.cells.filter(c => c.offer && c.axis === axis && c.dir === dir && gate(c));
  const cells = [...aimed, ...dirless].sort(byRank);
  return pack(opts.hasActive ? "busy" : "ok", axis, gap, cells, excluded);
}

function pack(status, axis, gap, cells, excluded) {
  // §4-5 후보 풀 전체를 남긴다 — 스킵된 칸을 빼면 거부율의 분모가 사라진다
  const offered = cells.filter(c => !excluded.has(c.id));
  return {
    status, primary_axis: axis, gap_value: gap,
    candidate_pool: cells.map(c => c.id),
    offered_quests: offered.map(c => c.id),
    cells: offered,
  };
}

// ── 완료 판정 ────────────────────────────────────────────────
// §2-1 성공 = 처방 방향과 같은 부호로 변했다. 크기 문턱 없음 — 문턱은 상수 창작이다.
export function judgeSkill(cell, before, after) {
  if (!cell.field) return { verdict: "uncountable", reason: "완료 판정 필드 없음", sign_match: null };
  const b = readField(before, cell.field), a = readField(after, cell.field);
  if (b === null || a === null) return { verdict: "unmeasured", reason: "측정값 결측", sign_match: null };
  const delta = a - b;
  const want = cell.field_dir === "+" ? 1 : -1;
  const sign_match = Math.sign(delta) === want;   // delta 0이면 불일치 — 변하지 않은 것은 성공이 아니다
  return { verdict: sign_match ? "done" : "not_yet", field: cell.field, delta, sign_match };
}

// 아이템(§2-4)·지식(§2-5)은 앱이 관측하는 사실이라 측정이 없다.
export const judgeItem      = reg  => ({ verdict: reg && reg.slot ? "done" : "not_yet", sign_match: null });
export const judgeKnowledge = quiz => ({ verdict: quiz && quiz.correct ? "done" : "not_yet", sign_match: null });

// 스탯 반영 여부. 헤어처럼 발행은 되지만 세지 않는 칸이 있다(§3-5)
export const isCountable = cell => cell.kind === "skill" ? !!cell.countable : !!cell.countable;

// ── 자체 점검 ────────────────────────────────────────────────
export function selfCheck(dict) {
  const out = [];
  const t = (name, cond, detail = "") => out.push({ name, pass: !!cond, detail });
  const ids = r => r.offered_quests;

  const arrived = issueOffer(dict, { T: 0.1, D: -0.05 });
  t("도착 밴드 안이면 걸음을 내지 않는다", arrived.status === "arrived" && ids(arrived).length === 0, arrived.status);

  const d = issueOffer(dict, { T: 0.5, D: -0.7 });
  t("주축은 절대값 최대 축", d.primary_axis === "D", `주축=${d.primary_axis}`);
  t("방향은 gap 부호를 따른다", d.cells.every(c => c.axis === null || c.dir === "-"),
    ids(d).join(","));

  const tt = issueOffer(dict, { T: 0.5, D: -0.1 });
  t("T 주축이면 T+ 칸이 나온다", ids(tt).includes("color.T+") && ids(tt).includes("eye.T+"), ids(tt).join(","));
  t("발행 금지 칸은 목록에 없다",
    !ids(tt).includes("lip.corner") && !ids(tt).includes("color.M") && !ids(tt).includes("contour.sealed"),
    ids(tt).join(","));
  t("아이템 걸음은 주축과 무관하게 항상 있다",
    ["item.outer", "item.lip", "item.acc"].every(x => ids(tt).includes(x) && ids(d).includes(x)));
  t("목록은 서열 순", ids(tt)[0].startsWith("brow"), ids(tt).join(","));

  const m = issueOffer(dict, { M: -0.6 });
  t("M 주축이면 헤어·눈썹간격 칸이 나온다",
    ids(m).includes("hair.M-") && ids(m).includes("brow.M-"), ids(m).join(","));

  const re = issueOffer(dict, { T: 0.5 }, { excluded: ["color.T+"] });
  t("스킵해도 후보 풀에는 남는다(거부율 분모)",
    re.candidate_pool.includes("color.T+") && !ids(re).includes("color.T+"));

  const busy = issueOffer(dict, { T: 0.9 }, { hasActive: true });
  t("진행 중이면 실행 걸음을 더 내지 않는다",
    busy.status === "busy" && busy.cells.every(c => c.kind === "knowledge"),
    busy.offered_quests.join(","));
  t("진행 중이어도 학습 짝 칸은 병행된다 (지식이 있을 때)",
    !dict.cells.some(c => c.kind === "knowledge") || busy.cells.length > 0);

  const cell = dict.cells.find(c => c.id === "eye.T+");            // field_dir "+"
  t("부호가 맞으면 완료", judgeSkill(cell, { eye_angle: 1 }, { eye_angle: 2 }).verdict === "done");
  t("부호가 반대면 미완료", judgeSkill(cell, { eye_angle: 2 }, { eye_angle: 1 }).verdict === "not_yet");
  t("변화 0은 완료가 아니다", judgeSkill(cell, { eye_angle: 1 }, { eye_angle: 1 }).verdict === "not_yet");
  t("아주 작은 변화도 완료 — 크기 문턱 없음",
    judgeSkill(cell, { eye_angle: 1 }, { eye_angle: 1.0001 }).verdict === "done");
  t("파생 필드가 계산된다",
    judgeSkill(dict.cells.find(c => c.id === "lip.T-"),
      { lip_upper: 1, lip_lower: 1 }, { lip_upper: 1.2, lip_lower: 1 }).verdict === "done");
  t("필드 없는 칸은 판정하지 않는다",
    judgeSkill(dict.cells.find(c => c.id === "hair.T"), {}, {}).verdict === "uncountable");

  // 헤어 명도는 비율로 본다(이론 C3). 원값을 쓰면 조명만 밝아져도 "밝게 했다"가 된다.
  const hairCell = dict.cells.find(c => c.id === "hair.M-");   // field_dir "+" = 밝아져야 완료
  const hs = (hair, skin) => ({ color:{ hair_L:hair, skinL:skin } });
  t("헤어를 실제로 밝게 하면 완료",
    judgeSkill(hairCell, hs(20, 60), hs(24, 60)).verdict === "done");
  t("★ 방만 밝아진 것은 완료가 아니다 (노출 게인이 소거된다)",
    judgeSkill(hairCell, hs(20, 60), hs(24, 72)).verdict === "not_yet",
    "머리·피부가 같은 비율로 밝아진 경우");
  t("헤어를 어둡게 하면 M+ 쪽이 완료",
    judgeSkill(dict.cells.find(c => c.id === "hair.M+"), hs(20, 60), hs(16, 60)).verdict === "done");

  // ★ photo-module이 실제로 저장하는 형태로 판정한다.
  //   평탄한 가짜 객체로만 시험하면 단위 시험은 다 통과하는데 실물에서 전부
  //   "측정값 결측"으로 흘러간다 — 실제로 그렇게 새어나갔다(오류대장 053).
  const shot = (eye, chroma) => ({ v:2, ts:1,
    ratio:{lip_upper:1.0, lip_lower:1.0, eye_len:0.30, brow_eye_gap:0.05},
    line:{eye_angle:eye, brow_arch_deg:12, eye_open:0.25},
    color:{skinL:60, hue:50, chroma, contrast:40} });
  t("실제 저장 형태(ratio/line 중첩)로 판정된다",
    judgeSkill(dict.cells.find(c => c.id === "eye.T-"), shot(3, 18), shot(2, 18)).verdict === "done");
  t("color는 이름까지 갈아끼워야 읽힌다(chroma·hue_angle)",
    judgeSkill(dict.cells.find(c => c.id === "color.D-"), shot(3, 18), shot(3, 15)).verdict === "done");
  t("실제 형태에서 파생 필드도 읽힌다",
    readField(shot(3, 18), "eye_openness") !== null && readField(shot(3, 18), "lip_sum") === 2);

  // 사전 무결성 — 발행되는데 보여줄 문구가 없으면 화면에 빈칸이 뜬다
  const noCopy = dict.cells.filter(c => c.offer && !c.copy).map(c => c.id);
  t("발행되는 칸은 전부 문구가 있다", noCopy.length === 0, noCopy.join(","));
  const badField = dict.cells.filter(c => c.offer && c.countable && c.kind === "skill" && !c.field).map(c => c.id);
  t("세는 스킬 칸은 전부 판정 필드가 있다", badField.length === 0, badField.join(","));

  return out;
}
