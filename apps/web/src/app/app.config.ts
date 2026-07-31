import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
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
    // No app-wide session restore here on purpose: public pages must never
    // call the API just because the app loaded. SessionStore.restore() is
    // triggered lazily by authGuard, only when a private route is actually
    // visited — see core/auth/auth.guard.ts.
  ],
};
