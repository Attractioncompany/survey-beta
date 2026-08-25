/* 색분석 모듈 (M-02) — 픽셀에서 색·명도·대비를 읽는다.
 * 근거: docs/구조도_인덱스_v1.md · docs/모듈구조_v1_2026-08-17.md
 *
 * 성격: **순수 함수가 아니다.** 캔버스 픽셀을 봐야 하므로 ctx가 필요하다.
 *       그래서 구조분석(M-03)과 달리 사진 없이는 시험할 수 없다 — Sample 대조가 유일한 검증이다.
 *
 * ⚠ photo-module.html에서 **한 글자도 안 바꾸고** 옮겼다. 임계·상수는 전부 원본 그대로다.
 *   (WHITE_REF 93 · L_CLAMP 25 · L_REF_MIN 88 · CLIP_A 0.15 · muteness 37/12 · irisOK 0.22/15 …)
 *   숫자가 바뀌면 이관이 아니라 사고다. 이관 직후 Sample 3장 × 45필드로 대조 확인했다.
 *
 * DYED(염색모)는 원본이 DOM을 직접 읽었는데, 그건 화면의 몫이라 인자로 받는다.
 */
(function (root) {
  "use strict";
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const dist=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y);
  const P=(lm,i,W,H)=>({x:lm[i].x*W, y:lm[i].y*H});

function rgb2lab(r,g,b){
  let [R,G,B]=[r,g,b].map(v=>{v/=255; return v>0.04045?Math.pow((v+0.055)/1.055,2.4):v/12.92;});
  let X=(R*0.4124+G*0.3576+B*0.1805)/0.95047, Y=R*0.2126+G*0.7152+B*0.0722, Z=(R*0.0193+G*0.1192+B*0.9505)/1.08883;
  const fx=t=>t>0.008856?Math.cbrt(t):(7.787*t+16/116);
  const fX=fx(X),fY=fx(Y),fZ=fx(Z);
  return {L:116*fY-16, a:500*(fX-fY), b:200*(fY-fZ)};
}
function sampleLab(ctx,x,y,r=4){
  const d=ctx.getImageData(Math.max(0,x-r),Math.max(0,y-r),r*2,r*2).data;
  let R=0,G=0,B=0,n=0;
  for(let i=0;i<d.length;i+=4){R+=d[i];G+=d[i+1];B+=d[i+2];n++;}
  return rgb2lab(R/n,G/n,B/n);
}
function sampleRegionLab(ctx,cx,cy,r){ // 원형 영역 전체 픽셀 → 중앙값 Lab (이상치 강건)
  const R=Math.max(4,Math.round(r)), w=R*2;
  const x0=Math.max(0,Math.round(cx)-R), y0=Math.max(0,Math.round(cy)-R);
  const d=ctx.getImageData(x0,y0,w,w).data;
  const Ls=[],As=[],Bs=[];
  let clipped=0;
  for(let yy=0;yy<w;yy++)for(let xx=0;xx<w;xx++){
    if((xx-R)*(xx-R)+(yy-R)*(yy-R)>R*R) continue;
    const i=(yy*w+xx)*4;
    if(d[i]===undefined) continue;
    if(Math.max(d[i],d[i+1],d[i+2])>=250) clipped++;   // 흰색이 날아간(포화된) 픽셀
    const lab=rgb2lab(d[i],d[i+1],d[i+2]);
    if(!isFinite(lab.L)) continue;
    Ls.push(lab.L);As.push(lab.a);Bs.push(lab.b);
  }
  if(!Ls.length) return {L:NaN,a:NaN,b:NaN,n:0,clip:1};
  const med=arr=>{arr.sort((a,b)=>a-b);return arr[Math.floor(arr.length/2)];};
  return {L:med(Ls),a:med(As),b:med(Bs),n:Ls.length,clip:clipped/Ls.length};
}
// 눈썹 L — 한 점(105)만 찍으면 눈썹을 빗나가 피부를 집는다.
// 실측(Sample 11장, 2026-07-20): 눈썹 L이 71.1 / 69.0 / 60.6 로 피부와 구분이 안 되던 3장이
// 능선 다중 샘플링 후 30.0 / 31.7 / 52.7 로 교정됨. 눈썹은 피부보다 어두우므로 어두운 쪽을 취한다.
function sampleBrowDark(ctx,lm,W,H,ids){
  const vals=ids.map(i=>{const p=P(lm,i,W,H); return sampleLab(ctx,p.x,p.y,2).L;}).filter(isFinite);
  if(!vals.length) return NaN;
  vals.sort((a,b)=>a-b);
  const k=Math.max(1,Math.round(vals.length*0.4));
  return vals.slice(0,k).reduce((x,y)=>x+y,0)/k;
}
/** 방향성 선 에너지 — ROI 안에서 **가로 방향 구조**와 **세로 방향 구조**의 양을 견준다.
 *  비율이라 노출·게인·화이트밸런스에 무관하다(분자·분모가 같이 밀린다).
 *  ROI를 getImageData로 **한 번만** 읽는다 — sampleLab을 픽셀마다 부르면 수백 번 왕복한다. */
function lineEnergyRatio(ctx, x0, y0, w, h, d, W, H){
  x0=Math.round(x0); y0=Math.round(y0); w=Math.round(w); h=Math.round(h);
  if(w<2 || h<2) return null;
  if(x0-d<0 || y0-d<0 || x0+w+d>W || y0+h+d>H) return null;   // ROI가 이미지 밖 → null. 잘라 쓰지 않는다
  const Wr=w+2*d, Hr=h+2*d;
  const px=ctx.getImageData(x0-d, y0-d, Wr, Hr).data;
  const L=new Float32Array(Wr*Hr);
  for(let i=0,j=0;i<L.length;i++,j+=4) L[i]=rgb2lab(px[j],px[j+1],px[j+2]).L;
  let gy=0, gx=0, n=0;
  for(let yy=d; yy<Hr-d; yy++) for(let xx=d; xx<Wr-d; xx++){
    gy+=Math.abs(L[(yy+d)*Wr+xx]-L[(yy-d)*Wr+xx]);
    gx+=Math.abs(L[yy*Wr+xx+d]-L[yy*Wr+xx-d]);
    n++;
  }
  if(!n) return null;
  gy/=n; gx/=n;
  return {gy:+gy.toFixed(3), gx:+gx.toFixed(3), ratio:gy/Math.max(gx,1e-6)};
}

/** 쌍꺼풀 라인(B3) — 이론 측정확충 v1 §2-B3. 마스터 배제신호 2순위인데 지금 입력이 **설문 자가응답**이고
 *  (index.html B1 "내 쌍꺼풀과 가장 비슷한 건?"), 사내 확정 원칙이 자가응답 지양이다.
 *  쌍꺼풀 주름은 윗눈꺼풀 위의 **가로 방향 선**이다 — 모공(등방성 고주파)과 달리 방향이 있다.
 *  gy/gx > 1 = 가로 구조가 있다 = 뜬 눈에서 라인이 보인다.
 *
 *  ⚠ 정직한 한계: 이건 *쌍꺼풀 유형*이 아니라 **"눈을 떴을 때 라인이 보이는가"** 다.
 *    뜬 눈에서 속쌍과 무쌍은 둘 다 "안 보임"으로 나온다. 그 둘을 가르려면 눈 감은 프레임이 필요하다. */
function lidCrease(ctx, lm, W, H, faceW, eyeOpen0){
  const NUL={lid_crease:null, lid_crease_lr:null, lid_crease_gy:null, lid_crease_gx:null};
  if(!(eyeOpen0>0.22)) return NUL;                       // 기존 게이트 재사용 — 눈이 덜 뜨이면 ROI가 눈을 문다
  const d=Math.max(2, Math.round(faceW*0.006));          // ≈0.8mm. 해상도가 달라도 얼굴 위 물리 크기가 고정된다
  const one=(outer,inner,upper)=>{
    const O=P(lm,outer,W,H), I=P(lm,inner,W,H), U=P(lm,upper,W,H);
    const x0=Math.min(O.x,I.x), x1=Math.max(O.x,I.x);
    // 윗눈꺼풀 가장자리(159/386) 바로 위 띠. 눈썹 아래(52)까지 올라가지 않는다.
    return lineEnergyRatio(ctx, x0, U.y-faceW*0.055, x1-x0, faceW*0.047, d, W, H);
  };
  const l=one(33,133,159), r=one(263,362,386);
  const vals=[l,r].filter(v=>v && isFinite(v.ratio));
  if(!vals.length) return NUL;
  const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
  return {
    lid_crease:+avg(vals.map(v=>v.ratio)).toFixed(3),
    lid_crease_lr:(l&&r)?+Math.abs(l.ratio-r.ratio).toFixed(3):null,
    lid_crease_gy:+avg(vals.map(v=>v.gy)).toFixed(2),    // 분자·분모 병기 — 비율이 튀었을 때 어느 쪽인지 본다
    lid_crease_gx:+avg(vals.map(v=>v.gx)).toFixed(2)
  };
}

function detectHairline(ctx, lm, W, H, faceW, brow, cheek){
  // v3 (대표 실기기 3장 검증 2026-07-22: 2성공 1실패 — 실패=이마 번들거림 최강 사진):
  //   v2는 기준색이 이마 샘플 단독이라, 이마가 하이라이트로 오염되면 기준이 비정상적으로 밝아져
  //   그 위의 정상 피부를 '어둡다=모발'로 오판했다. v3 —
  //   ① 기준 명도를 볼(번들거림 없는 부위)로 안정화: seed L = min(이마, 볼+6)
  //   ② 적응형 추적: 피부로 판정된 픽셀은 기준을 그쪽으로 따라가게(EMA) —
  //      번들거림→정상 피부의 '점진적' 어두워짐은 피부로 추적되고, 모발의 '급격+지속' 하락만 경계
  //   ③ 밝아지는 픽셀(반사·흰 배경)은 여전히 피부 취급 (v2 유지)
  const top10 = P(lm,10,W,H);
  const xs = [top10.x - faceW*0.10, top10.x, top10.x + faceW*0.10];
  const maxRise = faceW*0.7;
  const ys=[];
  for(const x of xs){
    // v3.2: 기준은 '고정' — L만 볼로 바닥 고정(하이라이트 오염 차단), 색조는 이마 자체.
    // 적응형 추적(EMA)은 기각: 잔머리의 점진적 어두워짐을 기준이 따라 내려가 경계를 통과함(가을딥 dev 로그 hairline_detected:false로 확인)
    const refL = Math.min(brow.L, cheek.L + 6);
    const refA = brow.a, refB = brow.b;
    let boundary=null, run=0;
    for(let dy=2; dy<maxRise; dy+=2){
      const y = top10.y - dy;
      if(y<2) break;
      const px = sampleLab(ctx, x, y, 2);
      const darker = px.L < refL - 16;
      const chromaShift = (Math.abs(px.a-refA) > 12 || Math.abs(px.b-refB) > 14) && px.L <= refL + 6;
      if(darker || chromaShift){ run++; if(run>=3){ boundary = y + 6; break; } }
      else run=0;
    }
    if(boundary!==null && boundary < top10.y - 4) ys.push(boundary);
  }
  if(ys.length<2) return {y: top10.y, detected:false};
  ys.sort((a,b)=>a-b);
  return {y: ys[Math.floor(ys.length/2)], detected:true};
}


  /**
   * @param c {ctx, lm, W, H, faceW, eyeL, eyeLi, eyeR, eyeRi, dyed}
   * @returns 색·명도·대비 측정값 일체 + hairTop(구조분석이 쓴다) + 조명 보정 상태
   */
  function measureColor(c){
    const {ctx, lm, W, H, faceW, eyeL, eyeLi, eyeR, eyeRi} = c;
    const DYED = !!c.dyed;
  // ---------- 샘플링 ----------
  const rr=Math.max(8, faceW*0.07);
  const cheekL=sampleRegionLab(ctx, P(lm,118,W,H).x, P(lm,118,W,H).y, rr);
  const cheekR=sampleRegionLab(ctx, P(lm,347,W,H).x, P(lm,347,W,H).y, rr);
  const brow  =sampleRegionLab(ctx, P(lm,9,W,H).x,   P(lm,9,W,H).y - faceW*0.10, rr*0.8); // 미간 위 이마
  const skin={L:(cheekL.L+cheekR.L+brow.L)/3, a:(cheekL.a+cheekR.a+brow.a)/3, b:(cheekL.b+cheekR.b+brow.b)/3};
  // 공막(눈 흰자) — 홍채 중심과 내안각 사이
  const irisL=P(lm,468,W,H), irisR=P(lm,473,W,H);
  const scL=sampleLab(ctx,(irisL.x+eyeLi.x)/2,(irisL.y+eyeLi.y)/2,2);
  const scR=sampleLab(ctx,(irisR.x+eyeRi.x)/2,(irisR.y+eyeRi.y)/2,2);
  const sclera={L:(scL.L+scR.L)/2, a:(scL.a+scR.a)/2, b:(scL.b+scR.b)/2};  // a*는 조명지표 로깅용 보존(scleraOK 판정은 L·b만 사용, 불변)
  const browDark=sampleBrowDark(ctx,lm,W,H,[70,63,105,66,107,300,293,334,296,336]);
  const browCol={L: isFinite(browDark)? browDark : sampleLab(ctx, P(lm,105,W,H).x, P(lm,105,W,H).y,3).L};
  const lipCol =sampleLab(ctx, (P(lm,13,W,H).x+P(lm,14,W,H).x)/2, (P(lm,13,W,H).y+P(lm,14,W,H).y)/2,3);
  const hairPts=[[P(lm,10,W,H).x, Math.max(6,P(lm,10,W,H).y-faceW*0.18)],[P(lm,10,W,H).x-faceW*0.28, Math.max(6,P(lm,10,W,H).y-faceW*0.08)],[P(lm,10,W,H).x+faceW*0.28, Math.max(6,P(lm,10,W,H).y-faceW*0.08)]];
  const hairCol=hairPts.map(([hx,hy])=>sampleLab(ctx,hx,hy,6)).sort((p,q)=>p.L-q.L)[0]; // 최암값
  const irisCol={L:(sampleLab(ctx,irisL.x,irisL.y,3).L + sampleLab(ctx,irisR.x,irisR.y,3).L)/2};

  // ---------- 조명 레퍼런스 선택 (공막 → 밝은 무채색 배경 폴백) ----------
  let ref={a:0,b:0}, refType="none";
  const bgR=Math.max(10,W*0.04);
  const bgCands=[sampleRegionLab(ctx,W*0.08,H*0.08,bgR), sampleRegionLab(ctx,W*0.92,H*0.08,bgR), sampleRegionLab(ctx,W*0.5,H*0.05,bgR)];
  // 흰 배경이 날아가면(포화) 그 배경은 노출·색 레퍼런스로 못 씁니다.
  // 아무리 밝게 찍어도 L이 100에서 멈추고 a·b는 0에 붙어버려서, 보정이 "충분히 됐다"고 착각하게 만듭니다.
  // 요청서가 지적한 '스튜디오 밝은 조명 검증셋 8명 고대비 편향'이 바로 이 구간입니다.
  const bgBright=bgCands.filter(s=>s.L>70 && Math.hypot(s.a,s.b)<8);
  const bgOK=bgBright.filter(s=>s.clip<0.25 && s.L<97);
  const bgBlown = bgBright.length>0 && bgOK.length===0;   // 밝은 배경은 있는데 전부 날아간 상태
  const bgPick=bgOK.sort((p,q)=>q.L-p.L)[0];
  const scleraOK = sclera.L > Math.max(62, skin.L+6) && Math.abs(sclera.b) < 12;
  if(bgPick){ ref={a:bgPick.a,b:bgPick.b}; refType="background"; }
  else if(scleraOK){ ref={a:0,b:sclera.b}; refType="sclera"; }
  const refWarn = refType==="none";

  // ---------- 명도(L*) 노출 정규화 — REQUEST_dev_L_normalize ----------
  // 요청서는 가산 보정(L+shift)을 지정했지만, 같은 shift를 피부와 다크앵커 양쪽에 더하면
  // 대비(=두 L의 차)에서 상쇄돼 아무 효과가 없습니다. 요청서가 노린 "밝은 사진일수록 갭만 확대"는
  // 다크앵커가 0 부근 바닥이라 노출에 덜 밀리기 때문이므로, 0을 고정하는 곱(게인) 보정이 맞습니다.
  //   재현: 피부65/동공18(정상) vs 피부73.6/동공20(밝음) → 가산 밴드 0.32↔0.62(불변) / 게인 0.27↔0.30(수렴)
  // 개발팀 판단으로 게인 방식 채택 — 이론팀 사후 확정 요청 (기록: theory/DEV_NOTES_오류대장.md)
  const WHITE_REF = 93;              // 흰 벽·종이 기준 L* — 캘리브레이션 상수 (요청서 초기값)
  const L_CLAMP = 25;                // 배경 L 허용 범위 WHITE_REF±25 (요청서 §2의 클램프를 게인으로 옮긴 것)
  // 밝기 보정은 "배경이 실제로 흰색일 때"만 유효합니다.
  // 회색 벽(L≈80)과 어둡게 찍힌 흰 벽(L≈80)은 픽셀만 봐선 구분되지 않습니다.
  // 구분 못 하는 채로 게인을 걸면 회색 배경 사진의 피부를 통째로 밀어올려 명도가 포화됩니다.
  //   실측(Sample 11장, 2026-07-20): 게인 적용 1/11 → 미적용 3/11 로 오히려 악화 (오류대장 007)
  // 반면 색(a·b) 보정은 회색 배경도 무채색이면 유효하므로 기존 임계(L>70)를 그대로 씁니다.
  const L_REF_MIN = 88;              // 밝기 보정을 허용할 최소 배경 L — 잠정값, 이론팀 확정 대기
  let L_gain = 1, L_shift = 0, L_corrected = false;
  if(refType==="background" && bgPick.L >= L_REF_MIN){
    L_gain = WHITE_REF / clamp(bgPick.L, WHITE_REF-L_CLAMP, WHITE_REF+L_CLAMP);
    L_shift = WHITE_REF - bgPick.L;  // 참고용 기록 (요청서 명시 필드)
    L_corrected = true;
  }
  const Lc = v => v*L_gain;          // 피부·동공·헤어·눈썹에 동일 적용
  const bgDim = refType==="background" && !L_corrected;   // 배경은 있는데 흰 벽 기준(88)보다 어둡게 찍힘

  const _oL=dist(P(lm,159,W,H),P(lm,145,W,H))/dist(eyeL,eyeLi), _oR=dist(P(lm,386,W,H),P(lm,374,W,H))/dist(eyeRi,eyeR);
  const eyeOpen0=(_oL+_oR)/2;
  // 이마 샘플 오염 검사 (머리카락 가림): 볼 평균과 크게 다르면 제외
  const cheekAvg={L:(cheekL.L+cheekR.L)/2, a:(cheekL.a+cheekR.a)/2, b:(cheekL.b+cheekR.b)/2};
  const browDelta=Math.hypot(brow.L-cheekAvg.L, brow.a-cheekAvg.a, brow.b-cheekAvg.b);
  const skinPts = browDelta>18 ? [cheekL,cheekR] : [cheekL,cheekR,brow];
  const skin2 = {L:skinPts.reduce((s,p)=>s+p.L,0)/skinPts.length, a:skinPts.reduce((s,p)=>s+p.a,0)/skinPts.length, b:skinPts.reduce((s,p)=>s+p.b,0)/skinPts.length};

  // ---------- [색상] L/a/b 기반 ----------
  const a_corr = skin2.a - ref.a;
  const b_corr = skin2.b - ref.b;
  const hue = Math.atan2(b_corr, a_corr)*180/Math.PI;    // 색상각: 낮을수록 붉은기 비중↑=쿨
  const chroma = Math.hypot(a_corr, b_corr);             // 채도
  const muteness = clamp((37-chroma)/12, 0, 1);          // 탁기 — cal#3: 영역샘플링 기준 재앵커(c30=0.58 여름뮤트 정합)
  // 명도·대비는 노출 정규화된 L로 계산합니다 (색상 a*/b*는 기존 배경 보정 그대로)
  const skinL = Lc(skin2.L), hairL = Lc(hairCol.L), browL = Lc(browCol.L), irisLm = Lc(irisCol.L);
  // 방안5 (이론 지시 2026-07-23): 하이라이트 클리핑 게이트 — 포화 피부샘플을 A(명도)에서만 제외.
  //   conH(대비)·판정 경로의 skinL은 불변(가중 미변경). A만 정직화 → skinL_A는 N.bright 전용.
  const CLIP_A = 0.15;   // 피부샘플 포화 비율 임계 (잠정 — 하니스 로그로 조정)
  const _skinPtsA = skinPts.filter(p => (p.clip||0) < CLIP_A);
  const skinL_A = Lc(_skinPtsA.length ? _skinPtsA.reduce((s,p)=>s+p.L,0)/_skinPtsA.length : skin2.L);
  const skinClipMax = Math.max(cheekL.clip||0, cheekR.clip||0, brow.clip||0);
  const ita = Math.atan2(skinL-50, b_corr)*180/Math.PI; // ITA 피부톤 각도(밝기 계열)
  // 대비 (전문 판정 표준: 모발·눈썹·눈동자 vs 피부)
  const c_hair = Math.abs(skinL - hairL);
  const c_brow = Math.abs(skinL - browL);
  const c_iris = Math.abs(skinL - irisLm);
  // 동공 우선: 염색 불가능한 유일 기준. 측정 원활 조건 = 눈 충분히 열림 + 홍채가 피부보다 확실히 어두움
  // DYED는 화면이 읽어 인자로 넘긴다 (원본은 여기서 DOM을 직접 봤다)
  const irisOK = eyeOpen0 > 0.22 && irisLm < skinL - 15;
  // cal#7: 대비 = 피부톤과 다크 앵커의 갭. 실대비 = 동공↔피부(염색 불가 기준). 염색모는 헤어를 진단에서 제외
  let contrast, cbasis;
  if(irisOK){ contrast = c_iris; cbasis = "iris_primary"; }
  else if(!DYED){ contrast = c_hair*0.6 + c_brow*0.4; cbasis = "hair_fallback"; }
  else { contrast = c_iris; cbasis = "iris_lowconf"; }   // 염색모+동공불량: 임시 측정 + 재촬영 요청

  // ---------- [비율] 3분할·부위 비율 ----------
  // 상안부 꼭대기 = 검출된 헤어라인 (10번은 이마 중간 — 대표 지적 2026-07-22, engine v2.1)
  // 게이트는 '어두운 오염'(앞머리 가림)일 때만 — 밝은 차이(번들거림)는 v3가 볼 기준으로 처리하므로 검출 진행
  const hairTop = (browDelta>18 && brow.L < cheekAvg.L - 12) ? {y:P(lm,10,W,H).y, detected:false}
                : detectHairline(ctx, lm, W, H, faceW, brow, cheekAvg);
  // 쌍꺼풀 라인(B3) — eyeOpen0가 나온 뒤라야 게이트를 걸 수 있어 여기서 부른다.
  const lid = lidCrease(ctx, lm, W, H, faceW, eyeOpen0);

    return { ...lid,
             cheekL, cheekR, brow, skin, sclera, browCol, lipCol, hairCol, irisCol, irisL, irisR,
             ref, refType, refWarn, bgPick, bgBlown, bgDim, scleraOK,
             L_gain, L_shift, L_corrected, Lc,
             eyeOpen0, cheekAvg, browDelta, skinPts, skin2,
             a_corr, b_corr, hue, chroma, muteness,
             skinL, hairL, browL, irisLm, skinL_A, skinClipMax, ita,
             c_hair, c_brow, c_iris, DYED, irisOK, contrast, cbasis, hairTop };
  }

  root.CZM = root.CZM || {};
  root.CZM.measureColor = measureColor;
  // 측정 원시 도구도 함께 내보낸다 — batch-verify(P-6)가 복사본을 들지 않게 하려는 것이 목적이다.
  root.CZM.rgb2lab = rgb2lab;
  root.CZM.sampleLab = sampleLab;
  root.CZM.sampleRegionLab = sampleRegionLab;
  root.CZM.sampleBrowDark = sampleBrowDark;
  root.CZM.detectHairline = detectHairline;
  root.CZM.lineEnergyRatio = lineEnergyRatio;
  root.CZM.lidCrease = lidCrease;
})(typeof window !== "undefined" ? window : globalThis);
