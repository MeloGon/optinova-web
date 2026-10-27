// Convierte lecciones en Markdown a PDF imprimible (docs/informes/, ignorado por git).
//
//   npm run pdf -- docs/lessons/fundamentos/F01-typescript-desde-dart.md
//   npm run pdf -- docs/lessons/fundamentos/*.md        (varios a la vez)
//
// Solo usa paquetes de npm (pdfmake, marked, geist): funciona igual en macOS y Windows,
// sin Chrome ni Python. Soporta títulos, párrafos, listas, tablas, código, citas y líneas.

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const require = createRequire(import.meta.url);
const pdfmake = require('pdfmake');
// Captura opcional para QA de la versión de pdfmake instalada, sin modificar el paquete.
let renderedPages = [];
if (process.env.PDF_LAYOUT_AUDIT === '1') {
  const Renderer = require('pdfmake/js/Renderer').default;
  const renderPages = Renderer.prototype.renderPages;
  Renderer.prototype.renderPages = function (pages) {
    renderedPages = pages;
    return renderPages.call(this, pages);
  };
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = join(ROOT, 'docs/informes');
const FONTS = join(ROOT, 'node_modules/geist/dist/fonts');
const fontkit = require('fontkit');
const glyphFonts = [
  fontkit.openSync(join(FONTS, 'geist-sans/Geist-Regular.ttf')),
  fontkit.openSync(join(FONTS, 'geist-mono/GeistMono-Regular.ttf')),
];
const replacedGlyphs = new Set();

// Colores del sistema de diseño (T-01, modo claro).
const C = {
  ink: '#1d2129',
  muted: '#5f6673',
  primary: '#1f6fe5',
  primarySubtle: '#eef4fe',
  border: '#dfe2e8',
  codeBg: '#f5f6f8',
};

pdfmake.setFonts({
  Geist: {
    normal: join(FONTS, 'geist-sans/Geist-Regular.ttf'),
    bold: join(FONTS, 'geist-sans/Geist-SemiBold.ttf'),
    italics: join(FONTS, 'geist-sans/Geist-Italic.ttf'),
    bolditalics: join(FONTS, 'geist-sans/Geist-SemiBold.ttf'),
  },
  GeistMono: {
    normal: join(FONTS, 'geist-mono/GeistMono-Regular.ttf'),
    bold: join(FONTS, 'geist-mono/GeistMono-SemiBold.ttf'),
    italics: join(FONTS, 'geist-mono/GeistMono-Regular.ttf'),
    bolditalics: join(FONTS, 'geist-mono/GeistMono-SemiBold.ttf'),
  },
});
pdfmake.setLocalAccessPolicy((path) => path.startsWith(FONTS));
pdfmake.setUrlAccessPolicy(() => false); // nunca descarga nada de internet

/** Las fuentes no traen emojis: se cambian por texto o se quitan. */
function clean(text) {
  const decoded = decodeEntities(text)
    .replaceAll('✅', '[ok]')
    .replaceAll('❌', '[error]')
    .replace(/\p{Extended_Pictographic}️?/gu, '')
    .replace(/[️\u200d]/g, '')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[├└┌┐┘┤┬┴┼]/g, '+')
    .replace(/│/g, '|')
    .replace(/─/g, '-');
  return Array.from(decoded, (character) => {
    if (/\s/.test(character) || glyphFonts.every((font) => font.hasGlyphForCodePoint(character.codePointAt(0)))) {
      return character;
    }
    replacedGlyphs.add(character);
    return `[U+${character.codePointAt(0).toString(16).toUpperCase()}]`;
  }).join('');
}

// Permite partir rutas, tipos y código en columnas estrechas sin invadir la celda vecina.
function wrappedCode(text) {
  return clean(text).split('\n').map((line) => {
    const parts = [];
    while (line.length > 94) {
      parts.push(line.slice(0, 94));
      line = '  ' + line.slice(94);
    }
    return [...parts, line].join('\n');
  }).join('\n');
}

function decodeEntities(text) {
  return text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');
}

/** Tokens en línea (negrita, código, enlaces...) → fragmentos de texto de pdfmake. */
function inline(tokens = [], style = {}) {
  return tokens.flatMap((t) => {
    switch (t.type) {
      case 'strong':
        return inline(t.tokens, { ...style, bold: true });
      case 'em':
        return inline(t.tokens, { ...style, italics: true });
      case 'del':
        return inline(t.tokens, { ...style, decoration: 'lineThrough' });
      case 'codespan':
        return [{ text: clean(t.text), wordBreak: 'break-all', font: 'GeistMono', fontSize: 8.5, background: C.codeBg, ...style }];
      case 'link':
        return inline(t.tokens, { ...style, color: C.primary, ...(t.href?.startsWith('https://') ? { link: t.href } : {}) });
      case 'checkbox':
        return [{ text: t.checked ? '[x] ' : '[ ] ', ...style }];
      case 'br':
        return [{ text: '\n' }];
      case 'text':
        return t.tokens ? inline(t.tokens, style) : [{ text: clean(t.text), ...style }];
      default:
        return [{ text: clean(t.text ?? t.raw ?? ''), ...style }];
    }
  });
}

/** Bloque de código: caja gris con letra monoespaciada. */
function codeBlock(text) {
  return {
    table: {
      widths: ['*'],
      dontBreakRows: true,
      body: [[{ text: wrappedCode(text), font: 'GeistMono', fontSize: 8.5, lineHeight: 1.25, preserveLeadingSpaces: true }]],
    },
    layout: {
      fillColor: () => C.codeBg,
      hLineColor: () => C.border,
      vLineColor: () => C.border,
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 6,
      paddingBottom: () => 6,
    },
    margin: [0, 2, 0, 10],
  };
}

function table(t) {
  const header = t.header.map((cell) => ({ text: inline(cell.tokens), bold: true, fillColor: C.primarySubtle }));
  const rows = t.rows.map((row) => row.map((cell) => ({ text: inline(cell.tokens) })));
  return {
    table: { headerRows: 1, keepWithHeaderRows: 1, widths: t.header.map(() => '*'), body: [header, ...rows], dontBreakRows: true },
    layout: {
      hLineColor: () => C.border,
      vLineColor: () => C.border,
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      paddingLeft: () => 5,
      paddingRight: () => 5,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
    fontSize: 9,
    margin: [0, 2, 0, 10],
  };
}

function list(t) {
  const items = t.items.map((item) => {
    const blocks = item.tokens.flatMap((tok) => (tok.type === 'text' ? [{ text: inline(tok.tokens ?? [tok]) }] : block(tok)));
    // marked coloca el checkbox como token de bloque antes del texto de la lista.
    if (item.task && blocks[0]?.text) {
      const text = blocks[0].text;
      blocks[0].text = [{ text: item.checked ? '[x] ' : '[ ] ' }, ...(Array.isArray(text) ? text : [{ text }])];
    }
    return blocks.length === 1 ? blocks[0] : { stack: blocks };
  });
  return { [t.ordered ? 'ol' : 'ul']: items, margin: [0, 0, 0, 8] };
}

function quote(t) {
  return {
    table: { widths: ['*'], body: [[{ stack: t.tokens.flatMap(block), color: C.muted }]] },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: (i) => (i === 0 ? 3 : 0),
      vLineColor: () => C.primary,
      fillColor: () => C.primarySubtle,
      paddingLeft: () => 10,
      paddingTop: () => 6,
      paddingBottom: () => 2,
    },
    margin: [0, 2, 0, 10],
  };
}

/** Un bloque de Markdown → contenido de pdfmake. */
function block(t) {
  switch (t.type) {
    case 'heading': {
      const sizes = { 1: 20, 2: 14, 3: 12, 4: 11 };
      return [
        {
          text: inline(t.tokens),
          fontSize: sizes[t.depth] ?? 11,
          bold: true,
          color: t.depth === 1 ? C.ink : C.primary,
          margin: [0, t.depth === 1 ? 0 : 10, 0, 6],
          headlineLevel: t.depth,
        },
      ];
    }
    case 'paragraph':
      return [{ text: inline(t.tokens), margin: [0, 0, 0, 8], unbreakable: true }];
    case 'code':
      return [codeBlock(t.text)];
    case 'table':
      return [table(t)];
    case 'list':
      return [list(t)];
    case 'blockquote':
      return [quote(t)];
    case 'hr':
      return [
        {
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: C.border }],
          margin: [0, 4, 0, 10],
        },
      ];
    case 'text':
      return [{ text: inline(t.tokens ?? [t]), margin: [0, 0, 0, 8] }];
    default:
      return []; // espacio, html y comentarios se ignoran
  }
}

/** Mantiene cada título con el primer párrafo o ejemplo, sin editar el Markdown. */
function content(tokens) {
  const visible = tokens.filter((token) => token.type !== 'space');
  const result = [];
  for (let index = 0; index < visible.length; index++) {
    const token = visible[index];
    if (token.type !== 'heading') {
      result.push(...block(token));
      continue;
    }
    const stack = block(token);
    while (visible[index + 1]?.type === 'heading') stack.push(...block(visible[++index]));
    const next = visible[index + 1];
    const shortTable = next?.type === 'table' && next.rows.length <= 10 && next.raw.length < 2500;
    if (next && (['paragraph', 'code'].includes(next.type) || shortTable)) {
      stack.push(...block(visible[++index]));
      if (next.type === 'paragraph' && next.raw.length < 220 && visible[index + 1]?.type === 'code') {
        stack.push(...block(visible[++index]));
      }
      result.push({ stack, unbreakable: true });
    } else {
      result.push(...stack);
    }
  }
  // Un margen final no debe abrir una página que solo contenga el pie.
  function trimBottom(node) {
    if (!node) return;
    node.margin = node.margin ? [...node.margin.slice(0, 3), 0] : [0, 0, 0, 0];
    if (node.stack) trimBottom(node.stack.at(-1));
    if (node.ul || node.ol) trimBottom((node.ul ?? node.ol).at(-1));
  }
  trimBottom(result.at(-1));
  return result;
}

async function convert(file) {
  const md = await readFile(file, 'utf8');
  const tokens = marked.lexer(md);
  const title = clean(tokens.find((t) => t.type === 'heading' && t.depth === 1)?.text ?? basename(file, '.md'));
  const out = join(OUT_DIR, `${basename(file, '.md')}.pdf`);

  const doc = {
    info: { title, author: 'Optinova Web', subject: 'Documentación de aprendizaje' },
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 50],
    defaultStyle: { font: 'Geist', fontSize: 10.5, lineHeight: 1.3, color: C.ink },
    content: content(tokens),
    footer: (page, pages) => ({
      columns: [
        // "F01: TypeScript desde Dart..." → "F01" (lo que va antes de los dos puntos).
        { text: `Optinova Web · ${title.split(':')[0]}`, color: C.muted, fontSize: 8 },
        { text: `${page} / ${pages}`, alignment: 'right', color: C.muted, fontSize: 8 },
      ],
      margin: [40, 20, 40, 0],
    }),
  };

  const output = pdfmake.createPdf(doc);
  await output.write(out);
  // Datos de maquetación para comprobar desbordes y páginas vacías sin depender del OCR.
  const audit = renderedPages.map((page, index) => ({
    page: index + 1,
    lines: page.items.filter((item) => item.type === 'line').map(({ item }) => ({
      x: item.x, y: item.y, width: item.getWidth(),
      text: item.inlines.map((part) => part.text).join(''),
    })),
  }));
  if (process.env.PDF_LAYOUT_AUDIT === '1') {
    await writeFile(out.replace(/\.pdf$/, '.layout.json'), JSON.stringify(audit, null, 2));
  }
  if (replacedGlyphs.size) console.warn('Caracteres sustituidos:', [...replacedGlyphs].join(' '));
  return out;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Uso: npm run pdf -- <archivo.md> [más archivos...]');
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });
for (const file of files) {
  console.log(`PDF listo: ${await convert(file)}`);
}
