import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Authenticated-only: nothing meaningful to prerender (no user at build
  // time), and prerendering it would run the auth guard/session restore
  // during the build with no live API — client-rendered instead.
  {
    path: 'compte',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
