mod analysis;
mod commands;
mod config;
mod cross_section;
mod db;
mod indicators;
mod market_calendar;
mod sources;

use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<db::Db>,
}

/// Release builds use the Windows GUI subsystem: a panic at startup prints
/// nowhere and the app just never appears. Every boot failure goes through
/// a native message box instead.
fn fatal(message: &str) -> ! {
    log::error!("startup failed: {message}");
    rfd::MessageDialog::new()
        .set_level(rfd::MessageLevel::Error)
        .set_title("Private Terminal can't start")
        .set_description(message)
        .set_buttons(rfd::MessageButtons::Ok)
        .show();
    std::process::exit(1);
}

/// Yes/No prompt: Yes → open the default database for this session only
/// (the pointer file is left alone, so the next launch tries the moved
/// location again); No → quit.
fn offer_default_db(problem: &str, default: &std::path::Path) -> std::path::PathBuf {
    let description = format!(
        "{problem}\n\n\
         Yes — open the default database for this session only:\n{}\n\
         Changes made there will NOT be in your moved database.\n\n\
         No — quit. Reconnect the drive and start Private Terminal again.",
        default.display()
    );
    let choice = rfd::MessageDialog::new()
        .set_level(rfd::MessageLevel::Warning)
        .set_title("Private Terminal — database not available")
        .set_description(description)
        .set_buttons(rfd::MessageButtons::YesNo)
        .show();
    if choice == rfd::MessageDialogResult::Yes {
        log::warn!("using default database for this session: {:?}", default);
        default.to_path_buf()
    } else {
        std::process::exit(0);
    }
}

fn open_and_prepare(path: &std::path::Path) -> Result<db::Db, String> {
    let db = db::Db::open(path)?;
    db.initialize_schema()?;
    db.migrate()?;
    db.seed()?;
    Ok(db)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // .env is a developer convenience (FRED_API_KEY etc.). Release builds
    // don't read it, so a stray .env in a parent directory can't inject keys.
    #[cfg(debug_assertions)]
    let _ = dotenvy::dotenv();
    env_logger::init();

    // Always create the default data dir — even when the user has moved
    // the DB elsewhere, the pointer file lives in the default dir.
    let data_dir = config::data_dir();
    if let Err(e) = std::fs::create_dir_all(&data_dir) {
        fatal(&format!(
            "Couldn't create the app data folder\n{}\n\n{e}",
            data_dir.display()
        ));
    }

    let default_path = config::default_db_path();
    let db_path = match config::resolve_db_location() {
        config::DbLocation::Default(p) | config::DbLocation::Moved(p) => p,
        config::DbLocation::MovedMissing { target, default } => offer_default_db(
            &format!(
                "Your database was moved to\n{}\nbut that file isn't there (disconnected drive?).",
                target.display()
            ),
            &default,
        ),
    };
    log::info!("opening database at {:?}", db_path);

    let open_failed = |path: &std::path::Path, e: &str| {
        format!("Couldn't open the database at\n{}\n\n{e}", path.display())
    };
    let db = match open_and_prepare(&db_path) {
        Ok(db) => db,
        // A moved DB that exists but won't open (corrupt, read-only share,
        // no WAL support on the target filesystem): offer the default copy.
        Err(e) if db_path != default_path => {
            let fallback = offer_default_db(&open_failed(&db_path, &e), &default_path);
            open_and_prepare(&fallback).unwrap_or_else(|e| fatal(&open_failed(&fallback, &e)))
        }
        Err(e) => fatal(&open_failed(&db_path, &e)),
    };

    // Retention pass for the news table. Runs once per app boot; bounded
    // table stays small even after months of use.
    match db.cleanup_old_news_items(30) {
        Ok(n) if n > 0 => log::info!("news retention: removed {} items older than 30 days", n),
        Ok(_) => {}
        Err(e) => log::warn!("news retention cleanup failed: {}", e),
    }
    if let Err(e) = db.cleanup_old_pulse_snapshots(90) {
        log::warn!("pulse snapshot retention cleanup failed: {e}");
    }

    tauri::Builder::default()
        // Must be registered first. A second launch focuses the running
        // window instead of opening a second connection to the same DB
        // (two writers, and a reader that can stall WAL checkpoints).
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState { db: Mutex::new(db) })
        .invoke_handler(tauri::generate_handler![
            commands::macro_cmds::get_fred_tile,
            commands::macro_cmds::list_macro_tiles,
            commands::macro_cmds::get_fred_history,
            commands::sector_cmds::list_sector_groups,
            commands::sector_cmds::list_palette_tickers,
            commands::ticker_cmds::list_ticker_tiles,
            commands::ticker_cmds::get_ticker_history,
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
            commands::note_cmds::get_ticker_note,
            commands::note_cmds::set_ticker_note,
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
            commands::analysis_cmds::compute_pair_ratio,
            commands::analysis_cmds::compute_rrg,
            commands::analysis_cmds::compute_recession_prob,
            commands::analysis_cmds::compute_financial_conditions,
            commands::analysis_cmds::compute_regime_quadrant,
            commands::cross_section_cmds::compute_cross_section,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| fatal(&format!("{e}")));
}
