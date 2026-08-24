/* 앱 하단 탭바 — **앱 전용**. 브라우저에서는 절대 뜨지 않는다.
 *
 * 이것이 해결하는 고객 불편: 옷 색 판정·타입별 추천 같은 모듈에 들어가면 나올 길이 없었고
 * (대표 지적 2026-08-24), 홈 한 화면이 미션·프리즘·쌓인 것·도구·기록·의견·로그아웃을 전부
 * 이고 있어 "사람이 그냥 안 보는" 화면이 됐다. 기능을 탭으로 나누고, 이동은 늘 손 닿는
 * 아래쪽에 둔다. 웹은 롱폼, 앱은 숏폼 (대표 2026-08-24).
 *
 * 왜 웹 파일이 아니라 이 파일인가 — 분리 트랙. 브라우저에는 뒤로가기가 있고 탭바는
 * 앱에서만 필요하다. AppFlow.hubInject(Swift)가 이 파일을 <script>로 끼워 넣는다.
 * Swift 문자열 안에 탭바를 직접 쓰지 않은 이유: 탭 구성은 앞으로 계속 바뀌는데
 * (인벤토리 R4·오늘의 착용 R11·스탯창 R3), 그때마다 앱을 다시 빌드할 일이 아니다.
 *
 * 탭 4개 — 진단은 '장소'가 아니라 '흐름'이라 탭을 주지 않는다(홈 CTA와 도구에 있다).
 *   홈      modules/home.html#home     오늘 할 것 하나
 *   기록    modules/home.html#record   옷장·해낸 미션·쌓인 것   ← 훗날 R4 인벤토리
 *   내 결과 index.html?view=report     진단 리포트             ← 훗날 R3 스탯창
 *   도구    modules/home.html#tools    옷 색 판정·추천·영상·다시 진단·의견·계정
 *
 * 계측(데이터 운영규약 §6-1)
 *   나오는 데이터: 탭 전환 1건당 {from, to}
 *   남길 것: 어느 탭에서 어느 탭으로 갔는가 / 안 남길 것: 체류 시간(아직 판단을 안 바꾼다)
 *   어디에: events 테이블 `app_tab_switched` — home.html track()과 같은 스키마
 *   대시보드: 탭별 진입 비중 — 탭 구성이 맞는지 보는 유일한 지표
 */
(function () {
  "use strict";
  if (window.__czmTabbar) return;

  // 앱 안인가. 네이티브 브릿지가 있거나 앱 번들 스킴으로 떴을 때만 그린다.
  var inApp = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.chugumism)
              || location.protocol === "app:" || window.__CHUGU_APP === true;
  if (!inApp) return;
  window.__czmTabbar = true;

  var p = location.pathname;
  // 진단 중에는 탭바를 띄우지 않는다 — 설문·촬영은 끝까지 가는 흐름이고, 중간에 나가는
  // 문을 하단에 넓게 깔면 완주율을 깎는다. 리포트(view=report)는 목적지라 예외.
  if (/\/photo\.html$/.test(p)) return;
  if (/\/index\.html$/.test(p) && !/view=report/.test(location.search)) return;
  if (/\/(scan-measure-run|scan-analyze|lecture|batch-verify|bridge-check|poc-analyze|scan-measure-check)\.html$/.test(p)) return;

  var inModules = /\/modules\//.test(p);
  var M = inModules ? "" : "modules/";          // modules/ 안이면 형제 경로
  var ROOT = inModules ? "../" : "";            // 루트(index.html)로 올라가는 경로

  var TABS = [
    { id: "home",   label: "홈",     href: M + "home.html#home",
      d: "M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" },
    { id: "record", label: "기록",   href: M + "home.html#record",
      d: "M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h5" },
    { id: "report", label: "내 결과", href: ROOT + "index.html?view=report",
      d: "M12 3a9 9 0 1 0 9 9h-9z M12 3a9 9 0 0 1 9 9" },
    { id: "tools",  label: "도구",   href: M + "home.html#tools",
      d: "M14.7 6.3a4 4 0 0 0 5.2 5.2L15 16.4l-3.5-3.5zM10.5 13 4 19.5 6.5 22 13 15.5" },
  ];

  // 지금 어느 탭인가. home.html은 해시가 곧 탭이다(해시 없으면 홈).
  function currentId() {
    if (/view=report/.test(location.search)) return "report";
    if (/\/home\.html$/.test(p)) {
      var h = location.hash.slice(1);
      return (h === "record" || h === "tools") ? h : "home";
    }
    return "";   // cloth-check·pick 등 — 어느 탭도 켜지 않는다(여기 있다고 거짓말하지 않는다)
  }

  var SVG = "http://www.w3.org/2000/svg";
  function icon(d, on) {
    var s = document.createElementNS(SVG, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("width", "22"); s.setAttribute("height", "22");
    s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", on ? "1.9" : "1.5");
    s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round");
    var pth = document.createElementNS(SVG, "path");
    pth.setAttribute("d", d); s.appendChild(pth);
    return s;
  }

  function track(to, from) {
    try {
      var uid = localStorage.getItem("czm_uid");
      fetch("https://qngylynylgqlbidvtbci.supabase.co/rest/v1/events", {
        method: "POST", keepalive: true,     // 페이지를 떠나는 전송 — keepalive 필수
        headers: { "Content-Type": "application/json",
          apikey: "sb_publishable_bGVbZ31O7OX_rnkLVb0i5Q_SDa8JEri",
          Authorization: "Bearer sb_publishable_bGVbZ31O7OX_rnkLVb0i5Q_SDa8JEri" },
        body: JSON.stringify({ user_id: uid, event: "app_tab_switched",
                               props: { from: from, to: to }, app_version: "tabbar_v1" }),
      });
    } catch (e) {}
  }

  function build() {
    if (document.getElementById("czmTabbar")) return;
    document.body.classList.add("czm-app");

    var bar = document.createElement("nav");
    bar.id = "czmTabbar";
    bar.setAttribute("aria-label", "주요 화면");
    bar.style.cssText =
      "position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;" +
      "padding:6px 8px calc(env(safe-area-inset-bottom) + 6px);" +
      "background:rgba(255,255,255,.86);-webkit-backdrop-filter:blur(18px) saturate(1.3);" +
      "backdrop-filter:blur(18px) saturate(1.3);border-top:1px solid #E4DCE9;" +
      "font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif";

    var cur = currentId();
    TABS.forEach(function (t) {
      var on = t.id === cur;
      var a = document.createElement("a");
      a.href = t.href;
      a.setAttribute("aria-current", on ? "page" : "false");
      a.style.cssText =
        "flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;" +
        "min-height:50px;text-decoration:none;border-radius:12px;" +
        "color:" + (on ? "#9C4680" : "#8E84A0") + ";font-size:11px;font-weight:" + (on ? "700" : "500");
      a.appendChild(icon(t.d, on));
      var s = document.createElement("span"); s.textContent = t.label; a.appendChild(s);
      a.addEventListener("click", function () { if (!on) track(t.id, cur || "other"); });
      bar.appendChild(a);
    });
    document.body.appendChild(bar);

    // .screen 셸이 아닌 페이지(옷 색 판정·추천·리포트)는 바닥이 탭바에 가린다 — 그만큼 비운다.
    // 셸 페이지는 czm-ui.css의 body.czm-app 규칙이 이미 처리한다.
    if (!document.querySelector(".screen")) {
      document.body.style.paddingBottom = "calc(env(safe-area-inset-bottom) + 64px)";
    }
    // 탭바가 홈으로 가는 길을 이미 준다 — 임시로 넣었던 우측 상단 홈 버튼은 뺀다
    var hb = document.getElementById("czmHomeBtn");
    if (hb) hb.remove();
  }

  if (document.body) build();
  else document.addEventListener("DOMContentLoaded", build);
  // home.html은 한 문서 안에서 화면을 갈아끼운다 — 해시가 바뀌면 켜진 탭도 따라 바뀐다
  window.addEventListener("hashchange", function () {
    var b = document.getElementById("czmTabbar");
    if (b) { b.remove(); build(); }
  });
})();
