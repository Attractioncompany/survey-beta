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
  return s;
}

/** 이메일로 로그인·가입 (같은 입구다 — 링크를 눌러야 들어온다) */
export async function emailLink(email, redirectTo = location.href.split("#")[0]){
  try { await authPost(`otp?redirect_to=${encodeURIComponent(redirectTo)}`,
                       { email, create_user: true }); return true; }
  catch(e){ console.warn("emailLink", e); return false; }
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
    body:JSON.stringify({id:uid, source:"app", app_version:"home_v1"})});
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
