/* 리포트 해설 — 이미 재고 있는 판정기·측정값을 유저 문장으로 인출한다.
 * 근거: theory/리포트해설_확충_v1_2026-08-24.md (이론팀 · 이론값 변경 0건)
 *
 * 왜 있나: czm-core에 유저향 판정 함수가 8개 있는데 앱 리포트가 쓰는 건 0개였다.
 * 측정·계산 비용은 이미 치렀고 화면이 그걸 안 불렀을 뿐이라, 여기는 **배선**이지 새 계산이 아니다.
 *
 * ⚠ 이 파일에서 임계·상수를 만들지 않는다. 전부 czm-core(밴드·황금비) ·
 *   shape-dist.json(관측 분포) · asset-score(부위 좌표·격차)에서 읽는다.
 *   새로 만든 것은 R5-b의 spread 구간(6·3) 하나뿐이고, 그건 이론팀이 [가설]로 등급을 매기고
 *   폐기 조건(n≥50에서 한 구간 60% 초과 시 삼분위 교체)을 달아 넘긴 값이다.
 *
 * 왜 ESM이 아닌가: index.html이 일반 스크립트라 결과 첫 페인트 때 동기로 필요하다.
 * 모듈로 두면 캐릭터 시트 해설이 늦게 도착해 설문만 한 유저(=다수)가 빈 카드를 본다.
 * czm-core와 같은 이유·같은 방식으로 window에 얹는다.
 *
 * 화법 원칙 3개 (헌법 §4 · §6-1):
 *   1. 없는 값은 지어내지 않는다 — 결측이면 그 문장을 통째로 뺀다. "측정되지 않았습니다"도 안 쓴다.
 *   2. 판정이 아니라 방향 — "안 어울림"·"부족"·"이상적" 금지.
 *   3. 어미를 반복하지 않는다 — 앞 문장이 ~요로 끝났으면 다음은 ~니다/~죠/명사로 간다.
 *      해설은 분량이 많아 이 함정에 특히 잘 빠진다. 아래 문장들은 **붙는 순서까지 계산해서** 썼다.
 */
(function (root) {
  "use strict";

  // 받침 — 타입·부위 이름이 변수라 조사를 고정하면 "윤곽예요"·"눈은" 류가 나온다.
  function jong(w) {
    var s = (w || "").trim(); if (!s) return false;
    var c = s.charCodeAt(s.length - 1);
    return (c >= 0xAC00 && c <= 0xD7A3) ? ((c - 0xAC00) % 28) !== 0 : false;
  }
  var eun  = function (w) { return w + (jong(w) ? "은" : "는"); };
  var gwa  = function (w) { return w + (jong(w) ? "과" : "와"); };
  var ieyo = function (w) { return w + (jong(w) ? "이에요" : "예요"); };

  // ── R5 캐릭터 시트 배합 ────────────────────────────────────
  /** 상위 n위. 동점은 같은 순위로 묶는다(30을 8칸에 정수로 나누면 동점이 흔하다). */
  function topRanks(st, NAMES, limit) {
    if (!st || !NAMES) return [];
    var lim = limit || 3;
    var keys = Object.keys(NAMES).filter(function (k) { return typeof st[k] === "number"; });
    var sorted = keys.slice().sort(function (a, b) { return st[b] - st[a]; });
    var out = [], rank = 0, prev = null;
    for (var i = 0; i < sorted.length; i++) {
      var k = sorted[i];
      if (st[k] !== prev) { rank = i + 1; prev = st[k]; }
      if (rank > lim) break;
      out.push({ k: k, v: st[k], rank: rank });
    }
    return out;
  }

  // 상쇄 밴드 — 도착 밴드(이동처방 v1.1)를 그대로 재사용한다. **신규 상수 아님.**
  // 그 밴드의 확정 의미가 "이보다 작은 차이는 원리적으로 판정 불가"이고,
  // |coord[축]| < 0.2 는 곧 "그 축에서 어느 쪽이라고 말할 수 없다"의 기확정 형식화다(이론 §3-3).
  var COUNTER_BAND = 0.2;

  /** 상쇄 축에서 부호가 갈리는 상위 타입 쌍. 없으면 null — 이름을 지어내지 않는다(이론 §3-3). */
  function counterPair(st, NAMES, axIdx) {
    var C = root.CZM && root.CZM.COORD; if (!C) return null;
    var top = topRanks(st, NAMES, 3).map(function (r) { return r.k; });
    for (var i = 0; i < top.length; i++)
      for (var j = i + 1; j < top.length; j++) {
        var a = C[top[i]], b = C[top[j]];
        /* 부호만 보면 인접 타입을 상쇄로 오판한다 — 실사례(대표 2026-08-29): 세련(D+0.6)과
           우아(D−0.1)는 인접 계열인데 "두 방향이 부딪힌다"로 나갔다. D−0.1은 반대쪽이
           아니라 사실상 중립이다. 양쪽 모두 그 축에서 뚜렷이 기울었을 때(각 |c|≥0.3)만
           상쇄다 — 0.3은 COORD에서 중립대(±0.1대)와 기운 값(±0.4↑)을 가르는 자연 틈. */
        if (a && b && a[axIdx] * b[axIdx] < 0
            && Math.abs(a[axIdx]) >= 0.3 && Math.abs(b[axIdx]) >= 0.3) return [top[i], top[j]];
      }
    return null;
  }

  /**
   * 배합 해설 — 이론 §3-5 분포 유형 4종. **먼저 걸리는 것이 이긴다.**
   * 상쇄형이 1순위인 이유: spread가 크든 작든 발생할 수 있고, 발생했다면 그것이
   * 그 사람에 대해 가장 정보량이 큰 사실이다.
   *
   * ⚠ 단정형 인과("그래서 매력이 깎인다")는 여전히 쓰지 않는다 — 타인 평가 데이터가 0건이다(이론 §3-4).
   *   다만 **가능성 표현까지 뺐던 것은 지나쳤다**(2026-08-26 재검토). 대표가 준 문구는
   *   "상반되는 매력이 충돌해서 매력이 반감되어 보일 수 있어요 / 충돌 지점을 개선하면
   *   더 매력적으로 보일 수 있을거에요"였는데, 근거 부족을 이유로 문장을 통째로 중립화했다.
   *   그 결과 관측만 남고 **유저가 무엇을 해야 하는지가 빠졌다.**
   *   "~수 있어요"는 가능성이지 단정이 아니다. 대표 의도(문제 인식 → 개선 방향)를 그 선에서 살린다.
   *   실제로 반감되는지는 타인 평가가 쌓이면 그때 단정형으로 올린다.
   *
   * @param coord 종합 좌표 [T, D, …]. 없으면 상쇄형은 판정하지 않는다.
   * @return string[] — 문장. 줄바꿈은 \n으로 두고 화면이 pre-line으로 받는다.
   */
  // [게이트 통과 2026-08-25] 네 벌 모두 바로 위에 "그중 결과 타입은 로맨틱이에요."가 서는
  //   자리다. 첫 줄이 전부 ~이에요/~있어요로 끝나 세로로 같은 어미가 이어졌다. 앞뒤를 뒤집어
  //   첫 줄은 ~니다로 받고 둘째 줄에서 ~요로 푼다. 뜻과 판정 분기는 그대로다.
  function statNarrative(st, topK, NAMES, bold, coord) {
    if (!st || !NAMES) return [];
    var B = bold || function (k) { return NAMES[k]; };
    var keys = Object.keys(NAMES).filter(function (k) { return typeof st[k] === "number"; });
    if (keys.length < 3) return [];
    var vals = keys.map(function (k) { return st[k]; });
    var spread = Math.max.apply(null, vals) - Math.min.apply(null, vals);

    // ① 상쇄형 — 반대 방향 두 갈래가 함께 높아 종합 좌표가 원점 쪽으로 모인 상태.
    if (coord && coord.length >= 2) {
      var ax = Math.abs(coord[0]) < COUNTER_BAND ? 0
             : Math.abs(coord[1]) < COUNTER_BAND ? 1 : -1;
      if (ax >= 0) {
        var pair = counterPair(st, NAMES, ax);
        return [pair
          ? "서로 반대쪽에 있는 " + B(pair[0]) + (jong(NAMES[pair[0]]) ? "과 " : "와 ")
            + B(pair[1]) + (jong(NAMES[pair[1]]) ? "이" : "가") + " 나란히 높게 나왔습니다."
          : "서로 반대쪽 매력 둘이 나란히 높게 나왔습니다.",
          "두 방향이 부딪히면서 각각이 덜 선명하게 읽힐 수 있습니다.",
          "부딪히는 자리를 한쪽으로 정리하면 인상이 또렷해집니다."];
      }
    }
    // ② 집중형
    if (spread >= 6)
      return ["한쪽으로 몰린 배합 — 그만큼 인상이 또렷하게 잡힙니다.",
              "이 방향을 더 깊게 밀고 가는 편이 잘 맞습니다."];
    // ③ 고른형
    if (spread < 3)
      return ["여덟 갈래가 거의 고르게 퍼졌습니다.",
              "자리에 따라 다르게 읽히니, 그날 쓰고 싶은 쪽을 골라 쓰면 됩니다."];
    // ④ 혼합형
    return ["몇 갈래가 나란히 섞인 배합입니다.",
            "위쪽 몇 개를 하나로 묶어 세우면 인상이 선명해집니다."];
  }

  // ── R1·R2 얼굴 비율 / 선·좌우 ──────────────────────────────
  // lecture.html verdicts()의 앱 이식판. 재는 기준이 둘로 갈려 있어 **반환도 둘로 갈랐다**:
  //   selfRatio() = 자기 얼굴 안의 비율(황금비·3분할) — 외부 표본이 필요 없다
  //   bandRows()  = 관측 분포 대비 위치(밴드·대칭) — shape-dist.json이 있어야 성립한다
  // 한 목록에 섞으면 "그래서 뭐랑 비교한 거지"를 유저가 묻게 된다(이론팀 §2-2).

  /** 황금비 대조 + 3분할. SHAPE 없이도 나온다. */
  function selfRatio(ratio, quality) {
    var CZM = root.CZM; if (!CZM || !ratio) return [];
    var out = [];
    var mouthNose = (ratio.mouth_w && ratio.nose_w) ? ratio.mouth_w / ratio.nose_w : null;
    // lip_ul은 뺐다 — 라벨이 산식과 반대로 읽힌다(아랫입술이 두꺼운데 "윗입술이 도톰한 편"이 나간다).
    // 이론팀 §2-2 검수 지적 · 마케팅 회부 중. 헷갈리게 말하느니 말하지 않는다.
    var golds = [
      CZM.goldenOf("face_HW", ratio.face_HW),
      CZM.goldenOf("mouth_nose", mouthNose),
      CZM.goldenOf("lip_ul", ratio.lip_ul_ratio),
      CZM.goldenOf("lower_balance", ratio.lower_balance),
      CZM.goldenOf("interocular", ratio.interocular)
    ].filter(Boolean);
    // p = 부위 페이지 배속(대표 지시 2026-08-25 부위 단위 분리). 값·산식 불변, 꼬리표만 붙인다.
    // face_HW는 「얼굴 비율」로 보낸다 — 가로:세로는 윤곽이 아니라 비율 이야기이고,
    // 같은 값에서 나온 폭 서술이 그 장에 있어 나란히 놓여야 서로 어긋나지 않는다.
    /* face_HW는 「얼굴형」 장으로 옮겼다(대표 D 2026-08-29 — 얼굴형 장에 face_HW 수치).
       lip_ul은 「입」 장으로(같은 지시 — 윗입술:아랫입술 행 이동). */
    /* mouth_nose는 「코」 장으로(2026-09-03 대표 — 코·입 분리 복원, 강의판 배속과 통일). */
    var GPART = { face_HW: "얼굴형", mouth_nose: "코", lip_ul: "입", interocular: "눈" };
    for (var i = 0; i < golds.length; i++) {
      var g = golds[i];
      // n = 큰 타이포로 서는 값 / v = 값 밑 한 줄 해설 / s = 기준 각주 (대표 C 2026-08-29)
      out.push({ k: g.name, v: g.label, p: GPART[g.key] || "비율", key: g.key,
                 n: "1 : " + g.value,
                 s: g.a + " 1 : " + g.b + " 기준 · 황금비율은 1 : " + (+g.ideal.toFixed(2)),
                 g: g });   // C1b 두 점 바 재료(표시 층 전용 — 판정·산식 불변, 2026-09-03 앱 격차 해소)
    }
    /* 「상 : 중 : 하」 — 대표 판정 2026-08-27로 유지한다(강의 리포트와 같은 판단).
       안면 3분할의 1:1:1은 φ(1:1.618)와 별개의 기준이다 — 신고전 안면 규범이
       얼굴 등분을 이상으로 삼는 것이고, φ는 다른 비례에 쓰는 다른 상수다.
       둘을 같은 말로 묶어 쓴 문구가 문제였지 기준이 문제였던 게 아니다.
       → '황금비율'을 떼고 '이상적 비율'로 쓴다.

       헤어라인 미검출이면 상안부가 이마 중간 기준으로 잡혀 **체계적으로 짧게** 나온다
       (검출O 0.173~0.314 vs 검출X 0.141~0.161 — 구간이 겹치지도 않는다).
       ⚠ 옛 저장분에는 이 플래그가 없어 undefined다. !==false라 통과시킨다. */
    var hairOK = !quality || quality.hairline_detected !== false;
    var th = hairOK ? CZM.thirdsGolden(ratio.upper, ratio.mid, ratio.lower) : null;
    if (th) out.push({ k: "상 : 중 : 하", n: th.relLine, v: th.label, p: "비율",
                       s: "이상적 비율은 1 : 1 : 1", th: th });   // C5 기둥 재료(표시 층 전용)
    return out;
  }

  /** 좌우 대칭 + 선·각도 밴드. SHAPE(관측 분포)가 없으면 **한 줄도 내지 않는다.** */
  function bandRows(ratio, line, SHAPE) {
    var CZM = root.CZM;
    var D = SHAPE && SHAPE.dist, L = SHAPE && SHAPE.labels;
    if (!CZM || !D || !L) return [];      // 틀린 기준으로 말하느니 말하지 않는다
    var out = [], l = line || {}, r = ratio || {};

    var av = CZM.asymVerdict(r.asym_score, D.asym_score, L.asym_score);
    if (av && av.label) {
      var t = r.asym_parts || {};
      var worst = Object.keys(t).sort(function (a, b) { return t[b] - t[a]; })[0];
      var KO = { eye_outer:"눈꼬리", eye_inner:"눈머리", brow:"눈썹", nose_wing:"콧방울",
                 mouth_corner:"입꼬리", jaw:"턱선", temple:"관자놀이" };
      // 이 밑줄들은 값에 붙는 캡션이라 전부 명사로 끝낸다. 문장으로 쓰면 여섯 줄이
      // 세로로 "~예요 ~예요 ~예요"가 되는데, 그건 대구가 아니라 그냥 같은 말이 여섯 번이다.
      out.push({ k: "좌우 균형", n: av.score + "%", v: av.label, p: "좌우",
                 s: (worst && KO[worst]) ? "얼굴 중앙선 대비 평균 어긋남 · 가장 차이가 큰 곳은 " + KO[worst]
                                         : "얼굴 중앙선을 놓고 좌우를 견준 값" });
    }
    function push(k, v, key, part, tail, num) {
      if (v == null || !D[key] || !L[key]) return;
      var b = CZM.bandOf(D[key], v, L[key]);
      if (b) out.push({ k: k, n: num, v: b.label, p: part, s: tail });
    }
    /* ⚠ 턱선(jaw_angular_deg) 서술을 내렸다 (2026-08-25, 오류대장 §045 · 이론 재판정).
       이 필드는 **인물 간 차이(SD_b 0.7533)보다 한 사람의 촬영 간 변동(SD_w 1.4679)이 2배 크다.**
       더 정밀히 재면 되는 문제가 아니라 **잴 대상에 개인차가 거의 없는** 문제다.
       그런 값으로 만든 문장은 유저의 얼굴이 아니라 **그날의 조명과 각도를 서술한다.**
       재현성 게이트 통과를 기다릴 이유가 없어서 게이트 이전에 실격 처리한다.
       판정 기여(asset-score)는 별건이다 — 폐기·재설계·유지는 이론 판단 대기.
    push("턱선", l.jaw_angular_deg, "jaw_angular_deg", "얼굴형", …); */
    push("턱끝",      l.chin_angle_deg,  "chin_angle_deg",  "얼굴형", "턱 끝이 모이는 각도",
         l.chin_angle_deg + "°");
    /* 눈매 라벨은 분포 3분위(bandOf)를 쓰지 않는다 — 그 라벨 사전에는 "내려온" 계열이
       없어서, 눈꼬리가 실제로 내려간 사람도 올라간 계열 라벨을 받았다. 부위 해설과
       기준이 갈리면 "해설은 내려와 있다는데 눈매는 올라갔다"는 모순이 화면에 선다
       (실사례 · 대표 2026-08-29). 부위 해설과 같은 기준으로 가른다 —
       자연 영점 0 + 표본 중앙값 2.305·SD_w 0.4288 (이론 v3 ref, part-report와 동일). */
    (function(){
      var v = l.eye_angle;
      if (typeof v !== "number" || !isFinite(v)) return;
      var label = v < 0 ? "내려온 눈매"
                : Math.abs(v - 2.305) < 0.4288 ? "수평에 가까운 눈매"
                : v >= 2.305 ? "뚜렷하게 올라간 눈매" : "조금 올라간 눈매";
      out.push({ k: "눈매", n: (v > 0 ? "+" : "") + v, v: label, p: "눈", key: "eye_angle",
                 s: "눈머리보다 눈꼬리가 얼마나 올라갔는지 본 값 (얼굴폭 대비 %)" });
    })();
    /* ⚠ 눈썹 모양(brow_arch_deg) 값 행도 뺐다 (2026-08-25 재현성 검증, r=0.57).
       이 필드는 OBS 사전·폭 서술에서 이미 빠졌는데 **여기 세 번째 자리에 남아 있었다** —
       같은 실격 값을 다른 계층에서 계속 말하고 있었다. 턱선을 두 곳 다 뺀 것과 같은 기준이다.
       한 곳만 남기면 "재현되지 않는 값이 각도까지 붙어" 나가므로 더 나쁘다.
       ⚠ 결과: 눈썹 장은 부위 판정 문장 하나만 남는다. 장이 얇아지는 것은 감수한다 —
         실격 값으로 장을 채우는 쪽이 나쁘다. 눈썹에 쓸 수 있는 측정이 생기면 그때 다시 연다
         (이론 측정확충 v1의 눈썹 진하기 contrast_brow가 후보 — 통로는 오늘 열렸다).
    push("눈썹 모양", l.brow_arch_deg, "brow_arch_deg", "눈썹", …); */
    // "(양수면 위)"는 개발자 표기다 — 0의 뜻부터 말한다(검수 2026-08-31).
    push("입꼬리",    l.mouth_corner,    "mouth_corner",    "입",     "입꼬리가 향하는 쪽 — 0이 수평, 클수록 위쪽",
         typeof l.mouth_corner === "number" ? (l.mouth_corner > 0 ? "+" : "") + l.mouth_corner : null);
    return out;
  }

  // ── 신설 측정값 행 (대표 D 2026-08-29) ─────────────────────
  /* photo.html이 2026-08-29 신설한 측정 19종 중 리포트 노출분.
     ⚠ 경계·밴드·분포가 아직 없다 — **숫자 + 중립 캡션만** 낸다. 방향 단정 문장은
       이론 게이트 통과 전 금지(어느 쪽이 어떤 인상인지는 이론팀이 경계를 정한 뒤의 일).
     값이 없으면(옛 측정·검출 실패) 그 행을 조용히 생략한다 — 없는 값을 지어내지 않는다. */
  function rawRows(d) {
    if (!d) return [];
    var r = d.ratio || {}, q = d.quality || {}, out = [];
    var num = function (v) { return typeof v === "number" && isFinite(v); };
    var one = function (part, k, v, cap, unit) {
      if (num(v)) out.push({ k: k, n: v + (unit || ""), s: cap, p: part });
    };
    var pair = function (part, k, a, b, la, lb, cap) {
      if (num(a) && num(b)) out.push({ k: k, n: la + " " + a + " · " + lb + " " + b, s: cap, p: part });
    };
    one("얼굴형", "측면 직선성", r.side_straight, "이마 폭 대비 하악 폭 — 1에 가까울수록 옆선이 일자");
    one("얼굴형", "하악 꺾임", r.gonial_ang, "광대 → 하악각 → 턱끝이 이루는 각도", "°");
    one("얼굴형", "턱 하강", r.jaw_drop, "하악각에서 턱끝까지 내려오는 깊이 (얼굴폭 대비)");
    // VLAS 대조표(2026-08-29)의 '재는데 침묵' 2종 — 옆광대·하관 비율
    one("얼굴형", "옆광대", r.cheek_out, "이마 폭 대비 광대 폭 — 1을 넘으면 광대가 옆으로 도드라지는 형태");
    one("얼굴형", "하관 비율", r.jaw_cheek, "광대 폭 대비 하악 폭");
    one("눈", "위 눈꺼풀 곡률", q.eye_curve_up, "눈 양끝을 이은 직선에서 가운데가 벗어난 정도 (눈 길이 대비)");
    one("눈", "아래 눈꺼풀 곡률", q.eye_curve_dn, "아래 눈꺼풀이 같은 직선에서 벗어난 정도 — 둘 다 작으면 직선적인 눈");
    pair("눈", "흰자 노출", q.sclera_up, q.sclera_dn, "위", "아래",
         "홍채 반지름 대비 눈꺼풀까지 거리 — 1을 넘으면 그쪽 흰자가 드러납니다");
    one("눈", "눈 바깥 여백", q.eye_gap_out, "눈꼬리에서 얼굴 윤곽까지 (얼굴폭 대비)");
    one("눈썹", "눈썹 길이", q.brow_len, "안쪽 끝에서 바깥 끝까지 (얼굴폭 대비)");
    one("눈썹", "눈썹 두께", q.brow_thick, "위선과 아래선의 세로 간격 (얼굴높이 대비)");
    one("눈썹", "산 위치", q.brow_peak, "눈썹 길이에서 산이 놓인 지점 — 0.5가 가운데, 클수록 바깥쪽");
    one("눈썹", "미간 너비", q.glabella_w, "눈썹 안쪽 끝 사이 (얼굴폭 대비)");
    // 코·입은 한 장이라 배속(p)이 같다 — 코 행이 먼저 서고 입 행이 뒤따른다.
    one("입", "코 길이", q.nose_len, "코뿌리에서 코밑까지 (얼굴높이 대비)");
    one("입", "코 너비", r.nose_w, "콧방울 폭 (얼굴폭 대비)");
    one("입", "콧볼 두께", q.ala_thick, "콧볼 바깥 폭 대비 안쪽 폭");
    one("입", "콧구멍 노출", q.nostril_show, "코끝이 콧볼 아래선보다 위에 있는 정도 (얼굴높이 대비)");
    one("입", "인중 길이", q.philtrum, "코밑에서 윗입술 위까지 (얼굴높이 대비)");
    one("입", "입 너비", r.mouth_w, "입꼬리 사이 (얼굴폭 대비)");
    // "~비율 행의 원자료"는 개발자 말이지 유저 말이 아니다(검수 2026-08-31). 측정 기준만 남긴다.
    pair("입", "입술 두께", r.lip_upper, r.lip_lower, "윗", "아랫",
         "위·아래 입술 각각의 두께 (얼굴높이 대비)");
    return out;
  }

  // ── R11 폭·거리 서술 [마케팅 게이트 통과 2026-08-25] ────────
  // 대표 지시 2026-08-25: **폭 서술을 연다.** 단 사실에서 끊지 않는다.
  //   "미간이 좁아요"        → 판정으로 읽힌다(까는 말이 된다)
  //   "미간이 좁아서 중심부가 짧아 보이고, 눈에 시선이 더 잘 가요" → 관찰이 된다
  // 두 번째가 정보를 **더** 준다. 덜 주면서 안전한 게 아니라 더 주면서 안전하다.
  //
  // ⚠ 위 문장은 **본보기가 아니라 예시다**(대표 2026-08-25). 초안 36개가 전부
  //   "[사실]+해서/아서+[그래서 어떻게 보이나]" 한 틀로 나왔던 이유가 그것을 틀로 쓴 것이다.
  //   지켜야 할 것은 리듬이 아니라 원리 하나다 — **사실을 빼지 않았고, 그 사실이 유저에게
  //   무엇을 뜻하는지까지 갔는가.** 그 원리만 지키면 문장은 짧아도, 처방까지 가도, 명사로 끊어도 된다.
  //   새 문형을 규칙으로 못 박지 않는다. 못 박는 순간 그것이 다음 번 3주기 반복이 된다.
  //
  // ⚠ 이론 정본(마스터 L588)은 폭 서술을 "판별력이 확보돼도 유저 카드 영구 비노출"로 두고 있다.
  //   대표가 2026-08-25 이 조항을 뒤집었다. 여기 사전은 **표시 계층**이고, 정본 개정은 이론팀 몫이다
  //   — 이론 회부 사항으로 남긴다. 처방까지 가는 문장(면적·앞머리·립·목선) 5개도 같이 회부한다.
  // ⚠ 두 벌인 이유는 MUTE_LINE과 같다. 한 장에 여러 줄이 세로로 쌓이면 "~니다 ~니다"가 되는데,
  //   그건 대구가 아니라 같은 말이 반복되는 것이다. 붙는 자리(짝/홀)로 어미를 갈라 쓴다.
  //   [0]은 부위 판정 문장("~에 가까워요") 바로 밑에 서므로 ~요로 끝내지 않는다.
  //   [1]은 [0] 밑에 서므로 ~니다를 쓰지 않는다. **이건 어미 배치일 뿐 문장 모양은 자유다.**
  /* ⚠ 재현성 미달 4종을 사전에서 내렸다 (2026-08-25 재현성 검증 · 12명 × 21회 촬영).
       판정 기준 SD_w < 0.35 × SD_b를 넘긴 값 — eye_len(0.44) · brow_eye_gap(0.52) ·
       lip_thickness(0.44) · jaw_w(0.43). 뜻은 하나다: **같은 사람이 5분 뒤에 다시 찍기만 해도
       "입이 시원하게 넓어요"가 "입이 단정하게 모여 있어요"로 넘어갈 수 있다.**
       그 문장은 유저의 얼굴이 아니라 그날의 촬영을 서술한다. 잘 다듬어도 틀린 말이라
       문구를 고치지 않고 항목을 뺐다 — 오늘 턱선(jaw_angular_deg)을 뺀 것과 같은 처리다.
       사전에서 빠지면 그 부위는 조용히 건너뛴다.
     ⚠ interocular · mouth_w는 삭제 목록에도 통과 목록에도 없다. 판정을 안 받은 값이므로
       현상 유지로 두되 **이론 회부 대기**다. 다음 재현성 판정에서 갈린다. */
  /* 이상비가 있는 셋(interocular·mouth_w·face_HW)은 여기서 뺐다 — 대표 지시 2026-08-27.
     "내가 준 샘플에 가로세로 비율있잖아 1:1.618 얼굴의 길이와 너비"
     이 층은 12명 표본 대비 방향으로 말한다. 그 셋은 이상비(φ·1.0)가 있으므로
     **이상비 행이 맡는다** — 행은 숫자를 보여주므로 사람마다 다르게 나온다.
     남은 chin_len·parts_vpos는 대응 이상비가 아직 없어 이 층에 둔다(이론 확인 대상). */
  var WIDTH = {
    chin_len: {
      hi: ["턱이 길게 떨어져 옆에서 볼 때 윤곽이 살아납니다.",
           "턱이 길게 떨어져 얼굴 아래쪽이 시원하게 뻗고, 옆선이 또렷하게 잡힙니다."],
      /* "눈코입이 가운데로 당겨 보이는 배치예요"를 걷었다(대표 2026-08-29 "뜻이 안 통함").
         이 행이 측정한 것은 턱 길이 하나다 — 눈코입 위치는 parts_vpos의 몫이라 여기서
         섞어 말하면 무엇을 측정해 하는 말인지 알 수 없게 된다. 측정한 것만 말한다. */
      lo: ["입술 아래에서 턱 끝까지가 짧은 편입니다. 얼굴에서 턱이 차지하는 몫이 작은 만큼 시선이 눈코입에 먼저 갑니다.",
           "입술 아래에서 턱 끝까지가 짧은 편입니다. 얼굴에서 턱 몫이 작은 만큼 시선이 눈코입으로 먼저 향합니다."],
      /* mid — 중간대(|관측−중앙값|<SD_w)는 방향을 단정하지 않는다(대표 2026-08-29
         "중간값을 두고 중간값해설을 만들면되지"). 균형은 애매함이 아니라 가진 것으로 말한다.
         [마케팅 사후 검수 대상] */
      mid: ["턱 길이는 어느 쪽으로도 기울지 않은 균형 자리입니다. 헤어나 넥라인 어느 연출도 무리 없이 받는 바탕입니다.",
            "턱 길이는 균형에 가깝습니다. 어느 쪽 연출도 무리 없이 받는 바탕입니다."]
    },
    parts_vpos: {
      /* ⚠ "이마가 넓게 열린다"는 말을 걷었다 (2026-08-25 실측). 같은 장 아래에 3분할 행이
         "상안부가 짧은 편이에요"로 서 있어서, 한 화면에서 이마가 넓다와 짧다가 나란히 섰다.
         두 값의 기준이 다르다 — parts_vpos는 얼굴 상자 대비 이목구비 위치, 상안부는 헤어라인
         기준 세로 길이다. 화면에 수치를 내는 쪽(3분할)이 정본이라는 게 이 파일의 기존 판단이므로
         문장에서 이마 서술을 빼고 **잰 것(이목구비 위치)만** 말한다.
         근본 해결은 widthDirs가 parts_vpos도 3분할 기준으로 다시 잡는 것 — 개발·이론 회부. */
      hi: ["이목구비가 아래쪽에 모여 얼굴 무게가 아래로 내려앉고, 인상이 차분하게 읽힙니다.",
           "이목구비가 아래쪽에 자리를 잡았습니다. 눈매에 힘을 주면 위아래 무게가 고르게 맞는 배치입니다."],
      lo: ["이목구비가 위쪽에 자리해 얼굴 중심이 위로 당겨집니다. 정면에서 또랑또랑한 인상이 먼저 잡힙니다.",
           "이목구비가 위쪽에 자리해 인상이 또랑또랑하게 잡힙니다."],
      // mid 사유는 chin_len과 같다. [마케팅 사후 검수 대상]
      mid: ["이목구비가 위아래 어느 쪽으로도 쏠리지 않은 배치입니다. 포인트를 어디에 두느냐에 따라 인상의 무게를 자유롭게 옮길 수 있습니다.",
            "이목구비 위치는 위아래 균형에 가깝습니다. 포인트 메이크업의 자리로 인상의 무게를 옮길 수 있는 배치입니다."]
    }
  };
  // 부위 페이지 배속. 한 장에 두 줄까지만 — 세 줄부터는 카드 안에 스크롤이 생긴다.
  // 눈썹은 배속이 통째로 비었다(brow_eye_gap 삭제) — 그 장은 폭 서술 없이 판정 문장만 선다.
  var WIDTH_PART = {
    얼굴형: ["chin_len"],
    비율:   ["face_HW", "parts_vpos"],
    눈:     ["interocular"],
    입:     ["mouth_w"]
  };

  /** 분포 중앙값 대비 방향. 밴드 라벨이 없는 필드(jaw_w 등)에서 hi/lo만 얻는다. */
  function medianDir(sorted, v) {
    if (!Array.isArray(sorted) || sorted.length < 6 || typeof v !== "number" || !isFinite(v)) return null;
    var m = sorted[Math.floor((sorted.length - 1) / 2)];
    return v === m ? null : (v > m ? "hi" : "lo");
  }

  /**
   * 부위 한 장에 붙는 폭·거리 문장.
   * @param dirs {필드: "hi"|"lo"} — 방향은 부르는 쪽이 정한다(엔진 detail의 부호 또는 medianDir)
   * @return [{f, t}] — 최대 2줄. f를 함께 돌려주는 이유: 부르는 쪽이 **같은 필드를
   *   부위 문장에서 빼야** 한 장에 같은 말이 두 번 서지 않는다.
   */
  function widthLines(part, dirs) {
    var fields = WIDTH_PART[part] || [];
    var out = [];
    for (var i = 0; i < fields.length && out.length < 2; i++) {
      var f = fields[i], d = dirs && dirs[f];
      if (!d || !WIDTH[f] || !WIDTH[f][d]) continue;
      out.push({ f: f, t: WIDTH[f][d][out.length % 2] });
    }
    return out;
  }

  // ── R4 「지금의 나」 근거 ───────────────────────────────────
  // 지금까지 이 장은 8명이 완전히 같은 두 문장을 받았다(타입명 + 고정 desc).
  // 고정 desc는 그대로 두고(타입 소개는 필요하다) **내 측정에서 나온 근거**를 뒤에 붙인다.
  var COLOR_OBS_ALIAS = { contrast_overall: "contrast", chroma: "chroma" };
  // hue_angle은 뺐다 — OBS 사전에 어휘가 없다. 없는 말을 만들지 않는다.
  var PART_LABEL = { 윤곽:"윤곽", 눈:"눈", 눈썹:"눈썹", 입:"입", 코:"코", 볼입체:"볼·입체" };

  /**
   * @param score  AS.scoreOne() 결과
   * @param OBS    part-report의 관찰 어휘 사전(마케팅 검수 통과분). 없으면 빈 배열
   * @return string[] — 기존 desc 뒤에 그대로 붙인다
   */
  /** @param skip {필드:1} — 부위 장의 폭 서술이 이미 가져간 필드. 여기서 또 말하면
   *    두 장이 다른 기준으로 같은 값을 말해 정반대로 읽힌다(2026-08-25 실측).
   *  @param surveyName 설문이 정한 타입명. 이 장의 판정("~에 가깝습니다")이 설문 결과인데,
   *    측정 근거를 출처 없이 붙이면 측정이 그 판정을 만든 것처럼 읽힌다 — 사진 종합이
   *    설문과 다를 때 "왜 이게 나왔는지 이해가 안 간다"가 되는 원인(대표 2026-08-29).
   *    사진이 읽은 타입을 먼저 밝히고, 관찰은 그 타입의 근거로 붙인다. */
  function whyThisType(score, OBS, skip, surveyName) {
    if (!score || !OBS) return [];
    var det = score.detail || [], out = [];
    var byS = function (a, b) { return Math.abs(b.s) - Math.abs(a.s); };
    var photoType = score.overallType && score.overallType.type;

    // 출처 문장 — 설문(스타일 응답)과 사진(형태 측정)은 재는 것이 다르다. 다르면 다르다고 말한다.
    if (photoType && surveyName) {
      out.push(photoType === surveyName
        ? "사진으로 측정한 결과도 같은 방향입니다."
        : "사진으로 측정한 얼굴은 " + (jong(photoType) ? photoType + "이" : photoType + "가")
          + " 조금 더 강하게 잡혔습니다. 설문은 지금 하고 있는 스타일을, 사진은 타고난"
          + " 형태를 읽기 때문에 둘이 다를 수 있습니다.");
    }

    /* 형태 근거 3개 — 부위 무관 전역 |s| 상위.
       ⚠ 방향 사전은 buildPartRows와 같은 규칙으로 고른다(mid → 균형 · below → 단정형).
         hi/lo만 보면 중간대 얼굴에 방향을 단정하고, 실제로 내려간 눈에 "올라가 있다"가 나간다.
       ⚠ 이유형(-서요)으로 문장을 끝내지 않는다(대표 2026-08-29 "~해서요로 끝내는 경우가
         도대체 어디 있는지"). 마지막 관찰은 평서 종결형 d로 닫는다 — part-report와 같은 처리다. */
    var shape = det.filter(function (d) { return d.part !== "색" && d.s !== null && OBS[d.key] && !(skip && skip[d.key]); })
                   .sort(byS).slice(0, 3)
                   .map(function (d) {
                     var dir = d.mid ? "mid" : (d.s >= 0 ? "hi" : (d.below ? "lo0" : "lo"));
                     return OBS[d.key][dir];
                   }).filter(Boolean);
    if (shape.length) {
      // 같은 부위가 두 번 뽑히면 "눈썹이 곧게 뻗고, 눈썹이 눈에 가깝게 붙고"가 된다.
      // 두 번째부터는 주어를 지운다 — part-report가 행 안에서 하는 것과 같은 처리다.
      var seen = {};
      var phrase = function (w, last) {
        var t = last ? (w.d || (w.e || "").replace(/서요$/, "요")) : w.c;
        var m = t.match(/^(\S+?)(이|가|은|는)\s/);
        if (m) { if (seen[m[1]]) t = t.slice(m[0].length); else seen[m[1]] = 1; }
        return t;
      };
      out.push("측정에서 도드라진 특징 — " + shape.map(function (w, i) {
        return phrase(w, i === shape.length - 1);
      }).join(", ") + ".");
    }

    // 색 근거 1개 — 색 신호가 3종뿐이고 그중 하나는 어휘가 없다. 하나만 낸다.
    var col = det.filter(function (d) {
      return d.part === "색" && d.s !== null && OBS[COLOR_OBS_ALIAS[d.key]];
    }).sort(byS)[0];
    if (col) {
      var w = OBS[COLOR_OBS_ALIAS[col.key]][col.s >= 0 ? "hi" : "lo"];
      var decl = (w.d || (w.e || "").replace(/서요$/, "요")) + ".";
      // "색 쪽에서는 — " 은 대시로 말을 끊어 문장이 안 끝난 꼴이었다(검수 2026-08-31).
      out.push("색에서 잡힌 특징은 하나 — " + decl);
    }

    // 못 잰 부위는 여기서 말하지 않는다. 바로 앞 장(파트별 나)이 그 부위 행에서 이미
    // "사진에서 잘 안 잡혔어요"라고 말하고 있고, 게다가 지금 분포에서는 입·코·볼이 전원 결측이라
    // 여기 넣으면 모두가 같은 문장을 받는다 — 한 화면 한 메시지에도, 정보량에도 어긋난다.
    return out;
  }

  // ── R6 퍼스널컬러 근거 ─────────────────────────────────────
  // "왜 그 계절인지 한 글자도 없다"가 이 장의 문제였다. 지금 저장돼 있는 값으로 말할 수 있는 것만 말한다.
  // ⚠ 채도·명도·대비의 축별 갈림(R6-b)은 pc12.five_axis와 앵커 벡터가 있어야 하는데
  //   chugu_photo_result에 안 담긴다. 없는 근거를 지어내지 않고 그 문장을 통째로 뺐다.
  // 두 벌인 이유: 앞에 웜쿨 문장(~니다)이 서면 여기는 ~요로 받아야 어미가 안 겹친다.
  // 웜쿨이 결측이면 계절 문장(~예요) 바로 뒤라 반대로 ~니다가 필요하다.
  var MUTE_LINE = {
    // "톤다운"은 업계어라 쉬운 풀이를 붙인다 (대표 2026-08-29)
    mute_confirmed:  ["드레이핑에서는 톤다운 쪽 — 채도가 낮고 회색이 살짝 섞인 색을 고르셨습니다.",
                      "드레이핑에서 고른 것은 톤다운 쪽 — 채도가 낮고 회색이 살짝 섞인 색입니다."],
    clear_confirmed: ["드레이핑에서는 선명한 쪽을 고르셨습니다.", "드레이핑에서 고른 것은 선명한 쪽입니다."],
    mute_tentative:  ["채도가 낮고 회색이 살짝 섞인 톤다운 계열로 기울어 보이며, 드레이핑 확인은 아직입니다.",
                      "채도가 낮고 회색이 살짝 섞인 톤다운 계열로 기울어 보입니다. 드레이핑 확인은 아직 전입니다."]
  };
  // 촬영 품질 각주(qualityNote)는 삭제했다 — 대표 지시 2026-08-25.
  // "사진이 흐릿하게 잡혔어요"·"밝기 보정을 못 걸었어요"는 **우리 측정이 못 미덥다**는 자백이고,
  // 유저가 그 문장을 읽고 할 수 있는 게 없다. 신뢰만 깎인다.
  // ⚠ 결측 고지("입은 사진에서 잘 안 잡혔어요")와 혼동하지 않는다 — 그건 안 한 판정의 사실 고지라
  //   남긴다(part-report의 강등 ①). 빼면 판정 안 한 것을 한 것처럼 보이게 된다.

  /** @return {wcLine, muteLine} — 없는 것은 null. 호출부가 있는 것만 붙인다. */
  function whyThisSeason(d) {
    if (!d) return null;
    var wc = d.warm_cool || {}, out = { wcLine: null, muteLine: null };
    if (typeof wc.v === "number" && isFinite(wc.v)) {
      // |v| 크기는 말하지 않는다 — 연속값을 노출하면 곧 "얼마부터 확실한가"의 밴드를 만들게 된다.
      out.wcLine = wc.borderline
        ? "웜과 쿨 사이 경계라 한쪽으로 딱 떨어지지는 않았습니다."
        : (wc.v > 0 ? "피부색이 노란기 쪽으로 기울어 웜으로 판별됐습니다."
                    : "피부색이 푸른기 쪽으로 기울어 쿨로 판별됐습니다.");
    }
    /* 외부진단 입력자에게 "드레이핑 확인은 아직"을 말하지 않는다(대표 지시 2026-08-29).
       본인이 타입을 직접 입력했으면 드레이핑 결과값을 역추론할 수 있어 미확인 고지가
       사실과 어긋난다. 확정 문구(mute/clear_confirmed)는 그대로 나간다. */
    if (d.mute === "mute_tentative" && d.pc_declared) { /* 억제 */ }
    else if (d.mute && MUTE_LINE[d.mute]) out.muteLine = MUTE_LINE[d.mute][out.wcLine ? 0 : 1];
    return out;
  }

  // ── R7 부위별 격차 ─────────────────────────────────────────
  // 4절이 축 방향 서술을 폐기한 뒤 아무 구체도 안 남았다. 축이 아니라 **부위**로 말한다 —
  // "카리스마가 화려함보다 부드럽다"는 안 읽히지만 "윤곽은 추구미 쪽이 더 또렷하다"는 읽힌다.
  var DIR = { D: ["더 부드러운 인상", "더 또렷한 인상"],
              T: ["더 따뜻한 인상", "더 시원한 인상"],
              M: ["더 어려 보이는 인상", "더 성숙한 인상"] };

  /**
   * @param gap AS.gapToWant(score, wantTypeName) 결과. 없으면 null이 들어온다(설문만 한 유저)
   * @return string[] — 최대 2문단. 수치는 한 글자도 내보내지 않는다(정본 §3-4).
   */
  function gapByPart(gap) {
    if (!gap || !gap.parts || gap.parts.length < 2) return [];
    var ps = gap.parts, out = [];
    var dirOf = function (p) {
      var ax = ["D", "T", "M"].sort(function (a, b) { return Math.abs(p["d" + b]) - Math.abs(p["d" + a]); })[0];
      var v = p["d" + ax];
      return v === 0 ? null : DIR[ax][v > 0 ? 1 : 0];
    };
    var far = ps[0], dir = dirOf(far);
    if (!dir) return [];
    var name = PART_LABEL[far.part] || far.part;
    // 둘째 부위는 **격차도 가깝고 방향도 같을 때만** 병기한다. 방향이 다르면 두 문장이 되고,
    // 두 문장이 되면 그 순간 결핍 목록이 된다. 0.8은 nearestType의 인접 기준을 빌린 것 — 새 상수가 아니다.
    var second = ps[1];
    var alsoName = (second.gap >= far.gap * 0.8 && dirOf(second) === dir) ? (PART_LABEL[second.part] || second.part) : null;
    out.push("가장 다른 데는 " + (alsoName ? gwa(name) + " " + alsoName : name)
           + "입니다. 추구미 쪽이 " + dir + "입니다.");
    // 이미 닿은 부위 — **반드시 함께 낸다.** 이게 없으면 위 문장만 남아 결핍 목록이 된다.
    var near = ps[ps.length - 1];
    // "여기서부터 ~면 돼요"를 쓰지 않는다 — 같은 장 위쪽 photoGapLine이 이미
    // "여기서부터 움직이면 돼요"로 끝난다(2026-08-25 실측, 한 화면에 두 번).
    if (near.part !== far.part && (!alsoName || near.part !== second.part))
      out.push(eun(PART_LABEL[near.part] || near.part)
             // "나머지"를 쓰지 않는다 — 두 줄 아래 4절 맺음말이 "나머지가 이번에 채울 자리예요."다.
             + " 이미 그 방향에 가까이 가 있습니다. 여기에 맞춰가면 그만큼 좁혀집니다.");
    return out;
  }

  root.RX = {
    statNarrative: statNarrative, topRanks: topRanks,
    selfRatio: selfRatio, bandRows: bandRows, rawRows: rawRows,
    widthLines: widthLines, medianDir: medianDir,
    whyThisType: whyThisType, whyThisSeason: whyThisSeason, gapByPart: gapByPart,
    version: "explain_v2"
  };
})(typeof window !== "undefined" ? window : globalThis);
