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
// export: 「지금의 나」 근거 문장(report-explain)이 같은 사전을 쓴다. 사전이 두 벌이 되면 갈린다.
export const OBS = {
  /* 눈꼬리는 셋으로 나뉜다. 사람 눈은 원래 눈꼬리가 눈머리보다 조금 높아서(실측 97건 중
     93건이 양수), 표본 하위를 "내려와 있다"고 쓰면 96%에게 사실이 아닌 말이 나간다.
     lo0 = 실제로 내려간 눈(4%)에게만 쓰는 단정형. lo = 올라갔지만 완만한 눈.
     고르는 것은 asset-score의 below 플래그다. */
  eye_angle: { hi:{c:"눈꼬리가 눈머리보다 뚜렷하게 올라가 있고", e:"눈꼬리가 눈머리보다 뚜렷하게 올라가 있어서요", d:"눈꼬리가 눈머리보다 뚜렷하게 올라가 있습니다"},
               lo:{c:"눈꼬리가 눈머리보다 조금 올라가 있고", e:"눈꼬리가 눈머리보다 조금 올라가 있어서요", d:"눈꼬리가 눈머리보다 조금 올라가 있습니다"},
               lo0:{c:"눈꼬리가 눈머리보다 내려와 있고", e:"눈꼬리가 눈머리보다 내려와 있어서요", d:"눈꼬리가 눈머리보다 내려와 있습니다"},
               // mid d = 인상어사전 v1 §3 균형 서술 (비단조 필드 — 마케팅 검수 통과 문면 2026-09-03, 그대로 사용)
               mid:{c:"눈매가 수평에 가깝고", e:"눈매가 수평에 가까워서요",
                    d:"눈매가 어느 쪽으로도 치우치지 않아, 또렷한 연출과 순한 연출 양쪽으로 폭이 넓습니다."} },
  /* ⚠ eye_round(0.50) · eye_len(0.44) · brow_arch_deg(0.57) · brow_eye_gap(0.52) ·
     lip_thickness(0.44) 항목을 뺐다 (2026-08-25 재현성 검증 · 12명 × 21회 촬영).
     판정 기준은 SD_w < 0.35 × SD_b — **한 사람이 다시 찍었을 때의 변동이 사람들 사이 차이의
     35%보다 작아야** 그 측정이 사람을 구별한다고 볼 수 있다. 다섯 값 전부 기준을 넘겼다.
     같은 사람이 5분 뒤에 다시 찍기만 해도 "눈이 시원하게 길어요"가 "눈매가 아담해요"로 넘어가는
     폭이라, 그 문장은 얼굴이 아니라 **그날의 촬영**을 서술한다. 잘 다듬어도 틀린 말이라
     문구를 고치지 않고 항목을 뺐다 — jaw_angular_deg를 뺀 것과 같은 처리다.
     ⚠ 결과: 눈썹은 등재 어휘가 0개가 되어 판정 문장만 남는다("눈썹은 ~ 매력에 가까워요.").
       bandRows의 「눈썹 모양」 값 행(brow_arch_deg)은 여기가 아니라 report-explain에 있다 —
       같은 값을 다른 계층에서 계속 말하고 있으므로 **이론 회부 대기**다. */
  interocular: { hi:{c:"두 눈 사이가 멀고", e:"두 눈 사이가 멀어서요", d:"두 눈 사이가 먼 편입니다"},
                 lo:{c:"두 눈 사이가 가깝고", e:"두 눈 사이가 가까워서요", d:"두 눈 사이가 가까운 편입니다"},
                 mid:{c:"두 눈 사이가 좁지도 넓지도 않고", e:"두 눈 사이가 좁지도 넓지도 않아서요", d:"두 눈 사이 간격이 균형에 가깝습니다"} },
  mouth_w: { hi:{c:"입이 얼굴 너비에 비해 넓고", e:"입이 얼굴 너비에 비해 넓어서요", d:"입이 얼굴 너비에 비해 넓은 편입니다"},
             lo:{c:"입이 얼굴 너비에 비해 좁고", e:"입이 얼굴 너비에 비해 좁아서요", d:"입이 얼굴 너비에 비해 좁은 편입니다"},
             mid:{c:"입 너비가 얼굴과 균형을 이루고", e:"입 너비가 얼굴과 균형을 이뤄서요", d:"입 너비가 얼굴과 균형을 이룹니다"} },
  /* ⚠ jaw_angular_deg 항목을 뺐다 (2026-08-25, 오류대장 §045 · 이론 재판정).
     인물 간 차이(SD_b 0.7533)보다 한 사람의 촬영 간 변동(SD_w 1.4679)이 **2배 크다.**
     이 값으로 "턱선이 또렷하게 꺾여 있어요"라고 말하면, 그건 그 사람의 턱이 아니라
     **그날 어느 각도에서 찍었는지**를 말하는 것이다. 사전에서 빠지면 이 부위는
     문장이 안 나가고 조용히 건너뛴다(OBS에 키가 없으면 그 필드는 발화하지 않는다).
     판정 기여(asset-score)는 별건 — 폐기·재설계·유지는 이론 판단 대기. */
  face_HW: { hi:{c:"얼굴이 갸름한 편이고", e:"얼굴이 갸름한 편이라서요", d:"얼굴이 갸름한 편입니다"},
             lo:{c:"얼굴이 동그란 편이고", e:"얼굴이 동그란 편이라서요", d:"얼굴이 동그란 편입니다"},
             mid:{c:"얼굴 세로와 가로가 균형에 가깝고", e:"얼굴 세로와 가로가 균형에 가까워서요", d:"얼굴 세로와 가로가 균형에 가깝습니다"} },
  chin_len: { hi:{c:"입술 아래에서 턱 끝까지가 길고", e:"입술 아래에서 턱 끝까지가 길어서요", d:"입술 아래에서 턱 끝까지가 긴 편입니다"},
              lo:{c:"입술 아래에서 턱 끝까지가 짧고", e:"입술 아래에서 턱 끝까지가 짧아서요", d:"입술 아래에서 턱 끝까지가 짧은 편입니다"},
              mid:{c:"입술 아래에서 턱 끝까지가 길지도 짧지도 않고", e:"입술 아래에서 턱 끝까지가 길지도 짧지도 않아서요", d:"입술 아래에서 턱 끝까지가 알맞은 길이입니다"} },
  parts_vpos: { hi:{c:"눈코입이 얼굴 아래쪽에 놓이고", e:"눈코입이 얼굴 아래쪽에 놓여서요", d:"눈코입이 얼굴 아래쪽에 놓여 있습니다"},
                lo:{c:"눈코입이 얼굴 위쪽에 놓이고", e:"눈코입이 얼굴 위쪽에 놓여서요", d:"눈코입이 얼굴 위쪽에 놓여 있습니다"},
                mid:{c:"눈코입이 위아래로 치우치지 않고", e:"눈코입이 위아래로 치우치지 않아서요", d:"눈코입이 얼굴 가운데에 자리 잡았습니다"} },
  skinL: { hi:{c:"피부 톤이 밝은 편이고", e:"피부 톤이 밝은 편이라서요", d:"피부 톤이 밝은 편입니다"},
           lo:{c:"피부 톤이 짙은 편이고", e:"피부 톤이 짙은 편이라서요", d:"피부 톤이 짙은 편입니다"} },
  chroma: { hi:{c:"얼굴에 도는 색이 선명하고", e:"얼굴에 도는 색이 선명해서요", d:"얼굴에 도는 색이 선명한 편입니다"},
            lo:{c:"얼굴에 도는 색이 옅고", e:"얼굴에 도는 색이 옅어서요", d:"얼굴에 도는 색이 옅은 편입니다"} },
  contrast: { hi:{c:"피부와 눈동자·머리 색의 밝기 차이가 크고", e:"피부와 눈동자·머리 색의 밝기 차이가 커서요", d:"피부와 눈동자·머리 색의 밝기 차이가 큰 편입니다"},
              lo:{c:"피부와 눈동자·머리 색의 밝기 차이가 작고", e:"피부와 눈동자·머리 색의 밝기 차이가 작아서요", d:"피부와 눈동자·머리 색의 밝기 차이가 작은 편입니다"} },
};

// 코 전용 문장 — 마케팅 검수 **승인분**(2026-08-09, 안전장치 6항 준수). 조합 서술만, 측정 단독 근거 없음.
const NOSE_LINE = {
  "클래식":  "코가 얼굴 중심을 단정하게 잡아줍니다 — 클래식 매력에서 자주 보이는 인상입니다.",
  "카리스마":"코의 인상이 또렷한 편입니다 — 카리스마 매력에서 자주 보이는 모습입니다.",
  "세련된":  "코의 인상이 또렷한 편입니다 — 세련된 매력에서 자주 보이는 모습입니다.",
  "_default":"코가 얼굴 전체에 부드럽게 어우러집니다 — {T} 매력을 자연스럽게 받쳐주는 자리입니다.",
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

// 게이지 도트(●●○○) 표기는 삭제했다 — 대표 지시 2026-08-25.
// "아래에 4개의 원으로 된 건 무슨 표시인지 구분이 안 됨." 범례 없이 서 있어 뜻이 전달되지 않았고,
// 뜻이 전달됐다면 그건 "우리 측정이 못 미덥다"는 자백이라 어느 쪽이든 남길 이유가 없었다.
// gauge()는 남긴다 — 계산은 계속 하되 화면에 내지 않는다(마스터 §4-6 "수집은 열되 카드는 닫는다").

/**
 * 부위 1행 생성.
 * @param part 부위명 / @param type 부위 판정 타입(에셋 엔진) / @param obs 관찰 [{field, dir}]
 */
/* 이 부위가 판정에 못 들어온 이유가 **게이트 때문인가**.
   detail에는 게이트로 닫힌 에셋도 관측값과 함께 남는다(asset-score가 rec.gated로 표시한다).
   그 부위 항목이 하나라도 있고 **전부 gated**면, 못 잰 게 아니라 안 쓴 것이다. */
function gatedOnly(score, part) {
  const rows = (score && score.detail || []).filter(x => x.part === part);
  if (!rows.length) return false;
  return rows.every(x => x.gated);
}

export function partRow({ part, type, second, adjacent, obs, n, missing, flagged, gated, axis, contrib }) {
  const g = gauge({ part, n, missing, flagged });
  const row = { part, type, gauge: g };

  if (missing) {                       // 강등 ① — 라벨 교체 + 이유 문장 생략(정본 §3-3 강등)
    // gated = 측정은 됐고 판정에만 안 쓴 경우. 사진 탓으로 돌리지 않는다(2026-08-26).
    row.label = gated ? "측정은 마쳤고, 판정 기준을 세우는 중입니다"
                      : "사진에서 잘 잡히지 않았습니다";
    row.gated = !!gated;
    row.line = "";
    return row;
  }
  // 인접 표기(정본 §3-3) — A′ 임계는 [미정]이라 엔진이 준 adjacent 플래그를 그대로 따른다
  row.label = adjacent && second ? `${type}인데, ${second} 매력도 조금 섞여 있습니다` : `${type} 매력에 가까운 편`;

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
  // 마케팅 검수 2026-08-18: 기계 치환(-서요→-요)은 절반만 맞았다.
  //   형용사는 "-요"가 맞지만 **동작 동사는 진행형으로 읽힌다** — "눈썹이 눈에 가깝게 붙어요"는
  //   지금 붙고 있는 중으로 들린다. 얼굴은 사건이 아니라 상태라 "-어 있어요"를 쓴다.
  //   그래서 종결형 d를 손으로 30종 확정했다(brand/문구확정_강의리포트_v1_2026-08-18.md §2-2).
  //   c(연결형)·e(이유형)는 다른 화면이 쓸 수 있어 손대지 않았다. d가 없으면 옛 방식으로 떨어진다.
  const decl = w => w.d || (w.e || "").replace(/서요$/, "요");
  // 앞문장이 "눈썹은 ~"인데 뒷문장도 "눈썹이 ~"로 시작하면 주어가 두 번 선다. 뒤쪽만 지운다.
  const dropSubj = (txt, p) => txt.replace(new RegExp("^" + p + "(이|가|은|는)\\s*"), "");
  // 관찰을 2개 → 3개로 연다(대표 지시 2026-08-25 "좀더 디테일한 분석").
  // 부위가 한 장을 통째로 갖게 됐으니 두 줄로는 장이 빈다. 사전에 이미 있는 어휘를 더 꺼낼 뿐,
  // 새 어휘는 만들지 않았다.
  const ws = (obs || []).map(o => OBS[o.field] && OBS[o.field][o.dir]).filter(Boolean).slice(0, 3);
  const last = ws.length ? dropSubj(decl(ws[ws.length - 1]), part) : "";
  const tail = ws.length === 0 ? ""
    : ws.length === 1 ? ` ${last}.`
    : ` ${ws.slice(0, -1).map(w => dropSubj(w.c, part)).join(", ")}, ${last}.`;
  // 어미 (게이트 2026-08-25): 관찰 문장이 붙으면 그 문장이 "~어 있어요"로 끝난다. 앞줄까지
  // "~가까워요"로 두면 부위 장마다 세로로 "~요 / ~요"가 붙었다(실측: 눈·피부톤·눈썹).
  // 뒤에 붙을 말이 있을 때만 앞을 ~니다로 받는다. 한 줄로 끝나는 부위는 ~요 그대로 — 혼자 선
  // 문장까지 합니다체로 바꾸면 판정 통보처럼 읽힌다.
  /* 왜 그 타입인지 (대표 지적 2026-08-27: "윤곽이 세련된 매력에 가까우면
     왜 세련된 매력인지를 알려줘야되는거아닌가?").
     앞의 관찰은 **무엇이 보이는지**만 말하고, 그것이 왜 그 타입으로 읽히는지는 비어 있었다.
     부위 좌표에서 가장 크게 기운 축 하나를 그 말로 옮긴다 —
     새 이론이 아니라 이미 계산해 둔 값이고, 축 이름도 「벌어진 곳」 장이 쓰는 그대로다. */
  const AXW = {T:["따뜻한 쪽","시원한 쪽"], D:["부드러운 쪽","또렷한 쪽"], M:["어려 보이는 쪽","성숙한 쪽"]};
  let why = "";
  if (axis && tail) {
    let k = null, best = 0;
    for (const a of ["T","D","M"]) {
      const v = axis[a];
      if (typeof v === "number" && Math.abs(v) > Math.abs(best)) { best = v; k = a; }
    }
    // 기운 정도가 미미하면 말하지 않는다 — 없는 이유를 지어내지 않는다.
    if (k && Math.abs(best) >= 0.15)
      why = ` ${part === "색·피부" ? "이 색이" : "이 선들이"} ${AXW[k][best >= 0 ? 1 : 0]}으로 기울어 ${type}으로 읽힙니다.`;
  }
  /* contrib(대표 G 2026-08-29) — "눈썹은 클래식 매력에 가까워요"가 아니라 이 부위가 종합
     판정에 어느 타입 방향으로 기여했는지로 말한다. 점수 숫자(+1)는 쓰지 않는다 —
     절대 점수 화법은 헌법 §4 충돌 소지가 있어 이론 협의 대상(보고에 남김).
     앱 리포트만 켠다 — 강의판(lecture.html)은 기존 화법 유지(분리 트랙). */
  row.line = contrib
    ? `${eun(part)} 종합 판정에 ${type} 쪽으로 기여했습니다.${tail}${why}`
    : `${eun(part)} ${type} 매력에 가깝습니다.${tail}${why}`;
  // 저신뢰 병기("사진 한 장으론 확신이 낮은 부위예요")는 삭제했다 — 대표 지시 2026-08-25.
  // 유저가 그 문장을 읽고 할 수 있는 게 없고, 신뢰만 깎인다. 결측 고지(위 강등 ①)는 남는다.
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
    return `부위마다 매력이 엇갈리는 얼굴입니다 — 이 엇갈림 자체가 ${overallType}의 생기입니다.`;
  const agree = rows.filter(r => r.type === overallType && r.line).map(r => r.part);
  const differ = rows.filter(r => r.type && r.type !== overallType && r.line);
  // 채널 수렴 미충족 → 확신 화법 금지. 방향 제시 + 인접 표기로 강등(정본 v1.4 §3-3)
  if (conv && !conv.strong) {
    // 앞 줄이 "…모은 결과예요."라 여기까지 ~이에요로 받으면 세로로 같은 어미가 셋 이어진다.
    let s = `지금 보이는 방향은 ${overallType} 쪽입니다.`;
    if (differ.length) s += ` ${differ[0].type} 매력도 함께 섞인 상태입니다.`;
    return s;
  }
  if (agree.length < 2) return "";
  const [a1, a2] = agree;
  const pair = `${jong(a1) ? a1 + "과" : a1 + "와"} ${iga(a2)}`;
  let s = `${pair} 같은 방향을 가리켜, 종합은 ${jong(overallType) ? overallType + "으로" : overallType + "로"} 모였습니다.`;
  if (differ.length) s += ` ${eun(differ[0].part)} ${differ[0].type} 쪽이라, ${overallType} 안에 ${differ[0].type} 매력이 섞인 얼굴입니다.`;
  return s;
}

// CAPTION("확신은 측정이 쌓일수록 올라가요 — 지금은 초기 단계예요")은 삭제 — 대표 지시 2026-08-25.
// 전원이 같은 문장을 받는 각주라 정보가 0이고, 읽는 사람 입장에서는 변명으로만 남는다.

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
/** @param skip {필드:1} — 화면 다른 줄이 이미 그 필드를 말했으면 부위 문장에서 뺀다(2026-08-25). */
export function buildPartRows(score, { n = 0, expressionType = null, skip = null, contrib = false } = {}) {
  const overall = score.overallType && score.overallType.type;
  const obsOf = p => (score.detail || [])
    .filter(d => d.part === p && d.s !== null && !(skip && skip[d.key]))
    .sort((a, b) => Math.abs(b.s) - Math.abs(a.s)).slice(0, 3)
    /* mid가 가장 앞선다 — 중앙값에서 SD_w 안쪽이면 다시 찍었을 때 방향이 뒤집히는 자리라
       (이론 v3 §5-2), 어느 쪽인지 말하지 않고 균형을 말한다.
       그 다음이 lo0 — 표본 하위이면서 자연 영점보다도 아래인 경우만 단정형을 쓴다. */
    .map(d => ({ field: d.key, dir: d.mid ? "mid" : (d.s >= 0 ? "hi" : (d.below ? "lo0" : "lo")) }));

  return PARTS.map(part => {
    // 색·피부 — 별도 레이어에서 끌어온다. 색 신호가 하나도 없을 때만 결측
    if (part === "색·피부") {
      const c = score.color;
      if (!c || !c.n) return partRow({ part, n, missing: true });
      const t = nearestType({T:c.T, D:c.D, M:c.M});
      return partRow({ part, type: t.type, second: t.second, adjacent: t.adjacent,
                       obs: obsOf("색"), n, axis: {T:c.T, D:c.D, M:c.M}, contrib });
    }
    // 표현 — 설문에서 온다. 없으면 결측(사진만 한 경우)
    if (part === "표현")
      return expressionType ? partRow({ part, type: expressionType, obs: [], n, contrib })
                            : partRow({ part, n, missing: true });
    // 코 — 직접 측정치 부재는 실패가 아니다. 종합 타입에 얹어 조합 서술(게이지는 이론 등급 2가 지배)
    if (part === "코")
      return overall ? partRow({ part, type: overall, obs: [], n, contrib })
                     : partRow({ part, n, missing: true });

    const key = part === "볼·입체" ? "볼입체" : part;   // 엔진 부위명과의 표기 차이
    const t = score.partTypes && score.partTypes[key];
    const ax = score.parts && score.parts[key];   // 이 부위가 어느 축으로 기울었나 → "왜 그 타입인지"
    /* 판정이 없는 이유가 둘인데 한 문장으로 뭉쳐 있었다 (2026-08-26 · 대표 지적
       "그럼 측정이 잘못된거 아니냐고 내가 몇 번을 얘기하지?").
         ① 사진에서 그 부위를 못 잡았다 — 재촬영이 답이다
         ② 잡았지만 **우리가 판정에 안 쓴다** — 재현성 게이트가 닫혀 있어서다
       실제로 화면에 뜨던 「볼·입체 · 입은 이번 사진에서 잘 안 잡혀」는 ②였다.
       볼입체는 에셋이 cheek_volume 하나뿐인데 게이트가 닫혀 있고, 입은 lip_thickness가
       재현성 실격(r=0.442)이라 남은 mouth_w가 단방향(neg:null)이다. 둘 다 **측정은 됐다.**
       사진 탓으로 돌린 것은 사실과 다르고, 유저에게는 "내가 잘못 찍었나"로 읽힌다.
       → gated 사유를 구분해 넘긴다. 문구는 partRow가 고른다. */
    if (!t) return partRow({ part, n, missing: true, gated: gatedOnly(score, key) });
    return partRow({ part, type: t.type, second: t.second, adjacent: t.adjacent,
                     obs: obsOf(key), n, axis: ax, contrib });
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
  ok(r0.label === "사진에서 잘 잡히지 않았습니다" && r0.line === "", "결측 강등 문안");
  // 6) 코는 전용 문장, 관찰 어휘를 쓰지 않는다
  const rn = partRow({ part: "코", type: "클래식", obs: [{ field: "skinL", dir: "hi" }], n: 10 });
  ok(rn.line.startsWith("코가 얼굴 중심을"), "코 승인 예문");
  ok(!/피부가 환하게/.test(rn.line), "코는 관찰 어휘 미사용");
  // 7) 이유 문장은 관찰 3개까지 (2026-08-25 확대)
  const re = partRow({ part: "눈", type: "로맨틱",
    obs: [{ field: "eye_angle", dir: "lo" }, { field: "interocular", dir: "hi" },
          { field: "skinL", dir: "hi" }, { field: "chroma", dir: "hi" }], n: 10 });
  ok((re.line.match(/,/g) || []).length === 2, "관찰 3개(쉼표 2개)");
  ok(re.line.includes("눈꼬리가 눈머리보다 조금 올라가 있고"), "관찰 어휘 매핑");
  // lo0 — 실제로 내려간 눈(자연 영점 아래)에게만 단정형이 나간다
  const rd = partRow({ part: "눈", type: "로맨틱", n: 10,
    obs: [{ field: "eye_angle", dir: "lo0" }] });
  ok(rd.line.includes("눈꼬리가 눈머리보다 내려와 있습니다"), "lo0는 단정형");
  // 8) 금지어가 산출물에 없다
  const bad = /이상적|정상|평균보다|약해요|부족|결이에요|의 결|당신은/;
  ok(!bad.test(re.line + rn.line), "금지어 없음");
  // 8-b) 걷어낸 변명 문구가 되살아나지 않는다(대표 지시 2026-08-25)
  ok(re.dots === undefined && re.note === undefined, "게이지 도트·저신뢰 병기 제거");
  // 9) 인접 표기
  const ra = partRow({ part: "입", type: "로맨틱", second: "화려함", adjacent: true, obs: [], n: 10 });
  ok(ra.label === "로맨틱인데, 화려함 매력도 조금 섞여 있습니다", "인접 표기");
  // 10) 분산 신호 서사
  ok(summaryNarrative([], "에너제틱", true).includes("엇갈림 자체가"), "분산 서사");

  // 11) 조사 — 받침에 따라 은/는·이/가가 갈린다 ("눈는"·"눈썹가" 방지)
  ok(eun("눈") === "눈은" && eun("눈썹") === "눈썹은" && eun("코") === "코는"
     && eun("입") === "입은" && eun("윤곽") === "윤곽은" && eun("표현") === "표현은", "은/는");
  ok(iga("눈썹") === "눈썹이" && iga("코") === "코가", "이/가");
  // 12) 어미 — 마지막 관찰만 종결형. "잡고해서요" 류가 나오면 안 된다
  const r2 = partRow({ part:"눈", type:"로맨틱", n:10,
    obs:[{field:"eye_angle",dir:"lo"},{field:"interocular",dir:"hi"}] });
  ok(!/고해서요|고 해서요/.test(r2.line), "연결형+종결형 중복 없음");
  // 마케팅 확정 2026-08-18: 이유형(-서요)이 아니라 평서 종결형(d)으로 끝난다.
  // 동작 동사는 "-어 있어요"여야 상태로 읽힌다("붙어요"는 지금 붙는 중으로 들린다).
  ok(!/서요\./.test(r2.line), "이유형 종결 없음");
  ok(r2.line.endsWith("두 눈 사이가 먼 편입니다."), "마지막 관찰이 평서 종결형");
  // 앞문장이 "눈은 ~"인데 뒷문장도 "눈이 ~"면 주어가 두 번 선다 — 뒤쪽은 지운다
  ok(!/가깝습니다\. 눈이 /.test(r2.line), "주어 중복 없음");
  ok(r2.line.startsWith("눈은 로맨틱"), "부위 조사 정상");
  // 13) 관찰 1개일 때도 종결형
  // 눈썹은 재현성 미달로 등재 어휘가 0개가 됐다(위 OBS 주석). 살아 있는 부위로 옮겨 같은 경로를 잰다.
  const r1 = partRow({ part:"입", type:"로맨틱", n:10, obs:[{field:"mouth_w",dir:"hi"}] });
  ok(r1.line === "입은 로맨틱 매력에 가깝습니다. 얼굴 너비에 비해 넓은 편입니다.", "관찰 1개 종결형");
  // 관찰이 하나도 없으면 혼자 서는 문장이라 ~요를 지킨다
  ok(partRow({ part:"입", type:"로맨틱", n:10, obs:[] }).line === "입은 로맨틱 매력에 가깝습니다.",
     "관찰 0개도 합니다체 (P 2026-08-29)");
  // 뺀 어휘가 사전에 되살아나면 여기서 걸린다(재현성 미달 5종 · 2026-08-25)
  ok(["eye_round","eye_len","brow_arch_deg","brow_eye_gap","lip_thickness"]
       .every(k => OBS[k] === undefined), "재현성 미달 어휘 미등재");
  // 14) 종합 서사 조사
  const sn = summaryNarrative(
    [{part:"눈",type:"로맨틱",line:"x"},{part:"눈썹",type:"로맨틱",line:"x"},{part:"코",type:"클래식",line:"x"}],
    "로맨틱", false);
  ok(sn.startsWith("눈과 눈썹이 ") && sn.includes("로맨틱으로 모였습니다") && sn.includes("코는 클래식 쪽이라"), "서사 조사");

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
  ok(!/같은 방향을 가리켜|모였습니다/.test(weak), "미충족 → 확신 화법 없음");
  ok(weak.includes("보이는 방향은") && weak.includes("쪽입니다"), "미충족 → 방향 제시 화법");
  const strong = summaryNarrative(rr, "세련된", false, cvYes);
  ok(strong.includes("모였습니다"), "충족 → 확신 화법");
  // 17) conv 미전달이면 기존 동작(하위 호환)
  ok(summaryNarrative(rr, "세련된", false).includes("모였습니다"), "conv 없으면 기존 동작");

  // 21) 중간대 — 방향을 단정하지 않고 균형을 말한다. 문장이 사라지지 않는 것이 요점이다.
  const rm = partRow({ part: "윤곽", type: "우아한", n: 10, obs: [{ field: "face_HW", dir: "mid" }] });
  ok(rm.line.includes("얼굴 세로와 가로가 균형에 가깝습니다"), "mid는 균형 문장");
  ok(!/갸름|동그란/.test(rm.line), "mid는 방향을 말하지 않는다");
  ok(rm.line.length > 0, "mid에서 문장이 사라지지 않는다");
  // mid 어휘가 여섯 필드 모두에 있다 — 하나라도 없으면 그 필드는 중간대에서 침묵한다
  ["face_HW","chin_len","interocular","parts_vpos","mouth_w","eye_angle"]
    .forEach(k => ok(OBS[k] && OBS[k].mid && OBS[k].mid.d, `${k} mid 어휘 등재`));

  return "part-report selfCheck 통과 (24/24 · 중간대 21 포함)";
}
