import { Component } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';

/**
 * The model is building the story. Placeholder for now — the real screen
 * (user's photos cycling, staged steps, the API call) lands with the generate
 * gateway in a follow-up PR.
 */
@Component({
  selector: 'app-generating',
  imports: [MatProgressBarModule],
  templateUrl: './generating.html',
})
export class Generating {}
