{
  mkShell,
  cargo,
  clippy,
  nodejs,
  rustc,
  rustfmt,
  private-terminal,
}:

mkShell {
  inputsFrom = [ private-terminal ];
  packages = [
    cargo
    clippy
    nodejs
    rustc
    rustfmt
  ];
}
