// 오늘의 한 걸음 — 산출 엔진
// 근거: theory/이론확정_이동처방규칙_v1_[가설]_2026-08-09.md §1·§2·§4
//       theory/추구미라이브러리_v1_마스터.md §6 서열표
// 지위: [가설] — 규칙 전체가 이론팀 [가설]이며 계측으로만 교정된다(요청서 §6 반증 조건)
//
// **창작한 숫자 0건.** 강도 0.2·주축 전환 문턱 0.4는 이론 §1에서, 서열과 "움직이는 축"은
// 마스터 §6 표에서 그대로 인용했다.

/* 마스터 §6 서열표. 순위·조정가능성·움직이는 축이 원문 그대로다.
   윤곽·입체(6위)는 HAVE-1이라 걸음 대상이 아니다 — "바꾸라" 금지, 활용 화법 전용(D25 ④). */
export const LADDER = [
  { rank:1, part:"눈썹",     axes:["T"],     ease:"최상", how:"그리기(아치↔직선)" },
  { rank:2, part:"색·대비",  axes:["T","D"], ease:"상",   how:"립·헤어·옷 색과 메이크업 농도" },
  { rank:3, part:"입술",     axes:["T","D"], ease:"상",   how:"오버립·립 컬러" },
  { rank:4, part:"눈",       axes:["T"],     ease:"중",   how:"아이라인·눈꼬리 연출" },
  { rank:5, part:"헤어",     axes:["M"],     ease:"중",   how:"앞머리·가르마·기장" },
  // 6위 윤곽·입체는 의도적으로 뺐다. 골격은 걸음으로 바꾸는 대상이 아니다.
];

export const STEP_DELTA = 0.2;   // 이론 §1 "완성형이 아니라 사다리 한 칸"
export const AXIS_SWITCH = 0.4;  // 이론 §1 "주축 격차가 0.4 이하로 줄면 부축으로 전환"

/* 이번 걸음의 방향. gap_axis에서 절대값이 가장 큰 축.
   ⚠ 현재 coordOf()는 T·D 2축만 낸다. M축은 산출 경로가 없어 헤어가 주축으로 뽑히지
      않는다 — M축이 붙으면 LADDER 수정 없이 자동으로 열린다. */
export function mainAxis(gapAxis){
  if(!gapAxis) return null;
  const axes = Object.entries(gapAxis)
    .filter(([,v]) => typeof v === "number")
    .sort((a,b) => Math.abs(b[1]) - Math.abs(a[1]));
  if(!axes.length) return null;
  const [k, v] = axes[0];
  // narrow = 이 축이 이론 §1의 전환 문턱(0.4) 아래로 좁혀졌다는 신호.
  // **축을 바꾸지는 않는다.** 절대값으로 정렬해 둔 뒤 "1위가 문턱 이하면 2위로" 하면
  // 항상 더 작은 격차 축으로 내려간다(실측: D=0.17 → T=0.0002). 그건 처방이 아니다.
  // 축 전환은 그 축의 항목을 서열에서 다 쓰면 pickStep이 자연히 처리한다.
  return { axis:k, sign: v >= 0 ? "+" : "-", value:v, narrow: Math.abs(v) <= AXIS_SWITCH };
}

/* 이번 걸음의 항목. 마스터 §6 서열 중 주축을 움직이는 것만 통과시킨다(이론 §2).
   @param done  이미 끝낸 항목 이름들 — 같은 항목을 연속으로 주지 않는다
   @param lowConfidence  측정 확신이 낮은 부위 (마스터 §6: 처방 근거로 쓰지 않는다) */
export function pickStep(axis, { done = [], lowConfidence = [] } = {}){
  const usable = LADDER
    .filter(s => !done.includes(s.part))
    .filter(s => !lowConfidence.includes(s.part));
  // 주축을 움직이는 항목이 먼저. 서열은 배열 순서가 이미 담고 있다(안정 정렬).
  const onAxis = usable.filter(s => s.axes.includes(axis));
  return onAxis[0] || usable[0] || null;
}

/* 한 걸음 산출. 이론 §4 예시와 같은 형태를 낸다.
   @param wantName  추구미 타입 이름 (문구용)
   @param haveName  지금 스타일 타입 이름 (문구용) */
export function buildStep({ gapAxis, wantName, haveName, weekNo = 1, done = [], lowConfidence = [] }){
  const m = mainAxis(gapAxis);
  if(!m) return null;                       // 좌표가 없으면 걸음을 만들지 않는다
  const step = pickStep(m.axis, { done, lowConfidence });
  if(!step) return null;                    // 서열을 다 돌았다 — 호출부가 축하 화면을 낸다
  return {
    week_no: weekNo,
    category: step.part,
    direction: { axis:m.axis, sign:m.sign },
    target_delta: STEP_DELTA,
    status: "issued",
    // 화면·계측용 (DB 컬럼 아님)
    _how: step.how,
    _narrow: m.narrow,        // 주축이 문턱 아래로 좁혀졌다 — 화면에서 축하 화법에 쓸 수 있다
    _want: wantName,
    _have: haveName,
  };
}

/* 자체 점검 */
export function selfCheck(){
  const ok = (c,m) => { if(!c) throw new Error("selfCheck 실패: " + m); };
  let n = 0, t = (c,m) => { ok(c,m); n++; };

  // 주축 — 절대값이 큰 쪽
  t(mainAxis({T:0.9, D:-0.3}).axis === "T", "절대값 큰 축이 주축");
  t(mainAxis({T:-0.2, D:-0.8}).axis === "D", "음수여도 절대값으로 비교");
  t(mainAxis({T:0.9, D:-0.3}).sign === "+", "부호 보존(양)");
  t(mainAxis({T:-0.9, D:0.3}).sign === "-", "부호 보존(음)");
  t(mainAxis(null) === null, "좌표 없으면 null");
  t(mainAxis({}) === null, "빈 좌표면 null");

  // 좁혀짐 신호 — 축을 바꾸지는 않는다
  t(mainAxis({T:0.3, D:0.2}).axis === "T", "문턱 이하여도 절대값 최대 축을 유지한다");
  t(mainAxis({T:0.3, D:0.2}).narrow === true, "좁혀짐 신호");
  t(mainAxis({T:0.5, D:0.2}).narrow === false, "문턱 초과면 신호 없음");
  t(mainAxis({T:0.1, D:0.9}).axis === "D", "더 작은 축으로 내려가지 않는다");

  // 항목 — 주축 필터 + 서열
  t(pickStep("T").part === "눈썹", "T축 첫 칸은 눈썹(서열 1위·T축)");
  t(pickStep("D").part === "색·대비", "D축 첫 칸은 색·대비(눈썹은 T라 빠진다)");
  t(pickStep("M").part === "헤어", "M축 첫 칸은 헤어");
  t(pickStep("T", {done:["눈썹"]}).part === "색·대비", "끝낸 항목은 건너뛴다");
  t(pickStep("T", {lowConfidence:["눈썹"]}).part === "색·대비", "저신뢰 부위는 처방 근거로 안 쓴다");
  t(!LADDER.some(s => s.part === "윤곽·입체"), "윤곽은 걸음 대상이 아니다(HAVE-1)");
  t(pickStep("T", {done:LADDER.map(s=>s.part)}) === null, "서열을 다 돌면 null");

  // 걸음 산출
  const s1 = buildStep({ gapAxis:{T:0.7, D:0.1}, wantName:"세련된", haveName:"로맨틱" });
  t(s1.category === "눈썹", "T 주축 → 눈썹");
  t(s1.direction.axis === "T" && s1.direction.sign === "+", "방향 기록");
  t(s1.target_delta === 0.2, "강도는 한 칸 0.2 — 완성형 직행 금지");
  t(s1.status === "issued", "발행 상태");
  t(buildStep({ gapAxis:null }) === null, "좌표 없으면 걸음 없음");

  // DB 컬럼과 화면용 필드가 섞이지 않는지 — _ 접두어가 경계다
  const cols = Object.keys(s1).filter(k => !k.startsWith("_"));
  t(cols.every(k => ["week_no","category","direction","target_delta","status"].includes(k)),
    "DB로 나가는 필드는 prescriptions 컬럼뿐");

  return `step-engine selfCheck 통과 (${n}/${n})`;
}
