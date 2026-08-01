import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { AuthUserDtoOutput } from '../../core/api-client/models/auth-user-dto-output';
import { SessionStore } from '../../core/auth/session.store';
import { SiteHeader } from './site-header';

const SAMPLE_USER: AuthUserDtoOutput = {
  id: 'u1',
  email: 'client@lavenet.ci',
  phone: '+2250700000002',
  role: 'CLIENT',
};

function configureWith(session: {
  isAuthenticated: () => boolean;
  user: () => AuthUserDtoOutput | null;
}) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: SessionStore, useValue: session },
    ],
  });
}

describe('SiteHeader', () => {
  // The invariant this guards: SiteHeader must only ever read SessionStore's
  // already-known state, never call restore() itself -- doing so on /,
  // /tarifs would trigger an API call on load and break the zero-API
  // invariant those prerendered pages depend on (CLAUDE.md's "restauration
  // de session paresseuse" rule).
  it('shows a login link when not authenticated, without calling restore', () => {
    configureWith({ isAuthenticated: () => false, user: () => null });
    const fixture = TestBed.createComponent(SiteHeader);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('LaveNet');
    expect(text).toContain('Se connecter');
    expect(text).not.toContain('client@lavenet.ci');
  });

  it('shows the account link with the email when authenticated', () => {
    configureWith({ isAuthenticated: () => true, user: () => SAMPLE_USER });
    const fixture = TestBed.createComponent(SiteHeader);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('client@lavenet.ci');
    expect(text).not.toContain('Se connecter');

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.account-link');
    expect(link.getAttribute('href')).toBe('/compte');
  });

  it('falls back to a generic label when authenticated without an email', () => {
    configureWith({
      isAuthenticated: () => true,
      user: () => ({ ...SAMPLE_USER, email: null }),
    });
    const fixture = TestBed.createComponent(SiteHeader);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Mon compte');
  });
});
