import { Environment } from './environment.model';

// Producción (ng build). Va en git, así que no lleva claves: en Cloudflare Pages,
// `npm run build:pages` lo reescribe con SUPABASE_URL y SUPABASE_KEY (scripts/deploy/set-env.mjs).
// En desarrollo (ng serve, ng test) Angular reemplaza este archivo por
// environment.local.ts (ver fileReplacements en angular.json).
export const environment: Environment = {
  production: true,
  supabaseUrl: '',
  supabaseKey: '',
};
