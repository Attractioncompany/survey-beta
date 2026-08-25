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
  /**
   * 스탯 8값 → 배합 해설 3문장. 사진이 없어도 나오는 유일한 확충분이다.
   * @param st     {romantic:4, …} 정수 8값 (합 30, 성장분 포함)
   * @param topK   결과가 정한 1위 키 — 그림·기존 문장과 같은 정본을 쓴다
   * @param NAMES  키→한글 이름
   * @param bold   이름 강조 함수(색 입히기). 없으면 그대로 쓴다
   * @return string[] — 기존 topLine 뒤, 총량 안내 앞에 그대로 끼운다
   */
  function statNarrative(st, topK, NAMES, bold) {
    if (!st || !NAMES) return [];
    var B = bold || function (k) { return NAMES[k]; };
    var keys = Object.keys(NAMES).filter(function (k) { return typeof st[k] === "number"; });
    if (keys.length < 3) return [];
    var sorted = keys.slice().sort(function (a, b) { return st[b] - st[a]; });
    var out = [];

    // R5-a 2·3위 — 1위 및 1위와 동점인 축(기존 topLine이 이미 부른 이름)은 뺀다.
    var topV = st[topK];
    var rest = sorted.filter(function (k) { return k !== topK && st[k] < topV; });
    if (rest.length >= 2) {
      var cut = st[rest[1]];                       // 3위 값
      var run = rest.filter(function (k) { return st[k] >= cut; });   // 3·4위 동점이면 병기
      // 넷 이상이 나란하면 "뒤를 받친다"는 말이 성립하지 않는다. 그건 받치는 게 아니라 다 같은 것이고,
      // 바로 아래 배합 문장이 이미 그 사실을 말한다. 이름을 늘어놓아 봐야 정보가 0이라 줄을 뺀다.
      if (run.length <= 3) {
        var names = run.map(B), lastName = NAMES[run[run.length - 1]];
        out.push("뒤로는 " + names.slice(0, -1).join(", ") + (names.length > 1 ? ", " : "")
               + names[names.length - 1] + (jong(lastName) ? "이" : "가") + " 받치고 있습니다.");
      }
    }

    // R5-c 최저 축 — 동점이면 문장을 뺀다(최저가 둘이면 "가장 적게"가 거짓말이 된다).
    // ⚠ 화법이 전부다. 30점 총합 고정이라 낮다는 건 다른 데 몰아줬다는 뜻일 뿐이고,
    //   그게 문장 안에 드러나야 절대 매력 점수로 읽히지 않는다.
    // 끝을 ~죠로 맞춘 건 취향이 아니다. 바로 뒤 총량 안내가 두 벌인데(~니다 / 성장분이 있으면 ~요)
    // 어느 쪽이 오든 안 겹치는 어미가 ~죠뿐이다.
    var vals = keys.map(function (k) { return st[k]; });
    var lowV = Math.min.apply(null, vals);
    var lows = keys.filter(function (k) { return st[k] === lowV; });
    var lowLine = (lows.length === 1 && lowV < topV)
      ? B(lows[0]) + (jong(NAMES[lows[0]]) ? "은" : "는")
        + " 지금 가장 적게 쓰고 있는 카드입니다. 부족해서가 아니라 다른 쪽에 더 많이 나눠준 결과죠."
      : null;

    // R5-b 배합의 성격 — [가설] 구간. 어미가 두 벌인 이유는 이 줄이 앞뒤 어느 쪽에도 붙을 수 있어서다.
    //   앞: R5-a(~니다) 또는 topLine(~예요) / 뒤: R5-c(~니다) 또는 총량 안내(~니다 또는 ~요)
    // ~요 형은 **앞에 R5-a가 서고 뒤에 R5-c가 올 때만** 안전하다. 나머지 경우는 명사 종결로 간다 —
    // 명사는 어느 어미와도 안 겹치기 때문이다.
    var spread = Math.max.apply(null, vals) - Math.min.apply(null, vals);
    var soft = out.length > 0 && lowLine;
    out.push(spread >= 6 ? (soft ? "한쪽으로 몰린 배합이라 인상이 또렷하게 잡혀요."
                                 : "한쪽으로 몰린 배합 — 그만큼 인상이 또렷하게 잡히는 쪽.")
           : spread >= 3 ? (soft ? "몇 갈래가 나란히 섞인 배합이에요."
                                 : "몇 갈래가 나란히 섞인 배합.")
                         : (soft ? "상황에 따라 다르게 읽힐 만큼, 여덟 갈래가 고르게 퍼져 있어요."
                                 : "여덟 갈래가 거의 고르게 퍼진 배합 — 상황에 따라 다르게 읽히는 얼굴."));
    if (lowLine) out.push(lowLine);

    return out;
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
      CZM.goldenOf("interocular", ratio.interocular)
    ].filter(Boolean);
    for (var i = 0; i < golds.length; i++) {
      var g = golds[i];
      out.push({ k: g.name, v: g.label,
                 s: g.a + " 1 : " + g.b + " " + g.value + "  ·  황금비율은 1 : " + (+g.ideal.toFixed(2)) });
    }
    // 헤어라인 미검출이면 상안부가 이마 중간 기준으로 잡혀 **체계적으로 짧게** 나온다
    // (검출O 0.173~0.314 vs 검출X 0.141~0.161 — 구간이 겹치지도 않는다). 그 상태의 3분할은 틀린 말이다.
    // ⚠ 옛 저장분에는 이 플래그가 없어 undefined다. !==false라 통과시킨다 — lecture.html과 같은 판단이다.
    var hairOK = !quality || quality.hairline_detected !== false;
    var th = hairOK ? CZM.thirdsGolden(ratio.upper, ratio.mid, ratio.lower) : null;
    // "황금비율 기준은 1 : 1 : 1" → 황금비는 1 : 1.618이라 유저에게 거짓말이 된다.
    // 3분할은 균등이 기준이므로 그대로 균등이라고 쓴다(값·산식 불변, 문구만).
    if (th) out.push({ k: "상 : 중 : 하", v: th.relLine, s: th.label + " · 고르게 나뉘면 1 : 1 : 1" });
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
      out.push({ k: "좌우 균형", v: av.label,
                 s: (worst && KO[worst]) ? "가장 차이가 큰 곳은 " + KO[worst]
                                         : "얼굴 중앙선을 놓고 좌우를 견준 값" });
    }
    function push(k, v, key, tail) {
      if (v == null || !D[key] || !L[key]) return;
      var b = CZM.bandOf(D[key], v, L[key]);
      if (b) out.push({ k: k, v: b.label, s: tail });
    }
    push("턱선",      l.jaw_angular_deg, "jaw_angular_deg", l.jaw_angular_deg + "° — 턱선이 꺾이는 정도");
    push("턱끝",      l.chin_angle_deg,  "chin_angle_deg",  l.chin_angle_deg + "° — 턱 끝이 모이는 각도");
    push("눈매",      l.eye_angle,       "eye_angle",       "눈머리보다 눈꼬리가 얼마나 올라갔는지 본 값");
    push("눈썹 모양", l.brow_arch_deg,   "brow_arch_deg",   l.brow_arch_deg + "° — 눈썹 산이 솟은 정도");
    push("입꼬리",    l.mouth_corner,    "mouth_corner",    "입꼬리가 향하는 쪽");
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
  function whyThisType(score, OBS) {
    if (!score || !OBS) return [];
    var det = score.detail || [], out = [];
    var byS = function (a, b) { return Math.abs(b.s) - Math.abs(a.s); };

    // 형태 근거 3개 — 부위 무관 전역 |s| 상위. 정본 템플릿("[관찰1]하고, [관찰2]해서요")을 셋으로 늘린 것뿐,
    // 새 어휘가 없다. 연결형 c로 잇고 마지막만 이유형 e로 닫는다.
    var shape = det.filter(function (d) { return d.part !== "색" && d.s !== null && OBS[d.key]; })
                   .sort(byS).slice(0, 3)
                   .map(function (d) { return OBS[d.key][d.s >= 0 ? "hi" : "lo"]; });
    if (shape.length) {
      // 같은 부위가 두 번 뽑히면 "눈썹이 곧게 뻗고, 눈썹이 눈에 가깝게 붙어서요"가 된다.
      // 두 번째부터는 주어를 지운다 — part-report가 행 안에서 하는 것과 같은 처리다.
      var seen = {};
      var phrase = function (w, last) {
        var t = last ? w.e : w.c;
        var m = t.match(/^(\S+?)(이|가|은|는)\s/);
        if (m) { if (seen[m[1]]) t = t.slice(m[0].length); else seen[m[1]] = 1; }
        return t;
      };
      out.push("이렇게 나온 건 " + shape.map(function (w, i) {
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
      // 앞에 형태 근거(~서요)가 섰으면 ~니다로 받고, 이 줄이 첫 줄이면 desc(~니다)를 ~요로 받는다.
      out.push(out.length ? "색을 재 봐도 같은 쪽입니다. " + decl : "색 쪽에서도 같은 방향 — " + decl);
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
    mute_confirmed:  ["드레이핑에서는 톤다운 쪽을 고르셨어요.", "드레이핑에서는 톤다운 쪽을 고르셨습니다."],
    clear_confirmed: ["드레이핑에서는 선명한 쪽을 고르셨어요.", "드레이핑에서는 선명한 쪽을 고르셨습니다."],
    mute_tentative:  ["톤다운 계열로 기울어 보이는데, 드레이핑 확인은 아직이에요.",
                      "톤다운 계열로 기울어 보이는데, 드레이핑 확인은 아직입니다."]
  };
  // 신뢰도를 깎은 이유 — **불리언 플래그만** 쓴다. "기기가 몇 도 이상 기울면 경고"는
  // 우리가 문턱을 새로 긋는 것이라 D26(밴드 상수 창작 금지)에 걸린다.
  function qualityNote(q) {
    if (!q) return null;
    if (q.hazy) return "사진이 조금 흐릿하게 잡혔어요";
    if (q.L_corrected === false) return "흰 기준을 못 찾아 밝기 보정을 못 걸었어요";
    if (q.forehead_used === false) return "이마가 가려져 피부 표본이 좁았어요";
    return null;
  }

  /** @return {wcLine, muteLine, confNote} — 없는 것은 null. 호출부가 있는 것만 붙인다. */
  function whyThisSeason(d) {
    if (!d) return null;
    var wc = d.warm_cool || {}, out = { wcLine: null, muteLine: null, confNote: null };
    if (typeof wc.v === "number" && isFinite(wc.v)) {
      // |v| 크기는 말하지 않는다 — 연속값을 노출하면 곧 "얼마부터 확실한가"의 밴드를 만들게 된다.
      out.wcLine = wc.borderline
        ? "웜과 쿨 사이 경계라 한쪽으로 딱 떨어지지는 않았습니다."
        : (wc.v > 0 ? "피부색이 노란기 쪽으로 기울어 웜으로 갈렸습니다."
                    : "피부색이 푸른기 쪽으로 기울어 쿨로 갈렸습니다.");
    }
    if (d.mute && MUTE_LINE[d.mute]) out.muteLine = MUTE_LINE[d.mute][out.wcLine ? 0 : 1];
    out.confNote = qualityNote(d.quality);
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
    out.push("가장 다른 데는 " + (alsoName ? gwa(name) + " " + ieyo(alsoName) : ieyo(name))
           + ". 추구미 쪽이 " + dir + "이죠.");
    // 이미 닿은 부위 — **반드시 함께 낸다.** 이게 없으면 위 문장만 남아 결핍 목록이 된다.
    var near = ps[ps.length - 1];
    if (near.part !== far.part && (!alsoName || near.part !== second.part))
      out.push(eun(PART_LABEL[near.part] || near.part)
             + " 이미 그 방향에 가까이 가 있습니다. 여기서부터 이어가면 돼요.");
    return out;
  }

  root.RX = {
    statNarrative: statNarrative,
    selfRatio: selfRatio, bandRows: bandRows,
    whyThisType: whyThisType, whyThisSeason: whyThisSeason, gapByPart: gapByPart,
    version: "explain_v1"
  };
})(typeof window !== "undefined" ? window : globalThis);
