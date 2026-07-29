import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="login-box animate-fade-in">
      <div class="login-header">
        <h2>Connexion</h2>
        <p>Accédez à votre espace client</p>
      </div>

      @if (error()) {
        <div class="alert alert-error">{{ error() }}</div>
      }

      <form (ngSubmit)="onLogin()" class="login-form">
        <div class="form-group">
          <label>Adresse email</label>
          <input type="email" [(ngModel)]="email" name="email" placeholder="vous@exemple.com" required>
        </div>
        <div class="form-group">
          <label>Mot de passe</label>
          <div class="password-field">
            <input [type]="showPassword() ? 'text' : 'password'"
              [(ngModel)]="password" name="password" placeholder="Votre mot de passe" required>
            <button type="button" class="eye-btn" (click)="showPassword.set(!showPassword())">
              {{ showPassword() ? '🙈' : '👁' }}
            </button>
          </div>
        </div>

        <button type="submit" class="btn btn-primary btn-lg w-full" [disabled]="loading()">
          @if (loading()) { <span class="spinner"></span> Connexion... }
          @else { Se connecter }
        </button>
      </form>

      <div class="login-footer">
        <p>Pas encore de compte? <a routerLink="/auth/register">Créer un compte</a></p>
      </div>
    </div>
  `,
  styles: [`
    .login-box { width: 100%; max-width: 400px; }
    .login-header { margin-bottom: 32px; h2 { font-size: 1.75rem; color: var(--neutral-900); } p { color: var(--neutral-500); margin-top: 6px; } }
    .login-form { display: flex; flex-direction: column; gap: 20px; }
    .password-field { position: relative; input { width: 100%; padding-right: 44px; } }
    .eye-btn { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 1rem; }
    .w-full { width: 100%; justify-content: center; margin-top: 8px; }
    .login-footer { margin-top: 24px; text-align: center; p { font-size: 0.875rem; color: var(--neutral-600); } a { color: var(--primary-600); font-weight: 600; &:hover { text-decoration: underline; } } }
    .demo-accounts { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--neutral-200); .demo-title { font-size: 0.78rem; color: var(--neutral-400); margin-bottom: 8px; } display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .demo-btn { padding: 6px 16px; border-radius: var(--radius-full); border: 1px solid var(--neutral-200); font-size: 0.8rem; color: var(--neutral-600); cursor: pointer; transition: all 0.2s; &:hover { background: var(--neutral-100); border-color: var(--neutral-300); } }
  `]
})
export class LoginComponent {
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');
  showPassword = signal(false);

  constructor(private auth: AuthService, private router: Router) {}

  fillDemo(email: string, password: string) {
    this.email = email;
    this.password = password;
  }

  async onLogin() {
    if (!this.email || !this.password) return;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.signIn(this.email, this.password);
      const profile = this.auth.profile();
      if (profile?.role === 'admin' || profile?.role === 'staff') {
        this.router.navigate(['/admin/dashboard']);
      } else {
        this.router.navigate(['/client/home']);
      }
    } catch (e: any) {
      this.error.set(e.message || 'Email ou mot de passe incorrect');
    } finally {
      this.loading.set(false);
    }
  }
}
