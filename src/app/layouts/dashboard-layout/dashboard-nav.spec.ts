import { Route } from '@angular/router';
import { routes } from '../../app.routes';
import { PageData } from '../../core/models/page-data';
import { DASHBOARD_NAV } from './dashboard-nav';

describe('DASHBOARD_NAV', () => {
  const dashboard = routes.find((r) => r.path === 'dashboard')!;
  const routeFor = (path: string): Route | undefined =>
    dashboard.children!.find((r) => `/dashboard${r.path ? '/' + r.path : ''}` === path);

  const items = DASHBOARD_NAV.flatMap((s) => s.items);

  it.each(items.map((i) => [i.path, i]))('%s existe y pide el mismo rol que su ruta', (_, item) => {
    const route = routeFor(item.path);
    expect(route).toBeDefined();
    const routeRole = (route!.data as PageData | undefined)?.minRole ?? 'vendedor';
    expect(routeRole).toBe(item.minRole);
  });
});
