import { Injectable, computed, signal } from '@angular/core';
import { Subject } from 'rxjs';

// Backs the global cold-start banner (CLAUDE.md hosting note: the free-tier
// Render API can take up to ~1 minute to wake up). Tracks in-flight API
// requests so the banner reflects the whole app, not one component's state.
@Injectable({ providedIn: 'root' })
export class ColdStartService {
  private readonly pendingCount = signal(0);
  private readonly slow = signal(false);
  private readonly timedOut = signal(false);
  private readonly retrySubject = new Subject<void>();

  readonly showBanner = computed(() => this.slow() || this.timedOut());
  readonly isTimedOut = this.timedOut.asReadonly();
  readonly retry$ = this.retrySubject.asObservable();

  requestStarted(): void {
    this.pendingCount.update((n) => n + 1);
  }

  requestSlow(): void {
    this.slow.set(true);
  }

  requestTimedOut(): void {
    this.timedOut.set(true);
  }

  requestSettled(): void {
    this.pendingCount.update((n) => Math.max(0, n - 1));
    if (this.pendingCount() === 0) {
      this.slow.set(false);
      this.timedOut.set(false);
    }
  }

  retry(): void {
    this.timedOut.set(false);
    this.retrySubject.next();
  }
}
