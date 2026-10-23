import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideLucideConfig } from '@lucide/angular';
import { routes } from './app.routes';
import { SessionStore } from './core/auth/session.store';
import { SupabaseAuthRepository } from './core/data/supabase-auth.repository';
import { AuthRepository } from './core/repositories/auth.repository';
import { ThemeService } from './core/theme/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // withComponentInputBinding: el `data` y los parámetros de la ruta llegan como input() de la página.
    provideRouter(routes, withComponentInputBinding()),
    // Íconos Lucide con trazo 1.75px (sistema de diseño, Iconografía).
    provideLucideConfig({ strokeWidth: 1.75 }),
    // Repositorio abstracto → implementación (= Provider<AuthRepository>((ref) => AuthRepositoryImpl())).
    { provide: AuthRepository, useClass: SupabaseAuthRepository },
    // Crea ThemeService al arrancar para aplicar el primario guardado antes de la primera pantalla.
    provideAppInitializer(() => {
      inject(ThemeService);
    }),
    // Restaura la sesión antes de la primera navegación: los guards ya saben si hay usuario
    // (= el splash + AuthStatus.checking de Flutter). Mientras tanto se ve el splash de index.html.
    provideAppInitializer(() => inject(SessionStore).restore()),
  ],
};
