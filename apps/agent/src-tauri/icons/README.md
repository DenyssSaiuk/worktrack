# Agent icons

Generate the icon set with the Tauri CLI (run from `apps/agent`):

```bash
pnpm tauri icon ./path/to/source-icon.png
```

This produces every size required by the bundle config (`icon.ico`,
`icon.icns`, `tray.png`, plus PNG variants).

Until you produce real artwork, the bundler will fail because these files do
not yet exist. For dev runs you can put any 1024×1024 PNG at this location and
re-run `pnpm tauri icon`.
