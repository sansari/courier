// Prevents additional console window on Windows in release mode
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod data;
mod yaml_emit;

use commands::{
    add_story, check_refresh_trigger, delete_story, load_magazine_story_links, load_magazines,
    load_stories, open_url, refresh_magazines, save_magazine_overrides, set_magazine_stories,
    update_story,
};

fn main() {
    let _ = dotenvy::dotenv();
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_magazines,
            refresh_magazines,
            open_url,
            save_magazine_overrides,
            check_refresh_trigger,
            load_stories,
            add_story,
            update_story,
            delete_story,
            load_magazine_story_links,
            set_magazine_stories,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
