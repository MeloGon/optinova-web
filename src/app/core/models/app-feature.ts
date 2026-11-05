/** Un interruptor de `app_config` (= AppConfigRepository.getAll() de Flutter, una fila por flag). */
export interface AppFeature {
  key: string;
  value: boolean;
  description: string;
}
