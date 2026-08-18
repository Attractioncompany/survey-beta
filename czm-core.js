/* 계약층 — 모듈끼리 주고받는 것의 정의. 근거: docs/모듈구조_v1_2026-08-17.md
 *
 * 왜 있나: 오늘 두 번 같은 일이 났다.
 *   · 촬영이 내는 측정값 모양을 걸음 판정이 몰라서, 단위 시험 18개가 통과하는데 실물은 한 번도 안 돌았다.
 *   · 8타입 좌표가 두 파일에 복사돼 있어서 M축이 서로 다른 좌표계로 돌았다.
 * 값이 두 곳에 있으면 언젠가 갈린다. 여기가 그 한 곳이다.
 *
 * 왜 ESM이 아닌가: index.html·photo-module.html이 일반 스크립트라 import를 못 쓴다.
 * 모듈 블록으로 넣으면 늦게 도착해서, 먼저 실행되는 코드가 빈 값을 본다(실제로 겪은 경주 조건).
 * 그래서 일반 스크립트로 window에 얹는다 — ESM 쪽(home.html·quest-engine)은 window에서 읽는다.
 */
(function (root) {
  "use strict";

  // ── 저장 키 ────────────────────────────────────────────────
  // 이름 체계가 셋으로 갈려 있다(chugu_·czm_·aim_). **지금 바꾸지 않는다** —
  // 이미 쓰는 기기에 값이 들어 있어서 이름을 바꾸면 그 사람의 진단 이력이 사라진다.
  // 대신 여기 모아두고, 앞으로는 문자열을 직접 쓰지 않고 이걸 꺼내 쓴다.
  var KEYS = {
    uid:        "czm_uid",             // app_users.id — 이 기기의 신분증
    session:    "czm_session",         // 로그인 토큰
    userEnsured:"czm_user_ensured",    // app_users 행을 만들어봤는가(중복 409 방지)
    diag:       "chugu_diag",          // 진단 결과 + scores + answers (v2~)
    photo:      "chugu_photo_result",  // 촬영 측정값 — 모양은 아래 measure가 정의한다
    scan:       "chugu_scan_result",
    steps:      "chugu_steps",         // 옛 걸음 기록(자기신고). 읽기 전용으로만 남긴다
    stats:      "czm_stats",           // 서버 stat_entries의 기기 사본
    activeQuest:"czm_active_quest",
    skipped:    "czm_skipped",
    lastSeen:   "czm_last_seen",
    previewDone:"czm_preview_done",
    aimLogs:    "aim_logs"
  };

  var store = {
    get: function (key, fallback) {
      try { var v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set: function (key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} },
    del: function (key) { try { localStorage.removeItem(key); } catch (e) {} },
    // czm_uid만 생문자열로 저장돼 있다(index.html이 처음 그렇게 썼다). 예외를 숨기지 않고 드러낸다.
    raw: function (key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  };

  // ── 8타입 ──────────────────────────────────────────────────
  var TYPE_KEYS = ["romantic", "pure", "elegant", "energetic", "gorgeous", "classic", "charisma", "chic"];
  var TYPE_NAMES = {
    romantic: "로맨틱", pure: "청순청량", elegant: "우아한", energetic: "에너제틱",
    gorgeous: "화려함", classic: "클래식", charisma: "카리스마", chic: "세련된"
  };

  // ── 퍼스널컬러 8타입 (상호진단 직접 입력용) ─────────────────
  // 출처: theory/추구미라이브러리_v1_마스터.md §1-1 "퍼스널컬러(8계절 실운용)" 열.
  // 8타입은 8매력타입과 1:1이라 리포트에서 그대로 이어붙는다.
  //
  // ⚠ 두 칸의 명칭이 아직 안 굳었다(대표 2026-08-17). 마스터 표기 → 잠정 채택:
  //     에너제틱: 마스터 "봄 스트롱" → **봄 클리어** (대표 추정)
  //     세련된:   마스터 "겨울 클리어" → **겨울 스트롱** (대표 추정 · 2026-08-17 시정)
  //   ⚠ 처음에 겨울 스트롱을 카리스마에 붙였는데 틀렸다. 대체 후보로 지목된 칸은 세련된이다.
  //   이론팀 확정이 오면 **이 표만** 고친다. 다른 파일에 라벨을 복사하지 말 것.
  var PC8 = [
    { key:"romantic",  label:"봄 라이트",   master:"봄 라이트",  provisional:false },
    { key:"energetic", label:"봄 클리어",   master:"봄 스트롱",  provisional:true  },
    { key:"pure",      label:"여름 라이트", master:"여름 라이트",provisional:false },
    { key:"elegant",   label:"여름 뮤트",   master:"여름 뮤트",  provisional:false },
    { key:"gorgeous",  label:"가을 딥",     master:"가을 딥",    provisional:false },
    { key:"classic",   label:"가을 뮤트",   master:"가을 뮤트",  provisional:false },
    { key:"charisma",  label:"겨울 딥",     master:"겨울 딥",    provisional:false },
    { key:"chic",      label:"겨울 스트롱", master:"겨울 클리어",provisional:true  }
  ];

  // ── 좌표 (이론 값 — 개발팀이 고치지 않는다) ─────────────────
  // T: 웜·곡선(−) ↔ 쿨·직선(+) / D: 순함(−) ↔ 강함(+) / M: 동안(−) ↔ 성숙(+)
  // T·D = 마스터 §1-1 표 / M = 이론_작업노트 §A6(2026-08-07 대표 확정 순위, 간격은 잠정 균등)
  var COORD = {
    romantic: [-0.8, -0.8, -0.40], pure:     [ 0.8, -0.8, -0.65],
    elegant:  [ 0.5, -0.5,  0.15], energetic:[-0.6, -0.4, -0.90],
    gorgeous: [-0.8,  0.8,  0.65], classic:  [-0.5,  0.4,  0.40],
    charisma: [ 0.8,  0.9,  0.90], chic:     [ 0.7,  0.6, -0.15]
  };

  // 8타입 전체 점수의 가중평균. top-3만 쓰면 반대 방향 하위 타입이 빠져 좌표가 극단으로 편향된다.
  function coordOf(scores) {
    var t = 0, d = 0, m = 0, s = 0;
    for (var i = 0; i < TYPE_KEYS.length; i++) {
      var v = Math.max(0, (scores && scores[TYPE_KEYS[i]]) || 0);
      var c = COORD[TYPE_KEYS[i]];
      s += v; t += v * c[0]; d += v * c[1]; m += v * c[2];
    }
    return s > 0 ? [t / s, d / s, m / s] : null;   // 점수 전무 → null. 0을 "중립 좌표"로 쓰지 않는다
  }

  var r4 = function (n) { return +n.toFixed(4); };

  /**
   * WANT−HAVE. 부호 = 추구미가 지금 대비 어느 쪽인가.
   * ⚠ dist는 T·D 2축만 쓴다(이론 판정 2026-08-17) — M 간격이 잠정 균등이라
   *   유클리드에 섞으면 이미 쌓인 진단 행과 정의가 조용히 갈린다.
   */
  function gapOf(wantScores, haveScores) {
    var w = coordOf(wantScores), h = coordOf(haveScores);
    if (!w || !h) return { dist: null, axis: null };
    return {
      dist: r4(Math.hypot(w[0] - h[0], w[1] - h[1])),   // M 미포함
      axis: { T: r4(w[0] - h[0]), D: r4(w[1] - h[1]), M: r4(w[2] - h[2]) }
    };
  }

  // ── 측정값 계약 ────────────────────────────────────────────
  // photo-module은 ratio/line/color로 나눠 저장하고 color 안에서는 이름도 다르다.
  // 이론·사전은 이론 필드명으로 말한다. 그 사이를 잇는 다리가 여기다 —
  // 이 다리가 없어서 판정이 전부 "측정값 결측"으로 흘렀다(오류대장 053).
  var COLOR_ALIAS = { hue_angle: "hue", chroma: "chroma", contrast_overall: "contrast",
                      skinL: "skinL", hair_L: "hair_L", dyed: "dyed" };

  function flatten(m) {
    if (!m) return null;
    var c = m.color || {}, out = {};
    var src = [m, m.ratio || {}, m.line || {}];
    for (var i = 0; i < src.length; i++) for (var k in src[i]) out[k] = src[i][k];
    for (var name in COLOR_ALIAS) {
      var v = c[COLOR_ALIAS[name]];
      if (v !== undefined) out[name] = v; else if (out[name] === undefined) out[name] = m[name];
    }
    return out;
  }

  // ── 판정 밴드 ──────────────────────────────────────────────
  // photo-module의 DEV 해설표(HINT)에 이미 있던 구간을 **그대로** 옮겼다. 새 문턱을 만들지 않았다.
  // 여기 둔 이유: 강의 리포트와 촬영 화면이 같은 기준으로 말해야 한다. 두 곳에 두면 갈린다.
  // 유저에게 보이는 말이므로 등급이 아니라 **어느 쪽인지**만 말한다("각진 편" O / "3등급" X).
  var BANDS = {
    // 얼굴형 — lineScore가 쓰는 구간(7~19 / 115~165)을 그대로 읽는다
    // 라벨은 유저가 그대로 읽는 말이다. "중간"은 아무것도 알려주지 않아 뜻이 통하는 말로 바꿨다
    // (2026-08-18 · 문턱은 그대로, 라벨만).
    jaw_angular_deg: function (v) { return v >= 19 ? "각진 편" : v >= 7 ? "적당히 각진 편" : "둥근 편"; },
    chin_angle_deg:  function (v) { return v >= 165 ? "완만한 편" : v >= 115 ? "적당한 편" : "뾰족한 편"; },
    brow_arch_deg:   function (v) { return v >= 25 ? "아치형" : v >= 5 ? "완만한 아치" : "일자형"; },
    // 눈매 방향 — 부호 임계 0.5는 기존 값
    eye_angle:       function (v) { return v > 0.5 ? "올라간 눈매" : v < -0.5 ? "내려간 눈매" : "수평에 가까운 눈매"; },
    mouth_corner:    function (v) { return v > 0.5 ? "올라간 입꼬리" : v < -0.5 ? "내려간 입꼬리" : "수평에 가까운 입꼬리"; }
  };

  /**
   * 상·중·하 3분할 — **자기 얼굴 안에서의 비교**라 외부 기준도 밴드 상수도 필요 없다.
   * 셋을 더하면 1이므로 "어디가 가장 긴가"는 그 사람 안에서 항상 참이다(D26 저촉 없음).
   * ⚠ 상안부는 헤어라인이 기준이다. 앞머리가 이마를 덮으면 검출이 흔들린다 — 각주로 밝힌다.
   */
  function thirdsVerdict(u, m, l) {
    if (![u, m, l].every(function (v) { return typeof v === "number" && isFinite(v); })) return null;
    var sum = u + m + l;
    if (!(sum > 0)) return null;
    var pct = [u, m, l].map(function (v) { return +(v / sum * 100).toFixed(1); });
    var NAME = ["상안부", "중안부", "하안부"];
    var max = 0, min = 0;
    for (var i = 1; i < 3; i++) { if (pct[i] > pct[max]) max = i; if (pct[i] < pct[min]) min = i; }
    return {
      pct: pct, longest: NAME[max], shortest: NAME[min],
      // 순위만 말한다. "고른 편"의 경계를 여기서 만들면 그게 곧 창작 상수다.
      text: pct[max] === pct[min] ? "세 부분 길이가 같아요" : NAME[max] + "가 가장 길어요",
      line: pct[0] + " : " + pct[1] + " : " + pct[2]
    };
  }

  // 중·하안부 — 규준(한국 여성 41.6 : 58.4)과 직접 견준다. 밴드가 아니라 평균 대비다.
  // ±2%p 안이면 "평균과 비슷"으로 본다 — SD가 없어 그 이상은 말할 수 없다(규준 조사 §usage_rule).
  function midLowerVerdict(midPct) {
    if (midPct == null) return null;
    var NORM = 41.6, d = midPct - NORM;
    return { mid: +midPct.toFixed(1), low: +(100 - midPct).toFixed(1), norm: NORM, delta: +d.toFixed(1),
             text: Math.abs(d) <= 2 ? "평균과 비슷해요"
                 : d > 0 ? "중안부가 평균보다 긴 편이에요" : "하안부가 평균보다 긴 편이에요" };
  }

  // ── 단계 계약 ──────────────────────────────────────────────
  // 목적: "어디서 오류났는지" 한 화면에서 보이게 한다.
  // 지금은 측정이 반쯤 실패해도 결과가 그냥 비어 나온다 — 역추적해야 알 수 있다.
  //
  // ⚠ 여기서 새 문턱을 만들지 않는다. 판정에 쓰는 값은 전부 photo-module이 이미 내는
  //   기존 플래그(hairline_detected·L_corrected·bg_blown…)다. 읽기만 한다.
  var STAGES = ["촬영", "색분석", "구조분석", "종합판정", "해설"];

  var trace = {
    steps: [],
    reset: function () { this.steps = []; return this; },
    // 하드 실패(예외)를 그 단계 이름으로 잡아 남긴다. 페이지는 계속 진행시킨다.
    run: function (stage, fn) {
      try { var r = fn(); this.steps.push({ stage: stage, ok: true }); return r; }
      catch (e) {
        this.steps.push({ stage: stage, ok: false, reason: (e && e.message) || String(e) });
        console.error("[" + stage + "] 실패", e);
        return null;
      }
    },
    failed: function () { return this.steps.filter(function (s) { return !s.ok; }); }
  };

  /** finalize() 산출물에서 단계별 상태를 읽어낸다. out이 없으면 어디까지 갔는지만 낸다. */
  function diagnose(out) {
    var q = (out && out.quality) || {}, pc = (out && out.pc12) || {};
    var hard = {};
    trace.steps.forEach(function (s) { if (!s.ok) hard[s.stage] = s.reason; });

    function note(cond, text) { return cond ? [text] : []; }
    var rows = [
      { stage: "촬영", notes: [].concat(
          note(q.cam_lock === false, "업로드 사진 — 촬영 조건이 고정되지 않았어요"),
          note(q.hazy, "흐릿하게 잡혔어요"),
          note(q.bg_blown, "배경이 날아갔어요"),
          note(q.bg_dim, "배경이 너무 어두워요")) },
      { stage: "색분석", notes: [].concat(
          note(q.L_corrected === false, "노출 보정을 못 걸었어요 — 흰 기준을 못 찾음"),
          note(q.hairline_detected === false, "헤어라인 미검출 → 대비 앵커 없음"),
          note(q.forehead_used === false, "이마를 못 써서 피부 표본이 좁아요")) },
      { stage: "구조분석", notes: [].concat(
          note(out && out.ratio && out.ratio.brow_eye_gap == null, "눈-눈썹 간격 미측정(눈 개방도 게이트)"),
          note(out && out.ratio && out.ratio.mouth_open, "입이 벌어져 입술 측정이 불안정해요")) },
      { stage: "종합판정", notes: [].concat(
          note(pc.contrast_anchor && pc.contrast_anchor.gate === 0, "대비 가중 0 — 색분석 실패에 종속"),
          note(pc.wc_borderline, "웜쿨 경계"),
          note(pc.borderline, "12타입 경계")) },
      { stage: "해설", notes: [] }
    ];

    return rows.map(function (r) {
      var reached = !out ? trace.steps.some(function (s) { return s.stage === r.stage; }) : true;
      return { stage: r.stage,
               ok: !hard[r.stage] && r.notes.length === 0 && reached,
               hard: hard[r.stage] || null,
               reached: reached,
               notes: r.notes };
    });
  }

  function diagnoseText(out) {
    return diagnose(out).map(function (r) {
      var mark = r.hard ? "❌" : !r.reached ? "⋯" : r.notes.length ? "⚠️" : "✅";
      var why = r.hard ? " " + r.hard : r.notes.length ? " " + r.notes.join(" · ") : "";
      return mark + " " + r.stage + why;
    }).join("\n");
  }

  root.CZM = {
    BANDS: BANDS, midLowerVerdict: midLowerVerdict, thirdsVerdict: thirdsVerdict,
    STAGES: STAGES, trace: trace, diagnose: diagnose, diagnoseText: diagnoseText,
    KEYS: KEYS, store: store,
    TYPE_KEYS: TYPE_KEYS, TYPE_NAMES: TYPE_NAMES, PC8: PC8,
    COORD: COORD, coordOf: coordOf, gapOf: gapOf,
    measure: { flatten: flatten, colorAlias: COLOR_ALIAS },
    version: "core_v1"
  };
})(typeof window !== "undefined" ? window : globalThis);
