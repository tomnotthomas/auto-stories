import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/**
 * Tracks the VISUAL viewport so the app shell can shrink when the on-screen
 * keyboard opens. `dvh` / `h-full` follow the *layout* viewport, which the
 * keyboard does not shrink — so a bottom action (e.g. "Create my story") ends up
 * hidden behind the keyboard, and the user has to dismiss it to submit.
 * `window.visualViewport.height` is the one signal that tracks the keyboard
 * across browsers (notably iOS Safari, where the `interactive-widget` viewport
 * hint isn't honoured). `height` is null when the API is unavailable (SSR / old
 * browsers), so callers fall back to the CSS height.
 */
@Injectable({ providedIn: 'root' })
export class ViewportService {
  private readonly _height = signal<number | null>(null);
  private readonly _mobile = signal(false);

  /** Visual-viewport height in px (shrinks with the keyboard), or null. */
  readonly height = this._height.asReadonly();
  /** True on phone-width screens, where the shell should track the keyboard. */
  readonly mobile = this._mobile.asReadonly();

  constructor() {
    const view = inject(DOCUMENT).defaultView;
    const viewport = view?.visualViewport;
    if (!view || !viewport) return;

    // Below Tailwind's `sm` breakpoint — where the shell is full-bleed and the
    // keyboard matters. Above it, the shell is a fixed phone frame (desktop).
    const query = view.matchMedia('(max-width: 639px)');
    const syncMobile = () => this._mobile.set(query.matches);
    const syncHeight = () => this._height.set(viewport.height);
    syncMobile();
    syncHeight();

    viewport.addEventListener('resize', syncHeight);
    query.addEventListener('change', syncMobile);
    inject(DestroyRef).onDestroy(() => {
      viewport.removeEventListener('resize', syncHeight);
      query.removeEventListener('change', syncMobile);
    });
  }
}
