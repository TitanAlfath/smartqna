/**
 * SmartQ&A — 3. Admin Login Page (iOS Liquid Glass Authentication Sheet)
 */

import { loginAdmin, getFirebaseConnectionInfo } from '../services/firebase.js';
import { Icons } from '../components/Icons.js';
import { navigateTo, showToast } from '../app.js';

export function renderAdminLoginPage() {
  const fbInfo = getFirebaseConnectionInfo();

  return `
    <main class="flex-1 flex items-center justify-center px-4 py-12">
      <div class="liquid-glass max-w-md w-full p-7 sm:p-9 animate-fade-in">
        <div class="text-center">
          <div class="w-14 h-14 rounded-[20px] bg-gradient-to-b from-[#0F172A] to-slate-800 text-[#06B6D4] flex items-center justify-center mx-auto shadow-lg border border-white/20">
            ${Icons.lock('w-6 h-6')}
          </div>
          <span class="inline-block mt-4 px-3 py-1 rounded-full text-[11px] font-semibold bg-[#2563EB]/10 text-[#2563EB]">
            OTORISASI MODERATOR
          </span>
          <h1 class="text-2xl font-bold text-[#0F172A] mt-2 tracking-tight">
            Masuk ke Ruang Kontrol
          </h1>
          <p class="text-xs text-slate-500 mt-1 leading-relaxed">
            Kelola antrean pertanyaan peserta secara real-time dan kendalikan layar undian proyektor.
          </p>
        </div>

        <form id="admin-login-form" class="mt-6 space-y-4">
          <div>
            <label for="admin-email" class="block text-xs font-semibold text-slate-700 mb-1.5 px-1">
              Email Moderator
            </label>
            <input
              type="email"
              id="admin-email"
              required
              value="admin@smartqa.id"
              placeholder="admin@smartqa.id"
              class="ios-input w-full px-4 py-3 text-sm text-[#0F172A]"
            />
          </div>

          <div>
            <label for="admin-password" class="block text-xs font-semibold text-slate-700 mb-1.5 px-1">
              Kata Sandi
            </label>
            <input
              type="password"
              id="admin-password"
              required
              value="smartqa2026"
              placeholder="Minimal 6 karakter"
              class="ios-input w-full px-4 py-3 text-sm text-[#0F172A]"
            />
          </div>

          <div class="pt-2">
            <button
              type="submit"
              id="btn-admin-login"
              class="ios-btn-primary w-full py-3.5 px-5 font-semibold text-sm inline-flex items-center justify-center gap-2"
            >
              <span>Buka Ruang Kontrol</span>
              ${Icons.arrowRight('w-4 h-4')}
            </button>
          </div>
        </form>

        <div class="mt-6 pt-4 border-t border-slate-200/70 flex items-center justify-between text-[11px] font-medium text-slate-500">
          <span>Mode: <strong class="text-[#0F172A]">${fbInfo.connected ? 'Firebase Auth' : 'Local Session'}</strong></span>
          <span>Kredensial Siap Uji</span>
        </div>
      </div>
    </main>
  `;
}

export function bindAdminLoginPageEvents() {
  const form = document.getElementById('admin-login-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email')?.value || '';
    const password = document.getElementById('admin-password')?.value || '';
    const btn = document.getElementById('btn-admin-login');
    if (btn) btn.disabled = true;

    try {
      await loginAdmin(email, password);
      showToast('Otorisasi berhasil. Selamat datang di Ruang Kontrol.', 'success');
      navigateTo('/admin/dashboard');
    } catch (err) {
      showToast(err.message || 'Gagal melakukan autentikasi.', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}
