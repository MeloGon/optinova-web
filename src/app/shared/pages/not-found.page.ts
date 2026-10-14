import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideCompass, LucideDynamicIcon } from '@lucide/angular';

/** Ruta inexistente. = NoPageFoundView de Flutter. */
@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink, LucideDynamicIcon],
  template: `
    <main class="grid min-h-dvh place-items-center bg-background p-6 text-foreground">
      <div class="flex max-w-sm flex-col items-center gap-3 text-center">
        <span class="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <svg [lucideIcon]="icon" [size]="20"></svg>
        </span>
        <h1 class="text-title">Página no encontrada</h1>
        <p class="text-body-sm text-muted-foreground">La dirección no existe o cambió de lugar.</p>
        <a
          routerLink="/dashboard"
          class="mt-2 inline-flex h-(--onv-control-h) items-center rounded-md bg-primary px-4 text-label text-primary-foreground hover:bg-primary-hover"
        >
          Ir al dashboard
        </a>
      </div>
    </main>
  `,
})
export class NotFoundPage {
  protected readonly icon = LucideCompass;
}
