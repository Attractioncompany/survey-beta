// 「나」 탭 — 캐릭터 시트.
// home.html이 CTX 꾸러미를 넘긴다: app·shell·head·esc·nav·track·LS·K·DICT·CZMStats·TCOLOR
//   diag·photo·tName·cell·statNow·USER·statsRow·downBanner·STATS(getter)·loadScan()
// 여기서 산식을 다시 짜지 않는다 — 숫자는 czm-stats.js(CTX.CZMStats)가 소유한다.
//
// 이것이 해결하는 고객 불편: RPG의 중심 화면인데 없었다. 숫자가 보이는 자리가
// 미션 완료 직후 "6 → 7" 한 줄뿐이라, 자기가 자라고 있다는 감각을 받을 데가 없었다.
//
// 그림 코드는 index.html statSheetPage()에서 가져왔다(새로 그리지 않았다).
// 그쪽은 1회성 결과지 안의 한 절이고 여기는 상시로 보는 탭이다 — 차트에는 라벨만 두고
// 숫자는 아래 목록이 맡는다(탭해서 숫자를 켜는 토글이 필요 없어졌다).
//
// 계측 (데이터 운영규약 §6-1)
//   나오는 데이터: 시트 진입 1건당 {has_base, grown, worn}
//   남길 것: 출발선이 있었는가 · 그 시점 성장 총량 · 착용분 합 — 착용 효과가 실제로 보이는
//     빈도는 이 worn으로만 알 수 있다(신규 이벤트는 안 만든다 — 기존 sheet_shown에 한 칸)
//   / 안 남길 것: 8타입 값 자체(diagnoses에 이미 있다) · 착용 슬롯 구성(daily_outfits에 이미 있다)
//   어디에: events 테이블 `sheet_shown`
//   대시보드: 성장 0인 채 시트를 보는 비율 — "뭘 하려는지 안다"가 통했는지 여기서 읽힌다

// 축 배치는 좌표계 그대로 — 위 Soft · 아래 Deep · 왼쪽 Warm · 오른쪽 Cool (index.html과 같은 순서)
const RING = ["pure", "elegant", "chic", "charisma", "gorgeous", "classic", "romantic", "energetic"];
const CX = 190, CY = 145, R = 110;

/* 방사형 8각. st=표시 스탯 · base=출발선(없으면 점선을 안 그린다) · names={키:표시명} */
function radar(st, base, up, names) {
  // 눈금은 최댓값에 맞춰 늘리되 하한 12 — 봉우리 하나가 그림을 다 먹지 않게(index.html과 같은 값)
  const max = Math.max(12, ...RING.map(k => st[k] || 0));
  const pt = (i, v) => { const a = (-90 + i * 45) * Math.PI / 180, r = (v / max) * R;
                         return [CX + Math.cos(a) * r, CY + Math.sin(a) * r]; };
  const poly = get => RING.map((k, i) => pt(i, get(k)).map(n => n.toFixed(1)).join(",")).join(" ");

  let grid = "", lab = "";
  [.25, .5, .75, 1].forEach(f => { grid += `<polygon class="ring${f === 1 ? " base" : ""}" points="${poly(() => max * f)}"/>`; });
  RING.forEach((k, i) => {
    const p = pt(i, max), a = (-90 + i * 45) * Math.PI / 180;
    grid += `<line class="spoke" x1="${CX}" y1="${CY}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}"/>`;
    const lx = CX + Math.cos(a) * (R + 20), ly = CY + Math.sin(a) * (R + 20);
    const anc = Math.abs(Math.cos(a)) < .3 ? "middle" : (Math.cos(a) > 0 ? "start" : "end");
    lab += `<text class="tlab" x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="${anc}">${names[k]}</text>`;
  });

  return `<div class="statsheet"><svg viewBox="0 0 380 300" role="img" aria-label="8타입 스탯 방사형 차트">
    <defs><radialGradient id="csFill2" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#B76BA3" stop-opacity=".38"/>
      <stop offset="100%" stop-color="#9CC8E8" stop-opacity=".26"/></radialGradient></defs>
    ${grid}
    ${up > 0 && base ? `<polygon class="poly-ghost" points="${poly(k => base[k] || 0)}"/>` : ``}
    <polygon class="poly" points="${poly(k => st[k] || 0)}"/>
    ${lab}
  </svg></div>`;
}

export function renderSheet(ctx) {
  const { app, shell, head, esc, nav, track, CZMStats, TCOLOR, diag, tName, statNow } = ctx;
  const gains = CZMStats.gainsOf(ctx.STATS);
  const up = CZMStats.sum(gains);
  /* 오늘 확정 차림의 착용분(배선 2026-09-04) — 이 탭만 statNow(equipped)로 받는다.
     표시 스탯 = 초기 + 영구 가산 + 착용 효과(산식 §3-3). 착용분은 벗으면 빠지는 값이라
     이력·완료 직후 화면은 계속 영구분만 말한다 — 여기서만 얹고, 얹었다고 아래에서 밝힌다. */
  const eq = ctx.equipped ? ctx.equipped() : null;
  const worn = eq ? CZMStats.sum(CZMStats.equipEffect(eq)) : 0;
  // 출발선이 없는 옛 진단에서는 null이 온다 — 그때는 없는 기준선을 지어내지 않는다.
  const st = statNow(eq);
  track("sheet_shown", { has_base: st ? 1 : 0, grown: up, worn });

  const nm = k => esc(tName(k));
  const row = (k, val, g) => `<div class="trow"><i style="background:${TCOLOR[k] || "var(--prism-purple)"}"></i>
    <span>${nm(k)}</span>${val === null ? `` : `<b>${val}</b>`}${g ? `<em>+${g}</em>` : ``}</div>`;

  // 아래로 가는 문. 2026-08-26: 「재진단·의견·계정」 줄은 뺐다 — 설정이 우측 상단 톱니로
  // 올라갔고, 같은 문을 두 자리에 두면 어느 쪽이 진짜인지 헷갈린다.
  // 대신 「볼 만한 영상」이 여기로 왔다(설정 서랍에 있던 것). 내 타입을 아는 화면의 일이다.
  const doors = `<a class="btn ghost" href="../index.html?view=report">진단 리포트 다시 보기</a>
    ${diag ? `<button class="btn quiet" id="toVid">내 타입 쪽 영상 보기</button>` : ``}`;
  const draw = (body, btm = doors) => {
    app.innerHTML = shell({ top: head("스탯", "", true), body, btm });
    const v = document.getElementById("toVid");
    if (v) v.onclick = () => nav("content");
  };

  if (!diag) {
    return draw(`<div class="card ph-glass"><p class="lead">아직 측정한 것이 없어요.</p>
      <p class="note">진단을 마치면 여기에 여덟 칸짜리 그림이 생깁니다. 미션을 해낼 때마다 그 칸이 밖으로 나가요.</p></div>`,
      `<a class="btn" href="../index.html?view=start">진단 시작하기</a>`);
  }

  if (!st) {
    // 출발선이 없다. 지금 값을 만들 수 없으니 오른 양만 말한다.
    const rows = Object.keys(gains).filter(k => gains[k]).sort((a, b) => gains[b] - gains[a])
      .map(k => row(k, null, gains[k])).join("");
    return draw(`<div class="card ph-glass"><p class="lead">지금까지 오른 만큼만 보여요.</p>
      <p class="note">출발선이 이 기기에 남아 있지 않아 지금 모양은 못 그렸습니다. 다시 진단하면 여덟 칸이 채워져요.</p>
      ${rows ? `<div class="tgrid" style="margin-top:var(--sp-4)">${rows}</div>`
             : `<p class="note">아직 오른 건 없어요.</p>`}</div>`);
  }

  // 몰린 쪽 — "높다/낮다"가 아니라 "어디에 몰려 있나"다. 다른 사람과 견주지 않는다(헌법 §4).
  // 30을 여덟 칸에 정수로 나누면 1위가 둘 이상으로 떨어지는 일이 흔해서, 동점이면 동점으로 적는다.
  const best = Math.max(...CZMStats.TKEYS.map(k => st[k]));
  const peers = CZMStats.TKEYS.filter(k => st[k] === best).map(k => `<b>${nm(k)}</b>`).join("·");
  const order = CZMStats.TKEYS.slice().sort((a, b) => st[b] - st[a] || RING.indexOf(a) - RING.indexOf(b));

  draw(`<div class="card ph-glass snap">
      ${radar(st, diag.base_stats, up, Object.fromEntries(CZMStats.TKEYS.map(k => [k, nm(k)])))}
      <p class="lead">지금은 ${peers} 쪽으로 몰려 있어요.</p>
      <p class="note">${up > 0
        ? `점선이 진단 직후 모양입니다. 미션으로 ${up}만큼 밖으로 나갔어요.`
        : `총 30을 여덟 칸에 나눠 가진 모양입니다. 미션을 하나 마칠 때마다 그쪽 칸이 밖으로 나가요.`}${
        worn > 0 ? ` 오늘 차림 몫 +${worn}도 함께 얹힌 그림입니다.` : ``}</p>
    </div>
    <div class="tgrid snap">${order.map(k => row(k, st[k], gains[k])).join("")}</div>`);
}
