// ================================================================
// auth.js — my-tools 共通認証ヘルパー
// 読み込み順は必ずこの順番にしてください:
//   1. supabase-js (CDN)
//   2. config.js   (SUPABASE_URL / SUPABASE_ANON_KEY)
//   3. auth.js     (このファイル)
// ================================================================

var _sb = null;

// Supabaseクライアントを取得(初回だけ生成、以後は使い回し)
function getClient() {
  if (!_sb) _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _sb;
}

// 未ログインならログインページへリダイレクトする
// loginPath: login.html への相対パス。省略時は1階層上(../login.html)を想定
// 各アプリの <script> 先頭で `requireAuth();` と呼ぶだけでOK
async function requireAuth(loginPath) {
  loginPath = loginPath || '../login.html';
  var result = await getClient().auth.getSession();
  if (!result.data.session) {
    window.location.href = loginPath + '?redirect=' + encodeURIComponent(window.location.href);
    return null;
  }
  return result.data.session;
}

// ログアウトしてログインページへ戻す
// 設定画面などに「ログアウト」ボタンを置く場合に使う
// 再ログイン後、元いたアプリに戻れるよう現在地をredirectパラメータとして渡す
async function signOutAndRedirect(loginPath) {
  loginPath = loginPath || '../login.html';
  var returnTo = window.location.href;
  await getClient().auth.signOut();
  window.location.href = loginPath + '?redirect=' + encodeURIComponent(returnTo);
}
