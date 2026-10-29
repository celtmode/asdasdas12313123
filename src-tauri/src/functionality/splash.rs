//! Native, always-on-top splash window.
//!
//! Discord draws its own boot screen inside the main webview very early and a
//! DOM overlay can end up behind it. This window is created before the main
//! window is shown, so the first thing the user sees is always our splash.
//! The main webview keeps loading Discord behind it; `finish_splash` closes
//! this window when the real interface is ready.

use tauri::{Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

const SPLASH_SCRIPT: &str = r#"
(function () {
  const $ = (id) => document.getElementById(id);
  const fill = $('progressFill');
  const track = $('progressTrack');
  const value = $('progressValue');
  const root = $('pc-root');
  const mid = $('midtitle');
  const note = $('startLabel');
  const feed = $('feedTitle');
  const session = $('sessionState');
  const conn = $('connectionLabel');
  const title = $('title');
  const release = $('releaseVersion');
  const stages = Array.from(document.querySelectorAll('.stage-row'));
  const version = '__PC_VERSION__';

  if (release) release.textContent = 'v' + version;

  const phases = [
    [0, 'Connecting to Discord...', 'Preparing cryo chamber'],
    [10, 'Localizing JS imports...', 'Warming up the JavaScript core'],
    [30, 'Loading client mod theme CSS...', 'Fusing client mod styles'],
    [48, 'Loading theme CSS...', 'Spreading a fresh coat of frost'],
    [64, 'Localizing CSS imports...', 'Frosting the interface'],
    [78, 'Getting injection JS...', 'Assembling the ice core'],
    [90, 'Waiting for Discord...', 'Handshaking with the gateway']
  ];

  let lastPhase = -1;

  function paint(next) {
    const progress = Math.max(0, Math.min(98, next));

    if (fill) fill.style.width = progress + '%';
    if (value) value.textContent = Math.floor(progress) + '%';
    if (track) {
      track.setAttribute('aria-valuenow', String(Math.round(progress)));
      track.setAttribute('aria-valuetext', Math.floor(progress) + '% - loading');
    }
    if (root) root.style.setProperty('--pc-progress', String(progress));

    let active = false;
    for (const row of stages) {
      const done = progress >= Number(row.dataset.complete);
      const current = !done && !active;
      row.classList.toggle('is-done', done);
      row.classList.toggle('is-active', current);
      const state = row.querySelector('.stage-state');
      if (state) state.textContent = done ? 'DONE' : current ? 'NOW' : 'WAIT';
      if (current) active = true;
    }

    let index = 0;
    for (let i = 0; i < phases.length; i++) if (progress >= phases[i][0]) index = i;
    if (index !== lastPhase) {
      lastPhase = index;
      if (mid) mid.textContent = phases[index][1];
      if (note) note.textContent = phases[index][2];
      if (feed) feed.textContent = phases[index][1].replace(/[.]+$/, '');
      if (conn) conn.textContent = 'LOADING';
      if (session) session.textContent = 'In progress';
    }
  }

  let typed = '';
  const typing = setInterval(() => {
    typed = 'ParsCord'.slice(0, typed.length + 1);
    if (title) title.innerHTML = typed + '|';
    if (typed.length === 'ParsCord'.length) clearInterval(typing);
  }, 80);

  const started = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - started) / 10000);
    const eased = t * t * (3 - 2 * t);
    paint(6 + 92 * eased);
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // A quiet escape hatch in case Discord never becomes ready.
  const hint = document.createElement('div');
  hint.textContent = 'Esc to skip';
  hint.style.cssText =
    'position:fixed;right:22px;bottom:18px;z-index:2147483647;pointer-events:none;' +
    'font:10px/1 "Segoe UI",system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;' +
    'color:rgba(240,217,160,.5)';
  document.body.appendChild(hint);

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Escape') window.close();
  });
})();
"#;

pub fn create(app: &tauri::App) -> tauri::Result<WebviewWindow> {
  let splash = crate::injection::local_html::splash_html();
  let script = SPLASH_SCRIPT.replace("__PC_VERSION__", env!("CARGO_PKG_VERSION"));
  let html = format!(
    "<!doctype html><html><head><meta charset=\"utf-8\"><style>html,body{{margin:0;width:100%;height:100%;overflow:hidden;background:#080604}}</style></head><body><div id=\"loadingContainer\" style=\"position:fixed;inset:0;z-index:2147483647\">{splash}</div><script>{script}</script></body></html>"
  );

  // Tauri rejects `data:` URLs unless the `webview-data-url` feature is on,
  // and the last portable build failed with that exact error so the splash
  // never appeared. A temp file:// URL is allowed and keeps the same HTML.
  let path = std::env::temp_dir().join("parscord-splash.html");
  std::fs::write(&path, html.as_bytes())?;
  let url = tauri::Url::from_file_path(&path).expect("valid splash file URL");

  let window = WebviewWindowBuilder::new(app, "splash", WebviewUrl::External(url))
    .title("ParsCord")
    .decorations(false)
    .resizable(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .fullscreen(true)
    .shadow(false)
    .background_color(tauri::window::Color(8, 7, 5, 255))
    .visible(true)
    .build()?;

  // Never leave the user trapped behind the splash if the main webview fails.
  let handle = app.handle().clone();
  std::thread::spawn(move || {
    std::thread::sleep(std::time::Duration::from_secs(30));

    if let Some(splash) = handle.get_webview_window("splash") {
      let _ = splash.close();
    }

    if let Some(main) = handle.get_webview_window("main") {
      let _ = main.show();
      let _ = main.set_focus();
    }
  });

  Ok(window)
}
