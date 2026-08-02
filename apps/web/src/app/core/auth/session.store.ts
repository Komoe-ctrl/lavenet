import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { Api } from '../api-client/api';
import { AuthUserDtoOutput } from '../api-client/models/auth-user-dto-output';
import { RegisterDto } from '../api-client/models/register-dto';
import {
  authControllerConfirmPasswordReset,
  authControllerLogin,
  authControllerLogout,
  authControllerMe,
  authControllerRefresh,
  authControllerRegister,
  authControllerRequestPasswordReset,
  authControllerResendOtp,
  authControllerVerifyOtp,
} from '../api-client/functions';

type SessionStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

type SessionState = {
  user: AuthUserDtoOutput | null;
  // In-memory only — never persisted (CLAUDE.md §5: no localStorage for the
  // access token). A page reload always goes through restore() below.
  accessToken: string | null;
  status: SessionStatus;
};

const initialState: SessionState = {
  user: null,
  accessToken: null,
  status: 'idle',
};

// CLAUDE.md §2: NgRx SignalStore is reserved for cart and session state —
// everything else uses plain signals.
export const SessionStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ status }) => ({
    isAuthenticated: computed(() => status() === 'authenticated'),
    isLoading: computed(() => status() === 'loading'),
  })),
  withMethods((store) => {
    const api = inject(Api);

    return {
      async login(identifier: string, password: string): Promise<void> {
        patchState(store, { status: 'loading' });
        try {
          const response = await api.invoke(authControllerLogin, {
            body: { identifier, password },
          });
          patchState(store, {
            user: response.user,
            accessToken: response.accessToken,
            status: 'authenticated',
          });
        } catch (err) {
          patchState(store, { user: null, accessToken: null, status: 'unauthenticated' });
          throw err;
        }
      },

      // Registration logs the user in immediately (same as login) -- an
      // unverified phone can browse, just not order. Returns the demo OTP
      // code (present only when the API runs with DEMO_MODE=true) so the
      // caller can show it in the demo banner.
      async register(input: RegisterDto): Promise<{ demoOtpCode?: string }> {
        patchState(store, { status: 'loading' });
        try {
          const response = await api.invoke(authControllerRegister, { body: input });
          patchState(store, {
            user: response.user,
            accessToken: response.accessToken,
            status: 'authenticated',
          });
          return { demoOtpCode: response.demoOtpCode };
        } catch (err) {
          patchState(store, { user: null, accessToken: null, status: 'unauthenticated' });
          throw err;
        }
      },

      async verifyOtp(code: string): Promise<void> {
        const response = await api.invoke(authControllerVerifyOtp, { body: { code } });
        patchState(store, { user: response.user });
      },

      async resendOtp(): Promise<{ demoOtpCode?: string }> {
        const response = await api.invoke(authControllerResendOtp);
        return { demoOtpCode: response.demoOtpCode };
      },

      // Always resolves -- the API never reveals whether identifier is
      // registered (F-AUTH-04). demoOtpCode is only ever populated when it
      // was and the API runs with DEMO_MODE=true.
      async requestPasswordReset(identifier: string): Promise<{ demoOtpCode?: string }> {
        const response = await api.invoke(authControllerRequestPasswordReset, {
          body: { identifier },
        });
        return { demoOtpCode: response.demoOtpCode };
      },

      // Logs the user in immediately on success, same as login/register --
      // they just proved control of the account via the OTP.
      async confirmPasswordReset(
        identifier: string,
        code: string,
        newPassword: string,
      ): Promise<void> {
        try {
          const response = await api.invoke(authControllerConfirmPasswordReset, {
            body: { identifier, code, newPassword },
          });
          patchState(store, {
            user: response.user,
            accessToken: response.accessToken,
            status: 'authenticated',
          });
        } catch (err) {
          patchState(store, { user: null, accessToken: null, status: 'unauthenticated' });
          throw err;
        }
      },

      async logout(): Promise<void> {
        try {
          await api.invoke(authControllerLogout);
        } finally {
          patchState(store, { user: null, accessToken: null, status: 'unauthenticated' });
        }
      },

      // Called once at app startup. The httpOnly refresh cookie (if any) is
      // the only trace of a session — there's nothing to read synchronously,
      // so this always costs a round-trip before the app knows who's logged
      // in (see the cold-start banner for how that wait is surfaced).
      async restore(): Promise<void> {
        patchState(store, { status: 'loading' });
        try {
          const { accessToken } = await api.invoke(authControllerRefresh);
          const user = await api.invoke(authControllerMe);
          patchState(store, { user, accessToken, status: 'authenticated' });
        } catch {
          patchState(store, { user: null, accessToken: null, status: 'unauthenticated' });
        }
      },

      // Used only by the auth interceptor's silent-refresh-on-401 path:
      // keeps the current user, replaces just the access token. Throws on
      // failure so the interceptor can fall back to clear().
      async refreshAccessToken(): Promise<string> {
        const { accessToken } = await api.invoke(authControllerRefresh);
        patchState(store, { accessToken });
        return accessToken;
      },

      clear(): void {
        patchState(store, { user: null, accessToken: null, status: 'unauthenticated' });
      },
    };
  }),
);
