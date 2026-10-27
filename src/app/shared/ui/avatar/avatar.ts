// C-19 Avatar
import { Component, computed, input } from '@angular/core';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';
export type AvatarTone = 'primary' | 'neutral';

const SIZES: Record<AvatarSize, string> = {
  xs: 'size-6 text-[9px]',
  sm: 'size-8 text-[12px]',
  md: 'size-10 text-[15px]',
  lg: 'size-14 text-[21px]',
};

const TONES: Record<AvatarTone, string> = {
  primary: 'bg-primary-subtle text-primary-subtle-foreground',
  neutral: 'bg-muted text-foreground',
};

/** "María Fernanda Quispe Huamán" → "MQ" (primer nombre + primer apellido, C-19). */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0][0].toUpperCase();
  const surnameStart = Math.floor(words.length / 2);
  return (words[0][0] + words[surnameStart][0]).toUpperCase();
}

/**
 * Círculo con iniciales que representa a una persona; nunca fotos (C-19 Avatar).
 *
 *   <onv-avatar name="María Fernanda Quispe Huamán" size="sm" tone="neutral" />
 */
@Component({
  selector: 'onv-avatar',
  template: `<span [attr.aria-hidden]="hidden() ? true : null" [attr.aria-label]="hidden() ? null : name()">{{
    initials()
  }}</span>`,
  host: { '[class]': 'classes()' },
})
export class Avatar {
  readonly name = input.required<string>();
  readonly size = input<AvatarSize>('md');
  readonly tone = input<AvatarTone>('neutral');
  /** `true` cuando el nombre ya se muestra aparte (evita leerlo dos veces con el lector de pantalla). */
  readonly hidden = input(false);

  protected readonly initials = computed(() => initialsOf(this.name()));

  protected readonly classes = computed(
    () =>
      `inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${SIZES[this.size()]} ${TONES[this.tone()]}`,
  );
}
