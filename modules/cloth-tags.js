/* 옷의 소재·실루엣 → 8타입 (2026-08-26)
 *
 * **왜 만들었나** — 대표 지적: "그냥 상의, 색깔만 등록하면 그걸로 분석을 어떻게하고
 * 추천을 어떻게해줄래?" 맞는 말이었다. 그전까지 옷 한 벌이 가진 정보는 부위와 색뿐이고,
 * 타입 판정은 **색 hex가 퍼스널컬러 팔레트 104칸과 정확히 일치하는가** 하나였다.
 * 그래서 같은 부위·같은 타입 옷이 여러 벌이면 추천은 id 문자열 순으로 골랐다 —
 * 고르는 게 아니라 줄 세우는 것이었다.
 *
 * **새 이론을 만들지 않았다.** 여기 표는 전부 마스터 `theory/추구미라이브러리_v1_마스터.md`의
 * 8타입 HAVE-2 서술(L357·372·386·400·414·428·442)과 로맨틱 상세표(L308~309)를 옮긴 것이다.
 * 이론이 이미 알고 있던 것을 화면이 안 묻고 있었을 뿐이다.
 *   · 로맨틱   쉬폰·굵은 게이지 니트 / A라인·프릴·리본·꽃무늬
 *   · 청순청량 셔츠·코튼 등 가볍고 깔끔한 소재 / 셔츠·연청·심플 원피스 미니멀
 *   · 우아한   슬랙스·가디건·실키 블라우스 등 흐르는 소재 / 장식 없는 단정한 라인
 *   · 에너제틱 코튼·저지·데님 활동 소재 / 봄버·와이드팬츠·후드 캐주얼
 *   · 화려함   가죽·새틴·벨벳 / 바디라인 핏·에스닉·카고
 *   · 클래식   트렌치·니트블레이저·치노 / 유행 안 타는 기본
 *   · 카리스마 무광 가죽 / 각진 어깨·더블브레스트·직선 실루엣
 *   · 세련된   정장·셔츠 / 스트레이트핏 미니멀
 *
 * ⚠ 이 매핑표는 이론팀 검수 대기다(requests/에 요청서). 마스터 서술을 옮기는 과정에서
 *   한 소재가 두 타입에 걸치는 자리가 있었고(코튼=청순청량·에너제틱, 가죽=화려함·카리스마),
 *   그건 내가 판단한 게 아니라 **양쪽에 다 준다**. 실제로 그 소재는 둘 다의 재료다 —
 *   가르는 것은 광택(새틴 vs 무광)과 핏이고, 그건 아래 실루엣 칸이 맡는다.
 *
 * 점수: 색·소재·실루엣 각 +1, 합계 0~3이 tag_power가 된다(czm-stats.recommendOutfit).
 * 색만 있던 시절의 "있으면 1"보다 **더 잘 맞는 옷이 위로 온다.** 그게 추천의 최소 조건이다.
 */

// 소재 — 만졌을 때·빛을 받았을 때로 갈린다. 유저가 옷장 앞에서 바로 고를 수 있는 낱말만 쓴다.
export const FABRICS = [
  { key:"chiffon",  label:"쉬폰·시스루", types:["romantic"] },
  { key:"knit_big", label:"도톰한 니트", types:["romantic"] },
  // 신설 (이론 2026-08-27) — 이 칸이 없어서 **모든 니트가 로맨틱으로 갔다.**
  // 마스터 2-1-2가 굵은 게이지와 얇고 단정한 니트를 직접 갈라 적고 있다.
  { key:"knit_fine",label:"얇고 단정한 니트·가디건", types:["classic","elegant"] },
  { key:"cotton",   label:"면·코튼",     types:["pure","energetic"] },
  { key:"shirt",    label:"셔츠천",      types:["pure","chic"] },
  { key:"silky",    label:"실키·흐르는", types:["elegant"] },
  { key:"denim",    label:"데님·청",     types:["energetic"] },
  { key:"jersey",   label:"저지·트레이닝", types:["energetic"] },
  { key:"satin",    label:"새틴·벨벳",   types:["gorgeous"] },
  // 광택으로 가른다 (이론 2026-08-27). 겹침으로 두면 실루엣 미기입 시 무광 가죽이
  // **항상** 화려함으로 갔다. 마스터가 카리스마 소재로 적은 것은 무광 가죽뿐이다.
  { key:"leather",  label:"가죽(광택)",  types:["gorgeous"] },
  { key:"leather_mat", label:"무광 가죽", types:["charisma"] },
  { key:"wool",     label:"울·트위드",   types:["classic"] },
  // 카리스마 제거 (이론 2026-08-27) — 마스터가 카리스마 소재로 적은 것은 무광 가죽뿐이고,
  // "더블브레스트"는 소재가 아니라 재단이라 실루엣 칸(sharp)이 맡는다.
  { key:"suit",     label:"정장지",      types:["chic"] },
];

// 실루엣 — 몸에 닿는 선의 모양. 소재가 겹칠 때 타입을 실제로 가르는 칸이다.
export const SHAPES = [
  { key:"flare",    label:"퍼지는 A라인", types:["romantic"] },
  { key:"frill",    label:"프릴·리본·꽃무늬", types:["romantic"] },
  { key:"simple",   label:"장식 없는 심플", types:["pure","elegant"] },
  { key:"straight", label:"곧게 떨어지는", types:["elegant","chic"] },
  { key:"oversize", label:"넉넉·오버핏",  types:["energetic"] },
  { key:"bodyline", label:"몸에 붙는",    types:["gorgeous"] },
  { key:"sharp",    label:"각진 어깨·직선", types:["charisma"] },
  { key:"basic",    label:"유행 안 타는 기본", types:["classic"] },
];

const byKey = (arr, k) => arr.find(x => x.key === k) || null;
export const fabricOf = k => byKey(FABRICS, k);
export const shapeOf  = k => byKey(SHAPES, k);

/** 옷 한 벌 → {type, power}. 색·소재·실루엣 세 표의 다수결이다.
 *  colorType은 기존 팔레트 판정 결과(없으면 null)를 그대로 받는다 — 색 규칙은 손대지 않았다.
 *  동점이면 **실루엣 → 소재 → 색** 순으로 앞선 쪽이 이긴다 (이론 역전 2026-08-27).
 *  개발팀이 처음 건 순서는 색 우선이었고 근거로 §4-2를 들었는데, 이론팀이 그 조항을
 *  다시 읽고 반대라고 판정했다 — §4-2의 원칙은 "실측이 이긴다"가 아니라
 *  **"재현되는 것이 이긴다"**이다(웜쿨은 드레이핑 0.8 + 색채 측정 0.2).
 *  그리고 옷 색은 조명으로 뒤집힌다(같은 회신 ②: 조명 노이즈가 1·2위 차보다 크다).
 *  실루엣과 소재는 유저 신고라 조명을 안 탄다 — 흔들리지 않는 값이 먼저 선다. */
export function tagOf(attrs, colorType) {
  const vote = new Map();
  const add = (types, w) => (types || []).forEach(t => vote.set(t, (vote.get(t) || 0) + w));
  if (colorType) add([colorType], 1);
  add(fabricOf(attrs?.fabric)?.types, 1);
  add(shapeOf(attrs?.shape)?.types, 1);
  if (!vote.size) return { type:null, power:0 };
  // 한 칸이 두 타입을 가리키면 두 타입 다 표를 받는다. 그래서 최고점이 곧 이 옷의 성격이다.
  let best = null, hi = 0;
  const order = [shapeOf(attrs?.shape)?.types?.[0], fabricOf(attrs?.fabric)?.types?.[0], colorType];
  for (const [t, n] of vote) {
    if (n > hi || (n === hi && order.indexOf(t) >= 0 &&
        (best === null || order.indexOf(t) < order.indexOf(best)))) { hi = n; best = t; }
  }
  return { type: best, power: hi };
}

/** 자기 점검 — 이 파일만 열어도 표가 살아 있는지 확인된다. */
export function selfCheck() {
  const t = [];
  const eq = (got, want, name) => t.push({name, ok: got === want, got, want});
  // 색·소재·실루엣이 모두 로맨틱 → 3점
  eq(tagOf({fabric:"chiffon", shape:"frill"}, "romantic").power, 3, "로맨틱 3표");
  // 소재만 있는 옷도 타입이 잡힌다 — 색이 팔레트에 없어 추천에서 사라지던 자리
  eq(tagOf({fabric:"leather"}, null).type, "gorgeous", "색 없이 소재만");
  // 아무것도 없으면 0 (종전 동작 유지)
  eq(tagOf({}, null).power, 0, "빈 옷");
  // 무광 가죽은 실루엣이 없어도 카리스마다 (겹침이던 시절엔 항상 화려함으로 갔다)
  eq(tagOf({fabric:"leather_mat"}, null).type, "charisma", "무광 가죽=카리스마");
  // 얇은 니트가 로맨틱으로 새지 않는다
  eq(tagOf({fabric:"knit_fine"}, null).type !== "romantic", true, "얇은 니트≠로맨틱");
  // 동점 역전 — 색(로맨틱)과 실루엣(카리스마)이 1:1이면 실루엣이 이긴다
  eq(tagOf({shape:"sharp"}, "romantic").type, "charisma", "동점이면 실루엣이 이긴다");
  return t;
}
