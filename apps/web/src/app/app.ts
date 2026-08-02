import { Component, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

import { StoryService } from './story/story.service';
import { ViewportService } from './viewport.service';
import { Example } from './features/example/example';
import { Create } from './features/create/create';
import { Generating } from './features/generating/generating';
import { Story } from './features/story/story';
import { ErrorScreen } from './features/error/error-screen';

/**
 * Flow shell — renders the current screen for the story flow's phase
 * (approach 3.17). The whole flow is an always-dark, immersive story surface
 * (approach 5.4), so `story-surface` wraps it once here.
 */
@Component({
  selector: 'app-root',
  imports: [Example, Create, Generating, Story, ErrorScreen],
  templateUrl: './app.html',
})
export class App {
  private readonly document = inject(DOCUMENT);
  protected readonly story = inject(StoryService);
  /** Drives the keyboard-aware shell height (see template). */
  protected readonly viewport = inject(ViewportService);

  constructor() {
    // Honour the landing page's deep-link: /app/create opens the picker,
    // /app/example (default) opens the demo. There is no router, so the entry
    // path is read once here from the URL the SPA was served at.
    this.story.startFromPath(this.document.location.pathname);
  }
}
