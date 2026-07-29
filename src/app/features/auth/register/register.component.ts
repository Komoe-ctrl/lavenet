import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="register-box animate-fade-in">
      <div class="register-header">
        <h2>Créer un compte</h2>
        <p>Rejoignez BlancoPro dès aujourd'hui</p>
      </div>

      @if (error()) {
        <div class="alert alert-error">{{ error() }}</div>
      }
      @if (success()) {
        <div class="alert alert-success">Compte créé! Vous pouvez maintenant vous connecter.</div>
      }

      <form (ngSubmit)="onRegister()" class="register-form">
        <div class="form-group">
          <label>Nom complet</label>
          <input type="text" [(ngModel)]="fullName" name="fullName" placeholder="Jean Dupont" required>
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" [(ngModel)]="email" name="email" placeholder="vous@exemple.com" required>
        </div>
        <div class="form-group">
          <label>Téléphone</label>
          <input type="tel" [(ngModel)]="phone" name="phone" placeholder="+225 07 XX XX XX XX">
        </div>
        <div class="form-group">
          <label>Mot de passe</label>
          <input type="password" [(ngModel)]="password" name="password" placeholder="Minimum 6 caractères" required minlength="6">
        </div>
        <div class="form-group">
          <label>Code de parrainage (optionnel)</label>
          <input type="text" [(ngModel)]="referralCode" name="referralCode" placeholder="CODE123">
        </div>

        <button type="submit" class="btn btn-primary btn-lg w-full" [disabled]="loading()">
          @if (loading()) { <span class="spinner"></span> Création... }
          @else { Créer mon compte }
        </button>
      </form>

      <div class="register-footer">
        <p>Déjà un compte? <a routerLink="/auth/login">Se connecter</a></p>
        <p class="terms">En créant un compte, vous acceptez nos <a href="#">conditions d'utilisation</a>.</p>
      </div>
    </div>
  `,
  styles: [`
    .register-box { width: 100%; max-width: 420px; }
    .register-header { margin-bottom: 28px; h2 { font-size: 1.75rem; color: var(--neutral-900); } p { color: var(--neutral-500); margin-top: 6px; } }
    .register-form { display: flex; flex-direction: column; gap: 16px; }
    .w-full { width: 100%; justify-content: center; margin-top: 8px; }
    .register-footer { margin-top: 20px; text-align: center; display: flex; flex-direction: column; gap: 8px; p { font-size: 0.875rem; color: var(--neutral-600); } a { color: var(--primary-600); font-weight: 600; &:hover { text-decoration: underline; } } }
    .terms { font-size: 0.78rem !important; color: var(--neutral-400) !important; }
  `]
})
export class RegisterComponent {
  fullName = '';
  email = '';
  phone = '';
  password = '';
  referralCode = '';
  loading = signal(false);
  error = signal('');
  success = signal(false);

  constructor(private auth: AuthService, private router: Router) {}

  async onRegister() {
    if (!this.fullName || !this.email || !this.password) return;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.signUp(this.email, this.password, this.fullName, this.phone);
      this.router.navigate(['/client/home']);
    } catch (e: any) {
      this.error.set(e.message || 'Erreur lors de la création du compte');
    } finally {
      this.loading.set(false);
    }
  }
}
