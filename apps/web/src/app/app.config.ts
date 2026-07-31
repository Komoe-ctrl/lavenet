import { isPlatformBrowser } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  PLATFORM_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { SessionStore } from './core/auth/session.store';
import { provideApiConfiguration } from './core/api-client/api-configuration';
import { apiRequestInterceptor } from './core/http/api-request.interceptor';
import { coldStartInterceptor } from './core/http/cold-start.interceptor';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideClientHydration(withEventReplay()),
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideApiConfiguration(environment.apiBaseUrl),
    provideHttpClient(
      withInterceptors([apiRequestInterceptor, authInterceptor, coldStartInterceptor]),
    ),
    // Settles SessionStore's status before the router's first navigation,
    // so authGuard can check it synchronously. Skipped during prerendering
    // (no PLATFORM_ID browser context, no live API to call at build time —
    // see app.routes.server.ts for the /compte route this protects).
    provideAppInitializer(() => {
      if (!isPlatformBrowser(inject(PLATFORM_ID))) {
        return;
      }
      return inject(SessionStore).restore();
    }),
  ],
};
