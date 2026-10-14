import { Component, inject } from '@angular/core';
import { Density, ThemeMode, ThemeService } from '../../core/theme/theme.service';
import { PRESETS } from '../../core/theme/primary-scale';
import { ConfigService } from '../../core/config/config.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { environment } from '../../../environments/environment';

/** Provisional: vista previa del sistema de diseño. El dashboard real (S-02) es E2.7. */
@Component({
  selector: 'app-dashboard-page',
  imports: [MoneyPipe],
  templateUrl: './dashboard.page.html',
})
export class DashboardPage {
  protected readonly theme = inject(ThemeService);
  protected readonly config = inject(ConfigService).config;
  protected readonly presets = PRESETS;
  protected readonly env = environment;

  protected readonly modes: { value: ThemeMode; label: string }[] = [
    { value: 'light', label: 'Claro' },
    { value: 'dark', label: 'Oscuro' },
    { value: 'system', label: 'Sistema' },
  ];

  protected readonly densities: { value: Density; label: string }[] = [
    { value: 'comfortable', label: 'Cómoda' },
    { value: 'compact', label: 'Compacta' },
  ];
}
