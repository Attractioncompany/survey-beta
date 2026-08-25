// 「한 것」 탭 — 지나온 미션 전체와 전/후 비교.
// home.html이 CTX 꾸러미를 넘긴다: app·shell·head·esc·nav·track·LS·K·DICT·CZMStats·TCOLOR
//   diag·photo·tName·cell·statNow·USER·statsRow·downBanner·STATS(getter)·loadScan()
// 헌법 §4 — 검증 사진은 서버에 올리지 않는다. 기기 안에서만 다룬다.
//
// ── 사진첩 (2026-08-25 해소) ──────────────────────────────────────────
// 전에 여기 "사진이 없어서 못 그린다"고 적어 뒀었다. 그 사유는 절반이 틀렸다 —
// 이미지는 처음부터 기기에 있었다(ScanWriter가 Documents/scans/{session}/{tag}_rgb.jpg를 쓴다).
// 없던 것은 저장소가 아니라 **어느 사진이 어느 측정인지 적어 둔 줄**이었고, 이제
// chugu_photo_result.shots[]가 그 줄을 갖는다(photo.html + scan-measure-run.html).
// 그래서 아래 album()이 선다. 이미지 바이트는 여전히 한 줄도 복사하지 않는다.
//
// **앱 전용이다.** 브라우저에는 그 파일 시스템이 없어 photo_uri가 하나도 없고, 그러면
// album()이 빈 문자열을 돌려준다 — 웹에서는 이 열이 통째로 빠지고 나머지는 그대로다.
// isApp 분기를 따로 두지 않았다: 없는 데이터로는 빈 액자를 만들 길 자체가 없다.

const NTH = ["첫째", "둘째", "셋째", "넷째", "다섯째", "여섯째"];

/* 측정 필드가 움직인 방향을 사람 말로. [올라갔을 때, 내려갔을 때]
   어휘는 지어내지 않았다 — quest-dict.json의 검수 통과 미션 카피에서 그대로 가져왔다
   (예: eye_angle "+"가 eye.T+ "아이라인 끝 살짝 올려 그리기"라 ↑ = 눈꼬리 올라감).
   명사로 맺는다: 목록은 같은 틀이 30번 반복되는 자리라 "~어요"로 맺으면 그 자체가 대구다(헌법 §6-1).
   사전에 없는 필드는 한 줄을 통째로 뺀다. 모르는 값에 이름을 붙이지 않는다.
   ponytail: 방향만 말하고 크기는 말하지 않는다. delta는 필드마다 단위가 달라(도 vs 비율)
             "조금/많이"를 가르려면 필드별 문턱이 필요한데 그건 이론팀 값이다.
             shape-dist.json의 분포로 SD 환산이 가능하지만 색·헤어 필드를 못 덮어
             화면 안에서 어떤 줄은 크기가 있고 어떤 줄은 없어진다. 문턱이 서면 붙인다. */
const MOVED = {
  eye_angle:     ["눈꼬리 올라감", "눈꼬리 내려감"],
  // 종횡비(eye_open ÷ eye_len)다. "커짐"은 틀린 말이었다 — 눈이 가로로 길어져도 값은
  // 내려가서, 눈이 커졌는데 "작아짐"이 나갈 수 있다(이론 확인 2026-08-25).
  // 비율이 오르면 세로가 상대적으로 크다 = 동그란 눈.
  eye_openness:  ["눈매 동그래짐", "눈매 가늘어짐"],
  // 이 각은 곡률도 높낮이도 아니다. 눈썹 안쪽–산–바깥 세 점이 **산에서 꺾이는 각의 크기**이고,
  // 이론이 쓰는 축은 「산이 뚜렷 ↔ 일자」다(이론 회신 2026-08-25).
  //  · 곡률로 말하면 안 된다: 3점으로는 둥근 아치와 각진 눈썹이 구분 안 된다(둘 다 크게 꺾인다)
  //  · 높낮이로 말하면 안 된다: 그건 brow_eye_gap이 재고, 두 필드가 같은 말을 하게 된다
  // 어휘는 shape-dist.json의 labels를 델타 형태로 옮긴 것이라 신규 창작이 없다.
  brow_arch_deg: ["눈썹 산 또렷해짐", "눈썹 산 일자에 가까워짐"],
  brow_eye_gap:  ["눈썹 아래 여백 넓어짐", "눈썹 아래 여백 좁아짐"],
  lip_sum:       ["입술 도톰해짐", "입술 얇아짐"],
  chroma:        ["색에 힘 실림", "색 가라앉음"],
  hue_angle:     ["색이 따뜻해짐", "색이 차가워짐"],
  // 머리 ÷ 피부 밝기 비율이다(이론 C3). 원값이 아니라 비율이라 **조명이 소거된다** —
  // 방만 밝아진 경우에는 값이 안 움직인다. 그래서 이 문구는 조명 탓과 헷갈릴 말이 아니라
  // 오히려 "진짜로 머리가 밝아졌다"만 남은 말이다. 그대로 둔다.
  hair_L_ratio:  ["머리색 밝아짐", "머리색 어두워짐"],
};

// 재촬영이 실제로 잰 변화. 사전에 없거나 값이 0이면 아무 말도 하지 않는다.
export function movedLine(attrs) {
  const w = MOVED[attrs?.field];
  const d = attrs?.delta;
  if (!w || !Number.isFinite(d) || d === 0) return null;
  return d > 0 ? w[0] : w[1];
}

// 월요일 기준 주 키. 로컬 시간으로 자른다 — 유저가 보는 날짜와 같은 축이어야 한다.
export function weekKey(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));           // 일요일(0) → 6칸 뒤로
  return `${m.getFullYear()}-${m.getMonth() + 1}-${m.getDate()}`;
}

export function weekLabel(key, now = new Date()) {
  if (!key) return "날짜가 없는 기록";
  const [y, mo, da] = key.split("-").map(Number);
  const here = weekKey(now.toISOString());
  if (key === here) return "이번 주";
  const prev = new Date(now); prev.setDate(prev.getDate() - 7);
  if (key === weekKey(prev.toISOString())) return "지난주";
  const nth = NTH[Math.ceil(da / 7) - 1] ?? "";
  return `${y === now.getFullYear() ? "" : y + "년 "}${mo}월 ${nth} 주`;
}

/* 사진첩이 쓸 수 있는 shot만 골라 오래된 것 → 최신 순으로.
   · 옛 저장분(v2 객체)은 `[o]` 한 장짜리 배열이 된다 — 마이그레이션 코드 없음.
   · photo_uri가 없는 shot(웹에서 잰 것, 지우기를 누른 뒤)은 통째로 빠진다.
   · 같은 파일을 두 번 걸지 않는다. 같은 스캔으로 측정을 다시 돌리면 shot이 하나 더 쌓인다. */
export function shotsOf(photo) {
  if (!photo) return [];
  const all = Array.isArray(photo.shots) ? photo.shots : [photo];
  const seen = new Set();
  return all.filter(s => {
    if (!s || !s.photo_uri || seen.has(s.photo_uri)) return false;
    seen.add(s.photo_uri); return true;
  }).sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
}

export const spanDays = shots => shots.length < 2 ? 0 :
  Math.max(0, Math.round(((shots[shots.length - 1].ts ?? 0) - (shots[0].ts ?? 0)) / 86400000));

/* 계측으로 나가는 값 전부. 사진·경로·세션명은 여기 들어오지 않는다(헌법 §4).
   함수로 뺀 이유는 하나다 — 자체 점검이 칸 이름을 붙들 수 있게. */
export const albumStats = shots => ({ n_shots: shots.length, span_days: spanDays(shots) });

/* 앱 셸 호출 — index.html·scan-measure-run과 같은 규약(messageHandlers ↔ __nativeReply).
   home.html에는 이 헬퍼가 없어 최소한만 세운다. id를 1e6부터 세는 이유: 같은 페이지에
   다른 브릿지가 이미 서 있으면 1부터 세는 두 카운터가 겹쳐 응답이 엉뚱한 쪽으로 간다. */
const nativeCbs = new Map(); let nativeSeq = 1e6;
export const inApp = () => !!(window.webkit && window.webkit.messageHandlers
                              && window.webkit.messageHandlers.chugumism);
function native(method, params) {
  return new Promise((res, rej) => {
    if (!inApp()) return rej(new Error("no-native"));
    const prev = window.__nativeReply;
    window.__nativeReply = (id, ok, payload) => {
      const cb = nativeCbs.get(id);
      if (!cb) return prev && prev(id, ok, payload);
      nativeCbs.delete(id);
      ok ? cb.res(payload) : cb.rej(new Error((payload && payload.error) || "native-error"));
    };
    const id = ++nativeSeq; nativeCbs.set(id, { res, rej });
    window.webkit.messageHandlers.chugumism.postMessage({ id, method, params: params || {} });
  });
}

/* 비교 사진첩. 사진 파일은 이미 기기에 있고(ScanWriter) 여기는 그걸 가리키기만 한다.
   서버로 나가는 값은 없다 — track에도 경로·세션명을 싣지 않는다(헌법 §4, 설계서 §5).

   말하는 자리가 셋이고 목적이 다 다르다:
     1장  = 사실 고지 (처음 사진이 남은 시점)
     2장~ = 잃을 것이 처음 생긴 시점 → 기기 사진첩으로 내보내기를 권한다
     상시 = 아래 한 줄 (잊었을 때 다시 확인하는 자리) */
function albumHTML(shots, hasCrops) {
  // 사진은 없는데 얼굴 조각은 있는 기기(= 웹에서 잰 사람)에도 지우는 문을 낸다.
  // 조각은 웹에서도 생기는데 사진첩 카드는 photo_uri가 있어야 서므로, 안 그러면
  // 웹 유저에게는 지울 것만 있고 지울 문이 없다. 액자는 만들지 않는다 — 걸 사진이 없다.
  if (!shots.length) return hasCrops
    ? `<div class="card ph-glass" id="album"><h2>얼굴 조각</h2>
         <p class="note">해설에 쓰려고 부위별로 잘라 둔 조각이 이 기기에 있어요. 서버에는 올라가지 않습니다.</p>
         <button class="btn ghost" id="albClear" style="margin-top:8px">저장된 사진 지우기</button>
       </div>`
    : "";
  const day = t => { const x = new Date(t ?? 0); return `${x.getMonth() + 1}.${x.getDate()}`; };
  const pair = shots.length > 1;
  const pick = pair ? [shots[0], shots[shots.length - 1]] : [shots[0]];
  const cap  = pair ? ["처음 · " + day(pick[0].ts), "지금 · " + day(pick[1].ts)]
                    : ["처음 · " + day(pick[0].ts)];
  // [마케팅 게이트 필요] — 아래 문구 5개는 유저향 신규 카피다.
  const lead = pair
    ? `나란히 볼 수 있게 됐어요. 남겨두고 싶으면 사진첩으로 저장해 두세요.`
    : `이 사진은 폰 안에만 있어요. 서버로 보내지 않습니다. 대신 폰을 바꾸면 같이 사라져요.`;
  const frames = pick.map((s, i) =>
    `<figure style="flex:1;min-width:0;margin:0;text-align:center">
       <img class="alb-i" alt="" style="width:100%;aspect-ratio:3/4;object-fit:cover;
            border-radius:14px;background:var(--line);display:block">
       <figcaption style="font-size:12px;color:var(--sub);margin-top:6px">${cap[i]}</figcaption>
     </figure>`).join("");
  return `<div class="card ph-glass" id="album"><h2>나란히 놓고 보기</h2>
    <div style="display:flex;gap:10px;align-items:flex-start">${frames}</div>
    <p class="note">${lead}</p>
    ${pair ? `<button class="btn ghost" id="albSave">사진첩에 저장</button>` : ``}
    <p class="note" style="margin-top:10px">기기에만 저장돼요 · 서버에 올라가지 않습니다</p>
    <button class="btn ghost" id="albClear" style="margin-top:8px">저장된 사진 지우기</button>
  </div>`;
}

function wireAlbum(ctx, shots) {
  const root = document.getElementById("album");
  if (!root) return;
  const { track, LS, K } = ctx;
  const imgs = [...root.querySelectorAll("img.alb-i")];
  const pick = shots.length > 1 ? [shots[0], shots[shots.length - 1]] : [shots[0]];
  if (shots.length) imgs.forEach((im, i) => {
    // 파일이 사라졌으면(가지치기·수동 삭제) 깨진 액자를 보이느니 카드를 통째로 뺀다.
    im.onerror = () => root.remove();
    im.src = pick[i].photo_uri;
  });
  track("album_opened", albumStats(shots));

  const save = document.getElementById("albSave");
  if (save) save.onclick = async () => {
    save.disabled = true; save.textContent = "저장하는 중…";
    try {
      for (const im of imgs) {
        const c = document.createElement("canvas");
        c.width = im.naturalWidth; c.height = im.naturalHeight;
        c.getContext("2d").drawImage(im, 0, 0);
        // 기기 사진첩으로만 나간다 — 네이티브 saveImage는 PHPhotoLibrary(addOnly)를 부른다.
        await native("saveImage", { dataUrl: c.toDataURL("image/jpeg", 0.92) });
      }
      save.textContent = "사진첩에 저장했어요";
    } catch (e) { save.disabled = false; save.textContent = "저장하지 못했어요 · 다시"; }
  };

  const clear = document.getElementById("albClear");
  if (clear) clear.onclick = async () => {
    if (!confirm("기기에 있는 검증 사진을 모두 지웁니다. 측정 기록과 미션 이력은 그대로예요.")) return;
    // 지울 파일이 있을 때만 셸을 부른다. 웹에는 그 파일 시스템이 없어 native가 반드시 실패하는데,
    // 예전엔 그 실패로 여기서 빠져나가 **조각이 안 지워졌다**. 사진은 앱에만, 조각은 양쪽에 있다.
    if (shots.length) {
      try { await native("clearPhotos", {}); }
      catch (e) { clear.textContent = "지우지 못했어요"; return; }
    }
    // 가리키는 줄도 끊는다. 파일 없는 경로가 남으면 다음에 깨진 액자가 뜬다.
    // 측정값·이력은 건드리지 않는다 — 사진을 지운다고 8주가 사라지면 그게 더 큰 배신이다.
    const o = LS.get(K.photo, null);
    if (o) {
      delete o.photo_uri;
      (Array.isArray(o.shots) ? o.shots : []).forEach(s => { delete s.photo_uri; });
      LS.set(K.photo, o);
    }
    // 해설지 부위 조각도 같은 문에서 나간다. 사진은 지웠는데 얼굴 조각이 남아 있으면
    // 그건 지운 게 아니다. 측정 수치는 그대로 둔다 — 얼굴이 아니라 좌표다.
    LS.del(K.faceCrops);
    track("album_photos_cleared", { n: shots.length });
    root.remove();
  };
}

export function renderHistory(ctx) {
  const { app, shell, head, esc, nav, track, DICT, CZMStats, LS, K,
          diag, photo, tName, cell, statNow, statsRow, STATS } = ctx;

  const rows = STATS.slice().sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
  track("history_viewed", { n: rows.length, has_base: !!diag?.base_stats });

  if (!rows.length) return empty(ctx);

  // ── 전/후 — 출발선(진단이 남긴 base_stats) 대비 지금 ──────────────
  // 오른 타입만, 많이 오른 순으로 최대 3줄. 카드 높이를 내용에 맡기지 않는다.
  const gains = CZMStats.gainsOf(rows);
  const now   = statNow();
  const base  = diag?.base_stats ?? null;
  const moved = Object.keys(gains).filter(k => gains[k] > 0)
                      .sort((a, b) => gains[b] - gains[a]).slice(0, 3);

  const ba = moved.map(k => `<div class="hist-ba"><span>${esc(tName(k))}</span>` + (
    base && now
      ? `<em><b>${base[k] ?? 0}</b> → <b>${now[k]}</b></em>`
      : `<em><b>+${gains[k]}</b></em>`) + `</div>`).join("");

  const summary = `<div class="card ph-glass"><h2>달라진 만큼</h2>${
    moved.length
      ? ba + (base && now ? `` :
          `<p class="note">예전 진단이라 출발선 숫자가 없어요. 오른 양만 적어뒀습니다.</p>`)
      : `<p class="note">숫자로 오른 건 아직 없어요. 미션을 하나 마치면 여기에 전과 지금이 나란히 놓입니다.</p>`
  }${statsRow(true)}</div>`;

  // ── 이력 전체 — 주 단위로 묶는다. 목록은 스크롤해도 되고, 한 줄은 잘리지 않는다 ──
  const groups = [];
  for (const s of rows) {
    const k = weekKey(s.at);
    if (!groups.length || groups[groups.length - 1].k !== k) groups.push({ k, items: [] });
    groups[groups.length - 1].items.push(s);
  }

  const day = t => { const d = new Date(t); return `${d.getMonth() + 1}.${d.getDate()}`; };
  const title = s => {
    if (s.kind === "knowledge" && s.ref === "diagnosis") return "내 추구미와 지금 매력 확인";
    if (s.kind === "item") return s.attrs?.name || String(s.ref ?? "").split(":").pop() || "옷장에 담기";
    return cell(s.ref)?.copy ?? String(s.ref ?? "");
  };
  // 잰 값이 있으면 그것이 이 줄의 주인공이다 — "사진으로 확인"보다 "눈꼬리 내려감"이 세다.
  // 값이 없을 때만 확인 표시로 물러선다.
  const under = s => {
    const m = movedLine(s.attrs);
    if (m) return `<em class="${s.evidence === "verified" ? "ok" : ""}">${esc(m)}</em>`;
    return s.evidence === "verified" ? `<em class="ok">사진으로 확인</em>` : ``;
  };
  const list = groups.map(g => `<div><p class="hist-wk">${esc(weekLabel(g.k))}</p>` +
    g.items.map(s => `<div class="hist-row"><span class="t">${esc(title(s))}${under(s)}</span>
      <span class="r">${s.gain ? `<b>+${s.gain}</b>` : ``}${s.at ? day(s.at) : ""}</span></div>`).join("") +
    `</div>`).join("");

  // 사진첩은 요약 바로 아래. 숫자로 말한 변화("우아한 6 → 16") 옆에 사진을 붙이는 자리다.
  const shots = shotsOf(photo);
  const hasCrops = !!LS.get(K.faceCrops, null);

  app.innerHTML = shell({
    top: head("한 것", `${rows.length}건`),
    body: summary + albumHTML(shots, hasCrops) + list,
    btm: `<button class="btn ghost app-only-hide" id="back">홈으로</button>`,
  });
  wireAlbum(ctx, shots);
  const b = document.getElementById("back");
  if (b) b.onclick = () => nav("home");
}

// 빈 상태 — 주어를 유저로 두지 않는다. 못 한 사람이 아니라 아직 안 쌓인 화면이다.
function empty(ctx) {
  const { app, shell, head, nav, statsRow } = ctx;
  app.innerHTML = shell({
    top: head("한 것"),
    body: `<div class="card ph-glass">
        <p class="lead">기록이 아직 한 줄도 없어요.</p>
        <p class="note">미션을 하나 마치면 그날 뭐가 얼마나 올랐는지 여기 남습니다.</p>
        ${statsRow(true)}</div>`,
    btm: `<button class="btn" id="go">오늘의 미션 보기</button>`,
  });
  const g = document.getElementById("go");
  if (g) g.onclick = () => nav("home");
}

/* 자체 점검 — 이 화면이 조용히 깨지는 방식은 둘이다: 주 묶음이 어긋나거나(일요일 경계),
   가산 합이 틀리거나. 둘 다 화면에는 "그냥 좀 이상함"으로만 보여 눈으로는 못 잡는다. */
export function historyCheck() {
  const errs = [];
  const eq = (a, b, m) => { if (a !== b) errs.push(`${m}: ${a} ≠ ${b}`); };
  // 2026-08-23(일)과 2026-08-17(월)은 같은 주다 — 일요일이 다음 주로 새지 않는다
  eq(weekKey("2026-08-23T10:00:00"), weekKey("2026-08-17T10:00:00"), "일요일이 주를 넘었다");
  // 2026-08-24(월)은 새 주다
  if (weekKey("2026-08-24T00:00:00") === weekKey("2026-08-23T23:59:00"))
    errs.push("월요일에 주가 안 넘어갔다");
  eq(weekLabel(weekKey("2026-08-25T09:00:00"), new Date("2026-08-25T09:00:00")), "이번 주", "이번 주 라벨");
  eq(weekLabel(weekKey("2026-08-18T09:00:00"), new Date("2026-08-25T09:00:00")), "지난주", "지난주 라벨");
  eq(weekLabel(""), "날짜가 없는 기록", "날짜 없는 묶음");
  // 부호가 뒤집히면 "내려갔다"를 "올라갔다"로 말하게 된다 — 화면에는 멀쩡해 보이는 종류의 거짓말이다
  eq(movedLine({ field: "eye_angle", delta: 1.4 }), "눈꼬리 올라감", "양수 방향");
  eq(movedLine({ field: "eye_angle", delta: -1.4 }), "눈꼬리 내려감", "음수 방향");
  eq(movedLine({ field: "eye_angle", delta: 0 }), null, "변화 0은 말하지 않는다");
  eq(movedLine({ field: "mouth_w", delta: 2 }), null, "사전에 없는 필드를 지어냈다");
  eq(movedLine(null), null, "attrs 없는 옛 행");
  eq(movedLine({ field: "chroma" }), null, "delta 없는 행");

  /* 사진첩 — 여기가 깨지는 방식은 셋이다: 옛 저장분이 통째로 사라지거나(v2 호환),
     웹에서 빈 액자가 뜨거나(photo_uri 없는 shot), 같은 사진이 두 번 걸리거나. */
  const DAY = 86400000, u = n => `app://local/scans/front_${n}/f000_rgb.jpg`;
  // v2 옛 저장분: 객체 하나. 사진은 없으니 사진첩은 안 서지만 **읽다가 터지면 안 된다**
  eq(shotsOf({ v: 2, ts: 1, pc: { primary: "여름 뮤트" } }).length, 0, "v2 옛 저장분에서 터졌다");
  eq(shotsOf(null).length, 0, "저장분 없는 기기");
  eq(shotsOf({ v: 3, shots: [] }).length, 0, "shots 빈 배열");
  // 웹: 측정은 있는데 사진 파일이 없다 → 액자 0개, HTML도 0줄
  eq(albumHTML(shotsOf({ v: 3, ts: 2, shots: [{ ts: 2 }, { ts: 3 }] })), "", "웹에서 빈 액자가 떴다");
  // 다만 얼굴 조각이 있으면 **지우는 문은 서야 한다** — 조각은 웹에서도 생긴다.
  // 문 없이 조각만 남기면 "기기에서 지울 수 있다"는 약속이 웹에서 거짓말이 된다.
  const cropOnly = albumHTML([], true);
  if (!cropOnly.includes("albClear")) errs.push("조각만 있는 기기에 지우는 문이 없다");
  if (cropOnly.includes("alb-i")) errs.push("걸 사진이 없는데 액자를 만들었다");
  eq(albumHTML([], false), "", "조각도 사진도 없는데 카드가 섰다");
  // 앱: 순서는 오래된 것 → 최신, 같은 파일은 한 번만
  const two = shotsOf({ v: 3, shots: [
    { ts: 9 * DAY, photo_uri: u(2) }, { ts: 2 * DAY, photo_uri: u(1) }, { ts: 9 * DAY, photo_uri: u(2) }] });
  eq(two.length, 2, "같은 사진이 두 번 걸렸다");
  eq(two[0].photo_uri, u(1), "최신이 앞에 왔다");
  eq(spanDays(two), 7, "두 시점 간격");
  eq(spanDays(two.slice(0, 1)), 0, "한 장짜리 간격");
  // 1장 = 사실 고지 / 2장 = 내보내기 권유. 문구가 상태와 어긋나면 잃을 것을 못 알린다
  if (!albumHTML(two).includes("사진첩으로 저장")) errs.push("2장인데 내보내기를 안 권했다");
  if (albumHTML(two).includes("폰을 바꾸면")) errs.push("2장 화면에 1장용 고지가 남았다");
  if (!albumHTML(two.slice(0, 1)).includes("폰을 바꾸면")) errs.push("첫 사진인데 사실 고지가 없다");
  if (!albumHTML(two).includes("서버에 올라가지 않습니다")) errs.push("상시 한 줄이 빠졌다");
  // 서버로 나갈 수 있는 유일한 통로는 track이다. 여기에 경로·세션명이 한 칸이라도
  // 끼면 헌법 §4 위반이고, 화면에는 아무 표시도 안 난다 — 그래서 칸 이름을 못 박아 둔다
  eq(Object.keys(albumStats(two)).join(","), "n_shots,span_days", "계측에 없던 칸이 생겼다");

  if (errs.length) console.error("[history] 자체 점검 실패:", errs);
  return errs;
}
