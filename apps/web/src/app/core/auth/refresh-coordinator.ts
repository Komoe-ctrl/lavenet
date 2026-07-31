import { Injectable, inject } from '@angular/core';
import { Observable, finalize, from, shareReplay } from 'rxjs';
import { SessionStore } from './session.store';

// Concurrent requests that all hit a 401 at once (e.g. a page firing several
// calls in parallel) must trigger exactly one refresh, not one per request —
// CLAUDE.md §5: "file d'attente des requêtes pendant le refresh." Shares a
// single in-flight refresh Observable so every caller replays its result.
@Injectable({ providedIn: 'root' })
export class RefreshCoordinator {
  private readonly session = inject(SessionStore);
  private refreshing$: Observable<string> | null = null;

  refresh(): Observable<string> {
    this.refreshing$ ??= from(this.session.refreshAccessToken()).pipe(
      shareReplay(1),
      finalize(() => {
        this.refreshing$ = null;
      }),
    );
    return this.refreshing$;
  }
}
