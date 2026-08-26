// 사진에서 가장 넓은 색을 뽑는다.
//
// 원래 cloth-check.html 안에 인라인으로 있던 함수다. 아이템 등록에서도 같은 일이 필요해져
// 파일로 뺐다 — 복사해 두면 한쪽만 고쳐져 두 화면의 판정이 조용히 갈린다(오류대장 053이
// 정확히 그 사고였다).

/**
 * @param ctx  2D 컨텍스트
 * @param x0,y0,w,h  훑을 사각형 (프레임 좌표)
 * @returns {r,g,b,share} | null   share = 그 색이 차지한 비율
 */
export function dominantColor(ctx, x0, y0, w, h){
  const d = ctx.getImageData(x0, y0, w, h).data;
  const bins = new Map();                       // 32단계로 뭉친 색 → 픽셀 수
  const key = (r,g,b) => (r>>3<<10) | (g>>3<<5) | (b>>3);
  for(let i=0; i<d.length; i+=4){
    if(d[i+3] < 200) continue;                  // 투명 픽셀 제외
    const k = key(d[i], d[i+1], d[i+2]);
    bins.set(k, (bins.get(k)||0) + 1);
  }
  if(!bins.size) return null;
  let top=null, max=0;
  for(const [k,n] of bins) if(n>max){ max=n; top=k; }
  // 최빈 구간에 속한 픽셀만 다시 훑어 평균 — 뭉친 값(32단계)을 그대로 쓰면 색이 어긋난다
  let R=0,G=0,B=0,n=0;
  for(let i=0; i<d.length; i+=4){
    if(d[i+3] < 200) continue;
    if(key(d[i], d[i+1], d[i+2]) !== top) continue;
    R+=d[i]; G+=d[i+1]; B+=d[i+2]; n++;
  }
  return n ? {r:Math.round(R/n), g:Math.round(G/n), b:Math.round(B/n), share:n/(w*h)} : null;
}

export const toHex = c =>
  "#" + [c.r, c.g, c.b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");

/**
 * 파일 하나에서 가운데 영역의 대표색을 뽑는다.
 * 가장자리를 빼는 이유: 옷을 찍으면 프레임 둘레는 대개 배경이다. 그대로 세면 벽 색이 이긴다
 * (옷 색 판정에서 측정 픽셀의 58%가 배경이었던 적이 있다).
 *
 * @param file  <input type="file"> 이 준 File
 * @param inset 가장자리에서 얼마나 안쪽만 볼지 (0~0.5, 기본 0.25 = 가운데 절반)
 * @param thumb 썸네일도 만들지 (기본 false). true면 결과에 dataURL이 붙는다.
 * @returns {hex, share, thumb?} | null
 */
export async function colorOfFile(file, inset = 0.25, thumb = false){
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => {
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = () => no(new Error("이미지를 읽지 못했습니다"));
      im.src = url;
    });
    // 긴 변 512로 줄여 훑는다. 원본 그대로면 4000×3000짜리에서 픽셀 1200만 개를 도는데,
    // 최빈색은 축소해도 거의 같다.
    const scale = Math.min(1, 512 / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const x0 = Math.round(w * inset), y0 = Math.round(h * inset);
    const cw = Math.max(1, w - x0 * 2), ch = Math.max(1, h - y0 * 2);
    const c = dominantColor(ctx, x0, y0, cw, ch);
    if (!c) return null;
    const out = { hex: toHex(c), share: c.share };
    /* 썸네일 — 이미 그려 둔 캔버스에서 한 번 더 줄인다. 파일을 다시 읽지 않는다.
       160px 정사각 가운데 자르기: 인벤토리는 행마다 작은 칸이라 비율이 제각각이면 줄이 흔들린다.
       q0.72 JPEG면 한 장 8~14KB고, 옷 50벌이라도 1MB를 넘지 않는다.
       ⚠ 원본은 저장하지 않는다. 얼굴이 아니어서 헌법 §4 대상은 아니지만, 옷 사진에도
       방·거울·사람이 같이 찍힌다. 남기는 것은 알아볼 수 있는 최소 크기까지다. */
    if (thumb) {
      const S = 160, side = Math.min(w, h);
      const tv = document.createElement("canvas");
      tv.width = tv.height = S;
      tv.getContext("2d").drawImage(cv, (w - side) / 2, (h - side) / 2, side, side, 0, 0, S, S);
      out.thumb = tv.toDataURL("image/jpeg", 0.72);
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}
