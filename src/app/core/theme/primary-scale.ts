// T-01 Color v1 (pedido D-001). Copiado de export/primary-scale.ts de Claude Design; no editar a mano.
/**
 * Optinova v1 — generador del color primario (OKLCH) con contraste AA garantizado.
 * Sin dependencias. En la app no se llama directo: se usa ThemeService.setPrimary().
 * Vista previa aislada (C-24 / S-06):
 *
 *   applyPrimary(hex, { selector: '#preview', styleId: 'preview-primary' });
 *
 * Regla (T-01):
 *  1. Del color elegido se toman H (tono) y C (croma) en OKLCH.
 *  2. Cada paso 50–950 tiene una luminosidad L fija (LADDER) y una fracción del croma (CHROMA);
 *     si el color no cabe en sRGB se reduce C (L y H se conservan).
 *  3. El color elegido queda EXACTO en el paso cuya L está más cerca (ancla).
 *  4. color-primary = el ancla, acotada a 400–700 en claro y 300–500 en oscuro.
 *  5. color-primary-foreground = blanco si contraste ≥ 4.5:1; si no, primary-950; si no, #0b0d12.
 *     Si ninguno llega, el primario se mueve un paso hacia el lado con mejor contraste.
 *  6. Hover/activo se alejan del texto: con texto blanco oscurecen, con texto oscuro aclaran.
 *  Probado con 764 colores (36 tonos × 7 luminosidades × 3 cromas + presets): 0 fallos AA.
 */

export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type Step = (typeof STEPS)[number];
export const LADDER = [0.975, 0.945, 0.89, 0.82, 0.73, 0.64, 0.55, 0.47, 0.4, 0.33, 0.26];
export const CHROMA = [0.1, 0.22, 0.42, 0.66, 0.88, 1, 1, 0.92, 0.8, 0.62, 0.42];
const DARK_TEXT_FALLBACK = '#0b0d12';

/** Paleta fija de gráficas (series 2–6), en orden validado para daltonismo. [L, C, H] */
export const CHART_POOL: { id: string; light: [number, number, number]; dark: [number, number, number] }[] = [
  { id: 'ambar', light: [0.74, 0.15, 68], dark: [0.66, 0.14, 68] },
  { id: 'violeta', light: [0.5, 0.19, 295], dark: [0.58, 0.17, 295] },
  { id: 'oliva', light: [0.7, 0.15, 130], dark: [0.64, 0.15, 130] },
  { id: 'rosa', light: [0.58, 0.19, 12], dark: [0.62, 0.18, 12] },
  { id: 'cielo', light: [0.62, 0.13, 235], dark: [0.66, 0.12, 235] },
  { id: 'naranja', light: [0.66, 0.16, 45], dark: [0.6, 0.16, 45] },
  { id: 'teal', light: [0.6, 0.11, 178], dark: [0.64, 0.11, 178] },
];

export const PRESETS = [
  { id: 'azul-optico', name: 'Azul óptico', hex: '#1f6fe5' },
  { id: 'turquesa', name: 'Turquesa', hex: '#0b9bb5' },
  { id: 'verde-menta', name: 'Verde menta', hex: '#14a37f' },
  { id: 'violeta', name: 'Violeta', hex: '#7655e6' },
  { id: 'frambuesa', name: 'Frambuesa', hex: '#d0336c' },
  { id: 'coral', name: 'Coral', hex: '#ec5f45' },
  { id: 'ambar', name: 'Ámbar', hex: '#e9a21c' },
  { id: 'grafito', name: 'Grafito', hex: '#4a5263' },
] as const;

type Vec3 = [number, number, number];
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

function hexToRgb(hex: string): Vec3 {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
function rgbToHex(rgb: Vec3): string {
  return '#' + rgb.map((c) => Math.round(clamp01(c) * 255).toString(16).padStart(2, '0')).join('');
}
function linToOklab([r, g, b]: Vec3): Vec3 {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function oklabToLin([L, a, b]: Vec3): Vec3 {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
const oklchToLin = (L: number, C: number, H: number): Vec3 => {
  const hr = (H * Math.PI) / 180;
  return oklabToLin([L, C * Math.cos(hr), C * Math.sin(hr)]);
};
const inGamut = (v: Vec3) => v.every((c) => c >= -0.0001 && c <= 1.0001);

export function hexToOklch(hex: string): Vec3 {
  const [L, a, b] = linToOklab(hexToRgb(hex).map(toLin) as Vec3);
  const C = Math.hypot(a, b);
  const H = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return [L, C, C < 0.0001 ? 0 : H];
}
/** Reduce el croma (manteniendo L y H) hasta que el color quepa en sRGB. */
export function fitGamut(L: number, C: number, H: number): Vec3 {
  if (inGamut(oklchToLin(L, C, H))) return [L, C, H];
  let lo = 0, hi = C;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToLin(L, mid, H))) lo = mid; else hi = mid;
  }
  return [L, lo, H];
}
export function oklchToHex(L: number, C: number, H: number): string {
  const [l, c, h] = fitGamut(L, C, H);
  return rgbToHex(oklchToLin(l, c, h).map((x) => toGamma(clamp01(x))) as Vec3);
}
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const hueDist = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

export interface Scale { scale: Record<Step, string>; anchor: Step; oklch: Vec3 }

/** 1 · Escala 50–950 a partir de un color. */
export function generateScale(baseHex: string): Scale {
  const base = hexToOklch(baseHex);
  const [L0, C0, H0] = base;
  let anchor = 0, best = 9;
  LADDER.forEach((l, i) => { const d = Math.abs(l - L0); if (d < best) { best = d; anchor = i; } });
  const scale = {} as Record<Step, string>;
  STEPS.forEach((step, i) => {
    scale[step] = i === anchor ? rgbToHex(hexToRgb(baseHex)) : oklchToHex(LADDER[i], C0 * CHROMA[i], H0);
  });
  return { scale, anchor: STEPS[anchor], oklch: base };
}

/** 2 · Texto sobre un relleno, con contraste ≥ 4.5:1. */
export function pickForeground(fillHex: string, darkHex?: string): string {
  if (contrast(fillHex, '#ffffff') >= 4.5) return '#ffffff';
  if (darkHex && contrast(fillHex, darkHex) >= 4.5) return darkHex;
  return DARK_TEXT_FALLBACK;
}

export type Mode = 'light' | 'dark';
/** 3 · Tokens semánticos del primario para un modo (valores = nombre de token o hex). */
export function semanticFor(gen: Scale, mode: Mode): Record<string, string> {
  const s = gen.scale;
  const idx = STEPS.indexOf(gen.anchor);
  const min = STEPS.indexOf(mode === 'light' ? 400 : 300);
  const max = STEPS.indexOf(mode === 'light' ? 700 : 500);
  let i = Math.min(max, Math.max(min, idx));
  const dark950 = s[950];
  for (let guard = 0; guard < 4; guard++) {
    const fill = s[STEPS[i]];
    if (contrast(fill, '#ffffff') >= 4.5 || contrast(fill, dark950) >= 4.5) break;
    i += contrast(fill, '#ffffff') > contrast(fill, dark950) ? 1 : -1;
  }
  const step = (k: number) => STEPS[Math.min(10, Math.max(0, k))];
  const primary = STEPS[i];
  const fg = pickForeground(s[primary], dark950);
  const dir = fg === '#ffffff' ? 1 : -1;
  return {
    'color-primary': `color-primary-${primary}`,
    'color-primary-hover': `color-primary-${step(i + dir)}`,
    'color-primary-active': `color-primary-${step(i + 2 * dir)}`,
    'color-primary-subtle': `color-primary-${mode === 'light' ? 50 : 950}`,
    'color-primary-subtle-hover': `color-primary-${mode === 'light' ? 100 : 900}`,
    'color-primary-subtle-foreground': `color-primary-${mode === 'light' ? 700 : 200}`,
    'color-primary-text': `color-primary-${mode === 'light' ? 700 : 300}`,
    'color-ring': `color-primary-${mode === 'light' ? 600 : 400}`,
    'color-chart-1': 'color-primary-500',
    'color-primary-foreground': fg === dark950 ? 'color-primary-950' : fg,
  };
}

/** Series 2–6 de gráficas (o 1–6 si el primario es casi gris). */
export function chartSeries(gen: Scale) {
  const [, C, H] = hexToOklch(gen.scale[500]);
  if (C < 0.06) return { primaryFirst: false, pool: CHART_POOL.slice(0, 6) };
  return { primaryFirst: true, pool: CHART_POOL.filter((p) => hueDist(p.light[2], H) >= 40).slice(0, 5) };
}

/** 4 · CSS listo para inyectar (claro + oscuro) bajo un selector. */
export function themeCss(baseHex: string, opts: { selector?: string; darkSelector?: string } = {}): string {
  const sel = opts.selector ?? ':root';
  const darkSel = opts.darkSelector ?? '[data-theme="dark"]';
  const gen = generateScale(baseHex);
  const light: string[] = STEPS.map((st) => `--color-primary-${st}:${gen.scale[st]}`);
  const dark: string[] = [];
  const put = (map: Record<string, string>, arr: string[]) =>
    Object.entries(map).forEach(([k, v]) => arr.push(`--${k}:${v.startsWith('#') ? v : `var(--${v})`}`));
  put(semanticFor(gen, 'light'), light);
  put(semanticFor(gen, 'dark'), dark);
  const cs = chartSeries(gen);
  const first = cs.primaryFirst ? 2 : 1;
  cs.pool.forEach((p, n) => {
    light.push(`--color-chart-${n + first}:${oklchToHex(...p.light)}`);
    dark.push(`--color-chart-${n + first}:${oklchToHex(...p.dark)}`);
  });
  const darkSelector = sel === ':root' ? darkSel : sel.split(',').map((s) => `${darkSel} ${s.trim()},${s.trim()}${darkSel}`).join(',');
  return `${sel}{${light.join(';')}}\n${darkSelector}{${dark.join(';')}}`;
}

/** 5 · Aplica (o reemplaza) el tema en un <style id="optinova-primary">. */
export function applyPrimary(baseHex: string, opts: { selector?: string; darkSelector?: string; styleId?: string; document?: Document } = {}): Scale {
  const doc = opts.document ?? document;
  const id = opts.styleId ?? 'optinova-primary';
  let el = doc.getElementById(id) as HTMLStyleElement | null;
  if (!el) { el = doc.createElement('style'); el.id = id; doc.head.appendChild(el); }
  el.textContent = themeCss(baseHex, opts);
  return generateScale(baseHex);
}
