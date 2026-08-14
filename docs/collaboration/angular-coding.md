# Angular coding conventions

Applies to `apps/web` (Angular v22+). The rules that bind on every change are summarised in `CLAUDE.md`; this file is the full version.

Upstream source of truth: `angular.dev/assets/context/best-practices.md`. Follow it where this file is silent, so the app stays idiomatic and a new dev onboards fast.

## Scaffold with the CLI

Use `ng generate` for components, services, directives, and pipes. It produces the conventional structure with less hand-written code. (`nest generate` plays the same role in `apps/api`.)

## Components

- Standalone and `OnPush` are the defaults. Do **not** set `standalone: true` or `changeDetection: OnPush` — writing them out is noise.
- Small, single-responsibility components.
- `input()` / `output()` functions, not `@Input()` / `@Output()` decorators.
- `inject()`, not constructor injection.
- Host bindings go in the `host` object, not `@HostBinding` / `@HostListener`.

## State

- Signals for state, `computed()` for derived values.
- Never `mutate`. Use `set()` or `update()`.

## Templates

- Native control flow: `@if` / `@for` / `@switch`. Not `*ngIf` / `*ngFor` / `*ngSwitch`.
- `class` bindings, not `ngClass` / `ngStyle`.

## Forms

Signal Forms for new forms.

## Styling — Tailwind and stock Material, nothing else

- Style with **Tailwind** utility classes and **standard Angular Material** components.
- **No component CSS files.** Do not add `.css` / `.scss` files or set `styleUrls` / `styleUrl` on a component.
- **No inline CSS.** No `styles` / `styles: []` in `@Component`, and no `style="…"` attributes in templates.
- **No custom components.** Use Material components as shipped; don't hand-roll or restyle bespoke variants. Tailwind covers layout and spacing; Material covers the controls.
- Drive colour and elevation from Material theme tokens rather than hand-picked values.

## Type safety and accessibility

- Strict TypeScript. No `any`.
- Must pass AXE / WCAG-AA.

## Testing

See `docs/collaboration/testing.md` — frontend tests assert behaviour and are driven through Material / CDK component harnesses.
