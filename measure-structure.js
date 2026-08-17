/* 구조분석 모듈 — 얼굴 랜드마크에서 비율·라인 지표를 낸다.
 * 근거: docs/모듈구조_v1_2026-08-17.md §4-2 (대표 확정 2026-08-17 "모듈단위로 만들고 조립")
 *
 * 이 모듈의 성격
 *   · **순수 함수다.** 캔버스·픽셀·조명을 보지 않는다. 같은 랜드마크가 들어오면 항상 같은 값이 나온다.
 *   · 그래서 사진 없이도 시험할 수 있고, batch-verify가 복사본을 들고 있을 이유가 없어진다.
 *   · 색 측정(피부·헤어·배경)은 여기 들어오지 않는다 — 그건 색분석 모듈의 몫이다.
 *
 * ⚠ 값·임계는 photo-module에 있던 것을 **그대로 옮겼다.** 한 글자도 바꾸지 않았다.
 *   숫자가 바뀌면 그건 이관 사고다. 이관 직후 Sample 3장으로 29필드를 대조해 확인했다.
 */
(function (root) {
  "use strict";

  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var dist = function (p, q) { return Math.hypot(p.x - q.x, p.y - q.y); };

  // 다항 적합 잔차 — 턱선 곡률 로깅 전용(판정 미사용).
  // ⚠ photo-module의 원본을 **한 글자도 안 바꾸고** 옮겼다. 부동소수 결과가 소수 5자리까지
  //   저장되므로, 수학적으로 같더라도 연산 순서가 다르면 마지막 자리가 흔들린다.
  function _gaussSolve(A,b){ const n=A.length,M=A.map((r,i)=>[...r,b[i]]);
    for(let c=0;c<n;c++){ let p=c; for(let r=c+1;r<n;r++) if(Math.abs(M[r][c])>Math.abs(M[p][c])) p=r;
      if(Math.abs(M[p][c])<1e-12) return null; [M[c],M[p]]=[M[p],M[c]];
      const piv=M[c][c]; for(let k=c;k<=n;k++) M[c][k]/=piv;
      for(let r=0;r<n;r++){ if(r===c) continue; const f=M[r][c]; for(let k=c;k<=n;k++) M[r][k]-=f*M[c][k]; } }
    return M.map(r=>r[n]); }
  function polyfitMSE(xs,ys,deg){ const n=xs.length,m=deg+1; if(n<m) return {mse:null,coef:null};
    const ATA=Array.from({length:m},()=>new Array(m).fill(0)), ATy=new Array(m).fill(0);
    for(let i=0;i<n;i++){ const pw=[]; let p=1; for(let j=0;j<m;j++){ pw.push(p); p*=xs[i]; }
      for(let r=0;r<m;r++){ for(let c=0;c<m;c++) ATA[r][c]+=pw[r]*pw[c]; ATy[r]+=pw[r]*ys[i]; } }
    const coef=_gaussSolve(ATA,ATy); if(!coef) return {mse:null,coef:null};
    let se=0; for(let i=0;i<n;i++){ let f=0,p=1; for(let j=0;j<m;j++){ f+=coef[j]*p; p*=xs[i]; } se+=(ys[i]-f)**2; }
    return {mse:se/n, coef}; }

  /**
   * @param ctx {lm, W, H, faceW, hairTopY, eyeOpen0, eyeL, eyeLi, eyeR, eyeRi}
   *   hairTopY  헤어라인 y — **색분석이 낸다**(픽셀을 봐야 하므로). 여기서는 받기만 한다.
   *   eyeOpen0  눈 개방도 — brow_eye_gap 게이트(>0.22)에 쓴다
   * @returns {ratio, line, lineScore, faceH, browY}
   */
  function measureStructure(c) {
    var lm = c.lm, W = c.W, H = c.H, faceW = c.faceW;
    var P = function (i) { return { x: lm[i].x * W, y: lm[i].y * H }; };
    var eyeL = c.eyeL, eyeLi = c.eyeLi, eyeR = c.eyeR, eyeRi = c.eyeRi, eyeOpen0 = c.eyeOpen0;

    var topPt = { x: P(10).x, y: c.hairTopY };
    var faceH = dist(topPt, P(152));
    var browY = (P(105).y + P(334).y) / 2;
    var subnasale = P(2);
    var upper = (browY - c.hairTopY);
    var midf = (subnasale.y - browY);
    var lower = (P(152).y - subnasale.y);
    var triSum = upper + midf + lower;
    var f_upper = upper / triSum, f_mid = midf / triSum, f_lower = lower / triSum;
    // ── 미간(nasion, 168) 기준 중·하안부 ──────────────────────
    // 왜 따로 두나: 위 3분할(upper/mid/lower)의 분할점은 **눈썹**이다. 계측 규준은 **미간**을 쓴다.
    //   그대로 견주면 우리 중안부가 체계적으로 부풀어 틀린 판정이 나온다(규준 조사 2026-08-17 §mid_lower).
    // 기존 필드는 손대지 않고 **새 필드만 더한다** — 쌓인 측정치의 정의가 갈리면 안 된다.
    // 규준(한국 여성 n=40, 직접 계측): 중안부 41.6 : 하안부 58.4.
    var nasion = P(168);
    var nMid = subnasale.y - nasion.y;          // n-sn
    var nLow = P(152).y - subnasale.y;          // sn-gn
    var nSum = nMid + nLow;
    var midPct = nSum > 0 ? +(nMid / nSum * 100).toFixed(1) : null;

    var eyeLen = dist(eyeL, eyeLi) / faceW;
    var interocular = dist(eyeLi, eyeRi) / dist(eyeL, eyeLi);
    var noseW = dist(P(98), P(327)) / faceW;
    var jawW = dist(P(172), P(397)) / faceW;
    var faceRatio = faceH / faceW;
    var lipThick = dist(P(13), P(14)) / faceH;
    var mouthW = dist(P(61), P(291)) / faceW;
    var mouthCorner = -(((P(61).y + P(291).y) / 2 - (P(13).y + P(14).y) / 2) / faceH * 100); // +상향

    // brow_eye_gap: 눈썹(105/334)↔윗눈꺼풀(159/386) 세로거리 ÷ faceW. eye_open>0.22 게이트.
    var _eyeVertH = (dist(P(159), P(145)) + dist(P(386), P(374))) / 2;
    var _browEyeRaw = (Math.abs(P(105).y - P(159).y) + Math.abs(P(334).y - P(386).y)) / 2;
    var browEyeGap = eyeOpen0 > 0.22 ? +(_browEyeRaw / faceW).toFixed(3) : null;
    var browEyeGapX = (eyeOpen0 > 0.22 && _eyeVertH > 0) ? +(_browEyeRaw / _eyeVertH).toFixed(2) : null;

    var lipUpper = +(dist(P(0), P(13)) / faceH).toFixed(3);
    var lipLower = +(dist(P(14), P(17)) / faceH).toFixed(3);
    var lipUlRatio = lipUpper > 0 ? +(lipLower / lipUpper).toFixed(2) : null;
    var templeW = +(dist(P(127), P(356)) / faceW).toFixed(3);
    var mouthOpen = lipThick > 0.055;   // 임계 0.055는 잠정(이론팀 캘리브레이션 대기)

    // M축 후보 2종 — 로깅 전용, 판정 미투입 [가설]
    var chinLen = +((P(152).y - P(17).y) / faceH).toFixed(3);
    var partsVpos = +(((eyeLi.y + eyeRi.y) / 2 - c.hairTopY) / faceH).toFixed(3);
    // face_taper: temple_w는 «개인차 미검증» — 불변이면 jaw_w의 재척도일 뿐이다(오류대장 §046)
    var faceTaper = templeW > 0 ? +(jawW / templeW).toFixed(3) : null;

    // ── 라인: 직선감·곡선감 ──
    var chain = [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397];
    var angSum = 0;
    for (var i = 1; i < chain.length - 1; i++) {
      var p1 = P(chain[i - 1]), p2 = P(chain[i]), p3 = P(chain[i + 1]);
      var a1 = Math.atan2(p2.y - p1.y, p2.x - p1.x), a2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
      var dd = Math.abs(a2 - a1); if (dd > Math.PI) dd = 2 * Math.PI - dd;
      angSum += dd;
    }
    var jawAngular = angSum / (chain.length - 2) * 57.3;

    var _jx = chain.map(function (i) { return P(i).x / faceW; });
    var _jy = chain.map(function (i) { return P(i).y / faceW; });
    var _fit3 = polyfitMSE(_jx, _jy, 3), _fit2 = polyfitMSE(_jx, _jy, 2);
    var jawCurveMse3 = _fit3.mse != null ? +_fit3.mse.toFixed(5) : null;
    var jawCurveMse2 = _fit2.mse != null ? +_fit2.mse.toFixed(5) : null;
    var jawCurveA = _fit2.coef ? +_fit2.coef[2].toFixed(4) : null;

    var chin = P(152), cL = P(148), cR = P(377);
    var v1 = Math.atan2(cL.y - chin.y, cL.x - chin.x), v2 = Math.atan2(cR.y - chin.y, cR.x - chin.x);
    var chinAngle = Math.abs(v1 - v2) * 57.3; if (chinAngle > 180) chinAngle = 360 - chinAngle;

    // 눈썹 아치 — ⚠ 절대값이라 꺾인 방향을 버린다(이론 C5 2026-08-17: 척도가 아니라 부호 오염).
    //   재설계 전까지 기존 산식을 그대로 둔다. 여기서 임의로 고치면 사전 등급과 어긋난다.
    var bIn = P(107), bPk = P(105), bOut = P(70);
    var bv1 = Math.atan2(bPk.y - bIn.y, bPk.x - bIn.x), bv2 = Math.atan2(bOut.y - bPk.y, bOut.x - bPk.x);
    var browArch = Math.abs(bv2 - bv1) * 57.3; if (browArch > 180) browArch = 360 - browArch;

    // N8(이론확정 2026-07-30): 부호 반전 시정 — 올라간 눈매가 +
    var eyeAngle = -(((eyeL.y - eyeLi.y) + (eyeR.y - eyeRi.y)) / 2) / faceW * 100;

    // 종합 직선감 (0=곡선 1=직선) — v0 러프, 캘리브레이션 대상
    var lineScore = clamp(clamp((jawAngular - 7) / 12, 0, 1) * 0.45
                        + clamp((chinAngle - 115) / 50, 0, 1) * 0.25
                        + clamp((25 - browArch) / 20, 0, 1) * 0.30, 0, 1);

    return {
      faceH: faceH, browY: browY, f_upper: f_upper, f_mid: f_mid, f_lower: f_lower,
      lineScore: lineScore,
      ratio: {
        face_HW: +faceRatio.toFixed(2), upper: +f_upper.toFixed(3), mid: +f_mid.toFixed(3), lower: +f_lower.toFixed(3),
        eye_len: +eyeLen.toFixed(3), interocular: +interocular.toFixed(2), nose_w: +noseW.toFixed(3), jaw_w: +jawW.toFixed(3),
        lip_thick: +lipThick.toFixed(3), mouth_w: +mouthW.toFixed(3),
        brow_eye_gap: browEyeGap, brow_eye_gap_x: browEyeGapX,
        lip_upper: lipUpper, lip_lower: lipLower, lip_ul_ratio: lipUlRatio, mouth_open: mouthOpen,
        temple_w: templeW, chin_len: chinLen, parts_vpos: partsVpos, face_taper: faceTaper,
        // 미간 기준 — 규준(41.6:58.4)과 직접 견줄 수 있는 유일한 비율
        n_mid_pct: midPct, n_low_pct: midPct == null ? null : +(100 - midPct).toFixed(1)
      },
      line: {
        jaw_angular_deg: +jawAngular.toFixed(1), chin_angle_deg: +chinAngle.toFixed(1),
        brow_arch_deg: +browArch.toFixed(1), eye_angle: +eyeAngle.toFixed(2),
        eye_open: +eyeOpen0.toFixed(2), mouth_corner: +mouthCorner.toFixed(2),
        jaw_curve_mse3: jawCurveMse3, jaw_curve_mse2: jawCurveMse2, jaw_curve_a: jawCurveA
      }
    };
  }

  root.CZM = root.CZM || {};
  root.CZM.measureStructure = measureStructure;
  root.CZM.polyfitMSE = polyfitMSE;
})(typeof window !== "undefined" ? window : globalThis);
