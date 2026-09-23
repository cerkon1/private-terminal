// Injected at build time from package.json by vite.config.ts `define`.
// Release bumps touch package.json, src-tauri/Cargo.toml and
// src-tauri/tauri.conf.json — this file no longer needs editing.
declare const __APP_VERSION__: string;

export const APP_VERSION: string = __APP_VERSION__;
