import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  LucideArrowRight,
  LucideDynamicIcon,
  LucideEye,
  LucideEyeOff,
  LucideLock,
  LucideMail,
} from '@lucide/angular';

/**
 * S-01 Login, solo la parte visual. En E2.1 llegan Reactive Forms, validación,
 * Supabase Auth y los controles C-01 Button / C-02 Input.
 */
@Component({
  selector: 'app-login-page',
  imports: [LucideDynamicIcon],
  templateUrl: './login.page.html',
  host: { class: 'block w-full max-w-[380px]' },
})
export class LoginPage {
  private readonly router = inject(Router);

  protected readonly showPassword = signal(false);

  protected readonly icons = {
    mail: LucideMail,
    lock: LucideLock,
    eye: LucideEye,
    eyeOff: LucideEyeOff,
    arrow: LucideArrowRight,
  };

  /** Provisional: entra sin validar. = context.go(RouterName.dashboard) */
  protected enter(): void {
    this.router.navigate(['/dashboard']);
  }
}
