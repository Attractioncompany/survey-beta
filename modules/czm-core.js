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
    // 해설지 부위 장에 보여줄 얼굴 조각(눈·코·입…). **기기 밖으로 나가지 않는다**(헌법 §4).
    // photo와 키를 나눈 이유: photo는 24장을 쌓고, 여기는 최신 한 벌만 둔다.
    // 사진첩 「저장된 사진 지우기」가 이 키도 함께 지운다(history.js).
    faceCrops:  "chugu_face_crops",
    scan:       "chugu_scan_result",
    steps:      "chugu_steps",         // 옛 걸음 기록(자기신고). 읽기 전용으로만 남긴다
    stats:      "czm_stats",           // 서버 stat_entries의 기기 사본
    activeQuest:"czm_active_quest",
    skipped:    "czm_skipped",
    lastSeen:   "czm_last_seen",
    previewDone:"czm_preview_done",
    introSeen:  "czm_intro_seen",      // 앱 소개 5장(intro.html)을 봤는가 — 완주·건너뛰기 모두 남는다
    // 오늘 확정한 착용. daily_outfits에도 남지만 그건 읽는 코드가 없어서, 아침에 정한 조합이
    // 새로고침 한 번에 사라졌다. 기기 사본이 있으면 저녁 재촬영 때 "그날 뭘 입었는지"가 남는다.
    outfitToday:"czm_outfit_today",
    /* 옷 썸네일. 뒤에 아이템 id를 붙여 한 벌에 한 칸씩 쓴다(czm_item_thumb_<id>).
       한 덩어리로 묶지 않는 이유 — 옷 한 벌을 담을 때마다 전체를 다시 쓰게 되고,
       50벌이면 매번 1MB를 통째로 직렬화한다. 지우는 것도 칸 하나만 지우면 된다.
       **기기 전용이다.** 서버로 보내지 않는다 — 옷 사진에도 방·거울·사람이 같이 찍힌다. */
    itemThumb:  "czm_item_thumb_",
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
  // T: 웜·곡선(−) ↔ 쿨·직선(+) / D: 인상의 세기·무게(순함 − ↔ 강함 +) / M: 동안(−) ↔ 성숙(+)
  // T·D = 마스터 §1-1 표 / M = 이론_작업노트 §A6(2026-08-07 대표 확정 순위, 간격은 잠정 균등)
  //
  // D축 개정 2026-08-27 (theory/회신_회부4건_..._2026-08-27.md ①) — 대표 지적이 취향이 아니라
  // 마스터 내부의 모순이었다. 마스터 2.5-C가 우아↔클래식을 "온도 쌍둥이(웜쿨 하나로 갈림)"로
  // 규정하는데 좌표는 ΔD 0.9로 최대 원거리쌍에 놓고 있었다(다른 온도 쌍둥이는 0.1·0.2).
  // 게다가 2.5-A는 같은 쌍을 고위험 혼동쌍으로 등재한다 — "가장 헷갈리면서 가장 먼" 자기모순.
  //   elegant  depth −0.5 → −0.1 / classic depth +0.4 → +0.1
  // 웜쿨 기여율 55.2% → 96.2%. 나머지 6타입·T축 전부 불변.
  // ⚠ 소급 없음 — 신규 진단부터 적용된다. 저장된 진단은 옛 좌표로 남는다.
  var COORD = {
    romantic: [-0.8, -0.8, -0.40], pure:     [ 0.8, -0.8, -0.65],
    elegant:  [ 0.5, -0.1,  0.15], energetic:[-0.6, -0.4, -0.90],
    gorgeous: [-0.8,  0.8,  0.65], classic:  [-0.5,  0.1,  0.40],
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
  // flatten은 color를 통째로 펼치지 않고 **이 표에 있는 것만** 통과시킨다.
  // 그래서 표에 없는 색 값은 계산·저장까지 되고도 엔진·사전에 영영 안 닿는다.
  // contrast_brow가 정확히 그 상태였다 — 마스터가 카리스마 신호로 쓰는 눈썹 진하기를
  // "측정이 없다"고 적어 뒀는데, 실은 재고 있었고 이 표에 없었을 뿐이다
  // (이론 측정확충 v1 P0-1). contrast_iris·ita도 같은 이유로 함께 연다.
  var COLOR_ALIAS = { hue_angle: "hue", chroma: "chroma", contrast_overall: "contrast",
                      skinL: "skinL", hair_L: "hair_L", dyed: "dyed",
                      contrast_brow: "contrast_brow", contrast_iris: "contrast_iris", ita: "ita" };

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
  /**
   * 분포 기반 판정 — 관측값이 아래 3분의 1 / 가운데 / 위 3분의 1 중 어디인가.
   * 왜 이걸 쓰나: 현 밴드 상수로 14명을 갈라보니 **전원이 같은 칸**에 들어갔다(조사 2026-08-18).
   *   jaw 8.3~10.7 → 전원 "적당히 각진 편" · chin 165.9~173.7 → 전원 "완만" · brow 34.5~45.8 → 전원 "아치형"
   * 유저 전원이 같은 문장을 받으면 정보가 0이다. D26은 상수 창작을 금하고 분포 백분위를 쓰라고 한다 —
   * 그래서 상수를 새로 만들지 않고 관측 분포(modules/shape-dist.json)의 삼분위를 읽는다.
   * ⚠ n=14다. "어느 쪽"까지만 말하고 "상위 몇 %"는 말하지 않는다.
   */
  function bandOf(sorted, v, labels) {
    if (!Array.isArray(sorted) || sorted.length < 6 || typeof v !== "number" || !isFinite(v)) return null;
    var q = function (p) {
      var i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
      return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
    };
    var t1 = q(1 / 3), t2 = q(2 / 3);
    return { label: v < t1 ? labels[0] : v < t2 ? labels[1] : labels[2],
             low: +t1.toFixed(3), high: +t2.toFixed(3) };
  }

  // ⚠ 아래 BANDS는 lineScore(이론 엔진)가 쓰는 구간을 그대로 읽은 것이다. 유저 표시에는
  //   위 bandOf를 쓴다 — 이 상수들은 전원을 한 칸에 몰아넣어 표시용으로 쓸 수 없다.
  //   엔진 구간 자체의 재설정은 이론팀 몫이라 여기서 건드리지 않는다(요청서 발행).
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
   * 황금비율 대조 (2026-08-18 대표 지시).
   *   "평균과 비교하는 건 타인과 비교하는 것이고, 황금비율과 비교하는 건
   *    미학 기준에 따라 자기 상태를 보는 것이다."
   *
   * 기술적으로도 이쪽이 단단하다 — **전부 자기 얼굴 안의 비율**이라
   * 외부 표본도, 성별·연령 규준도, 우리가 만든 밴드 상수도 필요 없다.
   * φ = 1.618은 창작 상수가 아니라 수학 상수다(D26 저촉 없음).
   *
   * ⚠ 화법: 이건 등급이 아니다. "얼마나 어긋났나"가 아니라 "어느 쪽 특징인가"로 말한다.
   *   황금비율에 안 맞는 것은 결점이 아니다 — 헌법 §4 "판정이 아닌 방향 제시".
   */
  var PHI = 1.618;
  var GOLDEN = {
    face_HW:   { ideal: PHI, name: "얼굴 가로 : 세로", a: "가로", b: "세로",
                 low: "황금비 대비 가로가 조금 넓은 편", high: "황금비 대비 세로가 긴 편",   // 어휘 교정 (대표 2026-08-29)
                 tell: "얼굴 길이를 가로폭으로 나눈 값이에요" },
    mouth_nose:{ ideal: PHI, name: "코 : 입 너비", a: "코", b: "입",
                 low: "코 대비 입이 아담한 편", high: "코 대비 입이 시원한 편",
                 tell: "입 너비를 코 너비로 나눈 값이에요" },
    lip_ul:    { ideal: PHI, name: "윗입술 : 아랫입술", a: "윗입술", b: "아랫입술",
                 /* "윗입술이 도톰한 편"을 걷었다(검수 2026-08-31). 황금비(1:1.62) 대비 화법인데
                    기준 언급 없이 나가서, 바로 아래 실측 행(윗 0.04 · 아랫 0.054)과 정반대로
                    읽혔다 — 1<값<1.54 구간 전원이 그 모순을 받는다. 비교 기준을 문장에 싣는다.
                    판정·산식 불변, 라벨만. [마케팅 사후 검수 대상] */
                 low: "황금비 대비 윗입술 비중이 큰 편", high: "황금비 대비 아랫입술 비중이 큰 편",
                 tell: "아랫입술 두께를 윗입술로 나눈 값이에요" },
    lower_balance:{ ideal: PHI, name: "코밑~입술 : 입술~턱끝", a: "코밑~입술", b: "입술~턱끝",
                 low: "입술이 아래쪽에 자리한 편", high: "입술이 위쪽에 자리한 편",
                 tell: "입술틈에서 턱끝까지를 코밑에서 입술틈까지로 나눈 값이에요" },
    interocular:{ ideal: 1.0, name: "눈 길이 : 눈 사이", a: "눈 길이", b: "눈 사이",
                 low: "눈 사이 여백이 좁은 편", high: "눈 사이 여백이 넓은 편",   // "여유로운"은 사람 말이 아니다 (대표 2026-08-29)
                 tell: "두 눈 사이 거리를 한쪽 눈 길이로 나눈 값이에요 — 이상은 1 : 1이에요" }
  };
  // ±5%는 측정 오차 수준이다(같은 사람을 조명만 바꿔 찍어도 이 정도는 움직인다).
  // 그 안이면 "거의 일치"로 본다 — 소수점 아래를 두고 우열을 말하지 않기 위한 폭이다.
  var GOLDEN_TOL = 0.05;
  function goldenOf(key, v) {
    var g = GOLDEN[key];
    if (!g || typeof v !== "number" || !isFinite(v) || v <= 0) return null;
    var ratio = v / g.ideal, off = (ratio - 1) * 100;
    return {
      key: key, name: g.name, value: +v.toFixed(2), ideal: g.ideal, tell: g.tell,
      a: g.a, b: g.b,
      // "1 : 1.6" 꼴. 소수 셋째 자리까지 보여줘도 읽는 사람에게 뜻이 없다.
      idealPair: "1 : " + (+g.ideal.toFixed(2)),
      myPair: "1 : " + (+v.toFixed(2)),
      offPct: +off.toFixed(1),
      // 라벨 명사 종결 — 리포트 전면 합니다체 전환(대표 P 2026-08-29). 판정·산식 불변, 표기만.
      label: Math.abs(ratio - 1) <= GOLDEN_TOL ? "황금비율에 가까운 편" : (off < 0 ? g.low : g.high)
    };
  }

  /**
   * 황금비 근접도 — 항목별 |어긋남 %|의 평균. 라벨이 전원 같은 방향이어도
   * 정도는 사람마다 다르다(실측: face_HW가 -9%인 사람과 -34%인 사람이 같은 라벨을 받았다).
   * 낮을수록 황금비에 가깝다. 등급이 아니라 **자기 상태의 요약**이다.
   */
  function goldenSummary(list) {
    var vals = [];
    for (var i = 0; i < list.length; i++) if (list[i] && isFinite(list[i].offPct)) vals.push(Math.abs(list[i].offPct));
    if (!vals.length) return null;
    var sum = 0;
    for (var j = 0; j < vals.length; j++) sum += vals[j];
    var avg = sum / vals.length;
    var near = list.filter(function (g) { return g && Math.abs(g.offPct) <= GOLDEN_TOL * 100; }).length;
    return { avgOff: +avg.toFixed(1), near: near, total: vals.length };
  }

  /**
   * 3분할 이상비 대조 — 신고전 안면 규범(neoclassical canon)은 상:중:하 = 1:1:1이다.
   * ⚠ 이것은 φ(1:1.618)와 **다른 기준이다.** 함수 이름에 Golden이 붙어 있어 한 번 혼동이
   *   났고(이론 회신 2026-08-27이 "황금비는 1:1.618이라 틀렸다"고 기각 → 대표가 정정),
   *   그래서 유저향 문구는 '황금비율'이 아니라 **'이상적 비율'**로 쓴다.
   *   위 goldenOf()가 쓰는 φ 대조와 헷갈리지 않게 한다.
   * 셋의 합이 100이므로 33.3에서 얼마나 떨어졌는지로만 말한다. 역시 자기 안 비교다.
   */
  function thirdsGolden(u, m, l) {
    var t = thirdsVerdict(u, m, l);
    if (!t) return null;
    var IDEAL = 33.3, NAME = ["상안부", "중안부", "하안부"];
    var off = t.pct.map(function (v) { return +(v - IDEAL).toFixed(1); });
    var far = 0;
    for (var i = 1; i < 3; i++) if (Math.abs(off[i]) > Math.abs(off[far])) far = i;
    var even = Math.abs(off[far]) <= 3;   // 3%p = 세 칸이 고르다고 볼 수 있는 폭
    // 상대비: 가장 짧은 칸을 1로 둔다. 백분율은 크기 감각이 안 온다(대표 2026-08-18).
    var mn = Math.min(t.pct[0], t.pct[1], t.pct[2]);
    var rel = mn > 0 ? t.pct.map(function (v) { return +(v / mn).toFixed(1); }) : null;
    return {
      pct: t.pct, off: off, line: t.line,
      rel: rel, relLine: rel ? rel.join(" : ") : t.line,
      label: even ? "세 칸이 고른 편"
                  : NAME[far] + (off[far] > 0 ? "가 긴 편" : "가 짧은 편"),
      tell: "이상적인 얼굴은 상·중·하가 1 : 1 : 1 이에요"
    };
  }

  /**
   * 좌우 대칭 — 0에 가까울수록 대칭. 완전 대칭이 자연 기준이라 외부 표본이 필요 없다.
   * ⚠ 라벨을 "심하다"로 쓰지 않는다. 비대칭은 흠이 아니라 누구에게나 있는 것이고,
   *   실제로 표정 습관·씹는 쪽 같은 **바꿀 수 있는 원인**이 있어 퀘스트로 이어진다.
   */
  function asymVerdict(score, dist, labels) {
    if (typeof score !== "number" || !isFinite(score)) return null;
    // 절대 0이 이상이지만 실제 얼굴은 1~7%로 흩어져 있다(실측 13명). 고정 문턱을 두면
    // 대부분이 "차이가 보인다"로 몰려 겁만 준다 → 분포 삼분위로 가른다.
    var b = bandOf(dist, score, labels || ["좌우가 고른 편", "좌우 차이가 조금 있는 편", "좌우 차이가 보이는 편"]);
    if (!b) return { score: +score.toFixed(2), label: null, care: false };
    return { score: +score.toFixed(2), label: b.label, care: score >= b.high };
  }

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

  /* 헤어 관찰·미션 3밴드 (forehead_open) — 대표 확정 2026-08-29.
     관찰(obs)은 리포트 얼굴형 장에서 상태만 말하고, 미션(mission·why)은 「오늘 해볼 것」에서 나온다.
     index.html에 있던 정의를 2026-09-02 계약층으로 옮겼다 — 강의판(lecture.html)도 같은 문구를
     읽어야 하는데 사본을 두면 한쪽만 고쳐지는 사고(전파 체크리스트)가 재발한다. */
  var HAIR_BANDS = [
    { min: 0.75, key:"hair_open",
      title: "드러난 이마",
      obs: "이마가 거의 다 보이는 상태로 찍혔습니다. 얼굴 위쪽이 열려 있으면 이목구비가 또렷하게 읽힙니다.",
      mission: "앞머리를 조금만 내려보세요",
      why: "얼굴 길이가 짧아 보이고 인상이 한결 부드러워집니다." },
    { min: 0.40, key:"hair_half",
      title: "반쯤 열린 이마",
      obs: "가운데는 드러나 있고 옆쪽은 머리가 덮은 상태입니다. 어느 쪽으로도 갈 수 있는 자리입니다.",
      mission: "가르마를 넘기는 쪽을 바꿔보세요",
      why: "조금만 옮겨도 인상이 꽤 움직입니다. 두 장 찍어두면 뭐가 맞는지 비교하기 좋아요." },
    { min: 0, key:"hair_covered",
      title: "이마를 덮은 머리",
      obs: "머리가 이마를 대부분 덮은 상태로 찍혔습니다. 이마가 가려지면 시선이 눈·코·입으로 모입니다.",
      mission: "이마를 조금만 열어보세요",
      why: "얼굴이 위아래로 길어 보이고 윤곽이 또렷해져요. 어느 쪽이 나은지에 정답은 없고, 두 가지를 다 가진 사람이 선택지가 많습니다." },
  ];
  function hairBandOf(v){
    if(typeof v !== "number" || !isFinite(v)) return null;
    for(var i=0;i<HAIR_BANDS.length;i++) if(v >= HAIR_BANDS[i].min) return HAIR_BANDS[i];
    return null;
  }

  root.CZM = {
    BANDS: BANDS, bandOf: bandOf,
    HAIR_BANDS: HAIR_BANDS, hairBandOf: hairBandOf, midLowerVerdict: midLowerVerdict, thirdsVerdict: thirdsVerdict,
    PHI: PHI, GOLDEN: GOLDEN, goldenOf: goldenOf, goldenSummary: goldenSummary, thirdsGolden: thirdsGolden, asymVerdict: asymVerdict,
    STAGES: STAGES, trace: trace, diagnose: diagnose, diagnoseText: diagnoseText,
    KEYS: KEYS, store: store,
    TYPE_KEYS: TYPE_KEYS, TYPE_NAMES: TYPE_NAMES, PC8: PC8,
    COORD: COORD, coordOf: coordOf, gapOf: gapOf,
    measure: { flatten: flatten, colorAlias: COLOR_ALIAS },
    // 계약층 이벤트 — **정의만 등재한다. 발화는 각 화면이 한다.**
    // 이름이 여러 곳에서 문자열로 흩어지면 오타 하나가 조용히 계측을 끊는다(전략팀 R2).
    EVENTS: {
      // 결과 시점 과금의 훅. 검증에서 delta가 처방 방향으로 확인된 순간 1회.
      CHANGE_CONFIRMED: "change_confirmed",     // props: category, axis, week_no, delta, quest_id, offer_id
      // 커머스 접점 — 아이템 걸음 완료 화면의 슬롯. 아직 내용물이 없어 발화처도 없다.
      COMMERCE_SLOT_SHOWN:   "commerce_slot_shown",   // props: slot_id, quest_id, category
      COMMERCE_SLOT_CLICKED: "commerce_slot_clicked", // props: slot_id, quest_id, category, target
    },
    version: "core_v1"
  };
})(typeof window !== "undefined" ? window : globalThis);
