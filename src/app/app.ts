import { Component, inject } from '@angular/core';
import { Density, ThemeMode, ThemeService } from './core/theme/theme.service';
import { PRESETS } from './core/theme/primary-scale';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly theme = inject(ThemeService);
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
