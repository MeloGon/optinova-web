// C-20 Sidebar
import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  LucideDynamicIcon,
  LucideIcon,
  LucidePanelLeft,
  LucidePanelLeftClose,
  LucideX,
} from '@lucide/angular';

export interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
  /** Activo solo si la URL es exactamente esta (para /dashboard, que es prefijo de todo). */
  exact?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * Navegación principal: secciones con ítems, versión expandida (256px) o solo íconos (64px).
 * El ítem activo lleva aria-current="page" (fondo tenue + texto 600 + barra de 3px).
 */
@Component({
  selector: 'onv-sidebar',
  imports: [RouterLink, RouterLinkActive, LucideDynamicIcon],
  templateUrl: './sidebar.html',
  host: { class: 'block h-full shrink-0' },
})
export class Sidebar {
  readonly sections = input.required<NavSection[]>();
  readonly collapsed = input(false);
  /** Abierto encima del contenido (pantallas angostas): el botón de abajo dice "Cerrar menú". */
  readonly overlay = input(false);
  /** Se pulsó "Colapsar menú". */
  readonly toggle = output<void>();
  /** Se eligió un ítem (el layout lo usa para cerrar el menú superpuesto). */
  readonly navigate = output<void>();

  protected readonly collapseIcon = LucidePanelLeftClose;
  protected readonly expandIcon = LucidePanelLeft;
  protected readonly closeIcon = LucideX;
}
