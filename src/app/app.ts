import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('Optinova Web');
  protected readonly clicks = signal(0);

  protected addClick() {
    this.clicks.update((c) => c + 1);
  }

  // Demo del primario personalizable: cambia la variable CSS --brand.
  protected setBrand(color: string) {
    document.documentElement.style.setProperty('--brand', color);
  }
}
