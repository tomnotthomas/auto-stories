import { Component, inject } from '@angular/core';

import { StoryService } from './story/story.service';
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
  protected readonly story = inject(StoryService);
}
