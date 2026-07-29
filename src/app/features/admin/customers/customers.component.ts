import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { getSupabase } from '../../../core/services/supabase';
import { Profile } from '../../../core/models';

@Component({
  selector: 'app-customers',
  imports: [FormsModule],
  template: `
    <div class="customers animate-fade-in">
      <div class="page-header">
        <div>
          <h1>Gestion des clients</h1>
          <p>{{ customers().length }} client(s) enregistré(s)</p>
        </div>
        <button class="btn btn-outline btn-sm" (click)="exportCSV()">📥 Exporter</button>
      </div>

      <div class="filters-bar">
        <input type="search" [(ngModel)]="search" placeholder="Rechercher un client..." class="search-input">
        <select [(ngModel)]="roleFilter" class="filter-select">
          <option value="">Tous les rôles</option>
          <option value="client">Clients</option>
          <option value="admin">Admins</option>
          <option value="staff">Personnel</option>
        </select>
      </div>

      @if (loading()) {
        <div class="loading-overlay"><span class="spinner"></span></div>
      } @else {
        <div class="table-container">
          <table>
            <thead>
              <tr><th>Nom</th><th>Téléphone</th><th>Rôle</th><th>Points fidélité</th><th>Code parrainage</th><th>Inscription</th><th>Actions</th></tr>
            </thead>
            <tbody>
              @for (c of filteredCustomers(); track c.id) {
                <tr>
                  <td><strong>{{ c.full_name || 'Sans nom' }}</strong></td>
                  <td>{{ c.phone || '—' }}</td>
                  <td>
                    <select class="role-select" [value]="c.role" (change)="updateRole(c, $any($event.target).value)">
                      <option value="client">Client</option>
                      <option value="staff">Personnel</option>
                      <option value="admin">Admin</option>
                      <option value="deliverer">Livreur</option>
                    </select>
                  </td>
                  <td><span class="points-badge">⭐ {{ c.loyalty_points }}</span></td>
                  <td><code>{{ c.referral_code }}</code></td>
                  <td>{{ formatDate(c.created_at) }}</td>
                  <td>
                    <button class="btn btn-ghost btn-sm" (click)="viewDetails(c)">Détails</button>
                  </td>
                </tr>
              }
              @empty {
                <tr><td colspan="7"><div class="empty-state"><h3>Aucun client</h3></div></td></tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (selectedCustomer()) {
        <div class="modal-overlay" (click)="selectedCustomer.set(null)">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Détails — {{ selectedCustomer()!.full_name }}</h3>
              <button (click)="selectedCustomer.set(null)">✕</button>
            </div>
            <div class="modal-body">
              <div class="detail-row"><span>Email:</span><span>N/A</span></div>
              <div class="detail-row"><span>Téléphone:</span><span>{{ selectedCustomer()!.phone || 'N/A' }}</span></div>
              <div class="detail-row"><span>Adresse:</span><span>{{ selectedCustomer()!.address || 'N/A' }}</span></div>
              <div class="detail-row"><span>Points:</span><strong>{{ selectedCustomer()!.loyalty_points }} pts</strong></div>
              <div class="detail-row"><span>Parrain:</span><span>{{ selectedCustomer()!.referral_code }}</span></div>
              <div class="detail-row"><span>Inscrit le:</span><span>{{ formatDate(selectedCustomer()!.created_at) }}</span></div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .filters-bar { display: flex; gap: 12px; margin-bottom: 20px; }
    .search-input { flex: 1; padding: 10px 14px; border: 1.5px solid var(--neutral-200); border-radius: var(--radius-md); font-size: 0.9rem; &:focus { border-color: var(--primary-500); outline: none; } }
    .filter-select, .role-select { padding: 10px 14px; border: 1.5px solid var(--neutral-200); border-radius: var(--radius-md); font-size: 0.9rem; background: white; cursor: pointer; }
    .role-select { padding: 4px 8px; font-size: 0.8rem; }
    .points-badge { background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: var(--radius-full); font-size: 0.8rem; font-weight: 600; }
    code { background: var(--neutral-100); padding: 2px 6px; border-radius: 4px; font-size: 0.85rem; }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 200; }
    .modal { background: white; border-radius: var(--radius-xl); width: 400px; max-width: 90vw; overflow: hidden;
      .modal-header { padding: 16px 20px; border-bottom: 1px solid var(--neutral-200); display: flex; justify-content: space-between; align-items: center; h3 { font-size: 1rem; } button { font-size: 1rem; color: var(--neutral-500); &:hover { color: var(--neutral-900); } } }
      .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
    }
    .detail-row { display: flex; justify-content: space-between; font-size: 0.875rem; span:first-child { color: var(--neutral-500); } }
  `]
})
export class CustomersComponent implements OnInit {
  customers = signal<Profile[]>([]);
  loading = signal(true);
  search = '';
  roleFilter = '';
  selectedCustomer = signal<Profile | null>(null);

  constructor() {}

  async ngOnInit() {
    try {
      const { data } = await getSupabase().from('profiles').select('*').order('created_at', { ascending: false });
      this.customers.set(data ?? []);
    } finally {
      this.loading.set(false);
    }
  }

  filteredCustomers(): Profile[] {
    return this.customers().filter(c => {
      const matchSearch = !this.search || c.full_name?.toLowerCase().includes(this.search.toLowerCase()) || c.phone?.includes(this.search);
      const matchRole = !this.roleFilter || c.role === this.roleFilter;
      return matchSearch && matchRole;
    });
  }

  async updateRole(customer: Profile, newRole: string) {
    await getSupabase().from('profiles').update({ role: newRole }).eq('id', customer.id);
    this.customers.update(cs => cs.map(c => c.id === customer.id ? { ...c, role: newRole as any } : c));
  }

  viewDetails(customer: Profile) {
    this.selectedCustomer.set(customer);
  }

  exportCSV() {
    const rows = [
      ['Nom', 'Téléphone', 'Rôle', 'Points', 'Inscription'].join(','),
      ...this.filteredCustomers().map(c => [
        c.full_name, c.phone, c.role, c.loyalty_points,
        new Date(c.created_at).toLocaleDateString('fr-FR')
      ].join(','))
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'clients.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
