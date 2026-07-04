import { Component, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-home',
  imports: [MatButtonModule],
  templateUrl: './home.html',
})
export class Home {
  /** Emitted when the user chooses to start creating a story. */
  readonly start = output<void>();
}
