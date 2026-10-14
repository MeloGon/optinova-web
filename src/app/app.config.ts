import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideLucideConfig } from '@lucide/angular';
import { routes } from './app.routes';
import { ThemeService } from './core/theme/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // withComponentInputBinding: el `data` y los parámetros de la ruta llegan como input() de la página.
    provideRouter(routes, withComponentInputBinding()),
    // Íconos Lucide con trazo 1.75px (sistema de diseño, Iconografía).
    provideLucideConfig({ strokeWidth: 1.75 }),
    // Crea ThemeService al arrancar para aplicar el primario guardado antes de la primera pantalla.
    provideAppInitializer(() => {
      inject(ThemeService);
    }),
  ],
};
