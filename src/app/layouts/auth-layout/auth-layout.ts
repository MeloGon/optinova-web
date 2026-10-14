import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfigService } from '../../core/config/config.service';

/**
 * Marco de las pantallas sin sesión (S-01): panel de marca a la izquierda y el
 * formulario a la derecha. Bajo 1024px el panel de marca desaparece. = AuthLayout de Flutter.
 */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet],
  templateUrl: './auth-layout.html',
})
export class AuthLayout {
  protected readonly branches = inject(ConfigService).activeBranches;
}
