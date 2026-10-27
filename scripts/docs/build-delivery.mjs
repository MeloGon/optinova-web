// Genera la entrega completa sin cambiar package.json ni los Markdown existentes.
// Uso: node scripts/docs/build-delivery.mjs
import { readdir, readFile, writeFile, mkdir, unlink, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve, basename, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { deflateRawSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = join(root, 'docs/informes');
const delivery = join(out, 'entrega');
const date = '2026-10-26';
const report = `docs/avance/${date}-informe-de-avance.md`;
const descriptions = {
  '00': 'Anatomía del proyecto Angular y herramientas.',
  '01': 'Tokens, tema, modo oscuro y densidad.',
  '02': 'Core: cliente, errores, configuración y Result.',
  '03': 'Layouts, rutas y navegación.',
  '04': 'Login, sesión y permisos por rol.',
  '05': 'Búsqueda, URL, paginación, edición y borrado básico.',
  '06': 'Alta, validación, controles y vista previa.',
  '07': 'IDs como texto, fechas, columnas y migraciones.',
  F00: 'Mapa del ecosistema web desde Flutter.',
  F01: 'TypeScript: variables, tipos, null safety y funciones.',
  F02: 'TypeScript: objetos, clases, uniones y organización.',
  F03: 'HTML: estructura, etiquetas y formularios.',
  F07: 'Recorrido del código de autenticación de adentro hacia afuera.',
};

const numbered = (await readdir(join(root, 'docs/lessons')))
  .filter((name) => /^\d{2}-.+\.md$/.test(name)).sort()
  .map((name) => `docs/lessons/${name}`);
const fundamentals = (await readdir(join(root, 'docs/lessons/fundamentos')))
  .filter((name) => /^F\d{2}-.+\.md$/.test(name)).sort()
  .map((name) => `docs/lessons/fundamentos/${name}`);
const lessons = [...numbered, ...fundamentals];
const protectedFiles = lessons.filter((file) => /(?:^|\/)(?:0[0-4]|F0[0-3]|F07)-/.test(file));
const hash = async (file) => createHash('sha256').update(await readFile(join(root, file))).digest('hex');
const before = new Map(await Promise.all(protectedFiles.map(async (file) => [file, await hash(file)])));

// Validar entradas antes de limpiar salidas. F04–F06 no se inventan ni se saltan en silencio.
for (const file of [...lessons, report]) await readFile(join(root, file));
await mkdir(delivery, { recursive: true });
await mkdir(join(out, '_sources'), { recursive: true });
for (const directory of [out, delivery]) {
  const resolvedDirectory = resolve(directory);
  const inside = relative(out, resolvedDirectory);
  if (inside.startsWith('..') || isAbsolute(inside)) throw new Error('Salida fuera de docs/informes');
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isFile() && /\.(pdf|layout\.json)$/i.test(entry.name)) {
      await unlink(join(directory, entry.name));
    }
  }
}

const indexFile = 'docs/informes/_sources/INDICE.md';
const rows = lessons.map((file) => {
  const name = basename(file, '.md');
  const key = name.split('-')[0];
  return `- **${name}.pdf**: ${descriptions[key] ?? 'Lección del proyecto.'}`;
});
await writeFile(join(root, indexFile), [
  '# Índice: documentación de Optinova Web', '',
  `Entrega del ${date}. ${lessons.length} lecciones, un informe y este índice.`, '',
  '## Lecciones por entregable', '', ...rows.filter((row) => !row.startsWith('- **F')), '',
  '## Fundamentos', '', ...rows.filter((row) => row.startsWith('- **F')), '',
  '## Estado del proyecto', '',
  '- **informe-de-avance.pdf**: entregables y commits, decisiones, fases, riesgos y pendientes.', '',
  '00–04, F00–F03 y F07 conservan su contenido. Algunas referencias de esas lecciones son históricas; el informe y 05–07 explican el estado de esta entrega.', '',
  'F04, F05 y F06 están pendientes y no se incluyen como documentos existentes.', '',
  'Los PDF se regeneraron desde Markdown. La carpeta no contiene claves, volcados de pacientes, repositorios de referencia ni archivos temporales de revisión.', '',
].join('\n'));

// Ejecuta npm run pdf sin depender de la política de scripts PowerShell ni de comillas de shell.
const npmCli = process.env.npm_execpath ?? join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
execFileSync(process.execPath, [npmCli, 'run', 'pdf', '--', ...lessons, report, indexFile], {
  cwd: root, stdio: 'inherit', env: { ...process.env, PDF_LAYOUT_AUDIT: '1' },
});
const files = [...lessons.map((file) => `${basename(file, '.md')}.pdf`), 'informe-de-avance.pdf', 'INDICE.pdf'];
for (const file of lessons) {
  const name = `${basename(file, '.md')}.pdf`;
  await copyFile(join(out, name), join(delivery, name));
}
await copyFile(join(out, `${basename(report, '.md')}.pdf`), join(delivery, 'informe-de-avance.pdf'));
await copyFile(join(out, 'INDICE.pdf'), join(delivery, 'INDICE.pdf'));

for (const [file, expected] of before) {
  if (await hash(file) !== expected) throw new Error(`Cambió una lección protegida: ${file}`);
}

const manifest = [];
for (const file of files.sort()) {
  const bytes = await readFile(join(delivery, file));
  if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error(`PDF inválido: ${file}`);
  manifest.push({ file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}

// ZIP estándar, sin dependencias nuevas: un directorio entrega/ con cada PDF.
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const parts = [], central = [];
let offset = 0;
for (const { file } of manifest) {
  const data = await readFile(join(delivery, file));
  const packed = deflateRawSync(data);
  const name = Buffer.from(`entrega/${file}`);
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
  local.writeUInt16LE(0x5d5a, 12); // 2026-10-26, formato DOS
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18);
  local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
  parts.push(local, name, packed);
  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(0x0800, 8); entry.writeUInt16LE(8, 10); entry.writeUInt16LE(0x5d5a, 14);
  entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(packed.length, 20);
  entry.writeUInt32LE(data.length, 24); entry.writeUInt16LE(name.length, 28);
  entry.writeUInt32LE(offset, 42); central.push(entry, name);
  offset += local.length + name.length + packed.length;
}
const directory = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(manifest.length, 8);
end.writeUInt16LE(manifest.length, 10); end.writeUInt32LE(directory.length, 12);
end.writeUInt32LE(offset, 16);
const zip = join(out, `optinova-docs-${date}.zip`);
await writeFile(zip, Buffer.concat([...parts, directory, end]));
await writeFile(join(out, 'entrega-manifest.json'), JSON.stringify({ date, protectedFiles: [...before], files: manifest }, null, 2));
console.log(`\nCarpeta: ${delivery}\nZIP: ${zip}`);
for (const item of manifest) console.log(`${item.file}: ${item.bytes} bytes`);
