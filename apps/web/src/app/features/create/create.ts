import { Component, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

/**
 * The get-started route (`/create`), for visitors who are already sold. Opens
 * the OS native photo picker so uploading is one tap; the picked photos feed
 * the story-creation flow (built in a later step).
 */
@Component({
  selector: 'app-create',
  imports: [MatButtonModule],
  templateUrl: './create.html',
})
export class Create {
  /** How many photos the user has picked from the native picker. */
  readonly photoCount = signal(0);

  /** Record how many photos came back from the native picker. */
  onPhotosPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.photoCount.set(input.files?.length ?? 0);
  }
}
