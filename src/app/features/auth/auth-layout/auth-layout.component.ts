import { Component } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, RouterLink],
  template: `
    <div class="auth-wrap">
      <div class="auth-brand">
        <div class="brand-content">
          <a routerLink="/" class="logo">
            <span class="logo-icon">👕</span>
            <span>BlancoPro</span>
          </a>
          <h1>Votre blanchisserie professionnelle</h1>
          <p>Lavage, repassage et pressing à domicile. Service rapide, qualité garantie.</p>
          <div class="features">
            <div class="feature"><span>✓</span> Collecte et livraison à domicile</div>
            <div class="feature"><span>✓</span> Suivi en temps réel</div>
            <div class="feature"><span>✓</span> Paiement sécurisé</div>
            <div class="feature"><span>✓</span> Programme de fidélité</div>
          </div>
        </div>
        <img src="https://images.pexels.com/photos/5591663/pexels-photo-5591663.jpeg?auto=compress&cs=tinysrgb&w=800" alt="Blanchisserie">
      </div>
      <div class="auth-form-side">
        <router-outlet />
      </div>
    </div>
  `,
  styles: [`
    .auth-wrap { display: grid; grid-template-columns: 1fr 1fr; min-height: 100vh; }

    .auth-brand {
      background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 50%, #1e3a8a 100%);
      color: white;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 48px;
      position: relative;
      overflow: hidden;

      img {
        position: absolute; inset: 0; width: 100%; height: 100%;
        object-fit: cover; opacity: 0.12;
      }

      .brand-content { position: relative; z-index: 1; }

      .logo {
        display: flex; align-items: center; gap: 10px;
        font-size: 1.5rem; font-weight: 800; margin-bottom: 48px;
        font-family: 'Poppins', sans-serif;
        .logo-icon { font-size: 2rem; }
      }

      h1 { font-size: 2rem; line-height: 1.2; margin-bottom: 16px; }
      p { font-size: 1rem; opacity: 0.85; line-height: 1.6; margin-bottom: 32px; }

      .features {
        display: flex; flex-direction: column; gap: 12px;
        .feature { display: flex; align-items: center; gap: 10px; font-size: 0.95rem; opacity: 0.9;
          span { width: 22px; height: 22px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; flex-shrink: 0; }
        }
      }
    }

    .auth-form-side {
      background: white; display: flex;
      align-items: center; justify-content: center; padding: 48px;
    }

    @media (max-width: 768px) {
      .auth-wrap { grid-template-columns: 1fr; }
      .auth-brand { display: none; }
      .auth-form-side { padding: 24px; }
    }
  `]
})
export class AuthLayoutComponent {}
