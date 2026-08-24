/* 스탯 산식 정본 — theory/산식_RPG스탯성장_v1_2026-08-24.md 의 구현체.
 *
 * ★ 표시 층 전용이다(§2-1). 정수 스탯은 화면에만 쓰고,
 *   판정·좌표·저장은 계속 normed 실수값으로 한다. 이 경계가 깨지면
 *   라운딩·바닥값이 아핀 변환으로 작동해 좌표가 중심으로 수축한다.
 *
 * czm-core.js와 같은 방식으로 얹는다 — ESM이 아니라 일반 스크립트다.
 * (index.html이 일반 스크립트라 import를 못 쓴다. 경주 조건 재발 방지.)
 */
(function (root) {
  "use strict";

  var TKEYS = (root.CZM && root.CZM.TYPE_KEYS) ||
              ["romantic", "pure", "elegant", "energetic", "gorgeous", "classic", "charisma", "chic"];

  var TOTAL = 30;                       // 대표 지정
  var FLOOR = 1;                        // [가설] 0점 판정을 만들지 않는 최소값 §2-3
  var POOL  = TOTAL - FLOOR * TKEYS.length;   // 22

  // 사다리(약0.2/중0.4/강0.6) × SCALE(×5). 신규 상수 아님 — 기존 확정의 표기 배율.
  var RUNG = { observed: 1, verified: 2, arrival: 3 };   // §3-2 근거 강도 A/B/C

  // 착장 슬롯 9종 — 산식 §4-3 확정 = 판정 ④ 정정본(2026-08-24, 7종 판정은 철회됨).
  // 슬롯당 착용 1개. 감쇠가 없어 슬롯별 argmax가 근사가 아니라 정확해가 된다(§6-1).
  var SLOTS = ["hair", "makeup_base", "lip", "top", "bottom", "outer", "shoes", "bag", "accessory"];

  function sum(o) { var t = 0; for (var k in o) t += o[k]; return t; }

  /* ── §2-2 초기 스탯 — normed 8값 → 정수 8값, 합은 항상 30 ───────────
     최저 기준화 → 비례 배분(POOL 22) → 바닥 1 → 최대잉여법(Hamilton).
     입력은 normed(scoreHave) 또는 normed(scoreWant) 중 하나다. */
  function initialStats(normed) {
    var pos = TKEYS.map(function (k) { return Math.max(0, (normed && normed[k]) || 0); });
    var lo  = Math.min.apply(null, pos);
    var v   = pos.map(function (x) { return x - lo; });            // 1) 최저 기준화
    var sv  = v.reduce(function (a, b) { return a + b; }, 0);
    var raw = v.map(function (x) {                                 // 2) 비례 배분
      return sv > 0 ? x / sv * POOL : POOL / TKEYS.length;         //    전원 동일 → 균등
    });
    var stat = raw.map(function (x) { return FLOOR + Math.floor(x); });   // 3) 내림 + 바닥
    var rest = TOTAL - stat.reduce(function (a, b) { return a + b; }, 0); // 4) 잔여
    var order = TKEYS.map(function (_, i) { return i; }).sort(function (a, b) {
      return (raw[b] - Math.floor(raw[b])) - (raw[a] - Math.floor(raw[a]))   // 소수부 큰 순
          || pos[b] - pos[a]                                                 // → normed 큰 순
          || a - b;                                                          // → TKEYS 선언 순
    });
    for (var i = 0; i < rest; i++) stat[order[i]] += 1;
    var out = {};
    TKEYS.forEach(function (k, i) { out[k] = stat[i]; });
    return out;
  }

  /* ── §3-3 성장 반영 — 영구 가산은 감소 없음·상한 없음 ─────────────── */
  function applyGains(base, gains) {
    var out = {};
    TKEYS.forEach(function (k) { out[k] = ((base && base[k]) || 0) + ((gains && gains[k]) || 0); });
    return out;
  }

  /* ── §4-4 착용 효과 — 슬롯당 1개, 감쇠 없는 단순 합산 ──────────────
     equipped: {slot: {tag_type, tag_power}}. 태그 없는 아이템은 효과 0이 정상이다. */
  function equipEffect(equipped) {
    var out = {};
    TKEYS.forEach(function (k) { out[k] = 0; });
    for (var slot in (equipped || {})) {
      var it = equipped[slot];
      if (it && it.tag_type && out[it.tag_type] !== undefined) out[it.tag_type] += (it.tag_power || 0);
    }
    return out;
  }

  // 표시 스탯 = 초기 + 영구 가산 + 착용 효과 (§3-3). 총합 고정 없음 — 자란다.
  function finalStats(base, gains, equipped) {
    return applyGains(applyGains(base, gains), equipEffect(equipped));
  }

  /* ── §6-1 역방향 — "오늘 이렇게 되고 싶다" → 슬롯별 argmax ─────────
     감쇠가 없어 목적 함수가 슬롯별로 분리되므로 슬롯별 최댓값이 곧 전역 최적이다(O(n)). */
  function recommendOutfit(inventory, goalType, slots) {
    var pick = {}, empty = [], shown = 0;
    (slots || SLOTS).forEach(function (slot) {
      var best = null;
      (inventory || []).forEach(function (it) {
        if (it.slot !== slot || it.tag_type !== goalType || !it.tag_power) return;
        // 동점이면 등록 오래된 순(id 오름차순) — 결정적이면 충분하다 §6-1
        if (!best || it.tag_power > best.tag_power ||
            (it.tag_power === best.tag_power && String(it.id) < String(best.id))) best = it;
      });
      if (!best) { empty.push(slot); return; }      // §6-2 억지로 채우지 않는다
      pick[slot] = best; shown += best.tag_power;
    });
    return { pick: pick, empty: empty, shown: shown };
  }

  /* ── 미션 가산 매핑 — theory/초안_미션가산매핑_v1_2026-08-24.md ──────
     성장 엔진의 정본이 여기라 매핑 규칙도 여기 둔다. 화면마다 복사하면 갈린다.
     새 상수는 없다 — 크기는 위 RUNG 그대로다. */

  // §1-2 대상 타입 = WANT ?? HAVE 1위. **발행 시점에 확정해 offer에 심고**
  // 완료 시점에 다시 판정하지 않는다(§1-3 과거 가산은 안 움직인다).
  // user는 {want_type, have_type} — have_type은 진단이 이미 정한 1위라 여기서 다시 세지 않는다.
  function targetType(user, cell) {
    return (cell && cell.quiz_topic_type) || (user && user.want_type) ||
           (user && user.have_type) || TKEYS[0];
  }

  // §2-2 근거 강도. 자기 보고는 여기 들어오지 않는다 — 들어올 자리가 없는 것이 곧 0점 규칙이다.
  function evidenceOf(cell, event) {
    var e = event || {};
    if (!cell) return null;
    if (cell.kind === "milestone")  return "arrival";                        // +3
    if (cell.kind === "item")       return e.registered ? "observed" : null; // +1
    if (cell.kind === "knowledge")  return e.correct    ? "observed" : null; // +1
    if (cell.kind === "skill") {
      if (!cell.countable || !cell.field) return null;   // 세지 않는 칸 — 기록만 남는다
      if (e.verdict === "done")  return "verified";      // +2 부호 일치
      if (e.photo_submitted)     return "observed";      // +1 부호가 틀려도 시도는 일어났다
    }
    return null;
  }

  // §3-1 표시값 ≤ 확정값. 전부 최소 등급으로만 약속하고, 승급(+2)은 재촬영 결과에서 처음 등장한다.
  // 도착·보스(+3)는 예고하지 않는다 — 측정 결과라 행동으로 보장되지 않는다(§3-3).
  function previewGain(cell) {
    if (!cell || cell.kind === "milestone") return null;
    if (cell.kind === "skill" && (!cell.countable || !cell.field)) return null;
    return RUNG.observed;
  }

  // stat_entries 사본 → {타입: 합}. gain_type이 없는 옛 행은 세지 않는다 — 타입을 지어내지 않는다.
  function gainsOf(entries) {
    var g = {};
    (entries || []).forEach(function (e) {
      if (!e || !e.gain || !e.gain_type) return;
      g[e.gain_type] = (g[e.gain_type] || 0) + e.gain;
    });
    return g;
  }

  /* ── §7-6 자체검사 — 산식이 깨지면 여기서 터진다 ────────────────── */
  function selfCheck(n) {
    var errs = [], Z = {}, F = {}, S = {};
    TKEYS.forEach(function (k) { Z[k] = 0; F[k] = 7.5; S[k] = 0; });
    S[TKEYS[0]] = 20;
    [Z, F, S].forEach(function (x, i) {
      var b = initialStats(x);
      if (sum(b) !== TOTAL) errs.push("경계 " + i + " 합이 30이 아니다: " + sum(b));
      if (Math.min.apply(null, TKEYS.map(function (k) { return b[k]; })) < FLOOR) errs.push("경계 " + i + " 0점 발생");
    });
    if (initialStats(S)[TKEYS[0]] !== FLOOR + POOL) errs.push("단일 독식이 1+22가 아니다");
    var N = n || 1000;
    for (var i = 0; i < N; i++) {
      var r = {};
      TKEYS.forEach(function (k) { r[k] = Math.random() * 20; });
      var b = initialStats(r);
      if (sum(b) !== TOTAL) { errs.push("무작위에서 합 깨짐: " + JSON.stringify(r)); break; }
      if (Math.min.apply(null, TKEYS.map(function (k) { return b[k]; })) < FLOOR) { errs.push("무작위에서 0점 발생"); break; }
    }
    // 가산 매핑 (초안_미션가산매핑 §6-3)
    var SKILL = { kind: "skill", countable: true, field: "chroma" };
    var DEAD  = { kind: "skill", countable: false, field: null };
    if (targetType({ want_type: null, have_type: "chic" }, {}) !== "chic")
      errs.push("추구미가 없을 때 HAVE 1위로 안 떨어진다");
    if (targetType({ want_type: "elegant", have_type: "chic" }, {}) !== "elegant")
      errs.push("추구미가 있는데 HAVE가 이겼다");
    if (evidenceOf(DEAD, { photo_submitted: true }) !== null || previewGain(DEAD) !== null)
      errs.push("0점 칸에 가산이 붙었다");
    if (previewGain({ kind: "milestone" }) !== null) errs.push("도착·보스를 예고하고 있다");
    if (evidenceOf(SKILL, { photo_submitted: true }) !== "observed" ||
        evidenceOf(SKILL, { verdict: "done" })      !== "verified")
      errs.push("스킬 칸의 근거 강도가 어긋난다");
    ["item", "knowledge", "skill"].forEach(function (k) {          // §3-1 표시값 ≤ 확정값
      if ((previewGain({ kind: k, countable: true, field: "x" }) || 0) > RUNG.observed)
        errs.push("표시값이 최소 등급을 넘는다: " + k);
    });
    if (gainsOf([{ gain: 1, gain_type: "chic" }, { gain: 2, gain_type: "chic" },
                 { gain: 1 }]).chic !== 3)
      errs.push("가산 합산이 틀렸다(타입 없는 행은 세지 않는다)");

    if (errs.length) console.error("[czm-stats] 자체 점검 실패:", errs);
    return errs;
  }

  root.CZMStats = {
    TKEYS: TKEYS, TOTAL: TOTAL, FLOOR: FLOOR, POOL: POOL, RUNG: RUNG,
    SLOTS: SLOTS,
    initialStats: initialStats, applyGains: applyGains,
    equipEffect: equipEffect, finalStats: finalStats,
    recommendOutfit: recommendOutfit, selfCheck: selfCheck, sum: sum,
    targetType: targetType, evidenceOf: evidenceOf,
    previewGain: previewGain, gainsOf: gainsOf,
    version: "stats_v1"
  };
})(typeof window !== "undefined" ? window : globalThis);
