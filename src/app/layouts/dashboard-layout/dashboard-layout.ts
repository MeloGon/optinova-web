import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { PageData } from '../../core/models/page-data';
import { Sidebar } from '../../shared/ui/sidebar/sidebar';
import { Topbar } from '../../shared/ui/topbar/topbar';
import { DASHBOARD_NAV } from './dashboard-nav';

const COLLAPSED_KEY = 'optinova.sidebar-collapsed';

/**
 * Marco de todas las páginas internas: sidebar (C-20) + topbar (C-21) + contenido.
 * = DashboardLayout de Flutter.
 *
 * Responsive (C-20):
 * - ≥1280px: sidebar fijo; el botón lo colapsa a íconos (se recuerda).
 * - 768–1279px: sidebar en íconos; el botón lo abre encima del contenido, con velo.
 * - <768px: sin sidebar; el botón lo abre encima (= el drawer de Flutter bajo 700px).
 */
@Component({
  selector: 'app-dashboard-layout',
  imports: [RouterOutlet, Sidebar, Topbar],
  templateUrl: './dashboard-layout.html',
  host: { '(document:keydown.escape)': 'overlayOpen.set(false)' },
})
export class DashboardLayout {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly breakpoints = inject(BreakpointObserver);

  protected readonly nav = DASHBOARD_NAV;

  // = MediaQuery.of(context).size.width >= 1280
  protected readonly isWide = toSignal(
    this.breakpoints.observe('(min-width: 1280px)').pipe(map((r) => r.matches)),
    { initialValue: true },
  );
  protected readonly isTablet = toSignal(
    this.breakpoints.observe('(min-width: 768px)').pipe(map((r) => r.matches)),
    { initialValue: true },
  );

  /** Preferencia del usuario en pantallas anchas. */
  private readonly collapsedPref = signal(readCollapsed());
  /** Sidebar superpuesto en pantallas angostas. */
  protected readonly overlayOpen = signal(false);

  protected readonly collapsed = computed(() => (this.isWide() ? this.collapsedPref() : true));

  /** title/description de la ruta activa (los `data` de app.routes.ts). */
  protected readonly page = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.currentPageData()),
    ),
    { initialValue: this.currentPageData() },
  );

  constructor() {
    // Al navegar se cierra el menú superpuesto. takeUntilDestroyed = cancelar la
    // suscripción en dispose(), como un StreamSubscription que se cancela solo.
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.overlayOpen.set(false));
  }

  protected toggleMenu(): void {
    if (this.isWide()) {
      const next = !this.collapsedPref();
      this.collapsedPref.set(next);
      try {
        localStorage.setItem(COLLAPSED_KEY, String(next));
      } catch {
        // Sin almacenamiento: la preferencia dura solo esta sesión.
      }
    } else {
      this.overlayOpen.update((open) => !open);
    }
  }

  /** Baja hasta la ruta hija más profunda y devuelve su `data`. */
  private currentPageData(): PageData {
    // Se recorre el árbol de snapshots: ya está completo aunque la página hija aún no exista.
    let s = this.route.snapshot;
    while (s.firstChild) s = s.firstChild;
    return s.data as PageData;
  }
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}
