// 에셋 스코어링 엔진 v1 [가설] — 이론체계_에셋스코어링_v1 v1.4 구현
// 지위: hypo_ver hs2 · 섀도 산출(기존 판정 미교체) · 부위별 판정은 베타 노출 허용(v1.3.1 Q6)
//
// 상수는 전부 이론팀 확정값의 인용이다. 이 파일에서 창작한 수치는 0건이다.
//   · 축 기여 계수 강0.6/중0.4/약0.2 ...... v1.4 §3 서두
//   · 부위 비중 ............................ v1.4 §5-1 (v1.3 개정판)
//   · 8타입 T·D 좌표 ....................... 마스터 1-1
//   · 8타입 M 좌표 ......................... 대표 확정 순위(작업노트 §A6) · 간격은 잠정 균등
//   · A′ 거리비 0.8 ........................ v1.4 §5-1
//
// 밴드 경계 0건. 관측값은 분포(중앙값·IQR) 대비 상대 위치로만 쓴다 — D26 정합.

export const TYPES = {
  로맨틱:   { T:-0.8, D:-0.8, M:-0.40 },   // §A6 정본. -0.90은 §A6 확정 이전 제안값이 남은 것 (2026-08-17 시정)
  청순청량: { T:+0.8, D:-0.8, M:-0.65 },
  우아한:   { T:+0.5, D:-0.5, M:+0.15 },
  에너제틱: { T:-0.6, D:-0.4, M:-0.90 },
  화려함:   { T:-0.8, D:+0.8, M:+0.65 },
  클래식:   { T:-0.5, D:+0.4, M:+0.40 },
  카리스마: { T:+0.8, D:+0.9, M:+0.90 },
  세련된:   { T:+0.7, D:+0.6, M:-0.15 },
};
// ⚠ M은 대표 확정 "순서"만 정본이다. 위 숫자의 간격은 개발팀 잠정 균등 배분이며
//   판정 로직이 간격에 의존하지 않도록 최근접 판정에만 쓴다(v1.4 §2-2 Q1 해소).

export const PART_WEIGHT = { 윤곽:0.30, 눈:0.25, 코:0.15, 입:0.15, 눈썹:0.08, 볼입체:0.07 };

// 색 채널 — **부위가 아니라 별도 레이어**다 (이론 판정 ②-b, 2026-08-08).
// 부위 비중 테이블은 대표 검수를 거친 "사람이 인지하는 부위" 서열이라, 색을 7번째로 끼우면
// 검수받지 않은 서열 개입이 된다. 그래서 부위 가중평균 뒤에 얹는다.
//
// 가중은 **확정 가중을 그대로** 쓴다 — 강중약 사다리(0.6/0.4/0.2)로 변환하지 않는다(판정 ②-a 기각).
// 이유: 채도는 유일 검증 주축(r≈0.58)인데 강 0.6으로 누르면 미검증 형태 에셋과 같은 계수가 되어
// 검증 위계가 지워진다.
export const COLOR_ASSETS = [
  { key:"chroma",           label:"채도", axis:"D", w:1.0 },  // AXW 1.0 — 유일 검증 주축
  { key:"contrast_overall", label:"대비", axis:"D", w:0.3 },  // ⚠ 명세는 "0.3×헤어게이트"인데
  //   헤어게이트 값이 photo-module 산출에 없어 0.3 고정으로 뒀다. 이론팀 고지 대상.
  { key:"hue_angle",        label:"웜쿨", axis:"T", w:-0.2 }, // 측정 0.2분만(드레이핑 0.8은 사진 단계 측정 불가)
  //   부호: hue 높음=노란기=웜 → T 음수 (마스터 1-1 웜=음수). 이론팀 확인 완료.
  //   ⚠ 확정 구조(0.8+0.2)의 20%짜리 신호 → 색 유래 T 기여는 저신뢰. 웜쿨이 판정을 가른 케이스는
  //   저신뢰 병기 대상(기존 2차 방어 문법).
];

// 에셋 정의. pos/neg = 관측값이 분포 중앙보다 클 때 / 작을 때의 축 기여.
// 계수가 방향마다 다른 항목이 있다(예: 눈꼬리 상향 +0.6 / 하향 −0.4) — 이론 표를 그대로 옮긴 것이다.
export const ASSETS = [
  // ── 눈 (v1.4 §3-1)
  { part:"눈", key:"eye_angle",   label:"눈꼬리",
    pos:{T:+0.6}, neg:{T:-0.4} },                       // 상향=카리·세련·에너 / 하향·수평=로맨·우아
  { part:"눈", key:"eye_round",   label:"눈 종횡비", derive:m => ratio(m.eye_open, m.eye_len),
    pos:{T:-0.4}, neg:{T:+0.4, D:+0.2} },               // 동그람 / 길고 가늠
  { part:"눈", key:"eye_len",     label:"눈 크기",
    pos:{M:-0.4}, neg:{M:+0.4} },                       // 큼=동안. D 소적재(여성한정)는 섀도라 제외(§5-3)
  { part:"눈", key:"interocular", label:"눈 사이 간격",
    pos:{M:-0.2}, neg:null },                           // 넓음만 단방향 — 좁음은 앵커 없음(§3-1)

  // ── 눈썹 (v1.4 §3-2)
  { part:"눈썹", key:"brow_arch_deg", label:"눈썹 아치",
    pos:{T:-0.4}, neg:{T:+0.4}, note:"H2 척도 의심 — 분포 확인 전 저가중 운용" },
  { part:"눈썹", key:"brow_eye_gap",  label:"눈-눈썹 거리",
    pos:{T:-0.2, M:-0.2}, neg:null },                   // 넉넉만. 좁음 방향은 마스터 근거 없음

  // ── 코 (v1.4 §3-3) — 3D 전용. 2D 환경에서는 부위 전체가 결측이 된다.
  { part:"코", key:"nose_projection", label:"콧대 돌출",
    pos:{M:+0.4, D:+0.2}, neg:{M:-0.4, D:-0.2} },

  // ── 입 (v1.4 §3-4)
  { part:"입", key:"lip_thickness", label:"입술 두께", derive:m => sum(m.lip_upper, m.lip_lower),
    pos:{T:-0.4}, neg:{T:+0.2, D:+0.2} },               // 도톰 / 얇음~보통
  { part:"입", key:"mouth_w",       label:"입 크기",
    pos:{D:+0.4}, neg:null },                           // 큼만 — 조합 판독 전용(D28 단독 금지)

  // ── 윤곽 (v1.4 §3-5)
  { part:"윤곽", key:"jaw_angular_deg", label:"턱선 꺾임",
    pos:{T:+0.6, D:+0.3}, neg:{T:-0.6} },
  { part:"윤곽", key:"face_HW",         label:"얼굴 세로/가로",
    pos:{M:+0.6}, neg:{M:-0.6} },                       // M축 전용(§5-3 — T·D 적재 제거)
  { part:"윤곽", key:"chin_len",        label:"턱 길이",
    pos:{M:+0.4}, neg:{M:-0.4} },
  { part:"윤곽", key:"parts_vpos",      label:"파츠 상하 위치",
    pos:{M:-0.4}, neg:{M:+0.4} },                       // 아래쪽(값 큼)=동안
];
// 축 가산이 없는 것(의도적 제외):
//   chin_angle_deg  — E4 조합 규칙 전용, 단독 사용 금지(🔴4)
//   face_taper      — 분산 신호 재료(§5-2), 축 가산 없음
//   nose_w          — 배제신호 D1 감점 전용(§3-3), 가산 없음
//   mouth_corner    — 축이 아니라 에너제틱 타입 직접 가산. 표정 교란(U2·H4)으로 저가중 → applyDirect()
//   jaw_w·temple_w  — 보조·게이트 전용(삼중계산 금지 🟡9)
//   볼·입체         — 3D/설문 미도입

const AXES = ["T","D","M"];
const sum   = (...v) => v.every(isNum) ? v.reduce((a,b)=>a+b,0) : null;
const ratio = (a,b)  => (isNum(a)&&isNum(b)&&b!==0) ? a/b : null;
function isNum(v){ return typeof v==="number" && isFinite(v); }

/** 분포 기준(중앙값·IQR)을 만든다. 밴드가 아니라 상대 위치용 기준자다. */
export function buildRef(samples){
  const ref={};
  const keys=new Set([...ASSETS.map(a=>a.key), ...COLOR_ASSETS.map(a=>a.key)]);
  for(const k of keys){
    const vals=samples.map(s=>s[k]).filter(isNum).sort((a,b)=>a-b);
    if(vals.length<4){ ref[k]=null; continue; }          // 4개 미만이면 사분위가 무의미
    const q=p=>vals[Math.min(vals.length-1, Math.floor(vals.length*p))];
    const med=q(0.5), iqr=q(0.75)-q(0.25);
    ref[k]={med, iqr, n:vals.length};
  }
  return ref;
}

/** 관측값 → [-1,+1] 상대 위치. IQR이 0이면(변별 없음) null. */
function relative(v, r){
  if(!isNum(v)||!r||!isNum(r.med)) return null;
  if(!(r.iqr>0)) return null;
  return Math.max(-1, Math.min(1, (v-r.med)/(r.iqr/2)));
}

/** 측정치 하나 → 부위 좌표·종합 좌표·분산 신호. m은 photo-module의 ratio+line 필드 평면. */
export function scoreAssets(m, ref){
  const parts={}, detail=[];
  for(const a of ASSETS){
    const raw = a.derive ? a.derive(m) : m[a.key];
    const s = relative(raw, ref[a.key]);
    const contrib = s==null ? null : (s>=0 ? a.pos : a.neg);
    const rec={ part:a.part, key:a.key, label:a.label, raw:isNum(raw)?+raw.toFixed(4):null, s:s==null?null:+s.toFixed(3) };
    detail.push(rec);
    if(s==null || !contrib) continue;                     // 결측 또는 단방향의 반대편 → 기여 없음
    (parts[a.part] ||= {T:0,D:0,M:0,n:0});
    for(const ax of AXES) if(isNum(contrib[ax])) parts[a.part][ax] += contrib[ax]*Math.abs(s);
    parts[a.part].n++;
  }

  // 부위 비중 재정규화 — 결측 부위(3D 미측정 등)를 0으로 두지 않고 남은 부위로 나눈다.
  // 0을 채우면 "중립"이라는 없는 정보를 만든다(오류대장 §001).
  const live=Object.keys(parts).filter(p=>parts[p].n>0);
  const wSum=live.reduce((s,p)=>s+(PART_WEIGHT[p]||0),0);
  const overall={T:0,D:0,M:0};
  if(wSum>0) for(const p of live){
    const w=(PART_WEIGHT[p]||0)/wSum;
    for(const ax of AXES) overall[ax]+=parts[p][ax]*w;
  }

  // 부위 간 분산 신호(§5-2) — T좌표 분산이 크고 부위 평균이 Soft 반평면(D<0)일 때만 에너제틱 신호.
  const Ts=live.map(p=>parts[p].T);
  const variance = Ts.length>=2 ? +stdev(Ts).toFixed(3) : null;
  const energeticSignal = (variance!=null && overall.D<0) ? variance : null;

  // ── 색 레이어 (별도 항, 판정 ②) ──
  // 종합 축값 = Σ(부위 비중 × 부위 좌표) + Σ(색 확정 가중 × 정규화 신호)
  // 두 항의 결합 비율 상수는 두지 않는다 — 판정 ①의 순위 변환이 최종 축값의 절대 스케일을
  // 흡수하므로 비율 상수가 판정에 들어갈 자리가 없다(①②를 한 회신에서 처리한 이유).
  const color={T:0,D:0,M:0,n:0};
  for(const c of COLOR_ASSETS){
    const s=relative(m[c.key], ref[c.key]);
    detail.push({part:"색", key:c.key, label:c.label, raw:isNum(m[c.key])?+m[c.key].toFixed(4):null, s:s==null?null:+s.toFixed(3)});
    if(s==null) continue;
    color[c.axis]+=c.w*s; color.n++;
  }
  for(const ax of AXES) overall[ax]+=color[ax];

  const partTypes={};
  for(const p of live) partTypes[p]=nearestType(parts[p]);

  return {
    hypo_ver:"hs3",
    color:{T:+color.T.toFixed(3), D:+color.D.toFixed(3), M:+color.M.toFixed(3), n:color.n},
    parts:Object.fromEntries(live.map(p=>[p,{T:+parts[p].T.toFixed(3),D:+parts[p].D.toFixed(3),M:+parts[p].M.toFixed(3),n:parts[p].n}])),
    partTypes,
    overall:Object.fromEntries(AXES.map(ax=>[ax,+overall[ax].toFixed(3)])),
    overallType: wSum>0 ? nearestType(overall) : null,
    variance, energeticSignal,
    partsMissing:Object.keys(PART_WEIGHT).filter(p=>!live.includes(p)),
    weightUsed:wSum,
    detail,
  };
}

/**
 * 배치 판정 — 판정 ①(순위 공간 최근접) 정본 구현. **단건으로는 판정할 수 없다.**
 * 백분위는 표본이 있어야 정의되기 때문이다.
 *
 * 축별(T·D·M 각각): 순위 r(1..n, 동률 평균) → p=(r−0.5)/n → s=2p−1 ∈ (−1,+1)
 * 타입 좌표는 §2-2 값 그대로 쓰고, 판정은 변환된 좌표와의 유클리드 최근접.
 *
 * 왜 표준화(z·min-max)가 아닌가: 순위 변환은 **고를 파라미터가 0개**다. 표준화는 그 연속 근사이고,
 * 근사를 정본으로 삼으면 "왜 z인가"라는 파라미터 선택 문제가 나중에 다시 생긴다(판정 ①).
 *
 * 지위 [가설-잠정분포]: 기준 분포가 현재 표본이라는 사실은 표본 의존이다. 고정 앵커를 두지 않고
 * 표본이 갱신될 때마다 재산출한다. 실사용 n≥30 도달 시 그 분포로 교체 — D26 백분위 밴드와 같은 시점.
 */
export function scoreBatch(samples, ref){
  const raw=samples.map(m=>scoreAssets(m, ref));
  const n=raw.length;
  const ranked=raw.map(r=>({...r, overallRaw:{...r.overall}}));
  for(const ax of AXES){
    const idx=ranked.map((r,i)=>({i, v:r.overall[ax]})).sort((a,b)=>a.v-b.v);
    // 동률은 평균 순위 — 같은 값에 다른 좌표를 주면 없는 차이를 만든다
    let k=0;
    while(k<idx.length){
      let j=k; while(j+1<idx.length && idx[j+1].v===idx[k].v) j++;
      const avgRank=(k+j)/2 + 1;                       // 1-based
      for(let t=k;t<=j;t++) ranked[idx[t].i].overall[ax]=+(2*((avgRank-0.5)/n)-1).toFixed(4);
      k=j+1;
    }
  }
  for(const r of ranked){
    r.overallType = r.weightUsed>0 ? nearestType(r.overall) : null;
    r.rankSpace = true;
  }
  return ranked;
}

/**
 * 누적 분포 기준자 — 리포트는 **한 사람이 자기 결과를 보는 화면**이라 배치 판정을 쓸 수 없다.
 * 판정 ①의 [가설-잠정분포]가 정한 대로 "지금까지 확보된 전 측정 표본"을 기준 분포로 삼는다.
 * 축별·부위별 raw 좌표 배열을 만들어 두고, 새 관측 한 건의 백분위를 그 안에서 잰다.
 */
export function buildDist(samples, ref){
  const scored=samples.map(m=>scoreAssets(m, ref));
  const overall=Object.fromEntries(AXES.map(a=>[a,[]]));
  const parts={};
  for(const s of scored){
    for(const ax of AXES) if(s.weightUsed>0) overall[ax].push(s.overall[ax]);
    for(const [p,c] of Object.entries(s.parts)){
      (parts[p] ||= Object.fromEntries(AXES.map(a=>[a,[]])));
      for(const ax of AXES) parts[p][ax].push(c[ax]);
    }
  }
  const sort=o=>{ for(const ax of AXES) o[ax].sort((a,b)=>a-b); return o; };
  sort(overall); Object.values(parts).forEach(sort);
  return { n:scored.length, overall, parts };
}

/** 값 v가 정렬 배열 arr 안에서 차지하는 위치 → (−1,+1). 판정 ① 식 그대로, 새 관측을 포함해 n+1로 센다. */
function rankPos(v, arr){
  if(!isNum(v) || !arr || arr.length===0) return null;
  let lo=0, eq=0;
  for(const x of arr){ if(x<v) lo++; else if(x===v) eq++; }
  const r=lo + eq/2 + 1;          // 새 관측의 순위(동률은 평균)
  const p=(r-0.5)/(arr.length+1);
  return +(2*p-1).toFixed(4);
}

/**
 * 단건 판정 — 리포트용 정본 경로. `scoreBatch`는 검증용(배치), 이것이 실사용 경로다.
 * dist가 없거나 표본이 모자라면 순위 좌표를 만들지 않는다(0을 중립으로 쓰지 않는다, §001).
 */
export function scoreOne(m, ref, dist){
  const s=scoreAssets(m, ref);
  if(!dist || !dist.n){ s.rankSpace=false; return s; }
  s.overallRaw={...s.overall};
  s.partsRaw=JSON.parse(JSON.stringify(s.parts));
  for(const ax of AXES){
    const v=rankPos(s.overall[ax], dist.overall[ax]);
    if(v!==null) s.overall[ax]=v;
  }
  for(const [p,c] of Object.entries(s.parts)){
    const d=dist.parts[p]; if(!d) continue;
    for(const ax of AXES){ const v=rankPos(c[ax], d[ax]); if(v!==null) c[ax]=v; }
    s.partTypes[p]=nearestType(c);
  }
  s.overallType = s.weightUsed>0 ? nearestType(s.overall) : null;
  s.rankSpace=true; s.distN=dist.n;
  return s;
}

/**
 * 부위별 관찰 2개 — 리포트 이유 문장 재료(정본 §3-3).
 * 기여가 큰 순(|s|)으로 고르고, 방향은 부호로 준다. 결측 필드는 detail에서 s=null이라 자동 제외된다.
 */
export function partObservations(score, part, limit=2){
  return (score.detail||[])
    .filter(d=>d.part===part && d.s!==null)
    .sort((a,b)=>Math.abs(b.s)-Math.abs(a.s))
    .slice(0,limit)
    .map(d=>({field:d.key, dir:d.s>=0?"hi":"lo"}));
}

/** 좌표 → 최근접 타입. 1·2위 거리비가 0.8 이상이면 A′(인접) 병기(§5-1). */
export function nearestType(c){
  const d=Object.entries(TYPES).map(([name,t])=>({
    name, dist:Math.hypot(c.T-t.T, c.D-t.D, c.M-t.M)
  })).sort((a,b)=>a.dist-b.dist);
  const [first,second]=d;
  const ratio2=first.dist>0 ? second.dist/first.dist : Infinity;
  return {
    type:first.name,
    second:second.name,
    adjacent: ratio2<=1/0.8,                 // 2위가 1위에 가까움 → A′ 표기 대상
    label: ratio2<=1/0.8 ? `${first.name}′(${second.name}의 결)` : first.name,
    dist:+first.dist.toFixed(3),
  };
}

/** WANT(추구미) 대조 → 부위별 격차. 큰 순으로 정렬해 변주 우선순위 재료로 넘긴다(§6). */
export function gapToWant(score, wantType){
  const w=TYPES[wantType];
  if(!w||!score.parts) return null;
  const rows=Object.entries(score.parts).map(([part,c])=>({
    part,
    gap:+Math.hypot(c.T-w.T, c.D-w.D, c.M-w.M).toFixed(3),
    dT:+(w.T-c.T).toFixed(3), dD:+(w.D-c.D).toFixed(3), dM:+(w.M-c.M).toFixed(3),
  })).sort((a,b)=>b.gap-a.gap);
  return { want:wantType, overallGap:+Math.hypot(score.overall.T-w.T, score.overall.D-w.D, score.overall.M-w.M).toFixed(3), parts:rows };
}

function stdev(a){ const m=a.reduce((s,v)=>s+v,0)/a.length; return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/a.length); }

// ── 자체 점검 ──────────────────────────────────────────────
// 노드/브라우저 어디서든 asserts로 돈다. 로직이 깨지면 여기서 먼저 터진다.
export function selfCheck(){
  const ok=(c,msg)=>{ if(!c) throw new Error("selfCheck 실패: "+msg); };

  // 1) 8타입이 자기 좌표에서 자기로 판정돼야 한다
  for(const [name,t] of Object.entries(TYPES))
    ok(nearestType(t).type===name, `${name} 자기좌표 자기판정`);

  // 2) 여름쌍이 M축으로 갈린다 — M을 빼면 안 갈려야 한다(M축 신설의 근거)
  const 청순=TYPES.청순청량, 우아=TYPES.우아한;
  const with3=Math.hypot(청순.T-우아.T, 청순.D-우아.D, 청순.M-우아.M);
  const with2=Math.hypot(청순.T-우아.T, 청순.D-우아.D);
  ok(with3>with2*1.5, `여름쌍이 M축으로 벌어져야 함 (2축 ${with2.toFixed(2)} → 3축 ${with3.toFixed(2)})`);

  // 3) 부위 비중 합 = 1
  ok(Math.abs(Object.values(PART_WEIGHT).reduce((a,b)=>a+b,0)-1)<1e-9, "부위 비중 합 1");

  // 4) 결측 부위가 있어도 비중이 재정규화돼 좌표가 나온다
  const ref=buildRef([
    {eye_angle:-2,eye_open:.30,eye_len:.28,interocular:1.0,brow_arch_deg:35,brow_eye_gap:.05,lip_upper:.03,lip_lower:.04,mouth_w:.42,jaw_angular_deg:8,face_HW:1.35,chin_len:.16,parts_vpos:.36},
    {eye_angle:+1,eye_open:.26,eye_len:.30,interocular:1.1,brow_arch_deg:40,brow_eye_gap:.06,lip_upper:.02,lip_lower:.03,mouth_w:.45,jaw_angular_deg:12,face_HW:1.45,chin_len:.18,parts_vpos:.38},
    {eye_angle:+3,eye_open:.24,eye_len:.32,interocular:1.2,brow_arch_deg:44,brow_eye_gap:.07,lip_upper:.04,lip_lower:.05,mouth_w:.48,jaw_angular_deg:16,face_HW:1.55,chin_len:.20,parts_vpos:.40},
    {eye_angle:+5,eye_open:.22,eye_len:.34,interocular:1.3,brow_arch_deg:48,brow_eye_gap:.08,lip_upper:.05,lip_lower:.06,mouth_w:.51,jaw_angular_deg:20,face_HW:1.65,chin_len:.22,parts_vpos:.42},
  ]);
  const s=scoreAssets({eye_angle:+5,eye_open:.22,eye_len:.34,interocular:1.3,brow_arch_deg:48,brow_eye_gap:.08,
                       lip_upper:.05,lip_lower:.06,mouth_w:.51,jaw_angular_deg:20,face_HW:1.65,chin_len:.22,parts_vpos:.42}, ref);
  ok(s.partsMissing.includes("코"), "3D 없으면 코 부위 결측");
  ok(s.partsMissing.includes("볼입체"), "볼·입체 결측");
  ok(s.overallType!==null, "결측이 있어도 종합 좌표 산출");
  ok(Math.abs(s.weightUsed-(0.30+0.25+0.15+0.08))<1e-9, "결측 제외 비중 합");

  // 5) 결측 필드는 0이 아니라 기여 없음으로 처리돼야 한다
  const s2=scoreAssets({jaw_angular_deg:20}, ref);
  ok(s2.partsMissing.includes("눈"), "눈 필드 없으면 눈 부위 결측");
  ok(s2.detail.find(d=>d.key==="eye_angle").s===null, "결측 필드 s=null");

  // 6) 각짐이 커지면 T가 커져야 한다(방향 부호)
  const soft=scoreAssets({jaw_angular_deg:8,  face_HW:1.35, chin_len:.16, parts_vpos:.36}, ref);
  const hard=scoreAssets({jaw_angular_deg:20, face_HW:1.35, chin_len:.16, parts_vpos:.36}, ref);
  ok(hard.parts.윤곽.T > soft.parts.윤곽.T, "각짐↑ → T↑");

  // 7) WANT 대조가 격차 큰 부위를 먼저 준다
  const g=gapToWant(hard, "로맨틱");
  ok(g.parts.length>=1 && g.parts[0].gap>=g.parts[g.parts.length-1].gap, "격차 내림차순");

  // 8) 순위 변환(판정 ①) — 결과가 (−1,+1) 안이고 순서가 보존돼야 한다
  const S=[{jaw_angular_deg:8,face_HW:1.35,chin_len:.16,parts_vpos:.36},
           {jaw_angular_deg:12,face_HW:1.45,chin_len:.18,parts_vpos:.38},
           {jaw_angular_deg:16,face_HW:1.55,chin_len:.20,parts_vpos:.40},
           {jaw_angular_deg:20,face_HW:1.65,chin_len:.22,parts_vpos:.42}];
  const B=scoreBatch(S, ref);
  for(const b of B) for(const ax of AXES)
    ok(b.overall[ax]>-1 && b.overall[ax]<1, `순위좌표 ${ax} 개구간 (−1,+1)`);
  const rawT=B.map(b=>b.overallRaw.T), rnkT=B.map(b=>b.overall.T);
  for(let i=0;i<rawT.length;i++) for(let j=0;j<rawT.length;j++)
    if(rawT[i]<rawT[j]) ok(rnkT[i]<rnkT[j], "순위 변환이 순서를 보존");
  ok(B.every(b=>b.rankSpace), "배치 결과에 rankSpace 표시");

  // 9) 동률은 평균 순위 — 같은 값에 다른 좌표를 주면 없는 차이를 만든다
  const T2=scoreBatch([S[0],S[0],S[3]], ref);
  ok(T2[0].overall.T===T2[1].overall.T, "동률 입력은 동일 좌표");

  // 10) 색은 별도 레이어다 — 부위에 안 들어가고 종합에만 얹힌다
  const cRef=buildRef([{chroma:10,contrast_overall:30,hue_angle:50,jaw_angular_deg:8},
                       {chroma:20,contrast_overall:40,hue_angle:60,jaw_angular_deg:12},
                       {chroma:30,contrast_overall:50,hue_angle:70,jaw_angular_deg:16},
                       {chroma:40,contrast_overall:60,hue_angle:80,jaw_angular_deg:20}]);
  const cHi=scoreAssets({chroma:40,contrast_overall:60,hue_angle:80,jaw_angular_deg:12}, cRef);
  const cLo=scoreAssets({chroma:10,contrast_overall:30,hue_angle:50,jaw_angular_deg:12}, cRef);
  ok(!("색" in cHi.parts), "색은 부위가 아니다");
  ok(cHi.color.D > cLo.color.D, "채도↑ → 색 레이어 D↑");
  ok(cHi.color.T < cLo.color.T, "웜(hue↑) → 색 레이어 T↓ (마스터 웜=음수)");
  ok(cHi.overall.D !== cHi.parts.윤곽.D, "종합에 색이 얹혀 부위값과 달라진다");

  // 11) 누적 분포 단건 판정 — 리포트 실사용 경로
  const D=buildDist(S, ref);
  ok(D.n===S.length, "분포 표본 수");
  ok(Array.isArray(D.overall.T) && D.overall.T.length===S.length, "축별 분포 배열");
  const one=scoreOne(S[3], ref, D);
  ok(one.rankSpace===true && one.distN===S.length, "순위 공간 표시");
  for(const ax of AXES) ok(one.overall[ax]>-1 && one.overall[ax]<1, `단건 순위좌표 ${ax} 개구간`);
  ok(one.overallRaw && one.overallRaw.T!==undefined, "raw 좌표 보존");
  // 12) 분포가 없으면 순위 변환을 하지 않는다(0을 중립으로 쓰지 않음)
  const noD=scoreOne(S[0], ref, null);
  ok(noD.rankSpace===false && noD.overallRaw===undefined, "분포 없으면 raw 유지");
  // 13) 분포 안에서 큰 값일수록 순위 좌표도 크다(순서 보존)
  const lowRaw=scoreAssets(S[0], ref).overall.T, hiRaw=scoreAssets(S[3], ref).overall.T;
  const lo2=scoreOne(S[0], ref, D).overall.T, hi2=scoreOne(S[3], ref, D).overall.T;
  ok((hiRaw>lowRaw) === (hi2>lo2), "단건 순위 변환이 순서 보존");
  // 14) 관찰 추출 — 기여 큰 순 2개, 방향 부호
  const obs=partObservations(one, "윤곽");
  ok(obs.length<=2 && obs.every(o=>o.field && (o.dir==="hi"||o.dir==="lo")), "관찰 추출 형식");
  ok(partObservations(one, "코").length===0, "3D 없으면 코 관찰 0");

  return "asset-score selfCheck 통과 (14/14)";
}
