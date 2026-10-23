import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideArrowRight,
  LucideCircleAlert,
  LucideDynamicIcon,
  LucideEye,
  LucideEyeOff,
  LucideLock,
  LucideMail,
} from '@lucide/angular';
import { LoginStore } from './login.store';

/** S-01 Login. = LoginView de Flutter. */
@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, LucideDynamicIcon],
  providers: [LoginStore],
  templateUrl: './login.page.html',
  host: { class: 'block w-full max-w-[380px]' },
})
export class LoginPage {
  protected readonly store = inject(LoginStore);

  // = GlobalKey<FormState> + TextEditingController + validator de cada campo.
  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
  });

  protected readonly showPassword = signal(false);
  /** Los errores de campo se muestran después del primer intento de envío. */
  protected readonly submitted = signal(false);

  protected readonly icons = {
    mail: LucideMail,
    lock: LucideLock,
    eye: LucideEye,
    eyeOff: LucideEyeOff,
    arrow: LucideArrowRight,
    alert: LucideCircleAlert,
  };

  protected emailError(): string | null {
    const c = this.form.controls.email;
    if (!this.submitted() && !c.touched) return null;
    if (c.hasError('required')) return 'Escribe tu correo.';
    if (c.hasError('email')) return 'El correo no es válido. Ejemplo: nombre@optinova.pe';
    return null;
  }

  protected passwordError(): string | null {
    const c = this.form.controls.password;
    if (!this.submitted() && !c.touched) return null;
    if (c.hasError('required')) return 'Escribe tu contraseña.';
    if (c.hasError('minlength')) return 'La contraseña debe tener al menos 6 caracteres.';
    return null;
  }

  protected async onSubmit(): Promise<void> {
    this.submitted.set(true);
    if (this.form.invalid || this.store.loading()) return; // = _formKey.currentState.validate()
    const { email, password } = this.form.getRawValue();
    await this.store.submit(email, password);
  }
}
