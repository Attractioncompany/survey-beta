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
    var browY = (P(105).y + P(334).y) / 2;        // 눈썹선 — brow_eye_gap 등 다른 계측이 쓴다
    var subnasale = P(2);
    /* 3분할의 위 분할점은 **미간(glabella, lm 9)**이다 (대표 지시 2026-08-27).
       2026-08-17에 규준 대조를 하면서 "우리 분할점은 눈썹인데 계측 규준은 미간을 쓴다,
       그대로 견주면 중안부가 체계적으로 부풀어 틀린 판정이 나온다"를 이미 확인해 두고도
       새 필드(n_mid_pct)만 더하고 이 3분할은 눈썹 기준으로 남겨 두었다.
       그 사이 유저는 **미간을 전제한 황금비 1:1:1 기준에 눈썹 기준 값을 대본 결과**를 받았다.
       눈썹은 표정과 화장으로 움직이고 사람마다 위치가 다르다 — 골격 지점이 아니다.
       계측의 분할점이 될 수 없다.
       ⚠ 소급 없음 — 이 값은 서버 컬럼이 아니라 매 측정마다 다시 계산된다.
         기기에 남은 옛 결과는 옛 기준이고, 다시 측정하면 새 기준으로 바뀐다. */
    /* ⚠ 168이 아니라 9다 (2026-08-27 재교정, 대표 실기기 확인: "이번엔 미간이 아니라
         눈 윗선으로 측정함").
       미간(glabella)은 **눈썹 사이**이고, 168(nasion)은 **눈 사이 코뿌리**로 그보다 아래다.
       이 파일이 168을 "미간"이라 부르고 있어서 그대로 옮겼다가 분할선이 눈 위로 내려갔다.
       신고전 3분할의 경계는 trichion–**glabella**–subnasale–menton이므로 9가 맞다.
       n_mid_pct(아래)는 그대로 168을 쓴다 — 그 규준(41.6:58.4)이 nasion 기준이라 맞바꾸면 안 된다. */
    var splitY = P(9).y;
    var upper = (splitY - c.hairTopY);
    var midf = (subnasale.y - splitY);
    var lower = (P(152).y - subnasale.y);
    var triSum = upper + midf + lower;
    var f_upper = upper / triSum, f_mid = midf / triSum, f_lower = lower / triSum;
    // ── 코뿌리(nasion, 168) 기준 중·하안부 — 외부 규준 대조 전용 ────────
    // 왜 따로 두나: 위 3분할은 **미간(glabella)** 기준이고, 아래 규준(41.6:58.4)은 **nasion** 기준이다.
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

    /* 하안부 균형 — 코밑 → 입술틈 → 턱끝 (참고 레퍼런스 2026-08-27 대표 제공:
       mindvideo 얼굴 황금비 계산기 6항목 중 우리에게 없던 하나).
       이상값 1.618 = (입술틈~턱끝) / (코밑~입술틈).
       새 랜드마크가 필요 없다 — 코밑(2)·입술틈(13·14 중간)·턱끝(152)은 이미 쓰고 있다. */
    var stomion = (P(13).y + P(14).y) / 2;
    var lowUp   = stomion - subnasale.y;          // 코밑 → 입술
    var lowDn   = P(152).y - stomion;             // 입술 → 턱끝
    var lowerBalance = (lowUp > 0 && lowDn > 0) ? +(lowDn / lowUp).toFixed(3) : null;
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

    /* 측면 직선성 — 대표 지시 2026-08-29의 얼굴형 판별 1단계.
       "긴형의 특징중에 또 하나가 정면에서 볼떄 눈썹 옆(관자놀이쯤)부터 하악각까지가
        거의 일자로 떨어져서 더 길이감이 강하게 느껴져. 보통 계란형들은 광대부터
        턱선방향으로 각져서 떨어지는 반면, 긴형과 둥근형은 광대부터 하악각까지가
        정면에서 봤을때 일자로 떨어지는 편이야"

       위의 face_taper(lm127·356 기준)로는 이걸 못 잰다. 예시 4장으로 확인했더니
       그 랜드마크에서는 광대가 관자놀이보다 **좁게** 나온다 — 해부학적으로 뒤집힌 값이라
       lm127·356이 대표가 말한 "눈썹 옆"보다 위·뒤를 잡고 있다는 뜻이다.
       그래서 고정 인덱스가 아니라 **눈썹 높이에서 윤곽선을 잘라** 폭을 잰다.
       같은 방식으로 광대 높이·하악각 높이도 잰다.

       1에 가까울수록 일자(긴형·둥근형), 작을수록 아래로 좁아짐(계란형).
       ⚠ 로깅 전용. 밴드 경계는 이론팀 판정 사항이다. */
    var OVAL_L = [234,127,162,21,54,103,67,109,132,93,58,172,136,150,149,176,148];
    var OVAL_R = [454,356,389,251,284,332,297,338,361,323,288,397,365,379,378,400,377];
    function widthAtY(y){
      function nearest(side){
        var best = null, bd = Infinity;
        for (var i = 0; i < side.length; i++) {
          var p = P(side[i]), d = Math.abs(p.y - y);
          if (d < bd) { bd = d; best = p; }
        }
        return best;
      }
      var l = nearest(OVAL_L), r = nearest(OVAL_R);
      return (l && r) ? Math.abs(r.x - l.x) : null;
    }
    var wBrow  = widthAtY(browY);
    var wCheek = widthAtY(P(116).y);
    var wGon   = widthAtY((P(172).y + P(397).y) / 2);
    var sideStraight = (wBrow > 0 && wGon != null) ? +(wGon / wBrow).toFixed(3) : null;

    /* 턱 하강·하악 꺾임 — 대표 지시 2026-08-29 3차의 각진형/역삼각 판별.
       각진형: "턱이 수평감이 있고, 광대-하악각-하악각-턱까지의 선이 선명하게 드러난다"
       역삼각: "광대→하악각부터 각도가 안쪽으로 들어와서 눈 아랫부분이 삼각형의 느낌을
               주면서 급격하게 들어간다. 보통 이마 양옆이 좀 벗겨지듯이 넓다"

       jaw_drop   = 하악각에서 턱끝까지의 세로 낙차 / 얼굴폭. 작을수록 턱이 수평이다.
       gonial_ang = 광대 → 하악각 → 턱끝이 이루는 각. 클수록 안쪽으로 급히 들어간다.

       예시 13장 검산: 각진형 하강 0.210~0.251 · 꺾임 126.4~133.1
                       역삼각 하강 0.263~0.286 · 꺾임 133.7~145.8  — 둘 다 겹침 없이 갈렸다.
       ⚠ 로깅 전용. 경계는 이론팀 판정 사항이다. */
    var _gonL = P(172), _gonR = P(397), _chin = P(152);
    var jawDrop = faceW > 0
      ? +((((_chin.y - _gonL.y) + (_chin.y - _gonR.y)) / 2) / faceW).toFixed(3) : null;
    function angAt(a, b, cc) {
      var v1 = Math.atan2(a.y - b.y, a.x - b.x), v2 = Math.atan2(cc.y - b.y, cc.x - b.x);
      var d = Math.abs(v1 - v2) * 57.3; if (d > 180) d = 360 - d; return d;
    }
    var gonialAng = +(((angAt(P(116), _gonL, _chin) + angAt(P(345), _gonR, _chin)) / 2)).toFixed(1);

    /* ── 대표 요청 항목 신설 (2026-08-29) ─────────────────────────────
       "체크되서 해설로 나갔으면 하는 부분" 15개 중, **랜드마크만으로 재는 것**을 여기 넣는다.
       음영·3D가 필요한 것(측면 턱선, 얼굴 입체감, 콧대 휘어짐)은 여기서 하지 않는다 —
       2D 정면 사진에서 지어내면 조명을 재고 얼굴이라고 부르게 된다.
       전부 얼굴폭(faceW) 또는 얼굴높이(faceH)로 정규화한다. 로깅 전용. */

    // ⑥ 미간 너비 — 눈썹 안쪽 끝 사이 (눈썹 굵기·길이 조절의 기준)
    var glabellaW = +(dist(P(107), P(336)) / faceW).toFixed(3);
    // ⑥ 눈썹 길이 — 안쪽 끝 ~ 바깥 끝
    var browLenL = dist(P(107), P(46)), browLenR = dist(P(336), P(276));
    var browLen = +(((browLenL + browLenR) / 2) / faceW).toFixed(3);
    // ⑥ 눈썹 두께 — 위선(70·105·107) 대비 아래선(46·53·52)의 세로 간격 평균
    var browThick = +((
        (Math.abs(P(105).y - P(53).y) + Math.abs(P(334).y - P(283).y)) / 2) / faceH).toFixed(4);
    /* ⑥ 눈썹 산 위치 — 안쪽 끝에서 산까지가 눈썹 전체 길이의 몇 %인가.
       0.5면 가운데, 클수록 바깥쪽에 산이 있다. 눈썹을 어디서 꺾을지의 기준이 된다. */
    var browPeakL = browLenL > 0 ? Math.abs(P(105).x - P(107).x) / browLenL : null;
    var browPeakR = browLenR > 0 ? Math.abs(P(334).x - P(336).x) / browLenR : null;
    var browPeak = (browPeakL != null && browPeakR != null)
      ? +(((browPeakL + browPeakR) / 2)).toFixed(3) : null;
    // ⑥ 눈썹 바깥 끝 ~ 얼굴 윤곽 여백 (눈썹을 더 뺄 수 있는가)
    var browGapOut = +((
        (Math.abs(P(46).x - P(234).x) + Math.abs(P(276).x - P(454).x)) / 2) / faceW).toFixed(3);

    /* ⑨ 눈 곡률 — 위 눈꺼풀과 아래 눈꺼풀이 각각 얼마나 휘었나.
       양 끝을 잇는 직선에서 가운데가 얼마나 벗어나는지를 눈 길이로 나눈다.
       위가 크면 위로 둥근 눈, 아래가 크면 아래로 둥근 눈, 둘 다 작으면 직선적인 눈이다.
       **타입 이름을 붙이지 않는다** — 대표 요청도 "어떤 타입으로 규정하지않더라도"였다. */
    function lidCurve(outer, inner, mid) {
      var a = P(outer), b = P(inner), m = P(mid);
      var len = Math.hypot(b.x - a.x, b.y - a.y);
      if (!(len > 0)) return null;
      var d = Math.abs((b.y - a.y) * m.x - (b.x - a.x) * m.y + b.x * a.y - b.y * a.x) / len;
      return d / len;
    }
    var eyeCurveUp = +(((lidCurve(33, 133, 159) + lidCurve(263, 362, 386)) / 2)).toFixed(4);
    var eyeCurveDn = +(((lidCurve(33, 133, 145) + lidCurve(263, 362, 374)) / 2)).toFixed(4);

    /* ⑩ 삼백안 — 홍채 위·아래로 흰자가 얼마나 보이나.
       홍채 중심(468·473)에서 위·아래 눈꺼풀까지의 거리를 홍채 반지름으로 나눈다.
       1보다 크면 그쪽에 흰자가 드러난다. 아래가 크면 하삼백안, 위가 크면 상삼백안이다.
       홍채 랜드마크는 face_landmarker.task가 기본 포함한다(478점). */
    function scleraShow(iris, ringA, ringB, upper, lower) {
      var c = P(iris), r = dist(P(ringA), P(ringB)) / 2;
      if (!(r > 0)) return null;
      return { up: (c.y - P(upper).y) / r, dn: (P(lower).y - c.y) / r };
    }
    var _scL = scleraShow(468, 469, 471, 159, 145);
    var _scR = scleraShow(473, 474, 476, 386, 374);
    var scleraUp = (_scL && _scR) ? +(((_scL.up + _scR.up) / 2)).toFixed(3) : null;
    var scleraDn = (_scL && _scR) ? +(((_scL.dn + _scR.dn) / 2)).toFixed(3) : null;

    // ⑪ 눈 바깥 끝 ~ 얼굴 윤곽 여백 (눈 주위 여백감)
    var eyeGapOut = +((
        (Math.abs(P(33).x - P(234).x) + Math.abs(P(263).x - P(454).x)) / 2) / faceW).toFixed(3);

    // ⑫ 코 길이 — 코뿌리(168) ~ 코밑(2)
    var noseLen = +((Math.abs(P(2).y - P(168).y)) / faceH).toFixed(3);
    // ⑫ 콧볼 두께 — 콧볼 폭 대비 코 기둥(측면 아닌 정면 근사)
    var alaThick = +((dist(P(48), P(278)) / dist(P(129), P(358)))).toFixed(3);
    // ⑫ 콧구멍 노출 — 코끝(4)이 콧볼 아래선보다 얼마나 위인가. 클수록 콧구멍이 보인다
    var nostrilShow = +(((P(2).y - P(4).y) / faceH)).toFixed(4);

    // ⑭ 인중 길이 — 코밑(2) ~ 윗입술 상단(0)
    var philtrum = +((Math.abs(P(0).y - P(2).y)) / faceH).toFixed(4);
    var cheekOut     = (wBrow > 0 && wCheek != null) ? +(wCheek / wBrow).toFixed(3) : null;
    var jawCheek     = (wCheek > 0 && wGon != null) ? +(wGon / wCheek).toFixed(3) : null;

    // ── 좌우 대칭 (2026-08-18 대표 지시) ────────────────────
    // 자기 얼굴 안에서만 재므로 외부 표본도 규준도 필요 없다.
    // 중앙선 = 미간(168)·코밑(2)·턱끝(152)을 최소제곱으로 맞춘 직선.
    //   코끝 하나로 세로선을 세우면 고개를 살짝 돌린 사진에서 통째로 기울어 전부 비대칭으로 읽힌다.
    // 각 대응 쌍의 "중앙선까지 거리 차"를 faceW로 나눈다 → 촬영 거리와 무관한 비율.
    var midPts = [P(168), P(2), P(152)];
    var mx = 0, my = 0;
    for (var mi = 0; mi < 3; mi++) { mx += midPts[mi].x; my += midPts[mi].y; }
    mx /= 3; my /= 3;
    var sxy = 0, syy = 0;
    for (var mj = 0; mj < 3; mj++) {
      var dx0 = midPts[mj].x - mx, dy0 = midPts[mj].y - my;
      sxy += dx0 * dy0; syy += dy0 * dy0;
    }
    var slope = syy > 0 ? sxy / syy : 0;          // x = mx + slope*(y - my)
    // 점에서 중앙선까지의 부호 있는 가로 거리
    var offAxis = function (pt) { return (pt.x - (mx + slope * (pt.y - my))) / Math.sqrt(1 + slope * slope); };
    var PAIRS = [
      ["eye_outer", 33, 263], ["eye_inner", 133, 362], ["brow", 105, 334],
      ["nose_wing", 129, 358], ["mouth_corner", 61, 291], ["jaw", 172, 397], ["temple", 127, 356]
    ];
    var asymParts = {}, asymSum = 0, asymMax = 0, asymN = 0;
    for (var pi = 0; pi < PAIRS.length; pi++) {
      var La = P(PAIRS[pi][1]), Ra = P(PAIRS[pi][2]);
      var d = Math.abs(Math.abs(offAxis(La)) - Math.abs(offAxis(Ra))) / faceW * 100;  // %
      d = +d.toFixed(2);
      asymParts[PAIRS[pi][0]] = d;
      asymSum += d; asymN++; if (d > asymMax) { asymMax = d; }
    }
    // 높이 차 — 좌우가 같은 높이에 있는가(눈·입꼬리가 대표적으로 티가 난다)
    var tiltOf = function (a, b) { return +(Math.abs(P(a).y - P(b).y) / faceW * 100).toFixed(2); };
    var asymTilt = { eye: tiltOf(33, 263), brow: tiltOf(105, 334), mouth: tiltOf(61, 291) };
    var asymScore = asymN ? +(asymSum / asymN).toFixed(2) : null;   // 평균 어긋남(%). 0 = 완전 대칭

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
      faceH: faceH, browY: browY, splitY: splitY, f_upper: f_upper, f_mid: f_mid, f_lower: f_lower,
      lineScore: lineScore,
      ratio: {
        face_HW: +faceRatio.toFixed(2), upper: +f_upper.toFixed(3), mid: +f_mid.toFixed(3), lower: +f_lower.toFixed(3),
        eye_len: +eyeLen.toFixed(3), interocular: +interocular.toFixed(2), nose_w: +noseW.toFixed(3), jaw_w: +jawW.toFixed(3),
        lip_thick: +lipThick.toFixed(3), mouth_w: +mouthW.toFixed(3),
        brow_eye_gap: browEyeGap, brow_eye_gap_x: browEyeGapX,
        lip_upper: lipUpper, lip_lower: lipLower, lip_ul_ratio: lipUlRatio, mouth_open: mouthOpen,
        temple_w: templeW, chin_len: chinLen, parts_vpos: partsVpos, face_taper: faceTaper,
        // 얼굴형 1단계 후보 (대표 정의 2026-08-29) — 로깅 전용
        side_straight: sideStraight, cheek_out: cheekOut, jaw_cheek: jawCheek,
        jaw_drop: jawDrop, gonial_ang: gonialAng,
        // 대표 요청 신설 (2026-08-29) — 랜드마크 기반, 로깅 전용
        glabella_w: glabellaW, brow_len: browLen, brow_thick: browThick,
        brow_peak: browPeak, brow_gap_out: browGapOut,
        eye_curve_up: eyeCurveUp, eye_curve_dn: eyeCurveDn,
        sclera_up: scleraUp, sclera_dn: scleraDn, eye_gap_out: eyeGapOut,
        nose_len: noseLen, ala_thick: alaThick, nostril_show: nostrilShow,
        philtrum: philtrum,
        asym_score: asymScore, asym_max: +asymMax.toFixed(2),
        asym_parts: asymParts, asym_tilt: asymTilt,
        // 미간 기준 — 규준(41.6:58.4)과 직접 견줄 수 있는 유일한 비율
        n_mid_pct: midPct, n_low_pct: midPct == null ? null : +(100 - midPct).toFixed(1),
        lower_balance: lowerBalance          // 하안부 균형 — 이상값 1.618
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
