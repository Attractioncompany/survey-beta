// 앱 스캔 측정 — 방금 찍은 스캔 세션에서 8타입 판정에 넣을 지표를 뽑는다.
//
// 흐름:  native.latestScan() → 프레임 로드 → MediaPipe 랜드마크 → depth 결합
//        → scan-metrics.computeFrontSnapshot() → 지표
//
// **이 파일은 지표를 산출만 한다.** 8타입 판정은 asset-score.js가, 화면 표시는 부르는
// 쪽이 한다. 산출과 판정이 한 파일에 섞이면 어느 쪽이 틀렸는지 가려내지 못한다.
//
// 스캔이 담당하는 것: 콧대 돌출(nose_projection) 같은 **사진으로는 못 재는 3D 지표**.
// 색 3종(chroma·contrast_overall·hue_angle)은 스캔이 내지 않는다 — 촬영(photo-module)
// 몫이고, 앱 플로우가 촬영을 먼저 두는 이유가 그것이다.

import { computeFrontSnapshot } from "./scan-metrics.js";
import { usedLandmarkIndices } from "./poc-metrics.js";

/** MediaPipe FaceLandmarker 1개를 재사용한다. 매번 만들면 wasm을 다시 올린다. */
let _lm = null;
async function landmarker(mpBase) {
  if (_lm) return _lm;
  const { FaceLandmarker, FilesetResolver } =
    await import(`${mpBase}/vision_bundle.mjs`);
  const fs = await FilesetResolver.forVisionTasks(mpBase);
  _lm = await FaceLandmarker.createFromOptions(fs, {
    baseOptions: { modelAssetPath: `${mpBase}/face_landmarker.task` },
    runningMode: "IMAGE", numFaces: 1,
  });
  return _lm;
}

async function loadImage(url) {
  const b = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(b);
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  c.getContext("2d").drawImage(bmp, 0, 0);
  return { bmp, canvas: c, w: bmp.width, h: bmp.height };
}

/**
 * 한 스캔 세션에서 지표를 산출한다.
 *
 * @param scan  native.latestScan() 결과 {base, frames:[...]}
 * @param opts  {mpBase} 앱 번들 경로(기본 "../mp") 또는 {lmk} 이미 만든 FaceLandmarker.
 *              CDN은 모듈·wasm·모델 경로가 서로 달라 하나의 base로 접히지 않는다 —
 *              검증 페이지는 자기가 만든 것을 그대로 넘긴다.
 * @returns {m, frameTag, tried} — m은 asset-score가 받는 지표 맵. 실패하면 m=null.
 *
 * **정면 프레임 하나만 쓴다.** 여러 프레임을 융합하면 프레임 간 축 정합(toARKitCamAxes)이
 * 필요한데, 그 경로는 scan-analyze의 오프라인 검증용이고 앱에서 아직 검증되지 않았다.
 * 단일 프레임은 강체변환이 같은 프레임 내 거리·각도를 바꾸지 않아 축 보정이 필요 없다
 * (scan-metrics.computeFrontSnapshot 주석 참고).
 */
export async function measureScan(scan, opts = {}) {
  const { mpBase = "../mp", lmk: given = null } = opts;
  if (!scan || !scan.frames || !scan.frames.length) return { m: null, reason: "no-frames" };

  const USED = usedLandmarkIndices();
  const LOOP = USED.slice();
  // 돌출도가 쓰는 정중선 점들 — shapeMetrics가 참조하지 않아 USED에 없다.
  for (const i of [1, 9, 2, 18, 200, 199, 175]) if (!LOOP.includes(i)) LOOP.push(i);

  const lmk = given || await landmarker(mpBase);
  const tried = [];

  // step이 front인 프레임부터 시도한다. 얼굴이 안 잡히거나 depth가 비면 다음 프레임으로.
  for (const tag of scan.frames) {
    let meta;
    try { meta = await (await fetch(`${scan.base}/${tag}.json`)).json(); }
    catch { tried.push([tag, "meta-fail"]); continue; }
    if (meta.step && meta.step !== "front" && tried.length < scan.frames.length - 1) {
      tried.push([tag, "skip-nonfront"]); continue;
    }

    try {
      const img = await loadImage(`${scan.base}/${tag}_rgb.jpg`);
      const res = lmk.detect(img.bmp);
      if (!res.faceLandmarks || !res.faceLandmarks.length) { tried.push([tag, "no-face"]); continue; }

      const depth = new Float32Array(
        await (await fetch(`${scan.base}/${tag}_depth.bin`)).arrayBuffer());
      const K = meta.intrinsics;   // flat 3x3 — poc-metrics.unproject 규약과 같다
      const rec = computeFrontSnapshot(
        USED, LOOP, res.faceLandmarks[0], img.w, img.h,
        depth, meta.depthW, meta.depthH, K);

      if (!rec.m3dSnap) { tried.push([tag, "depth-miss"]); continue; }

      // 엔진 입력으로 합친다. 3D 형태 지표 + 돌출도. 이름이 이미 엔진과 같아 매핑이 없다
      // — 매핑 표를 두면 그 표가 또 하나의 정의가 되고, 두 정의는 언젠가 갈라진다.
      const m = Object.assign({}, rec.m3dSnap, rec.protrusionSnap || {});
      m._src = "scan";
      m._frame = tag;
      return { m, frameTag: tag, tried };
    } catch (e) {
      tried.push([tag, String(e && e.message || e)]);
    }
  }
  return { m: null, reason: "all-frames-failed", tried };
}

/** 엔진 입력 15종 중 이 지표 맵이 채우는 것 — 화면에 "무엇까지 쟀는지" 정직하게 쓰려고 둔다. */
export const ENGINE_KEYS = ["chroma", "contrast_overall", "hue_angle",
  "eye_angle", "eye_round", "eye_len", "interocular", "brow_arch_deg", "brow_eye_gap",
  "nose_projection", "lip_thickness", "mouth_w", "jaw_angular_deg", "chin_len", "parts_vpos"];

export function coverage(m) {
  if (!m) return { have: [], miss: ENGINE_KEYS.slice() };
  // eye_round·lip_thickness는 엔진이 원자료에서 파생한다(eye_open/eye_len, lip_upper+lip_lower).
  const derived = { eye_round: ["eye_open", "eye_len"], lip_thickness: ["lip_upper", "lip_lower"] };
  const has = k => (derived[k] ? derived[k].every(x => m[x] != null) : m[k] != null);
  return { have: ENGINE_KEYS.filter(has), miss: ENGINE_KEYS.filter(k => !has(k)) };
}
