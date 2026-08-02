#!/usr/bin/env node
// Build a consumable design-system package out of src/components/ui.
//
// The app has no library build of its own (package.json `main` is the Electron
// entry), and design-sync's synth-entry fallback produces weak `.d.ts`
// contracts. So this script assembles a real one into `.ds-pkg/` (gitignored,
// fully regenerated on every run — never hand-edit it):
//
//   .ds-pkg/src/<group>/<file>.tsx   verbatim copies of src/components/ui,
//                                    filed under a group dir so design-sync
//                                    derives the DS-pane grouping from the path
//   .ds-pkg/src/index.ts             barrel over every component module
//   .ds-pkg/dist/index.js            esbuild ESM bundle (react + lucide external)
//   .ds-pkg/dist/**/*.d.ts           tsc declarations -> the real props contracts
//   .ds-pkg/styles.css               compiled Tailwind v4 + daisyUI output
//
// Only the copy step touches component code, and only to rewrite the sibling
// import specifiers that moving files into group dirs invalidates.

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UI = join(REPO, 'src/components/ui');
const PKG = join(REPO, '.ds-pkg');
const DS_SYNC_NM = join(REPO, '.ds-sync/node_modules');

// file basename -> DS-pane group. Every non-test .tsx in src/components/ui must
// appear here; the run fails loudly if one is missing so a new component can't
// silently land in the wrong group.
const GROUPS = {
  actions: ['button', 'icon-button'],
  forms: [
    'input', 'textarea', 'checkbox', 'switch', 'label', 'select', 'number-input',
    'search-input', 'form-field', 'segmented-control', 'settings-field-group',
  ],
  'data-display': [
    'table', 'data-table', 'badge', 'status-badge', 'card', 'section-card',
    'empty-state', 'scroll-area',
  ],
  feedback: ['alert', 'toast', 'tooltip'],
  overlays: ['dialog', 'confirm-dialog', 'unsaved-changes-dialog', 'dropdown-menu'],
  navigation: ['page-header'],
};

const groupOf = new Map();
for (const [group, files] of Object.entries(GROUPS)) for (const f of files) groupOf.set(f, group);

const sources = readdirSync(UI)
  .filter((f) => f.endsWith('.tsx') && !/\.(test|spec|stories)\.tsx$/.test(f))
  .map((f) => f.replace(/\.tsx$/, ''))
  .sort();

const unmapped = sources.filter((s) => !groupOf.has(s));
const stale = [...groupOf.keys()].filter((s) => !sources.includes(s));
if (unmapped.length || stale.length) {
  if (unmapped.length) console.error(`✗ ungrouped component files: ${unmapped.join(', ')} — add them to GROUPS`);
  if (stale.length) console.error(`✗ GROUPS names files that no longer exist: ${stale.join(', ')}`);
  process.exit(1);
}

// ── 1. copy sources into group dirs, repointing sibling imports ──────────
rmSync(PKG, { recursive: true, force: true });
for (const name of sources) {
  const group = groupOf.get(name);
  const body = readFileSync(join(UI, `${name}.tsx`), 'utf8')
    // `from "./button"` -> `from "../actions/button"` (all sibling imports in
    // this kit are extensionless single-segment relatives).
    .replace(/(\bfrom\s+["'])\.\/([a-z0-9-]+)(["'])/g, (m, pre, target, post) => {
      const g = groupOf.get(target);
      if (!g) throw new Error(`${name}.tsx imports "./${target}" which is not a known component file`);
      return g === group ? `${pre}./${target}${post}` : `${pre}../${g}/${target}${post}`;
    });
  const dest = join(PKG, 'src', group, `${name}.tsx`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, body);
}

writeFileSync(
  join(PKG, 'src/index.ts'),
  sources.map((n) => `export * from './${groupOf.get(n)}/${n}';`).join('\n') + '\n',
);

// Preview shell. The app carries its surface on <body> (src/styles/base.css:
// background/color/font from the theme tokens) and picks dark vs light with a
// data-theme attribute on <html> set by src/app/useThemePreferences.ts. Preview
// cards get neither: design-sync's card template hard-codes a white body, so a
// dark-first DS renders near-white text on white. This reproduces the app's own
// body rule as a wrapper so every card shows the DS on its real surface.
// Bundled via cfg.extraEntries and used as cfg.provider — deliberately NOT in
// index.ts, so it stays out of the component list. React.createElement rather
// than JSX so it needs no jsx build config of its own.
writeFileSync(
  join(PKG, 'preview-root.tsx'),
  `import * as React from 'react';

export function DSPreviewRoot({ children }) {
  return React.createElement(
    'div',
    {
      style: {
        background: 'var(--bg)',
        color: 'var(--fg-primary)',
        fontFamily: 'var(--font-body)',
        fontSize: 13,
        lineHeight: 1.5,
        padding: 20,
        borderRadius: 8,
      },
    },
    children,
  );
}
`,
);

writeFileSync(
  join(PKG, 'package.json'),
  JSON.stringify(
    {
      name: 'automation-app-ui',
      version: JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')).version,
      private: true,
      type: 'module',
      module: 'dist/index.js',
      types: 'dist/index.d.ts',
    },
    null,
    2,
  ) + '\n',
);

// Standalone (does not extend the repo tsconfig): noUnusedLocals/noEmit there
// would fight declaration emit. `types: ["node"]` is only for select.tsx's
// `process.env.NODE_ENV` guard — without it tsc reports TS2591 on every run.
writeFileSync(
  join(PKG, 'tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2020',
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        moduleResolution: 'bundler',
        jsx: 'react-jsx',
        strict: true,
        skipLibCheck: true,
        esModuleInterop: true,
        declaration: true,
        emitDeclarationOnly: true,
        rootDir: 'src',
        outDir: 'dist',
        types: ['node'],
      },
      include: ['src'],
    },
    null,
    2,
  ) + '\n',
);

const run = (bin, args, opts = {}) =>
  execFileSync(bin, args, { cwd: REPO, stdio: 'inherit', ...opts });

// ── 2. declarations ──────────────────────────────────────────────────────
// tsc exits non-zero on any diagnostic but still emits; the emit is what
// matters, so a failure is only fatal if index.d.ts didn't appear.
console.error('» tsc --emitDeclarationOnly');
try {
  run(join(REPO, 'node_modules/.bin/tsc'), ['-p', join(PKG, 'tsconfig.json')]);
} catch {
  console.error('  (tsc reported diagnostics — checking whether declarations were still emitted)');
}
if (!existsSync(join(PKG, 'dist/index.d.ts'))) {
  console.error('✗ tsc emitted no dist/index.d.ts');
  process.exit(1);
}

// ── 3. js bundle ─────────────────────────────────────────────────────────
// react/react-dom are shimmed to window globals by design-sync; lucide-react is
// left external so design-sync bundles it once from the repo's node_modules.
console.error('» esbuild dist/index.js');
run(join(DS_SYNC_NM, '.bin/esbuild'), [
  join(PKG, 'src/index.ts'),
  '--bundle',
  '--format=esm',
  '--platform=browser',
  '--target=es2020',
  '--jsx=automatic',
  '--external:react',
  '--external:react-dom',
  '--external:react/jsx-runtime',
  '--external:lucide-react',
  `--outfile=${join(PKG, 'dist/index.js')}`,
]);

// ── 4. compiled stylesheet ───────────────────────────────────────────────
// src/App.css is Tailwind v4 *source* (@import "tailwindcss", @plugin
// "daisyui", the two automation-* themes) — not browser-consumable. Compile it,
// declaring both the app source and the authored preview .tsx files as content
// so utilities used only in previews survive.
console.error('» tailwind styles.css');
writeFileSync(
  join(PKG, 'styles.src.css'),
  ['@import "../src/App.css";', '@source "../src";', '@source "../.design-sync/previews";', ''].join('\n'),
);
run(join(DS_SYNC_NM, '.bin/tailwindcss'), [
  '-i', join(PKG, 'styles.src.css'),
  '-o', join(PKG, 'styles.css'),
]);

const kb = (p) => (readFileSync(p).length / 1024).toFixed(0);
console.error(
  `✓ .ds-pkg ready — ${sources.length} modules, ` +
    `dist/index.js ${kb(join(PKG, 'dist/index.js'))} KB, styles.css ${kb(join(PKG, 'styles.css'))} KB`,
);
