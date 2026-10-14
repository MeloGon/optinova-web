import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';
import { PRESETS, applyPrimary } from './primary-scale';

// T-01 Color · T-07 Modo oscuro · densidad (C-02, C-07)

export type ThemeMode = 'light' | 'dark' | 'system';
export type Density = 'comfortable' | 'compact';

interface ThemePrefs {
  mode: ThemeMode;
  density: Density;
  primary: string;
}

// La misma clave la lee el script de src/index.html antes de pintar.
const STORAGE_KEY = 'optinova.theme';

// Hoy el primario se guarda por navegador. Cuando exista la configuración por empresa
// (Fase 4b), el valor por defecto saldrá de core/config en lugar de este preset.
const DEFAULTS: ThemePrefs = {
  mode: 'system',
  density: 'comfortable',
  primary: PRESETS[0].hex,
};

/**
 * Apariencia global de la app: modo claro/oscuro, densidad y color primario.
 * Equivale a un Notifier de Riverpod con keepAlive: una sola instancia para toda la app.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  private readonly html = this.doc.documentElement;
  // defaultView = window; en los tests (jsdom) no existe matchMedia.
  private readonly systemQuery = this.doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');

  private readonly state = signal<ThemePrefs>(this.load());
  private readonly systemDark = signal(this.systemQuery?.matches ?? false);

  readonly mode = computed(() => this.state().mode);
  readonly density = computed(() => this.state().density);
  readonly primary = computed(() => this.state().primary);
  /** Modo que se ve en pantalla: resuelve 'system' según el sistema operativo. */
  readonly isDark = computed(() =>
    this.mode() === 'system' ? this.systemDark() : this.mode() === 'dark',
  );

  constructor() {
    this.systemQuery?.addEventListener('change', (e) => {
      this.systemDark.set(e.matches);
      this.applyAttributes();
    });
    this.applyAttributes();
    applyPrimary(this.primary(), { document: this.doc });
  }

  setMode(mode: ThemeMode): void {
    this.update({ mode });
    this.applyAttributes();
  }

  setDensity(density: Density): void {
    this.update({ density });
    this.applyAttributes();
  }

  setPrimary(hex: string): void {
    this.update({ primary: hex });
    applyPrimary(hex, { document: this.doc });
  }

  private update(patch: Partial<ThemePrefs>): void {
    this.state.update((s) => ({ ...s, ...patch }));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state()));
    } catch {
      // Sin almacenamiento (modo privado): la preferencia dura solo esta sesión.
    }
  }

  private applyAttributes(): void {
    this.html.setAttribute('data-theme', this.isDark() ? 'dark' : 'light');
    this.html.setAttribute('data-density', this.density());
  }

  private load(): ThemePrefs {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<ThemePrefs>;
      return { ...DEFAULTS, ...saved };
    } catch {
      return DEFAULTS;
    }
  }
}
