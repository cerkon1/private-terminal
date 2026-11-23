{
  lib,
  rustPlatform,
  importNpmLock,
  cargo-tauri,
  nodejs,
  pkg-config,
  wrapGAppsHook3,
  glib-networking,
  gtk3,
  sqlite,
  webkitgtk_4_1,
}:

let
  root = ../.;
  packageJson = lib.importJSON (root + "/package.json");
in
rustPlatform.buildRustPackage {
  pname = "private-terminal";
  inherit (packageJson) version;

  src = lib.fileset.toSource {
    inherit root;
    fileset = lib.fileset.gitTracked root;
  };

  cargoRoot = "src-tauri";
  buildAndTestSubdir = "src-tauri";
  cargoLock.lockFile = root + "/src-tauri/Cargo.lock";

  npmDeps = importNpmLock { npmRoot = root; };

  nativeBuildInputs = [
    cargo-tauri.hook
    importNpmLock.npmConfigHook
    nodejs
    pkg-config
    wrapGAppsHook3
  ];

  buildInputs = [
    glib-networking
    gtk3
    sqlite
    webkitgtk_4_1
  ];

  meta = {
    inherit (packageJson) description homepage;
    license = lib.licenses.mit;
    mainProgram = "personal-terminal";
    platforms = lib.platforms.linux;
  };
}
