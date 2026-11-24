// Escribe src/environments/environment.ts con las claves de Supabase antes de `ng build`.
// Lo usa el hosting (Cloudflare Pages): las claves viven en sus variables de entorno,
// nunca en git. Equivale a pasar --dart-define en el build de Flutter.
//
// Uso: SUPABASE_URL=... SUPABASE_KEY=sb_publishable_... node scripts/deploy/set-env.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_KEY?.trim();

if (!url || !key) {
  console.error('Faltan SUPABASE_URL y/o SUPABASE_KEY.');
  process.exit(1);
}
if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)) {
  console.error(`SUPABASE_URL no parece una URL de Supabase: ${url}`);
  process.exit(1);
}
// La key viaja al navegador: solo la publishable, nunca la secret/service_role.
if (!key.startsWith('sb_publishable_')) {
  console.error('SUPABASE_KEY debe ser la publishable key (sb_publishable_...).');
  process.exit(1);
}

const target = fileURLToPath(new URL('../../src/environments/environment.ts', import.meta.url));
writeFileSync(
  target,
  `import { Environment } from './environment.model';

// Generado por scripts/deploy/set-env.mjs durante el build del hosting. No editar.
export const environment: Environment = {
  production: true,
  supabaseUrl: ${JSON.stringify(url)},
  supabaseKey: ${JSON.stringify(key)},
};
`,
);
console.log(`environment.ts listo para ${url}`);
