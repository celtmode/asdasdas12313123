//! Native, compact splash window (not fullscreen).
//!
//! A small centered window that shows loading progress without blocking
//! the main Discord window. Closes automatically when Discord is ready.

use tauri::{Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

const SPLASH_HTML: &str = r#"
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ParsCord</title>
  <style>
    :root {
      --bg: #080705;
      --panel: #1a1812;
      --gold: #d7b665;
      --gold-bright: #f0d9a0;
      --gold-dim: #a88a4a;
      --text: #fef6eb;
      --text-dim: #d9c9b0;
      --border: rgba(215,182,101,0.2);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { 
      width: 100%; height: 100%; 
      background: var(--bg); 
      color: var(--text);
      font-family: "Segoe UI Variable Display", "Segoe UI", -apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, sans-serif;
      font-size: 13px; line-height: 1.5;
      overflow: hidden;
    }
    #root {
      display: flex; flex-direction: column;
      width: 100%; height: 100%;
      padding: 20px; gap: 16px;
      background: linear-gradient(135deg, #0d0b06 0%, #15120e 50%, #0d0b06 100%);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(215,182,101,0.1);
    }
    .header { display: flex; align-items: center; gap: 12px; }
    .logo { width: 40px; height: 40px; flex-shrink: 0; }
    .title-block { display: flex; flex-direction: column; gap: 2px; }
    .title { font-size: 18px; font-weight: 700; color: var(--gold-bright); 
      background: linear-gradient(135deg, var(--gold) 0%, var(--gold-bright) 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .subtitle { font-size: 11px; color: var(--gold-dim); opacity: 0.8; }
    .progress-wrap { display: flex; flex-direction: column; gap: 8px; }
    .progress-head { display: flex; justify-content: space-between; align-items: center; }
    .status { font-size: 11px; color: var(--gold-dim); opacity: 0.7; }
    .pct { font-weight: 600; color: var(--gold-bright); font-variant-numeric: tabular-nums; }
    .track { height: 4px; background: var(--bg); border-radius: 2px; overflow: hidden; }
    .fill { height: 100%; width: 0%; background: var(--gold); border-radius: 2px; 
      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    .fill.ready { background: var(--gold-bright); }
    .steps { display: flex; flex-direction: column; gap: 6px; font-size: 11px; }
    .step { display: flex; align-items: center; gap: 8px; opacity: 0.5; transition: opacity 0.3s; }
    .step.active { opacity: 1; }
    .step.done { opacity: 0.7; }
    .step-num { color: var(--gold-dim); font-variant-numeric: tabular-nums; }
    .step-text { flex: 1; color: var(--text-dim); }
    .step-state { color: var(--gold); font-weight: 600; font-size: 10px; }
    .step.done .step-state { color: var(--gold-bright); }
    .version { font-size: 10px; color: var(--gold-dim); opacity: 0.6; text-align: right; }
  </style>
</head>
<body>
  <div id="root">
    <div class="header">
      <svg class="logo" viewBox="0 0 48 48" aria-hidden="true">
        <defs>
          <linearGradient id="lg" x1="6" y1="4" x2="42" y2="46" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#d7b665" />
            <stop offset="1" stop-color="#a88a4a" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="44" height="44" rx="12" fill="url(#lg)" />
        <rect x="3" y="3" width="42" height="42" rx="10" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="0.8" />
        <g transform="translate(24 24)" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2" stroke-linecap="round">
          <path d="M0 -12V12M-10 -6 10 6M-10 6 10 -6" />
          <path d="M0 -7 -2 -9M0 -7 2 -9M0 7 -2 9M0 7 2 9" stroke-width="1.5" opacity="0.8" />
        </g>
        <circle cx="24" cy="24" r="1.5" fill="rgba(255,255,255,0.6)" />
      </svg>
      <div class="title-block">
        <span class="title">ParsCord</span>
        <span class="subtitle">Gilded Discord Client</span>
      </div>
    </div>

    <div class="progress-wrap">
      <div class="progress-head">
        <span id="status" class="status">Initializing…</span>
        <span id="pct" class="pct">0%</span>
      </div>
      <div class="track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <div id="fill" class="fill"></div>
      </div>
    </div>

    <div class="steps" id="steps">
      <div class="step" data-pct="10"><span class="step-num">01</span><span class="step-text">Connecting to Discord</span><span class="step-state">WAIT</span></div>
      <div class="step" data-pct="30"><span class="step-num">02</span><span class="step-text">Authenticating</span><span class="step-state">WAIT</span></div>
      <div class="step" data-pct="60"><span class="step-num">03</span><span class="step-text">Starting sessions</span><span class="step-state">WAIT</span></div>
      <div class="step" data-pct="90"><span class="step-num">04</span><span class="step-text">Syncing data</span><span class="step-state">WAIT</span></div>
      <div class="step" data-pct="100"><span class="step-num">05</span><span class="step-text">Ready</span><span class="step-state">WAIT</span></div>
    </div>

    <div class="version" id="version">v__PC_VERSION__</div>
  </div>

  <script>
    const fill = document.getElementById('fill');
    const pct = document.getElementById('pct');
    const status = document.getElementById('status');
    const steps = document.querySelectorAll('.step');
    const versionEl = document.getElementById('version');

    const phases = [
      [10, 'Connecting to Discord…'],
      [30, 'Authenticating…'],
      [60, 'Starting sessions…'],
      [90, 'Syncing data…'],
      [100, 'All systems operational']
    ];

    let lastPhase = -1;

    function update(progress) {
      const p = Math.max(0, Math.min(100, progress));
      fill.style.width = p + '%';
      pct.textContent = Math.floor(p) + '%';
      fill.setAttribute('aria-valuenow', Math.round(p));

      let active = false;
      steps.forEach((row, i) => {
        const done = p >= Number(row.dataset.pct);
        const current = !done && !active;
        row.classList.toggle('done', done);
        row.classList.toggle('active', current);
        row.querySelector('.step-state').textContent = done ? 'DONE' : current ? 'NOW' : 'WAIT';
        if (current) active = true;
      });

      let idx = 0;
      for (let i = 0; i < phases.length; i++) if (p >= phases[i][0]) idx = i;
      if (idx !== lastPhase) {
        lastPhase = idx;
        status.textContent = phases[idx][1];
      }

      if (p >= 100) {
        fill.classList.add('ready');
        setTimeout(() => fill.classList.remove('ready'), 100);
      }
    }

    // Smooth animation from 0 to 98%
    const started = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - started) / 12000);
      const eased = t * t * (3 - 2 * t);
      update(6 + 92 * eased);
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // Expose update function for Rust
    window.__SPLASH_UPDATE__ = update;
  </script>
</body>
</html>
"#;

pub fn create(app: &tauri::App) -> tauri::Result<WebviewWindow> {
    let html = SPLASH_HTML.replace("__PC_VERSION__", env!("CARGO_PKG_VERSION"));

    // Write to temp file for WebView
    let path = std::env::temp_dir().join("parscord-splash.html");
    std::fs::write(&path, html.as_bytes())?;
    let url = tauri::Url::from_file_path(&path).expect("valid splash file URL");

    // Create compact non-fullscreen splash window
    let window = WebviewWindowBuilder::new(app, "splash", WebviewUrl::External(url))
        .title("ParsCord")
        .decorations(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .inner_size(380.0, 320.0)
        .center()
        .shadow(true)
        .background_color(tauri::window::Color(8, 7, 5, 255))
        .visible(true)
        .build()?;

    // Safety timeout: auto-close after 30s and show main window
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

// Called from Rust to update splash progress
pub fn update_splash_progress(app: &tauri::AppHandle, progress: f32) {
    if let Some(splash) = app.get_webview_window("splash") {
        let js = format!("window.__SPLASH_UPDATE__ && window.__SPLASH_UPDATE__({})", progress);
        let _ = splash.eval(&js);
    }
}