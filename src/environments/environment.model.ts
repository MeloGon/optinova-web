/** Forma que deben tener todos los archivos environment*.ts. */
export interface Environment {
  production: boolean;
  supabaseUrl: string;
  /** Publishable key (`sb_publishable_...`). Nunca la service_role/secret. */
  supabaseKey: string;
}
