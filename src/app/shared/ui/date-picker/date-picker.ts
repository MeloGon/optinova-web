// C-04 Date picker
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { DestroyRef, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NgControl } from '@angular/forms';
import { LucideCalendar, LucideChevronLeft, LucideChevronRight, LucideCircleAlert, LucideDynamicIcon } from '@lucide/angular';

const WEEKDAYS = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'];
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

interface DayCell {
  iso: string;
  label: number;
  outside: boolean;
  today: boolean;
  selected: boolean;
  disabled: boolean;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** `Date` local → `yyyy-MM-dd` (= today() que ya usan los stores/páginas). */
function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDisplay(iso: string): string {
  const d = fromIso(iso);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '';
}

/** `dd/mm/aaaa` escrito a mano → `yyyy-MM-dd`, o null si no es una fecha real (ej. 31/02). */
function fromDisplay(text: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return toIso(d);
}

function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Selector de fecha en español, `dd/mm/aaaa`: se puede escribir o elegir en un calendario propio
 * (= C-04 de Claude Design). Reemplaza el `<input type="date">` nativo, cuyo calendario lo dibuja
 * el navegador y no se puede tocar (ni para ponerle un botón "Hoy").
 *
 * Autocontenido (no va dentro de `<onv-field>`): trae su propia etiqueta y mensaje de error/ayuda.
 *
 *   <onv-date-picker label="Fecha de nacimiento" inputId="birth" formControlName="birthDate"
 *     [maxDate]="today" [errors]="{ future: 'No puede ser una fecha futura.' }" />
 */
@Component({
  selector: 'onv-date-picker',
  imports: [OverlayModule, LucideDynamicIcon],
  templateUrl: './date-picker.html',
  host: { class: 'flex flex-col gap-1.5' },
})
export class DatePicker implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly inputId = input.required<string>();
  readonly required = input(false);
  readonly hint = input<string>();
  /** Texto por clave de error. `invalidFormat` ya trae un mensaje por defecto. */
  readonly errors = input<Record<string, string>>({});
  /** `yyyy-MM-dd`; fuera de este rango el día queda deshabilitado en el calendario. */
  readonly minDate = input<string | null>(null);
  readonly maxDate = input<string | null>(null);

  private readonly ngControl = inject(NgControl, { self: true, optional: true });

  protected readonly calendarIcon = LucideCalendar;
  protected readonly prevIcon = LucideChevronLeft;
  protected readonly nextIcon = LucideChevronRight;
  protected readonly alertIcon = LucideCircleAlert;
  protected readonly weekdays = WEEKDAYS;

  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  ];

  /** `yyyy-MM-dd`, o '' sin fecha. Es lo que recibe/entrega el `FormControl`. */
  private readonly value = signal('');
  protected readonly displayValue = signal('');
  protected readonly open = signal(false);
  protected readonly disabled = signal(false);
  protected readonly viewMonth = signal(today());
  /** El texto escrito no es una fecha válida (ej. "31/02/2026"); se marca recién al salir del campo. */
  private readonly formatInvalid = signal(false);

  /** El estado del control (touched, errors) no es un signal: este contador fuerza a recalcular. */
  private readonly changes = signal(0);

  constructor() {
    // No se provee NG_VALUE_ACCESSOR (como harían la mayoría de los CVA): este componente
    // SÍ necesita leer su propio NgControl para los errores, y proveerse a sí mismo generaría
    // una dependencia circular (NG0200). En su lugar, se asigna como valueAccessor a mano,
    // igual que recomienda Angular para un control de formulario personalizado.
    if (this.ngControl) this.ngControl.valueAccessor = this;

    const destroyRef = inject(DestroyRef);
    this.ngControl?.control?.events.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => this.changes.update((n) => n + 1));
  }

  protected readonly monthTitle = computed(() => `${MONTHS[this.viewMonth().getMonth()]} ${this.viewMonth().getFullYear()}`);

  protected readonly days = computed<DayCell[]>(() => {
    const view = this.viewMonth();
    const year = view.getFullYear();
    const month = view.getMonth();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // lunes = 0
    const start = new Date(year, month, 1 - firstWeekday);
    const todayIso = toIso(today());
    const selectedIso = this.value();
    const min = this.minDate() ? fromIso(this.minDate()!) : null;
    const max = this.maxDate() ? fromIso(this.maxDate()!) : null;

    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(year, month, start.getDate() + i);
      const iso = toIso(d);
      return {
        iso,
        label: d.getDate(),
        outside: d.getMonth() !== month,
        today: iso === todayIso,
        selected: iso === selectedIso,
        disabled: (min !== null && d < min) || (max !== null && d > max),
      };
    });
  });

  protected readonly todayDisabled = computed(() => {
    const t = today();
    const min = this.minDate() ? fromIso(this.minDate()!) : null;
    const max = this.maxDate() ? fromIso(this.maxDate()!) : null;
    return (min !== null && t < min) || (max !== null && t > max);
  });

  /**
   * Nombre del primer error del control (`required`, `future`...), o `invalidFormat` si lo
   * escrito no es una fecha. Solo se muestra tocado el campo (igual criterio que `OnvInput`).
   */
  protected errorKey(): string | null {
    this.changes();
    if (this.formatInvalid()) return 'invalidFormat';
    const control = this.ngControl?.control;
    if (!control || !control.invalid || !(control.touched || control.dirty)) return null;
    return Object.keys(control.errors ?? {})[0] ?? null;
  }

  protected errorMessage(): string | null {
    const key = this.errorKey();
    if (!key) return null;
    if (key === 'invalidFormat') return this.errors()['invalidFormat'] ?? 'Fecha no válida.';
    return this.errors()[key] ?? 'El valor no es válido.';
  }

  protected toggle(): void {
    if (this.disabled()) return;
    if (!this.open()) this.viewMonth.set(fromIso(this.value()) ?? today());
    this.open.update((v) => !v);
  }

  protected onInput(raw: string): void {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    this.displayValue.set(formatted);
    this.formatInvalid.set(false);

    if (digits.length === 8) {
      const iso = fromDisplay(formatted);
      if (iso) this.commit(iso);
      else this.formatInvalid.set(true);
    }
  }

  protected onBlur(): void {
    this.onTouched();
    const text = this.displayValue().trim();
    if (!text) {
      this.formatInvalid.set(false);
      this.commit('');
      return;
    }
    const iso = fromDisplay(text);
    if (iso) {
      this.formatInvalid.set(false);
      this.commit(iso);
    } else {
      this.formatInvalid.set(true);
    }
  }

  protected pick(day: DayCell): void {
    if (day.disabled) return;
    this.formatInvalid.set(false);
    this.commit(day.iso);
    this.open.set(false);
  }

  protected prevMonth(): void {
    const v = this.viewMonth();
    this.viewMonth.set(new Date(v.getFullYear(), v.getMonth() - 1, 1));
  }

  protected nextMonth(): void {
    const v = this.viewMonth();
    this.viewMonth.set(new Date(v.getFullYear(), v.getMonth() + 1, 1));
  }

  protected clear(): void {
    this.formatInvalid.set(false);
    this.commit('');
    this.open.set(false);
  }

  protected setToday(): void {
    if (this.todayDisabled()) return;
    this.formatInvalid.set(false);
    this.commit(toIso(today()));
    this.open.set(false);
  }

  private commit(iso: string): void {
    this.value.set(iso);
    this.displayValue.set(toDisplay(iso));
    this.onChange(iso);
    this.onTouched();
  }

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
    this.displayValue.set(toDisplay(value ?? ''));
    this.formatInvalid.set(false);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }
}
