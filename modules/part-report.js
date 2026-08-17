// 3절 「파트별 나」 — 리포트 정본 v1.3 §3-3 · §3-3-1 · §3-6-1 구현
// 지위: [가설] · 베타 노출 개방(Q6 대표 결정) · 게이지 강등으로 노출(판정 A)
//
// **창작한 숫자 0건.** 게이지 문턱(30·100)은 판정①·G2에서, 상한(2)은 §3-3-1⑤·§3-6-1에서 인용.
// 관찰 어휘는 정본 §3-3의 사전 등재분 — 확정은 마케팅 검수.

// 좌표→타입 판정은 엔진 것을 그대로 쓴다(판정 규칙이 두 벌이 되면 어긋난다).
// asset-score는 part-report를 참조하지 않으므로 순환 참조가 없다.
import { nearestType } from "./asset-score.js";

export const PARTS = ["눈","눈썹","코","입","윤곽","볼·입체","색·피부","표현"];

// 한글 받침 판정 — 부위명·타입명이 변수라 조사를 고정하면 "눈는", "눈썹가"가 나온다.
// 음절 = 0xAC00 + 초성×588 + 중성×28 + 종성 → (코드−0xAC00)%28 !== 0 이면 받침 있음.
function jong(w){
  const s=(w||"").trim(); if(!s) return false;
  const c=s.charCodeAt(s.length-1);
  return (c>=0xAC00 && c<=0xD7A3) ? ((c-0xAC00)%28)!==0 : false;
}
export const eun = w => w + (jong(w) ? "은" : "는");
export const iga = w => w + (jong(w) ? "이" : "가");

// 측정 필드 → 관찰 어휘. 정본 §3-3 "관찰 어휘는 측정 필드별 사전 등재"
// 정본 템플릿이 "[관찰1]하고, [관찰2]해서요"라 **연결형(c)과 종결형(e) 두 벌**이 필요하다.
// 한 벌만 두고 어미를 코드로 붙이면 "잡고해서요" 같은 게 나온다(활용은 모음조화가 걸려 규칙화가 비싸다).
// 마케팅 검수 완료(2026-08-09) — lo 4건 교체 반영. hi 전량·나머지 lo 11종은 검수 통과분.
const OBS = {
  eye_angle:      { hi:{c:"눈꼬리가 살짝 올라가고",     e:"눈꼬리가 살짝 올라가서요"},
                    lo:{c:"눈꼬리가 부드럽게 내려오고", e:"눈꼬리가 부드럽게 내려와서요"} },
  eye_round:      { hi:{c:"눈이 동그랗게 트이고",       e:"눈이 동그랗게 트여서요"},
                    lo:{c:"눈이 길고 시원하게 뻗고",    e:"눈이 길고 시원하게 뻗어서요"} },
  eye_len:        { hi:{c:"눈이 시원하게 자리를 잡고",  e:"눈이 시원하게 자리를 잡아서요"},
                    lo:{c:"눈매가 아담하고",           e:"눈매가 아담해서요"} },
  interocular:    { hi:{c:"눈 사이가 넉넉하고",         e:"눈 사이가 넉넉해서요"},
                    lo:{c:"눈 사이가 가깝고",           e:"눈 사이가 가까워서요"} },
  brow_arch_deg:  { hi:{c:"눈썹이 둥글게 휘고",         e:"눈썹이 둥글게 휘어서요"},
                    lo:{c:"눈썹이 곧게 뻗고",           e:"눈썹이 곧게 뻗어서요"} },
  brow_eye_gap:   { hi:{c:"눈썹과 눈 사이가 여유롭고",  e:"눈썹과 눈 사이가 여유로워서요"},
                    lo:{c:"눈썹이 눈에 가깝게 붙고",    e:"눈썹이 눈에 가깝게 붙어서요"} },
  lip_thickness:  { hi:{c:"입술이 도톰하고",            e:"입술이 도톰해서요"},
                    lo:{c:"입술이 야무지게 정돈되고",   e:"입술이 야무지게 정돈돼서요"} },
  mouth_w:        { hi:{c:"입이 시원하게 넓고",         e:"입이 시원하게 넓어서요"},
                    lo:{c:"입이 단정하게 모이고",       e:"입이 단정하게 모여서요"} },
  jaw_angular_deg:{ hi:{c:"턱선이 또렷하게 꺾이고",     e:"턱선이 또렷하게 꺾여서요"},
                    lo:{c:"턱선이 부드럽게 이어지고",   e:"턱선이 부드럽게 이어져서요"} },
  face_HW:        { hi:{c:"얼굴에 길이감이 있고",       e:"얼굴에 길이감이 있어서요"},
                    lo:{c:"얼굴이 동글하고",           e:"얼굴이 동글해서요"} },
  chin_len:       { hi:{c:"턱이 길게 떨어지고",         e:"턱이 길게 떨어져서요"},
                    lo:{c:"턱이 야무지게 자리 잡고",    e:"턱이 야무지게 자리 잡아서요"} },
  parts_vpos:     { hi:{c:"이목구비가 아래쪽에 모이고", e:"이목구비가 아래쪽에 모여서요"},
                    lo:{c:"이목구비가 위쪽에 자리하고", e:"이목구비가 위쪽에 자리해서요"} },
  skinL:          { hi:{c:"피부가 환하게 밝고",         e:"피부가 환하게 밝아서요"},
                    lo:{c:"피부가 차분하게 가라앉고",   e:"피부가 차분하게 가라앉아서요"} },
  chroma:         { hi:{c:"색이 또렷하게 살아나고",     e:"색이 또렷하게 살아나서요"},
                    lo:{c:"색이 은은하게 번지고",       e:"색이 은은하게 번져서요"} },
  contrast:       { hi:{c:"이목구비 대비가 뚜렷하고",   e:"이목구비 대비가 뚜렷해서요"},
                    lo:{c:"이목구비가 부드럽게 어우러지고", e:"이목구비가 부드럽게 어우러져서요"} },
};

// 코 전용 문장 — 마케팅 검수 **승인분**(2026-08-09, 안전장치 6항 준수). 조합 서술만, 측정 단독 근거 없음.
const NOSE_LINE = {
  "클래식":  "코가 얼굴 중심을 단정하게 잡아줘요 — 클래식 매력에서 자주 보이는 인상이에요.",
  "카리스마":"코의 인상이 또렷한 편이에요 — 카리스마 매력에서 자주 보여요.",
  "세련된":  "코의 인상이 또렷한 편이에요 — 세련된 매력에서 자주 보여요.",
  "_default":"코가 얼굴 전체에 부드럽게 어우러져요 — {T} 매력을 자연스럽게 받쳐줘요.",
};

/** 게이지 = min(표본 등급, 측정 등급, 이론 등급). 세 성분 전부 기존 문턱 재사용(§3-6-1). */
export function gauge({ part, n, missing, flagged }) {
  const isSurvey = part === "표현";
  // 표본 등급 — 설문 유래 행은 분포 기준자를 안 쓰므로 미적용
  const s = isSurvey ? 4 : (n < 30 ? 2 : n < 100 ? 3 : 4);
  // 측정 등급
  const m = missing ? 1 : (flagged ? 2 : 4);
  // 이론 등급 — 저신뢰 고정 부위
  const t = (part === "코" || part === "볼·입체") ? 2 : 3;   // 주근거 [가설] → 최대 3
  return Math.max(1, Math.min(s, m, t));
}

export const dots = g => "●".repeat(g) + "○".repeat(4 - g);

/**
 * 부위 1행 생성.
 * @param part 부위명 / @param type 부위 판정 타입(에셋 엔진) / @param obs 관찰 [{field, dir}]
 */
export function partRow({ part, type, second, adjacent, obs, n, missing, flagged }) {
  const g = gauge({ part, n, missing, flagged });
  const row = { part, type, gauge: g, dots: dots(g) };

  if (missing) {                       // 강등 ① — 라벨 교체 + 이유 문장 생략(정본 §3-3 강등)
    row.label = "사진에서 잘 안 잡혔어요";   // "흐리게 보였어요"는 측정 실패인지 안 잰 건지 구분이 안 된다(대표 지적)
    row.line = "";
    return row;
  }
  // 인접 표기(정본 §3-3) — A′ 임계는 [미정]이라 엔진이 준 adjacent 플래그를 그대로 따른다
  row.label = adjacent && second ? `${type}인데, ${second} 매력도 조금 섞여 있어요` : `${type} 매력에 가까워요`;

  if (part === "코") {                 // §3-3-1 — 전용 화법. 측정 단독 근거를 만들지 않는다
    row.line = (NOSE_LINE[type] || NOSE_LINE._default).replace("{T}", type);
    return row;
  }
  // 정본 템플릿은 "[관찰1]하고, [관찰2]해서요"였다. 그대로 붙이면
  //   "눈썹은 우아한 매력에 가까워요 — 눈썹이 눈에 가깝게 붙어서요."
  // 가 되는데, 뒷문장이 이유형(-서요)이라 **문장이 닫히지 않는다**(대표 지적 2026-08-17).
  // 관찰을 이유절이 아니라 **평서문**으로 세워 두 문장으로 끊는다.
  //   → "눈썹은 우아한 매력에 가까워요. 눈썹이 눈에 가깝게 붙어요."
  // 어형은 새로 쓰지 않고 종결형(e)에서 기계적으로 얻는다: "-서요" → "-요".
  //   올라가서요→올라가요 · 트여서요→트여요 · 아담해서요→아담해요 · 정돈돼서요→정돈돼요
  // ⚠ 문구 변경이므로 마케팅 검수 대상. 뜻은 그대로이고 어미만 닫았다.
  const decl = e => e.replace(/서요$/, "요");
  const ws = (obs || []).map(o => OBS[o.field] && OBS[o.field][o.dir]).filter(Boolean).slice(0, 2);
  const tail = ws.length === 0 ? ""
    : ws.length === 1 ? ` ${decl(ws[0].e)}.`
    : ` ${ws.slice(0, -1).map(w => w.c).join(", ")}, ${decl(ws[ws.length - 1].e)}.`;
  row.line = `${eun(part)} ${type} 매력에 가까워요.${tail}`;
  if (g <= 2 && !missing)              // 강등 ② — 저신뢰 병기
    row.note = "사진 한 장으론 확신이 낮은 부위예요 — 방향만 참고해 주세요.";
  return row;
}

/**
 * 채널 수렴 조건 — 정본 v1.4 §3-3 [가설] (신호사전 워크북 흡수).
 * 종합을 **확신 강도로 말할 수 있는가**를 정한다. 게이지(부위 신뢰도)와 직교·보완 관계다.
 *
 * 독립 채널 4종: ① 색 ② 형태(포토 부위) ③ 설문 HAVE ④ 표현
 * **부위 8행은 전부 ② 단일 채널이다** — 부위끼리 아무리 일치해도 이 조건을 충족하지 않는다.
 * 포토 미수행이면 채널이 최대 2개라 확신 강도는 자동 불성립(판정은 성립, 화법만 강등 — D2와 정합).
 */
export function channelConvergence({ colorType, shapeType, surveyType, expressionType, overallType, adjacentOf }) {
  const near = t => !!t && (t === overallType || (adjacentOf || []).includes(t));
  const hit = [colorType, shapeType, surveyType, expressionType].filter(near).length;
  return { channels: hit, strong: hit >= 3 };
}

/**
 * 종합 유도 서사 — 비중 숫자·다수결 표현 금지, 일치 부위 서사로(정본 §3-3).
 * @param conv channelConvergence() 결과. 미충족이면 확신 화법을 쓰지 않고 방향 제시로 강등한다.
 */
export function summaryNarrative(rows, overallType, varianceHigh, conv) {
  if (varianceHigh)
    return `부위마다 매력이 엇갈리는 얼굴이에요 — 이 엇갈림 자체가 ${overallType}의 생기예요.`;
  const agree = rows.filter(r => r.type === overallType && r.line).map(r => r.part);
  const differ = rows.filter(r => r.type && r.type !== overallType && r.line);
  // 채널 수렴 미충족 → 확신 화법 금지. 방향 제시 + 인접 표기로 강등(정본 v1.4 §3-3)
  if (conv && !conv.strong) {
    let s = `지금 보이는 건 ${overallType} 쪽 방향이에요.`;
    if (differ.length) s += ` ${differ[0].type} 매력도 섞여 있어요.`;
    return s;
  }
  if (agree.length < 2) return "";
  const [a1, a2] = agree;
  const pair = `${jong(a1) ? a1 + "과" : a1 + "와"} ${iga(a2)}`;
  let s = `${pair} 같은 방향을 가리켜서, 종합은 ${jong(overallType) ? overallType + "으로" : overallType + "로"} 모였어요.`;
  if (differ.length) s += ` ${eun(differ[0].part)} ${differ[0].type} 쪽이라, ${overallType} 안에 ${differ[0].type} 매력이 섞인 얼굴이에요.`;
  return s;
}

export const CAPTION = "확신은 측정이 쌓일수록 올라가요 — 지금은 초기 단계예요.";

/**
 * 엔진 산출 → 리포트 8행 어댑터.
 *
 * **엔진과 리포트의 부위 체계가 다르다.** 이걸 연결하지 않으면 세 행이 잘못 나간다:
 *   · 색·피부 — 엔진에선 부위가 아니라 **별도 레이어**(판정 ②)라 `parts`에 없다 → 결측으로 오인된다
 *   · 코      — 3D 미도입이라 직접 측정치가 없지만 그건 **측정 실패가 아니다.**
 *               정본 §3-3-1 ⑤는 "조합 서술 + 게이지 2 상한"을 요구한다("흐리게 보였어요"가 아니다)
 *   · 표현    — 설문 유래(§4). 사진 산출에 있을 수 없다
 *
 * @param score  asset-score.scoreOne() 결과
 * @param opts   { n: 분포 표본 수, expressionType: 설문에서 온 표현 타입 }
 */
export function buildPartRows(score, { n = 0, expressionType = null } = {}) {
  const overall = score.overallType && score.overallType.type;
  const obsOf = p => (score.detail || [])
    .filter(d => d.part === p && d.s !== null)
    .sort((a, b) => Math.abs(b.s) - Math.abs(a.s)).slice(0, 2)
    .map(d => ({ field: d.key, dir: d.s >= 0 ? "hi" : "lo" }));

  return PARTS.map(part => {
    // 색·피부 — 별도 레이어에서 끌어온다. 색 신호가 하나도 없을 때만 결측
    if (part === "색·피부") {
      const c = score.color;
      if (!c || !c.n) return partRow({ part, n, missing: true });
      const t = nearestType({T:c.T, D:c.D, M:c.M});
      return partRow({ part, type: t.type, second: t.second, adjacent: t.adjacent,
                       obs: obsOf("색"), n });
    }
    // 표현 — 설문에서 온다. 없으면 결측(사진만 한 경우)
    if (part === "표현")
      return expressionType ? partRow({ part, type: expressionType, obs: [], n })
                            : partRow({ part, n, missing: true });
    // 코 — 직접 측정치 부재는 실패가 아니다. 종합 타입에 얹어 조합 서술(게이지는 이론 등급 2가 지배)
    if (part === "코")
      return overall ? partRow({ part, type: overall, obs: [], n })
                     : partRow({ part, n, missing: true });

    const key = part === "볼·입체" ? "볼입체" : part;   // 엔진 부위명과의 표기 차이
    const t = score.partTypes && score.partTypes[key];
    if (!t) return partRow({ part, n, missing: true });
    return partRow({ part, type: t.type, second: t.second, adjacent: t.adjacent,
                     obs: obsOf(key), n });
  });
}

// ── 자체 점검 ────────────────────────────────────────────
export function selfCheck() {
  const ok = (c, m) => { if (!c) throw new Error("selfCheck 실패: " + m); };

  // 1) n<30 이면 포토 부위 게이지가 2를 넘지 않는다(판정 A 조건)
  for (const p of PARTS.filter(x => x !== "표현"))
    ok(gauge({ part: p, n: 10, missing: false, flagged: false }) <= 2, `${p} n<30 상한 2`);
  // 2) 표현(설문 유래)은 표본 등급 미적용
  ok(gauge({ part: "표현", n: 10, missing: false, flagged: false }) === 3, "표현은 표본 등급 미적용");
  // 3) 코·볼입체는 n이 커져도 2 상한(이론 등급 지배)
  ok(gauge({ part: "코", n: 500, missing: false, flagged: false }) === 2, "코 상한 2");
  ok(gauge({ part: "볼·입체", n: 500, missing: false, flagged: false }) === 2, "볼·입체 상한 2");
  // 4) 결측이면 1
  ok(gauge({ part: "눈", n: 500, missing: true, flagged: false }) === 1, "결측 → 1");
  // 5) 결측 행은 라벨 교체 + 이유 문장 생략
  const r0 = partRow({ part: "눈", type: "로맨틱", obs: [], n: 10, missing: true });
  ok(r0.label === "이번엔 흐리게 보였어요" && r0.line === "", "결측 강등 문안");
  // 6) 코는 전용 문장, 관찰 어휘를 쓰지 않는다
  const rn = partRow({ part: "코", type: "클래식", obs: [{ field: "skinL", dir: "hi" }], n: 10 });
  ok(rn.line.startsWith("코가 얼굴 중심을"), "코 승인 예문");
  ok(!/피부가 환하게/.test(rn.line), "코는 관찰 어휘 미사용");
  // 7) 이유 문장은 관찰 2개까지
  const re = partRow({ part: "눈", type: "로맨틱",
    obs: [{ field: "eye_angle", dir: "lo" }, { field: "eye_len", dir: "hi" }, { field: "interocular", dir: "hi" }], n: 10 });
  ok((re.line.match(/,/g) || []).length === 1, "관찰 2개(쉼표 1개)");
  ok(re.line.includes("눈꼬리가 부드럽게 내려오고"), "관찰 어휘 매핑");
  // 8) 금지어가 산출물에 없다
  const bad = /이상적|정상|평균보다|약해요|부족|결이에요|의 결|당신은/;
  ok(!bad.test(re.line + rn.line + CAPTION), "금지어 없음");
  // 9) 인접 표기
  const ra = partRow({ part: "입", type: "로맨틱", second: "화려함", adjacent: true, obs: [], n: 10 });
  ok(ra.label === "로맨틱인데, 화려함 매력도 조금 섞여 있어요", "인접 표기");
  // 10) 분산 신호 서사
  ok(summaryNarrative([], "에너제틱", true).includes("엇갈림 자체가"), "분산 서사");

  // 11) 조사 — 받침에 따라 은/는·이/가가 갈린다 ("눈는"·"눈썹가" 방지)
  ok(eun("눈") === "눈은" && eun("눈썹") === "눈썹은" && eun("코") === "코는"
     && eun("입") === "입은" && eun("윤곽") === "윤곽은" && eun("표현") === "표현은", "은/는");
  ok(iga("눈썹") === "눈썹이" && iga("코") === "코가", "이/가");
  // 12) 어미 — 마지막 관찰만 종결형. "잡고해서요" 류가 나오면 안 된다
  const r2 = partRow({ part:"눈", type:"로맨틱", n:10,
    obs:[{field:"eye_angle",dir:"lo"},{field:"eye_len",dir:"hi"}] });
  ok(!/고해서요|고 해서요/.test(r2.line), "연결형+종결형 중복 없음");
  ok(r2.line.endsWith("잡아서요."), "마지막 관찰이 종결형");
  ok(r2.line.startsWith("눈은 로맨틱"), "부위 조사 정상");
  // 13) 관찰 1개일 때도 종결형
  const r1 = partRow({ part:"눈썹", type:"로맨틱", n:10, obs:[{field:"brow_arch_deg",dir:"hi"}] });
  ok(r1.line === "눈썹은 로맨틱 매력에 가까워요 — 눈썹이 둥글게 휘어서요.", "관찰 1개 종결형");
  // 14) 종합 서사 조사
  const sn = summaryNarrative(
    [{part:"눈",type:"로맨틱",line:"x"},{part:"눈썹",type:"로맨틱",line:"x"},{part:"코",type:"클래식",line:"x"}],
    "로맨틱", false);
  ok(sn.startsWith("눈과 눈썹이 ") && sn.includes("로맨틱으로 모였어요") && sn.includes("코는 클래식 쪽이라"), "서사 조사");

  // 15) 채널 수렴 — 부위끼리의 일치는 채널이 아니다(정본 v1.4 §3-3)
  const cvNo = channelConvergence({ colorType:"세련된", shapeType:null, surveyType:null,
                                    expressionType:null, overallType:"세련된" });
  ok(cvNo.channels === 1 && cvNo.strong === false, "채널 1개 → 확신 불성립");
  const cvYes = channelConvergence({ colorType:"세련된", shapeType:"세련된", surveyType:"세련된",
                                     expressionType:"카리스마", overallType:"세련된" });
  ok(cvYes.channels === 3 && cvYes.strong === true, "채널 3개 → 확신 성립");
  // 인접 타입도 동방향으로 센다
  const cvAdj = channelConvergence({ colorType:"세련된", shapeType:"카리스마", surveyType:"세련된",
                                     expressionType:null, overallType:"세련된", adjacentOf:["카리스마"] });
  ok(cvAdj.channels === 3, "인접 타입도 동방향");
  // 16) 미충족 시 확신 화법을 쓰지 않는다
  const rr = [{part:"눈",type:"세련된",line:"x"},{part:"윤곽",type:"세련된",line:"x"},{part:"코",type:"클래식",line:"x"}];
  const weak = summaryNarrative(rr, "세련된", false, cvNo);
  ok(!/같은 방향을 가리켜서|모였어요/.test(weak), "미충족 → 확신 화법 없음");
  ok(weak.includes("쪽 방향이에요"), "미충족 → 방향 제시 화법");
  const strong = summaryNarrative(rr, "세련된", false, cvYes);
  ok(strong.includes("모였어요"), "충족 → 확신 화법");
  // 17) conv 미전달이면 기존 동작(하위 호환)
  ok(summaryNarrative(rr, "세련된", false).includes("모였어요"), "conv 없으면 기존 동작");

  return "part-report selfCheck 통과 (17/17)";
}
