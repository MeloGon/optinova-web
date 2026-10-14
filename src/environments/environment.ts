import { Environment } from './environment.model';

// Producción (ng build). Va en git, así que no lleva claves: se completan al decidir
// el hosting de la beta (Fase 3).
// En desarrollo (ng serve, ng test) Angular reemplaza este archivo por
// environment.local.ts (ver fileReplacements en angular.json).
export const environment: Environment = {
  production: true,
  supabaseUrl: '',
  supabaseKey: '',
};
