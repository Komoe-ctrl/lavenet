import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { getSupabase } from '../../../core/services/supabase';
import { Promotion } from '../../../core/models';

@Component({
  selector: 'app-admin-promotions',
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="admin-promotions animate-fade-in">
      <div class="page-header">
        <div>
          <h1>Gestion des promotions</h1>
          <p>{{ promotions().length }} promotion(s) créée(s)</p>
        </div>
        <button class="btn btn-primary" (click)="openForm()">+ Nouvelle promotion</button>
      </div>

      @if (loading()) {
        <div class="loading-overlay"><span class="spinner"></span></div>
      } @else {
        <div class="table-container">
          <table>
            <thead>
              <tr><th>Code</th><th>Nom</th><th>Type</th><th>Valeur</th><th>Utilisations</th><th>Validité</th><th>Statut</th><th>Actions</th></tr>
            </thead>
            <tbody>
              @for (promo of promotions(); track promo.id) {
                <tr>
                  <td><code class="promo-code">{{ promo.code }}</code></td>
                  <td>{{ promo.name }}</td>
                  <td>
                    <span class="badge badge-info">{{ typeLabels[promo.type] }}</span>
                  </td>
                  <td>
                    @if (promo.type === 'percentage') { {{ promo.value }}% }
                    @else if (promo.type === 'fixed') { {{ promo.value | number }} FCFA }
                    @else { Gratuit }
                  </td>
                  <td>{{ promo.current_uses }} / {{ promo.max_uses }}</td>
                  <td class="text-sm text-muted">
                    {{ formatDate(promo.valid_from) }} - {{ formatDate(promo.valid_until) }}
                  </td>
                  <td>
                    <span class="badge" [class.badge-success]="isActive(promo)" [class.badge-error]="!isActive(promo)">
                      {{ isActive(promo) ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td>
                    <button class="btn btn-ghost btn-sm" (click)="togglePromo(promo)">
                      {{ promo.active ? 'Désactiver' : 'Activer' }}
                    </button>
                  </td>
                </tr>
              }
              @empty {
                <tr><td colspan="8"><div class="empty-state"><div class="empty-icon">🎁</div><h3>Aucune promotion</h3></div></td></tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (showForm()) {
        <div class="modal-overlay" (click)="showForm.set(false)">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Nouvelle promotion</h3>
              <button (click)="showForm.set(false)">✕</button>
            </div>
            <div class="modal-body">
              @if (formError()) { <div class="alert alert-error mb-3">{{ formError() }}</div> }
              <form (ngSubmit)="savePromo()" class="promo-form">
                <div class="grid-2">
                  <div class="form-group">
                    <label>Code promo</label>
                    <input type="text" [(ngModel)]="form.code" name="code" placeholder="PROMO20" required style="text-transform:uppercase">
                  </div>
                  <div class="form-group">
                    <label>Nom</label>
                    <input type="text" [(ngModel)]="form.name" name="name" placeholder="Réduction 20%" required>
                  </div>
                </div>
                <div class="grid-2">
                  <div class="form-group">
                    <label>Type</label>
                    <select [(ngModel)]="form.type" name="type">
                      <option value="percentage">Pourcentage (%)</option>
                      <option value="fixed">Montant fixe (FCFA)</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Valeur</label>
                    <input type="number" [(ngModel)]="form.value" name="value" min="0" required>
                  </div>
                </div>
                <div class="grid-2">
                  <div class="form-group">
                    <label>Commande minimum (FCFA)</label>
                    <input type="number" [(ngModel)]="form.min_order" name="min_order" min="0">
                  </div>
                  <div class="form-group">
                    <label>Nombre max d'utilisations</label>
                    <input type="number" [(ngModel)]="form.max_uses" name="max_uses" min="1">
                  </div>
                </div>
                <div class="grid-2">
                  <div class="form-group">
                    <label>Date de début</label>
                    <input type="date" [(ngModel)]="form.valid_from" name="valid_from">
                  </div>
                  <div class="form-group">
                    <label>Date de fin</label>
                    <input type="date" [(ngModel)]="form.valid_until" name="valid_until">
                  </div>
                </div>
                <div class="form-actions">
                  <button type="button" class="btn btn-ghost" (click)="showForm.set(false)">Annuler</button>
                  <button type="submit" class="btn btn-primary" [disabled]="saving()">
                    @if (saving()) { <span class="spinner"></span> } Créer
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .promo-code { background: var(--primary-50); color: var(--primary-700); padding: 3px 8px; border-radius: 4px; font-weight: 700; letter-spacing: 0.05em; }
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 200; }
    .modal { background: white; border-radius: var(--radius-xl); width: 520px; max-width: 90vw;
      .modal-header { padding: 16px 20px; border-bottom: 1px solid var(--neutral-200); display: flex; justify-content: space-between; align-items: center; }
      .modal-body { padding: 20px; }
    }
    .promo-form { display: flex; flex-direction: column; gap: 16px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-actions { display: flex; justify-content: flex-end; gap: 8px; }
    .mb-3 { margin-bottom: 12px; }
  `]
})
export class AdminPromotionsComponent implements OnInit {
  promotions = signal<Promotion[]>([]);
  loading = signal(true);
  showForm = signal(false);
  saving = signal(false);
  formError = signal('');

  form = { code: '', name: '', type: 'percentage', value: 0, min_order: 0, max_uses: 100, valid_from: '', valid_until: '' };

  typeLabels: Record<string, string> = { percentage: 'Pourcentage', fixed: 'Montant fixe', free_item: 'Gratuit' };

  async ngOnInit() {
    try {
      const { data } = await getSupabase().from('promotions').select('*').order('created_at', { ascending: false });
      this.promotions.set(data ?? []);
    } finally {
      this.loading.set(false);
    }
  }

  isActive(promo: Promotion): boolean {
    return promo.active && new Date(promo.valid_until) > new Date() && promo.current_uses < promo.max_uses;
  }

  openForm() {
    const today = new Date().toISOString().split('T')[0];
    const next30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    this.form = { code: '', name: '', type: 'percentage', value: 0, min_order: 0, max_uses: 100, valid_from: today, valid_until: next30 };
    this.formError.set('');
    this.showForm.set(true);
  }

  async savePromo() {
    if (!this.form.code || !this.form.name) { this.formError.set('Veuillez remplir tous les champs'); return; }
    this.saving.set(true);
    try {
      const { data, error } = await getSupabase().from('promotions').insert({
        ...this.form, code: this.form.code.toUpperCase(), active: true, current_uses: 0
      }).select().single();
      if (error) throw error;
      this.promotions.update(p => [data, ...p]);
      this.showForm.set(false);
    } catch (e: any) {
      this.formError.set(e.message);
    } finally {
      this.saving.set(false);
    }
  }

  async togglePromo(promo: Promotion) {
    await getSupabase().from('promotions').update({ active: !promo.active }).eq('id', promo.id);
    this.promotions.update(p => p.map(x => x.id === promo.id ? { ...x, active: !x.active } : x));
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
