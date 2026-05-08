/**
 * Build the extension for chrome and/or firefox. Outputs:
 *   dist-chrome/  — manifest.json (chromium variant), background.js, popup/*
 *   dist-firefox/ — manifest.json (gecko variant), background.js, popup/*
 *
 * Usage:
 *   pnpm build:chrome
 *   pnpm build:firefox
 *   pnpm build  (both)
 */
import { existsSync } from 'node:fs';
import { copyFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

type Target = 'chrome' | 'firefox';

async function main(): Promise<void> {
  const arg = process.argv[2];
  const targets: Target[] =
    arg === 'chrome' ? ['chrome'] : arg === 'firefox' ? ['firefox'] : ['chrome', 'firefox'];

  for (const target of targets) {
    const out = join(ROOT, `dist-${target}`);
    await rm(out, { recursive: true, force: true });
    await mkdir(out, { recursive: true });
    await mkdir(join(out, 'popup'), { recursive: true });
    await mkdir(join(out, 'icons'), { recursive: true });

    // background service worker (or background script for firefox)
    await build({
      entryPoints: [join(ROOT, 'src/background.ts')],
      outfile: join(out, 'background.js'),
      bundle: true,
      format: 'esm',
      target: 'es2022',
      platform: 'browser',
      minify: true,
      sourcemap: false,
    });

    // popup
    await build({
      entryPoints: [join(ROOT, 'src/popup/popup.ts')],
      outfile: join(out, 'popup/popup.js'),
      bundle: true,
      format: 'esm',
      target: 'es2022',
      platform: 'browser',
      minify: true,
      sourcemap: false,
    });
    await copyFile(join(ROOT, 'src/popup/index.html'), join(out, 'popup/index.html'));
    await copyFile(join(ROOT, 'src/popup/styles.css'), join(out, 'popup/styles.css'));

    // manifest
    const manifestPath = join(ROOT, `src/manifest.${target}.json`);
    const manifest = await readFile(manifestPath, 'utf8');
    await writeFile(join(out, 'manifest.json'), manifest);

    // icons (optional — placeholders generated at apps/agent/src-tauri/icons
    // are reused if no per-extension assets exist)
    const iconSrc = join(ROOT, 'src/icons');
    if (existsSync(iconSrc)) {
      await cp(iconSrc, join(out, 'icons'), { recursive: true });
    }

    process.stdout.write(`  built dist-${target}/\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`${(err as Error).stack ?? err}\n`);
  process.exitCode = 1;
});
