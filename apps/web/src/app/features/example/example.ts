import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

/**
 * The no-login example route (`/example`). Lets a first-time visitor explore a
 * finished Story before committing anything, then hands off to `/create`.
 */
@Component({
  selector: 'app-example',
  imports: [MatButtonModule, RouterLink],
  templateUrl: './example.html',
})
export class Example {}
