// 익명 세션 — 방문 즉시 진짜 auth.uid()를 발급받는다
// 근거: docs/superpowers/specs/2026-08-16-app-foundation-v1-design.md §2-1
//
// 왜 익명 로그인인가: own_read 정책이 authenticated 역할만 본다. Supabase 익명 로그인은
// 가입하지 않은 방문자에게도 authenticated 역할의 JWT를 준다 — 그래서 "나중에 할게요"를
// 누른 유저와 애플로 가입한 유저가 같은 조회 경로를 쓴다. 코드가 한 벌로 끝난다.
//
// ⚠ 계정 승급의 경계 (Phase 2에서 풀 것)
//   익명 → 정식 전환은 linkIdentity/updateUser로 **같은 uid를 유지한 채** 해야 한다.
//   새 uid로 로그인하면 claim_anon이 거부한다(auth_id is null 조건) — 남의 이력을 못 가져가게
//   막는 장치가 자기 이력에도 걸리는 것이다. 다른 기기에서 처음 로그인하는 경우의 병합은
//   별도 설계가 필요하다. 지금 구조는 그것을 막지 않고 미뤄둘 뿐이다.

const URL_ = "https://qngylynylgqlbidvtbci.supabase.co";
const KEY  = "sb_publishable_bGVbZ31O7OX_rnkLVb0i5Q_SDa8JEri";
// 공개 카탈로그(콘텐츠) 조회용. 키 문자열을 두 파일에 두지 않으려고 여기서만 내보낸다.
export const PUBLIC = { url: URL_, key: KEY };
const SKEY = "czm_session";
const MARGIN_S = 60;   // 만료 직전에 요청이 출발하면 401이 난다

const load = () => { try { return JSON.parse(localStorage.getItem(SKEY)) } catch { return null } };
const save = s => { try { localStorage.setItem(SKEY, JSON.stringify(s)) } catch {} };

async function authPost(path, body){
  const r = await fetch(`${URL_}/auth/v1/${path}`, {method:"POST",
    headers:{"Content-Type":"application/json", apikey:KEY}, body:JSON.stringify(body)});
  if (!r.ok) throw new Error(`auth ${path} ${r.status} ${await r.text()}`);
  return r.json();
}

const shape = j => ({ token:j.access_token, refresh:j.refresh_token,
                      uid:j.user?.id, exp:(j.expires_at ?? 0) });

/**
 * 유효한 세션을 돌려준다. 만료됐으면 갱신하고, **없으면 null**이다.
 * 2026-08-17 대표 결정으로 가입이 관문이 되면서 익명 세션 자동 발급을 뺐다 —
 * 이제 세션이 있다는 것은 곧 정식 계정이라는 뜻이고, 그래서 익명→정식 이력 병합 문제가 사라졌다.
 */
export async function getSession(){
  const now = Math.floor(Date.now()/1000);
  let s = load();
  if (s?.token && s.exp - MARGIN_S > now) return s;
  if (s?.refresh) {
    try { s = shape(await authPost("token?grant_type=refresh_token", {refresh_token:s.refresh}));
          save(s); return s; }
    catch(e){ console.warn("세션 갱신 실패 — 다시 로그인해야 한다", e); localStorage.removeItem(SKEY); }
  }
  return null;
}

export const isSignedIn = () => {
  const s = load();
  return !!(s?.token && s.exp - MARGIN_S > Math.floor(Date.now()/1000)) || !!s?.refresh;
};

export function signOut(){ try { localStorage.removeItem(SKEY); } catch(e){} }

/** 소셜 로그인 — 브라우저를 카카오로 보낸다. 돌아오면 주소 뒤에 토큰이 붙어 온다. */
export function oauthStart(provider, redirectTo = location.href.split("#")[0]){
  // 같은 탭 표식 — 로그인에서 돌아온 페이지가 "웹에서 시작한 로그인"임을 알게 한다.
  // 앱의 로그인 창은 새 컨텍스트라 이 표식이 없고, home.html이 그 차이로 앱 반송을 판단한다.
  try { sessionStorage.setItem("czm_oauth_web", "1"); } catch(e){}
  location.href = `${URL_}/auth/v1/authorize?provider=${encodeURIComponent(provider)}`
                + `&redirect_to=${encodeURIComponent(redirectTo)}`;
}

/**
 * 로그인에서 돌아온 직후 주소(#access_token=...)에서 세션을 건져 저장한다.
 * 주소는 바로 지운다 — 토큰이 주소창·기록·공유 링크에 남으면 그 자체가 유출이다.
 */
export function captureRedirect(){
  const h = new URLSearchParams(location.hash.replace(/^#/, ""));
  const token = h.get("access_token");
  if (!token) return h.get("error_description") ? { error: h.get("error_description") } : null;
  const s = { token, refresh: h.get("refresh_token"),
              exp: Math.floor(Date.now()/1000) + (+(h.get("expires_in") ?? 3600)) };
  save(s);
  history.replaceState(null, "", location.pathname + location.search);
  // type은 이 진입에서만 쓰고 저장하지 않는다 — recovery로 돌아왔으면 화면이
  // 새 비밀번호를 받아야 한다. 그냥 통과시키면 잊어버린 비밀번호가 그대로 남는다.
  return { ...s, type: h.get("type") };
}

/* ── 이메일 + 비밀번호 ────────────────────────────────────────────
   매직링크(otp)를 걷어낸 자리다. 링크 방식은 **재방문 로그인마다** 메일 왕복을 시킨다 —
   화면 배치를 아무리 고쳐도 그 왕복은 없어지지 않는다(대표 지적 2026-08-25 판단 근거).

   ⚠ 비밀번호는 이 파일 밖으로 나가지 않는다. 저장하지 않고, 로그에 찍지 않고,
     실패해도 입력값을 메시지에 싣지 않는다. 아래 catch가 e.message를 넘기는데
     그 문자열은 authPost가 만든 "경로+상태코드+**응답** 본문"이라 요청 본문이 없다.

   ⚠ 가입은 Supabase의 이메일 확인 설정에 따라 두 갈래다.
     확인 ON(기본) → 세션 없이 확인 메일이 나간다 · 확인 OFF → 즉시 세션.
     화면은 둘 다 감당해야 한다(session 플래그로 구분해 돌려준다). */

export async function signUpPassword(email, password, redirectTo = location.href.split("#")[0]){
  try {
    const j = await authPost(`signup?redirect_to=${encodeURIComponent(redirectTo)}`, {email, password});
    if (j.access_token) { save(shape(j)); return {ok:true, session:true}; }
    return {ok:true, session:false};             // 확인 메일이 나갔다
  } catch(e){ return {ok:false, why:e.message}; }
}

export async function signInPassword(email, password){
  try { save(shape(await authPost("token?grant_type=password", {email, password}))); return {ok:true}; }
  catch(e){ return {ok:false, why:e.message}; }
}

/** 재설정 메일. 링크를 누르면 #type=recovery로 돌아오고, 그때 setPassword를 부른다. */
export async function sendRecover(email, redirectTo = location.href.split("#")[0]){
  try { await authPost(`recover?redirect_to=${encodeURIComponent(redirectTo)}`, {email}); return true; }
  catch(e){ return false; }
}

/** 새 비밀번호로 갈아끼운다. 재설정 링크로 받은 세션이 있어야 한다. */
export async function setPassword(password){
  let s; try { s = await getSession(); } catch(e){ return false; }
  if (!s) return false;
  const r = await fetch(`${URL_}/auth/v1/user`, {method:"PUT",
    headers:{"Content-Type":"application/json", apikey:KEY, Authorization:`Bearer ${s.token}`},
    body:JSON.stringify({password})});
  if (!r.ok) { console.warn("setPassword", r.status); return false; }   // 응답 본문도 안 찍는다
  return true;
}

/** 인증된 요청. 실패해도 던지지 않고 null을 준다 — 화면이 조회 실패로 무너지지 않게. */
export async function sbFetch(path, opts = {}){
  let s;
  try { s = await getSession(); } catch(e){ console.warn("세션 조회 실패", e); return null; }
  if (!s) return null;   // 로그인 전이다. 조용히 넘어간다 — 화면이 이걸로 무너지지 않는다
  const r = await fetch(`${URL_}/rest/v1/${path}`, {...opts,
    headers:{"Content-Type":"application/json", apikey:KEY,
             Authorization:`Bearer ${s.token}`, ...(opts.headers||{})}});
  if (!r.ok) { console.warn("sbFetch", path, r.status, await r.text()); return null; }
  return r.status === 204 ? true : r.json().catch(() => true);
}

/**
 * app_users 행이 없으면 만든다.
 * 이 행이 없으면 stat_entries·quest_offers가 전부 FK 위반(409)으로 튕기고,
 * 유저는 아무 설명 없이 영영 비어 있는 앱을 보게 된다. 진단을 index.html 밖에서
 * 시작한 경로가 하나라도 생기면 바로 그 상태가 되므로 매 진입에서 보장한다.
 *
 * ⚠ 업서트(Prefer: resolution=ignore-duplicates)를 쓰지 않는다.
 *   PostgREST의 업서트는 ON CONFLICT 경로라 UPDATE 정책을 요구하는데, 이 표들은
 *   insert 전용으로 설계돼 UPDATE 정책이 없다 → 42501로 튕긴다.
 *   그냥 insert하고 중복키(409)를 "이미 있다"로 읽는 것이 맞다.
 */
export async function ensureUser(uid){
  if (!uid) return false;
  let s; try { s = await getSession(); } catch(e){ return false; }
  if (!s) return false;
  const r = await fetch(`${URL_}/rest/v1/app_users`, {method:"POST",
    headers:{"Content-Type":"application/json", apikey:KEY,
             Authorization:`Bearer ${s.token}`, Prefer:"return=minimal"},
    // source: 초대 링크 ?src= 가 있으면 그 값(계약층 CZM.srcTag, sessionStorage 보관). 이 행이 로그인 때
    // 먼저 만들어져 index.html의 app_users insert가 409로 끝나므로, 여기서 안 실으면 v_diagnoses_tagged가
    // 초대 유저를 영영 못 잡는다(2026-09-04). 첫 접촉 기준 — 이미 있는 행은 안 바뀐다.
    body:JSON.stringify({id:uid, source:(globalThis.CZM && CZM.srcTag && CZM.srcTag()) || "app", app_version:"home_v1"})});
  if (r.ok || r.status === 409) return true;   // app_users엔 FK가 없으므로 409 = 중복키 = 이미 있다
  console.warn("ensureUser", r.status, await r.text());
  return false;
}

/** 이 기기의 익명 uid(app_users.id)를 현재 계정에 묶는다. 이미 묶였으면 아무 일도 없다. */
export async function linkUid(uid){
  if (!uid) return false;
  return await sbFetch("rpc/claim_anon", {method:"POST", body:JSON.stringify({p_uid:uid})}) !== null;
}

/**
 * 익명 계정에 이메일을 붙여 정식 계정으로 승급한다 — **uid가 그대로 유지된다.**
 * 새로 로그인(signup/signInWithOtp)하면 다른 uid가 발급되어 지금까지의 이력이 끊긴다.
 * 승급은 반드시 이 경로여야 한다.
 */
export async function attachEmail(email){
  let s; try { s = await getSession(); } catch(e){ return false; }
  if (!s) return false;
  const r = await fetch(`${URL_}/auth/v1/user`, {method:"PUT",
    headers:{"Content-Type":"application/json", apikey:KEY, Authorization:`Bearer ${s.token}`},
    body:JSON.stringify({email})});
  if (!r.ok) { console.warn("attachEmail", r.status, await r.text()); return false; }
  return true;
}

/** 내 계정으로 묶인 모든 uid의 스탯. own_read가 걸러주므로 user_id 조건을 붙이지 않는다.
 *  id·attrs가 같이 온다 — 옷장(인벤토리)이 아이템을 지목하려면 id가, 착용 태그를 표시 시점에
 *  만들려면 attrs.color가 필요하다(스키마 §2-1: 태그는 저장하지 않는다). */
export async function fetchStats(){
  // gain·gain_type을 같이 가져온다 — 이게 빠지면 로그인해서 동기화한 순간 캐릭터 시트의
  // 성장분이 통째로 사라진다(화면이 서버 사본을 원천으로 삼기 때문).
  // removed_at 필터도 뺐다: 옷을 버려도 그 옷을 갖게 된 **사건**은 일어났고, 영구 가산은
  // 내려가지 않는다(산식 §4-1 · 초안_미션가산매핑 §6-1). 버린 옷을 옷장에서 감추는 것은
  // 화면 쪽 일이라 옷장 목록에서 걸러낸다.
  return await sbFetch("stat_entries?select=id,kind,ref,slot,attrs,acquired_at,removed_at,gain,gain_type,evidence&order=acquired_at");
}

/** 옷장에서 버리기 — removed_at을 채우는 유일한 경로(스키마 §2-5).
 *  영구 가산은 안 내려간다(버려도 그 옷을 갖게 된 사건은 일어났다). 오늘 입을 후보에서만 빠진다. */
export async function removeStat(id){
  return await sbFetch("rpc/stat_remove", {method:"POST", body:JSON.stringify({p_entry:id})}) !== null;
}

/** RPC 호출 — 반환값을 그대로 돌려준다. 실패하면 null.
 *
 *  ⚠ sbFetch를 쓰지 않는다. 그쪽은 **로그인 세션이 없으면 조용히 null을 돌려준다**(L130).
 *    친구 설문은 로그인 전에도 돌아야 하고(진단만 하고 계정을 안 만든 유저가 다수다),
 *    친구 쪽은 아예 계정이 없다. 그래서 익명 키로 직접 친다.
 *    보안은 여기가 아니라 서버가 맡는다 — 테이블 RLS 정책이 0건이라 직접 접근은 전부 막혀 있고,
 *    RPC 셋(SECURITY DEFINER)만이 통로다. 익명 키로 열 수 있는 것은 그 셋뿐이다.
 *  로그인한 유저는 토큰을 얹어 보낸다 — 서버가 누가 불렀는지 알 수 있으면 아는 편이 낫다. */
/** 배열을 통째로 받는 RPC. friend_results처럼 여러 행이 오는 것은 이쪽을 쓴다.
 *  sbRpc는 첫 행만 돌려주므로 응답 목록에는 못 쓴다. */
export async function sbRpcAll(fn, body){
  const j = await sbRpcRaw(fn, body);
  return Array.isArray(j) ? j : (j == null ? [] : [j]);
}

export async function sbRpc(fn, body){
  const j = await sbRpcRaw(fn, body);
  return Array.isArray(j) ? (j.length ? j[0] : null) : j;
}

async function sbRpcRaw(fn, body){
  let auth = KEY;
  try{ const s = await getSession(); if(s?.token) auth = s.token; }catch(e){}
  try{
    const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
      method:"POST",
      headers:{"Content-Type":"application/json", apikey:KEY, Authorization:`Bearer ${auth}`},
      body: JSON.stringify(body)});
    if(!r.ok){ console.warn("sbRpc", fn, r.status, await r.text()); return null; }
    return await r.json().catch(() => null);
  }catch(e){ console.warn("sbRpc 실패", fn, e); return null; }
}

/* ── 처음부터 다시 하기 (2026-08-26 · 대표 설계) ────────────────────────────
   "우리 최초측정이 바뀌면 안되기때문에 최초측정을 다시하는 재측정은 아예 리셋을 하고
    다시 하는 개념이야 캐릭터삭제하고 다시만드는 개념. 그래서 설정에 재측정이 들어간거고."

   왜 부분 갱신이 아니라 리셋인가 — **최초 측정이 성장의 기준선이기 때문이다.**
   기준선이 움직이면 "얼마나 자랐나"가 말이 안 된다. 그래서 다시 재고 싶으면
   기준선째로 새로 세운다. 게임에서 캐릭터를 지우고 새로 만드는 것과 같다.

   ⚠ 그럼 변화는 무엇이 재는가 — **친구 설문이다**(대표 확정).
     "이미지변화 매력변화는 타인이 봤을때 느껴져야하는 부분이니 그걸 지인체크를 통해 하자는거지."
     재측정은 변화 측정 수단이 아니다. 그 역할이 친구 설문으로 넘어갔다.

   범위: **최초 설치 상태**(대표 2026-08-26). 로컬 키를 하나도 남기지 않는다 —
   czm_uid도, 로그인 토큰도, 소개 화면을 봤다는 표시도 함께 지운다.
   전에는 czm_uid를 남겼다. 계측(누가 다시 시작했나)을 얻는 대신 유저에게 "처음"을
   못 준 셈이었다 — 소개도 안 뜨고 로그인도 그대로였다. 대표 지시가 이 저울을 정했다.
   서버 데이터는 지우지 않는다. 그것까지 지우는 것은 회원탈퇴(deleteAccount)의 일이고,
   둘을 나눠 둔 이유는 "다시 하고 싶다"와 "그만두겠다"가 다른 뜻이기 때문이다. */
/* 기기를 최초 설치 상태로 되돌린다 (대표 지시 2026-08-26: "완전히 앱 최초설치상태로").
   전에는 czm_uid를 남겼다 — 서버에 쌓인 것과 이어두려던 것인데, 그러면 소개 화면도
   안 뜨고 로그인도 그대로라 "처음"이 아니었다. 신분증째로 버린다: 다음 실행은 새 사람이다.
   ⚠ 서버 기록은 그대로 남는다. 그것까지 지우는 것은 회원탈퇴(deleteAccount)다. */
export function resetAll(){
  const removed = [];
  try{
    // 우리 키만 지운다. 다른 앱·확장이 같은 오리진에 둔 것을 건드리지 않는다.
    for(const k of Object.keys(localStorage)){
      if(/^(chugu_|czm_|aim_logs)/.test(k)){ localStorage.removeItem(k); removed.push(k); }
    }
    // 세션 저장소도 비운다 — 강의 흐름 마커(czm_lec_*)가 남으면 다음 진단이 그 상태를 물려받는다.
    sessionStorage.clear();
  }catch(e){ /* 저장소가 막힌 환경에서도 아래 이동은 해야 한다 */ }
  return removed;
}

/* 회원탈퇴 (대표 지시 2026-08-26). 초기화와 다른 점은 하나 — **서버 기록까지 지운다.**
   events만 남기되 user_id를 지워 익명 행으로 만든다: 퍼널·리텐션 집계의 분모라
   행이 사라지면 지난 코호트 수치가 흔들린다. 익명 행은 더는 그 사람을 가리키지 않는다.
   서버가 실패하면 기기를 지우지 않는다 — 화면에서만 사라지고 서버엔 남는 상태가
   유저에게는 "지웠다고 했는데 안 지워진 것"이라, 그 조합이 가장 나쁘다. */
export async function deleteAccount(){
  const uid = localStorage.getItem("czm_uid");
  if(!uid) return {ok:true, skipped:"no_uid"};   // 서버에 아무것도 없다
  const r = await sbRpc("account_delete", {p_user: uid});
  if(!r || r.ok !== true) return {ok:false};
  resetAll();
  return {ok:true, ...r};
}
