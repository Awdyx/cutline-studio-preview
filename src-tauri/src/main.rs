// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  // CEF spawns renderer/GPU/utility processes from this binary (--type=...).
  // Must run before Tauri initializes.
  if wry::is_cef_subprocess() {
    std::process::exit(wry::run_cef_subprocess());
  }

  app_lib::run();
}
