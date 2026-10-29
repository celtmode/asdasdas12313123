use include_flate::flate;

flate!(static SPLASH: str from "./html/index.html");
flate!(static EXTRA_CSS: str from "./html/extra.css");

#[tauri::command]
pub fn get_index() -> String {
  SPLASH.to_string()
}

/// The compiled splash markup, used by the native splash window.
pub fn splash_html() -> String {
  SPLASH.to_string()
}

#[tauri::command]
pub fn get_extra_css() -> String {
  EXTRA_CSS.to_string()
}
