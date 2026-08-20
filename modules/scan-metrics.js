// 스캔 3D 지표 — 다각도 스캔 프레임에서 형태·돌출도를 산출한다.
//
// **scan-analyze.html에서 뽑아낸 공용 모듈이다.** 앱(WebView)과 분석 도구가 같은 코드를
// 쓴다 — 복사해 두 벌이 되면 지표 정의가 조용히 갈라지고, 그건 이론값이 갈라지는 것과 같다.
// 여기 있는 상수·수식은 전부 이론팀 확정분의 인용이며 이 파일에서 창작한 값은 0건이다.

import { D, SUB, NRM, DOT, shapeMetrics, depthAtExpanding, unproject } from "./poc-metrics.js";


const CROSS=(a,b)=>({x:a.y*b.z-a.z*b.y, y:a.z*b.x-a.x*b.z, z:a.x*b.y-a.y*b.x});


/** 미간 상당(9)–코기저 상당(2) — 이론 §3-2-1 예시("미간–코기저 계열")를 그대로 채택한 기준현(chord). 코끝·턱
 *  자체의 돌출을 재는 데 쓴다("그 두 점을 포함하지 않는 내부 현"). */
const GLABELLA_LM=9, NOSEBASE_LM=2;

/** 정중선 단면 턱 최전방점(pogonion 상당) 탐색 후보 — 아랫입술 하단중앙(18)부터 턱끝(152)까지의
 *  정중선 seam. 152 고정 대신 이 집합에서 탐색한다(§3-2-2). 결정론적(같은 입력→같은 결과). */
const CHIN_SECTION_LM=[18,200,199,175,152];

/** 점 P에서 두 점 A,B가 만드는 직선까지의 수직 편차 벡터를 분해한다. mag=부호 없는 거리(항상 ≥0),
 *  signed=n(방향 나침반)의 + 쪽으로 자동 정렬한 부호 있는 값. E-line 편차(이론 §3-2-1 "원형")와 동일한
 *  수식(투영-차감)을 모든 돌출도 후보에 재사용하기 위해 일반화했다. */
function chordDeviation(P, A, B, n){
  const lineDir=NRM(SUB(B,A));
  const v=SUB(P,A);
  const proj=DOT(v,lineDir);
  const perp={x:v.x-proj*lineDir.x, y:v.y-proj*lineDir.y, z:v.z-proj*lineDir.z};
  const mag=Math.hypot(perp.x,perp.y,perp.z);
  const sign=DOT(perp,n)>=0?1:-1;
  return {mag, signed:sign*mag};
}


/** 정중선 단면 돌출도 후보지표 — 이론팀 회신 §3-2 확정 원칙 반영판(2026-08-07). 8타입 판정·카드·
 *  유저 화면에는 절대 사용하지 않는다([가설] 등급, 로깅 전용, §3-2-5).
 *
 *  §3-2-1 기준(외부 기준 금지, 현만): E-line(코끝(1)–턱 최전방점)이 원형이고, 윗입술(13)의 이 현
 *  대비 수직편차를 잰다. 코끝·턱 자체의 돌출·입술 돌출(상/하)은 그 두 점을 포함하지 않는 내부 현
 *  — 미간 상당(9)–코기저 상당(2) — 을 기준으로 잰다(이론 예시 그대로, 마스터 서술이 "입술 돌출" 단일이라
 *  입술 상/하에 별도 현을 새로 만들 근거가 없어 같은 현을 재량으로 공유했다).
 *
 *  부호(요구사항 "유지할 것"): 순수 현-거리(점-대-직선)는 부호가 없다. chin_protrusion처럼 "돌출↔
 *  후퇴" 양방향 서술(§3-1)이 있는 지표엔 부호가 필요해, 기존 구현의 "3점(127·356·10) 평면 법선
 *  자동정렬" 발상을 나침반으로 그대로 유지한다 — 단 이 평면은 이제 "돌출량의 기준(그걸 금지한 게
 *  §3-2-1)"이 아니라 "+/− 방향과 최전방점 탐색 방향을 정하는 내부 나침반" 역할로 한정했다. §3-2-2가
 *  "탐색 방향은 재량, 단 얼굴 내부 기준에서 유도(카메라 축 금지)"라고 명시해 이 용법을 뒷받침한다.
 *  좌표계가 3D스냅샷(원시 카메라축)·3D스캔(얼굴기준축)마다 달라 부호를 하드코딩하지 않는다(기존
 *  자동정렬 유지 — 코끝(1)이 항상 +가 되도록 회전).
 *
 *  §3-2-2 턱 최전방점: 152 고정 대신 CHIN_SECTION_LM에서 나침반(n) 방향으로 가장 앞선 점을 탐색한다
 *  (결정론적). 152 고정값도 *_fixed152 필드로 병기한다.
 *
 *  §3-2-3 정규화: 주값은 ÷faceH(=D(10,152), 기존 23필드 관례 face_HW 분자와 동일 정의)로
 *  무차원화하고 *_mm 필드로 mm 원시값을 병기한다(트루뎁스만 갖는 절대단위 — 버리지 않는다).
 *
 *  비교 병기: 기존 3점 평면(127·356·10) 방식을 *_plane 필드로 남긴다. 정규화 분모를 원 구현의
 *  faceWmm 대신 이 함수와 같은 faceH로 통일해, "기준면 선택(현 vs 평면)"만 분리해서 비교할 수 있게
 *  통제했다(이론이 원할 안정성 판단 재료, §3-2-6).
 *
 *  §3-2-4 인구 규범치 이식 금지·§3-2-5 판정/표시 금지 — 이 함수의 반환값은 로깅 전용이다. */
function protrusionCandidates(pts, faceWmm){
  const need=[1,2,9,10,13,14,127,152,356,...CHIN_SECTION_LM];
  if(need.some(i=>!pts[i]) || !faceWmm) return null;
  const faceHmm=D(pts[10],pts[152]);
  if(!faceHmm) return null;

  // 방향 나침반 — 3점(127·356·10) 평면 법선, 코끝(1)이 +가 되도록 자동정렬(기존 로직 그대로 유지).
  const planeP=pts[127];
  let n=NRM(CROSS(SUB(pts[356],planeP), SUB(pts[10],planeP)));
  if(DOT(SUB(pts[1],planeP), n) < 0) n={x:-n.x,y:-n.y,z:-n.z};

  // 턱 최전방점 탐색(§3-2-2) — 나침반 방향으로 가장 앞선 정중선 후보점. 결정론적.
  let chinApexIdx=CHIN_SECTION_LM[0], chinApexProj=-Infinity;
  for(const i of CHIN_SECTION_LM){
    const proj=DOT(pts[i], n);
    if(proj>chinApexProj){ chinApexProj=proj; chinApexIdx=i; }
  }
  const chinApex=pts[chinApexIdx];

  // 기준현(§3-2-1) — 미간 상당(9)–코기저 상당(2). 코끝·턱·입술 돌출 전부 이 현 기준.
  const chordA=pts[GLABELLA_LM], chordB=pts[NOSEBASE_LM];
  const lipU=chordDeviation(pts[13], chordA, chordB, n);
  const lipL=chordDeviation(pts[14], chordA, chordB, n);
  const chin=chordDeviation(chinApex, chordA, chordB, n);
  const chinFixed=chordDeviation(pts[152], chordA, chordB, n);
  const nose=chordDeviation(pts[1], chordA, chordB, n);

  // E-line(원형, §3-2-1) — 코끝(1)–턱 최전방점(탐색) 현. 윗입술(13) 편차.
  const eLine=chordDeviation(pts[13], pts[1], chinApex, n);
  const eLineFixed152=chordDeviation(pts[13], pts[1], pts[152], n);

  // 비교 병기 — 기존 3점 평면(127·356·10) 방식, 같은 ÷faceH로 통제(원 구현은 ÷faceWmm이었다).
  const distToPlaneH=p=>DOT(SUB(p,planeP), n)/faceHmm;

  const r4=v=>+v.toFixed(4), mm1=v=>+v.toFixed(1);
  return {
    lip_protrusion_upper:r4(lipU.signed/faceHmm), lip_protrusion_upper_mm:mm1(lipU.signed),
    lip_protrusion_lower:r4(lipL.signed/faceHmm), lip_protrusion_lower_mm:mm1(lipL.signed),
    chin_protrusion:r4(chin.signed/faceHmm), chin_protrusion_mm:mm1(chin.signed),
    chin_protrusion_fixed152:r4(chinFixed.signed/faceHmm), chin_protrusion_fixed152_mm:mm1(chinFixed.signed),
    chin_apex_index:chinApexIdx,
    nose_projection:r4(nose.signed/faceHmm), nose_projection_mm:mm1(nose.signed),
    e_line_dev:r4(eLine.signed/faceHmm), e_line_dev_mm:mm1(eLine.signed),
    e_line_dev_fixed152:r4(eLineFixed152.signed/faceHmm), e_line_dev_fixed152_mm:mm1(eLineFixed152.signed),
    lip_protrusion_upper_plane:r4(distToPlaneH(pts[13])),
    lip_protrusion_lower_plane:r4(distToPlaneH(pts[14])),
    chin_protrusion_plane:r4(distToPlaneH(chinApex)),
    chin_protrusion_fixed152_plane:r4(distToPlaneH(pts[152])),
    nose_projection_plane:r4(distToPlaneH(pts[1])),
    faceHmm:mm1(faceHmm)
  };
}

/** 대표 재지시(방법론 수정) — 스캔 세션의 첫 front 프레임 하나에서 2D·3D스냅샷을 동시에 뽑는다.
 *  M1의 강점("2D·3D가 같은 프레임에서 나옴")을 그대로 재현하기 위함 — captures/ 기준선(다른 날 촬영,
 *  C4 정의도 다름)과 섞지 않고 이 세션 자신의 프레임만 쓴다. engine.detect()는 다시 부르지 않고
 *  이미 있는 lm(랜드마크)·depth를 재사용한다. ⚠ toARKitCamAxes 미적용 — 단일 프레임이라 프레임 간
 *  정합이 필요 없고, 강체변환은 같은 프레임 내 거리·각도를 바꾸지 않으므로 축 보정이 결과에 영향 없다. */
function computeFrontSnapshot(USED, LOOP_LM, lm, W, H, depth, dW, dH, K){
  const p2=lm.map(p=>({x:p.x*W,y:p.y*H,z:0}));
  const fw2=Math.hypot(p2[454].x-p2[234].x, p2[454].y-p2[234].y);
  const p3=[]; let miss=0;
  for(const i of LOOP_LM){
    const hit=depthAtExpanding(depth,dW,dH,lm[i].x*W,lm[i].y*H,W,H);
    if(!hit){ if(USED.includes(i)) miss++; continue; }
    p3[i]=unproject(lm[i].x*W,lm[i].y*H,hit.z,K,W,H);
  }
  const rec={m2d:shapeMetrics(p2,fw2,"2d")};
  if(!miss){
    const fw3=D(p3[234],p3[454]);
    rec.m3dSnap=shapeMetrics(p3, fw3, "3d");
    // 이론 §3-2-6 산출 안정성 평가용 — 이 세션 자신의 3D스냅샷에서도 돌출도 후보를 뽑아 s.protrusionScan
    // (융합 3D스캔)과 세션 단위로 짝지어 비교할 수 있게 한다(기존 m3dSnap/m3dScan 짝짓기와 동일 패턴).
    rec.protrusionSnap=protrusionCandidates(p3, fw3);
  }
  return rec;
}

export { protrusionCandidates, computeFrontSnapshot, chordDeviation, CROSS, CHIN_SECTION_LM };
