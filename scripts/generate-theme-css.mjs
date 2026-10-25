// Genera src/theme.css: modos día/noche y colores de acento.
// En modo día las rampas de Tailwind se invierten (50 <-> 950) para que una UI
// diseñada en oscuro conserve contraste sin reescribir cada componente.
import { readFileSync, writeFileSync } from 'node:fs';

const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
const FAMILIES = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];

const ACCENTS = {
  caudal: ['#ebf8ff', '#d3f0fe', '#a8e2fc', '#72cff8', '#42baf0', '#1fa2e0', '#1284c2', '#10699c', '#12557d', '#134767', '#0b2c44'],
  senal: ['#eef0ff', '#e0e4ff', '#c6cdff', '#a3acff', '#8189ff', '#6366f1', '#5048e5', '#4339ca', '#3730a3', '#312e81', '#1e1b4b'],
  jade: ['#ecfdf7', '#d1faec', '#a7f3da', '#6ee7c3', '#34d3a6', '#10b98c', '#059672', '#04785e', '#065f4b', '#064e3f', '#022c24'],
  oro: ['#fffbeb', '#fef3c7', '#fde68a', '#fcd34d', '#fbbf24', '#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f', '#451a03'],
  orquidea: ['#fdf4ff', '#fae8ff', '#f5d0fe', '#f0abfc', '#e879f9', '#d946ef', '#c026d3', '#a21caf', '#86198f', '#701a75', '#4a044e'],
};

const NEUTRALS = {
  dark: {
    canvas: '#080d14', surface: '#0e1520', raised: '#141d2a', line: '#1f2a3a', white: '#ffffff',
    slate: ['#f3f6fa', '#e7edf4', '#cdd6e2', '#a9b6c7', '#8391a5', '#627086', '#48546a', '#2c3647', '#1f2a3a', '#141d2a', '#0b1018'],
  },
  light: {
    canvas: '#f2f5f8', surface: '#ffffff', raised: '#eef2f6', line: '#dde4ec', white: '#0b1018',
    slate: ['#0b1018', '#141d2a', '#1f2a3a', '#36435a', '#536075', '#6b778a', '#8a95a6', '#b6c0cd', '#d9e0e9', '#e8edf3', '#f3f6f9'],
  },
};

const theme = readFileSync(new URL('../node_modules/tailwindcss/theme.css', import.meta.url), 'utf8');
const palette = {};
for (const [, fam, step, value] of theme.matchAll(/--color-([a-z]+)-(\d+):\s*([^;]+);/g)) {
  (palette[fam] ??= {})[step] = value.trim();
}

const neutralVars = (n) => [
  `  --color-canvas: ${n.canvas};`,
  `  --color-surface: ${n.surface};`,
  `  --color-raised: ${n.raised};`,
  `  --color-line: ${n.line};`,
  `  --color-white: ${n.white};`,
  ...STEPS.map((s, i) => `  --color-slate-${s}: ${n.slate[i]};`),
].join('\n');

const accentToSky = (reversed) =>
  STEPS.map((s, i) => `  --color-sky-${s}: var(--accent-${reversed ? STEPS[STEPS.length - 1 - i] : s});`).join('\n');

const invertedFamilies = FAMILIES.flatMap((fam) =>
  STEPS.map((s, i) => `  --color-${fam}-${s}: ${palette[fam][STEPS[STEPS.length - 1 - i]]};`)
).join('\n');

const LIGHT = ':root[data-mode="light"]';
const SOLID_STEPS = ['500', '600', '700'];
const SOLID_RESTORE = ['100', '200', '300', '400', '500', '600', '700'];

const css = `/* Archivo generado por scripts/generate-theme-css.mjs. No editar a mano. */

:root {
  color-scheme: dark;
${neutralVars(NEUTRALS.dark)}
${accentToSky(false)}
}

${Object.entries(ACCENTS)
  .map(([name, ramp], idx) => `${idx === 0 ? ':root, ' : ''}:root[data-accent="${name}"] {\n${ramp.map((v, i) => `  --accent-${STEPS[i]}: ${v};`).join('\n')}\n}`)
  .join('\n\n')}

${LIGHT} {
  color-scheme: light;
${neutralVars(NEUTRALS.light)}
${accentToSky(true)}
${invertedFamilies}
}

/* Botones sólidos: en modo día conservan el tono real y el texto blanco */
${[...FAMILIES, 'sky'].map((fam) => `${LIGHT} .text-white:is(${SOLID_STEPS.map((s) => `[class*="bg-${fam}-${s}"]`).join(', ')}) {
  --color-white: #ffffff;
${SOLID_RESTORE.map((s) => `  --color-${fam}-${s}: ${fam === 'sky' ? `var(--accent-${s})` : palette[fam][s]};`).join('\n')}
}`).join('\n\n')}
`;

writeFileSync(new URL('../src/theme.css', import.meta.url), css);
console.log('src/theme.css generado');
