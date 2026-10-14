import { Environment } from './environment.model';

// Plantilla. Cópiala como environment.local.ts (ignorado por git) y completa los valores
// de dev (optinova-db): Supabase → Project Settings → API Keys.
export const environment: Environment = {
  production: false,
  supabaseUrl: 'https://dqofpmpyxumkzlsqcjri.supabase.co',
  supabaseKey: 'sb_publishable_...',
};
