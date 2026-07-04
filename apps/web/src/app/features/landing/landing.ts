import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

/**
 * The app's front door (`/`). Two calls-to-action mirror the two ways in:
 * explore a finished Story with no account (`/example`), or start from your
 * own photos (`/create`).
 */
@Component({
  selector: 'app-landing',
  imports: [MatButtonModule, RouterLink],
  templateUrl: './landing.html',
})
export class Landing {}
