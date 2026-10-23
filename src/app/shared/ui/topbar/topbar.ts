// C-21 Topbar
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { Component, computed, inject, input, output } from '@angular/core';
import {
  LucideChevronDown,
  LucideDynamicIcon,
  LucideLogOut,
  LucideMoon,
  LucidePanelLeft,
  LucideStore,
  LucideSun,
} from '@lucide/angular';
import { ThemeService } from '../../../core/theme/theme.service';

/**
 * Barra superior: botón de menú, título y descripción de la página, sucursal,
 * claro/oscuro y usuario. En densidad compacta mide 56px y oculta la descripción.
 */
@Component({
  selector: 'onv-topbar',
  imports: [LucideDynamicIcon, CdkMenuTrigger, CdkMenu, CdkMenuItem],
  templateUrl: './topbar.html',
  host: { class: 'block shrink-0' },
})
export class Topbar {
  readonly title = input.required<string>();
  readonly description = input<string>();
  /** Sucursal del usuario. Se muestra como texto: hoy nadie tiene varias sucursales (C-21). */
  readonly branch = input<string>();
  readonly userName = input<string>();
  readonly userRole = input<string>();
  /** Se pulsó el botón de menú. */
  readonly toggleMenu = output<void>();
  /** Se eligió "Cerrar sesión" en el menú del usuario. */
  readonly logout = output<void>();

  protected readonly theme = inject(ThemeService);

  /** "Ana Rodríguez" → "AR" (C-19 Avatar). */
  protected readonly initials = computed(() =>
    (this.userName() ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join(''),
  );

  protected readonly menuIcon = LucidePanelLeft;
  protected readonly storeIcon = LucideStore;
  protected readonly moonIcon = LucideMoon;
  protected readonly sunIcon = LucideSun;
  protected readonly chevronIcon = LucideChevronDown;
  protected readonly logoutIcon = LucideLogOut;

  protected toggleTheme(): void {
    this.theme.setMode(this.theme.isDark() ? 'light' : 'dark');
  }
}
