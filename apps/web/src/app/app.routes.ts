import { Routes } from '@angular/router';

// The landing page (`/`) leads to two entry points, mirroring its two CTAs:
//   /example  — explore a finished Story with no account ("check it out")
//   /create   — start from your own photos ("I'm sold")
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/landing/landing').then((m) => m.Landing),
  },
  {
    path: 'example',
    loadComponent: () => import('./features/example/example').then((m) => m.Example),
  },
  {
    path: 'create',
    loadComponent: () => import('./features/create/create').then((m) => m.Create),
  },
  { path: '**', redirectTo: '' },
];
