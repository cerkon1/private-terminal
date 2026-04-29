mod analysis;
mod commands;
mod config;
mod db;
mod indicators;
mod sources;

use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<db::Db>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env from the workspace root if present (FRED_API_KEY etc.)
    let _ = dotenvy::dotenv();
    env_logger::init();

    // Always create the default data dir — even when the user has moved
    // the DB elsewhere, the pointer file lives in the default dir.
    let data_dir = config::data_dir();
    std::fs::create_dir_all(&data_dir).expect("failed to create app data dir");
    let db_path = config::resolve_db_path();
    log::info!("opening database at {:?}", db_path);

    let db = db::Db::open(&db_path).expect("failed to open database");
    db.initialize_schema().expect("failed to initialize schema");
    db.migrate().expect("failed to run migrations");
    db.seed().expect("failed to seed database");

    // Retention pass for the news table. Runs once per app boot; bounded
    // table stays small even after months of use.
    match db.cleanup_old_news_items(30) {
        Ok(n) if n > 0 => log::info!("news retention: removed {} items older than 30 days", n),
        Ok(_) => {}
        Err(e) => log::warn!("news retention cleanup failed: {}", e),
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState { db: Mutex::new(db) })
        .invoke_handler(tauri::generate_handler![
            commands::macro_cmds::get_fred_tile,
            commands::macro_cmds::list_macro_tiles,
            commands::macro_cmds::get_fred_history,
            commands::sector_cmds::list_sector_groups,
            commands::ticker_cmds::list_ticker_tiles,
            commands::ticker_cmds::get_ticker_history,
            commands::ticker_cmds::list_market_index_quotes,
            commands::system_cmds::get_db_info,
            commands::system_cmds::get_storage_stats,
            commands::system_cmds::db_maintenance,
            commands::system_cmds::purge_orphaned_data,
            commands::system_cmds::backup_database,
            commands::system_cmds::move_database,
            commands::system_cmds::reset_database_location,
            commands::indicator_cmds::list_indicators,
            commands::indicator_cmds::get_indicator_settings,
            commands::indicator_cmds::set_indicator_setting,
            commands::indicator_cmds::compute_indicators,
            commands::indicator_cmds::scanner_snapshot,
            commands::indicator_cmds::prime_scanner_histories,
            commands::news_cmds::list_news,
            commands::news_cmds::list_news_feeds,
            commands::news_cmds::refresh_news,
            commands::feed_cmds::add_news_feed,
            commands::feed_cmds::update_news_feed,
            commands::feed_cmds::delete_news_feed,
            commands::edit_cmds::add_ticker,
            commands::edit_cmds::remove_ticker,
            commands::edit_cmds::purge_ticker,
            commands::edit_cmds::update_ticker,
            commands::edit_cmds::reorder_tickers,
            commands::edit_cmds::create_sector_group,
            commands::edit_cmds::update_sector_group,
            commands::edit_cmds::delete_sector_group,
            commands::edit_cmds::reorder_sector_groups,
            commands::session_cmds::get_session_key,
            commands::session_cmds::set_session_key,
            commands::settings_cmds::get_api_key_status,
            commands::settings_cmds::set_api_key,
            commands::settings_cmds::clear_api_key,
            commands::analysis_cmds::list_analysis_tools,
            commands::analysis_cmds::compute_correlations,
            commands::analysis_cmds::compute_yield_curve,
            commands::analysis_cmds::list_recession_segments,
            commands::analysis_cmds::list_tickers_with_coverage,
        ])
        .run(tauri::generate_context!())
        .expect("error while running personal-terminal");
}
