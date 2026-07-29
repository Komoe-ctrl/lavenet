import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { CatalogService } from '../../../core/services/catalog.service';
import { Service } from '../../../core/models';

@Component({
  selector: 'app-admin-services',
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="admin-services animate-fade-in">
      <div class="page-header">
        <div>
          <h1>Gestion des services</h1>
          <p>{{ services().length }} service(s) configuré(s)</p>
        </div>
        <button class="btn btn-primary" (click)="openForm()">+ Nouveau service</button>
      </div>

      @if (loading()) {
        <div class="loading-overlay"><span class="spinner"></span></div>
      } @else {
        <div class="services-grid">
          @for (svc of services(); track svc.id) {
            <div class="service-admin-card" [class.inactive]="!svc.active">
              <div class="svc-header">
                <div class="svc-icon-wrap">{{ getCatIcon(svc.category) }}</div>
                <div class="svc-status">
                  <span class="badge" [class.badge-success]="svc.active" [class.badge-error]="!svc.active">
                    {{ svc.active ? 'Actif' : 'Inactif' }}
                  </span>
                </div>
              </div>
              <h3>{{ svc.name }}</h3>
              <p>{{ svc.description }}</p>
              <div class="svc-meta">
                <span class="price-badge">{{ svc.price | number }} FCFA / {{ svc.unit }}</span>
                <span class="duration">⏱ {{ svc.duration_hours }}h</span>
              </div>
              <div class="svc-actions">
                <button class="btn btn-outline btn-sm" (click)="editService(svc)">Modifier</button>
                <button class="btn btn-ghost btn-sm" (click)="toggleActive(svc)">
                  {{ svc.active ? 'Désactiver' : 'Activer' }}
                </button>
              </div>
            </div>
          }
        </div>
      }

      @if (showForm()) {
        <div class="modal-overlay" (click)="showForm.set(false)">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>{{ editingId() ? 'Modifier le service' : 'Nouveau service' }}</h3>
              <button (click)="showForm.set(false)">✕</button>
            </div>
            <div class="modal-body">
              @if (formError()) { <div class="alert alert-error mb-3">{{ formError() }}</div> }
              <form (ngSubmit)="saveService()" class="svc-form">
                <div class="grid-2">
                  <div class="form-group">
                    <label>Nom</label>
                    <input type="text" [(ngModel)]="form.name" name="name" required>
                  </div>
                  <div class="form-group">
                    <label>Catégorie</label>
                    <select [(ngModel)]="form.category" name="category">
                      <option value="washing">Lavage</option>
                      <option value="ironing">Repassage</option>
                      <option value="pressing">Pressing</option>
                      <option value="dry_cleaning">Nettoyage à sec</option>
                      <option value="special">Spécial</option>
                    </select>
                  </div>
                </div>
                <div class="form-group">
                  <label>Description</label>
                  <textarea [(ngModel)]="form.description" name="description"></textarea>
                </div>
                <div class="grid-2">
                  <div class="form-group">
                    <label>Prix (FCFA)</label>
                    <input type="number" [(ngModel)]="form.price" name="price" min="0" required>
                  </div>
                  <div class="form-group">
                    <label>Unité</label>
                    <input type="text" [(ngModel)]="form.unit" name="unit" placeholder="pièce">
                  </div>
                </div>
                <div class="form-group">
                  <label>Délai (heures)</label>
                  <input type="number" [(ngModel)]="form.duration_hours" name="duration_hours" min="1">
                </div>
                <div class="form-actions">
                  <button type="button" class="btn btn-ghost" (click)="showForm.set(false)">Annuler</button>
                  <button type="submit" class="btn btn-primary" [disabled]="saving()">
                    @if (saving()) { <span class="spinner"></span> } Enregistrer
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
    .services-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .service-admin-card {
      background: white; border: 1px solid var(--neutral-200); border-radius: var(--radius-lg); padding: 20px;
      transition: all 0.2s; &:hover { box-shadow: var(--shadow-md); } &.inactive { opacity: 0.6; }
      .svc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
      .svc-icon-wrap { font-size: 1.75rem; width: 44px; height: 44px; background: var(--primary-50); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; }
      h3 { font-size: 1rem; margin-bottom: 4px; }
      p { font-size: 0.8rem; color: var(--neutral-500); margin-bottom: 12px; line-height: 1.5; }
      .svc-meta { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; .price-badge { background: var(--primary-50); color: var(--primary-700); padding: 4px 10px; border-radius: var(--radius-full); font-size: 0.8rem; font-weight: 700; } .duration { font-size: 0.78rem; color: var(--neutral-400); } }
      .svc-actions { display: flex; gap: 8px; }
    }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 200; }
    .modal { background: white; border-radius: var(--radius-xl); width: 520px; max-width: 90vw; max-height: 90vh; overflow-y: auto;
      .modal-header { padding: 16px 20px; border-bottom: 1px solid var(--neutral-200); display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: white; h3 { font-size: 1rem; } button { font-size: 1rem; color: var(--neutral-500); } }
      .modal-body { padding: 20px; }
    }
    .svc-form { display: flex; flex-direction: column; gap: 16px; }
    .form-actions { display: flex; justify-content: flex-end; gap: 8px; }
    .mb-3 { margin-bottom: 12px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

    @media (max-width: 1024px) { .services-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 768px) { .services-grid { grid-template-columns: 1fr; } }
  `]
})
export class AdminServicesComponent implements OnInit {
  services = signal<Service[]>([]);
  loading = signal(true);
  showForm = signal(false);
  saving = signal(false);
  formError = signal('');
  editingId = signal<string | null>(null);

  form = { name: '', description: '', price: 0, category: 'washing', unit: 'pièce', duration_hours: 24 };

  constructor(private catalogService: CatalogService) {}

  async ngOnInit() {
    try {
      this.services.set(await this.catalogService.getAllServices());
    } finally {
      this.loading.set(false);
    }
  }

  openForm() {
    this.form = { name: '', description: '', price: 0, category: 'washing', unit: 'pièce', duration_hours: 24 };
    this.editingId.set(null);
    this.formError.set('');
    this.showForm.set(true);
  }

  editService(svc: Service) {
    this.form = { name: svc.name, description: svc.description, price: svc.price, category: svc.category, unit: svc.unit, duration_hours: svc.duration_hours };
    this.editingId.set(svc.id);
    this.showForm.set(true);
  }

  async saveService() {
    if (!this.form.name || !this.form.price) { this.formError.set('Veuillez remplir tous les champs obligatoires'); return; }
    this.saving.set(true);
    try {
      if (this.editingId()) {
        const updated = await this.catalogService.updateService(this.editingId()!, this.form);
        this.services.update(svcs => svcs.map(s => s.id === this.editingId() ? updated : s));
      } else {
        const created = await this.catalogService.createService({ ...this.form, icon: 'shirt', active: true, sort_order: this.services().length + 1 });
        this.services.update(svcs => [...svcs, created]);
      }
      this.showForm.set(false);
    } catch (e: any) {
      this.formError.set(e.message);
    } finally {
      this.saving.set(false);
    }
  }

  async toggleActive(svc: Service) {
    const updated = await this.catalogService.updateService(svc.id, { active: !svc.active });
    this.services.update(svcs => svcs.map(s => s.id === svc.id ? updated : s));
  }

  getCatIcon(cat: string): string {
    const m: Record<string, string> = { washing: '🫧', ironing: '🔥', pressing: '👔', dry_cleaning: '✨', special: '⭐' };
    return m[cat] || '👕';
  }
}
