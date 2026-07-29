import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { getSupabase } from './supabase';
import { Profile } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabase = getSupabase();

  readonly currentUser = signal<any>(null);
  readonly profile = signal<Profile | null>(null);
  readonly loading = signal(true);

  readonly isLoggedIn = computed(() => !!this.currentUser());
  readonly isAdmin = computed(() => this.profile()?.role === 'admin');
  readonly isStaff = computed(() => ['admin', 'staff'].includes(this.profile()?.role ?? ''));

  constructor(private router: Router) {
    this.initAuth();
  }

  private async initAuth() {
    const { data: { session } } = await this.supabase.auth.getSession();
    this.currentUser.set(session?.user ?? null);
    if (session?.user) await this.loadProfile(session.user.id);
    this.loading.set(false);

    this.supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        this.currentUser.set(session?.user ?? null);
        if (session?.user) {
          await this.loadProfile(session.user.id);
        } else {
          this.profile.set(null);
        }
      })();
    });
  }

  private async loadProfile(userId: string) {
    const { data } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    this.profile.set(data);
  }

  async signUp(email: string, password: string, fullName: string, phone: string) {
    const { data, error } = await this.supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (data.user) {
      await this.supabase.from('profiles').insert({
        id: data.user.id,
        full_name: fullName,
        phone,
        role: 'client'
      });
      await this.loadProfile(data.user.id);
    }
    return data;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async signOut() {
    await this.supabase.auth.signOut();
    this.router.navigate(['/']);
  }

  async updateProfile(updates: Partial<Profile>) {
    const user = this.currentUser();
    if (!user) return;
    const { data, error } = await this.supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();
    if (error) throw error;
    this.profile.set(data);
    return data;
  }
}
