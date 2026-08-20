const D=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y,(p.z||0)-(q.z||0));
const SUB=(p,q)=>({x:p.x-q.x,y:p.y-q.y,z:(p.z||0)-(q.z||0)});
const NRM=v=>{const n=Math.hypot(v.x,v.y,v.z)||1e-9;return{x:v.x/n,y:v.y/n,z:v.z/n};};
const DOT=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
/** 세 점이 이루는 각(도). 2D·3D 모두 동일 정의(내적) */
const ANG=(a,b,c)=>{const u=NRM(SUB(a,b)),v=NRM(SUB(c,b));return Math.acos(Math.max(-1,Math.min(1,DOT(u,v))))*180/Math.PI;};

const JAW_CHAIN=[172,136,150,149,176,148,152,377,400,378,379,365,397];

function shapeMetrics(pts,scale,mode){
  const P=i=>pts[i];
  const m={};
  // 턱선 각도 — 체인 인접 3점 각의 평균(180°에서 뺀 값 = 꺾임 정도)
  let s=0,c=0;
  for(let i=1;i<JAW_CHAIN.length-1;i++){ s+=180-ANG(P(JAW_CHAIN[i-1]),P(JAW_CHAIN[i]),P(JAW_CHAIN[i+1])); c++; }
  m.jaw_angular_deg=+(s/c).toFixed(2);
  // 턱끝 각도 — 좌턱(172)·턱끝(152)·우턱(397)
  m.chin_angle_deg=+ANG(P(172),P(152),P(397)).toFixed(2);
  // 눈썹 아치 — 눈썹 안쪽(107)·정점(105)·바깥(46)
  m.brow_arch_deg=+(180-ANG(P(107),P(105),P(46))).toFixed(2);
  // 비율류 — 전부 scale로 정규화
  m.face_HW=+(D(P(10),P(152))/D(P(234),P(454))).toFixed(4);
  m.mouth_w=+(D(P(61),P(291))/scale).toFixed(4);
  m.nose_w=+(D(P(129),P(358))/scale).toFixed(4);
  m.jaw_w=+(D(P(172),P(397))/scale).toFixed(4);
  m.temple_w=+(D(P(127),P(356))/scale).toFixed(4);
  m.interocular=+(D(P(133),P(362))/scale).toFixed(4);
  m.eye_len=+((D(P(33),P(133))+D(P(263),P(362)))/2/scale).toFixed(4);
  m.eye_open=+((D(P(159),P(145))+D(P(386),P(374)))/2/scale).toFixed(4);
  m.brow_eye_gap=+((D(P(105),P(159))+D(P(334),P(386)))/2/scale).toFixed(4);
  m.lip_upper=+(D(P(0),P(13))/scale).toFixed(4);
  m.lip_lower=+(D(P(14),P(17))/scale).toFixed(4);
  m.lip_ul_ratio=+(m.lip_lower/(m.lip_upper||1e-9)).toFixed(3);
  // 방향성 지표 — 세로 성분 부호 유지(위가 y 작음 → 상향이 양수가 되도록 부호 반전)
  m.eye_angle=+(-((P(33).y-P(133).y)+(P(263).y-P(362).y))/2/scale*100).toFixed(3);
  m.mouth_corner=+(-((P(61).y-P(13).y)+(P(291).y-P(13).y))/2/scale*100).toFixed(3);
  // 파생축 — line_score (photo-module과 동일 가중)
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  m.line_score=+clamp(clamp((m.jaw_angular_deg-7)/12,0,1)*0.45
                     +clamp((m.chin_angle_deg-115)/50,0,1)*0.25
                     +clamp((25-m.brow_arch_deg)/20,0,1)*0.30,0,1).toFixed(4);
  m._mode=mode;
  return m;
}

// ── 깊이 조회 & 역투영 ───────────────────────────────────────────────
/** (px,py)=RGB 픽셀 좌표 → 깊이맵 좌표로 스케일 후, (2·radius+1)²창의 중앙값으로 잡음 억제. 유효 없으면 null */
function depthAt(depth, dW, dH, px, py, rgbW, rgbH, radius=1){
  const dx=Math.round(px*dW/rgbW), dy=Math.round(py*dH/rgbH);
  const vals=[];
  for(let j=-radius;j<=radius;j++) for(let i=-radius;i<=radius;i++){
    const x=dx+i, y=dy+j;
    if(x<0||y<0||x>=dW||y>=dH) continue;
    const v=depth[y*dW+x];
    if(v>0.05 && v<2.0) vals.push(v);
  }
  if(!vals.length) return null;
  vals.sort((a,b)=>a-b);
  return vals[vals.length>>1];
}

/** 3×3(radius=1)→7×7(radius=3)→11×11(radius=5) 순으로 탐색 범위를 넓혀 유효 깊이를 찾는다.
 *  깊이 구멍은 보통 작으므로 공간적으로 더 넓게 찾는 것이 물리적으로 타당한 보완이다.
 *  좌표를 지어내지 않는다 — 못 찾으면(11×11까지도 무효) null. 찾으면 어느 반경에서 찾았는지 함께 반환. */
function depthAtExpanding(depth, dW, dH, px, py, rgbW, rgbH){
  for(const radius of [1,3,5]){
    const z=depthAt(depth,dW,dH,px,py,rgbW,rgbH,radius);
    if(z!=null) return {z, radius};
  }
  return null;
}

/** shapeMetrics가 실제로 참조하는 468점 랜드마크 인덱스 집합을 코드에서 직접 수집한다.
 *  JAW_CHAIN은 변수 참조(P(JAW_CHAIN[i]))라 정규식으로 못 잡으므로 별도 병합.
 *  shapeMetrics 자체는 수정하지 않고 소스만 읽는다. */
function usedLandmarkIndices(){
  const src=shapeMetrics.toString();
  const literals=[...src.matchAll(/P\((\d+)\)/g)].map(m=>+m[1]);
  return [...new Set([...JAW_CHAIN, ...literals])];
}

/** 픽셀+깊이 → 카메라 좌표(mm). intrinsics는 원본(가로) 기준이라 세로 정립에 맞춰 축 교환.
 *  [리뷰 반영: Critical] 예전에는 "입력 픽셀만" 가로계로 되돌리고 "출력 좌표축은 가로 그대로" 내보냈다.
 *  거리·각도 지표는 회전 불변이라 멀쩡했지만, .y 성분을 직접 쓰는 eye_angle·mouth_corner 두 지표만
 *  2D와 직교하는 축을 재게 되어(좌우 눈 부호가 상쇄 → 3D 값이 0 근처 노이즈 → 비율 폭주)
 *  18지표 중 2개가 3D에 구조적으로 불리하게 고정됐다. 이제 출력을 세로(portrait) 축으로 되돌린다.
 *
 *  도출: 세로 픽셀 (px,py) ↔ 가로 (ox,oy) = (py, rgbW-1-px)
 *   - 세로에서 오른쪽 → px 증가 → oy 감소 → Y_land 감소  ⇒ 세로 x = -Y_land
 *   - 세로에서 아래로 → py 증가 → ox 증가 → X_land 증가  ⇒ 세로 y = +X_land
 *  결과적으로 2D 픽셀 좌표와 같은 방향 규약(오른쪽=x 증가, 아래=y 증가)을 갖는다. */
function unproject(px, py, z, K, rgbW, rgbH){
  // K = [fx,0,0, 0,fy,0, cx,cy,1] (column-major 9개). 세로 회전(.right) 보정:
  const fx=K[0], fy=K[4], cx=K[6], cy=K[7];
  // 원본 가로영상 좌표계로 되돌림: 세로(px,py) → 가로(px', py') = (py, rgbW-1-px)
  const ox=py, oy=rgbW-1-px;
  const Xland=(ox-cx)*z/fx*1000, Yland=(oy-cy)*z/fy*1000;
  return { x:-Yland, y:Xland, z:z*1000 };
}

export { D, SUB, NRM, DOT, ANG, JAW_CHAIN, shapeMetrics, depthAt, depthAtExpanding, usedLandmarkIndices, unproject };
