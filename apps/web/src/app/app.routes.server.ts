import { RenderMode, ServerRoute } from '@angular/ssr';

// Prerendering is an explicit opt-in, not the default: only the routes
// listed below are generated as static HTML at build time (ADR 0002 --
// accueil, tarifs, à propos, mentions légales; login/register/mot de
// passe are prerendered too, matching the app's existing behavior, even
// though ADR 0002 doesn't name them explicitly). Every other route,
// including any authenticated route added later, falls through to the
// catch-all below and is safely client-rendered without needing to be
// listed here first -- a route with dynamic params (e.g. commandes/:id)
// no longer breaks the build just because nobody remembered to add it as
// RenderMode.Client (see git history: this inverts the previous default,
// which broke the build on exactly that oversight).
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'tarifs', renderMode: RenderMode.Prerender },
  { path: 'login', renderMode: RenderMode.Prerender },
  { path: 'register', renderMode: RenderMode.Prerender },
  { path: 'mot-de-passe-oublie', renderMode: RenderMode.Prerender },
  { path: 'reinitialiser-mot-de-passe', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Client },
];
