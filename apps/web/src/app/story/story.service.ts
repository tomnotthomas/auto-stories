import { Injectable, signal } from '@angular/core';

/**
 * The screen the flow is currently on. Phase 1 is one linear, in-memory flow
 * (approach 3.17), so navigation is a signal here rather than the router:
 *   example    — first-open interactive example (the wow)
 *   create     — pick photos + "What's the story?" + tone
 *   generating — the model is building the story
 *   story      — the finished, refinable story (the payoff)
 *   error      — a specific failure (at-capacity / timeout / …)
 */
export type StoryPhase = 'example' | 'create' | 'generating' | 'story' | 'error';

/**
 * Holds the in-progress story in signals and drives the flow between screens.
 * A single root singleton (approach 3.8) — no NgRx, no router. Grows a field
 * per screen as the flow is built out; today it owns the phase machine.
 */
@Injectable({ providedIn: 'root' })
export class StoryService {
  private readonly _phase = signal<StoryPhase>('example');

  /** The screen the flow shell should render. */
  readonly phase = this._phase.asReadonly();

  /** Leave the first-open example and begin creating a story. */
  startCreating(): void {
    this._phase.set('create');
  }

  /** Return to the first-open example (start over). */
  reset(): void {
    this._phase.set('example');
  }
}
