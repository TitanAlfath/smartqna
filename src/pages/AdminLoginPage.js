/**
 * SmartQ&A — 3. Admin Login & Registration Page
 * Dilengkapi sistem Registrasi Akun Admin & Login Terverifikasi (SHA-256)
 * tanpa email/password terisi otomatis agar panel admin terlindungi.
 */

import {
  loginAdmin,
  registerAdmin,
  hasRegisteredAdminAccounts,
  getSessionById
} from '../services/firebase.js';
import { Icons } from '../components/Icons.js';
import { navigateTo, showToast } from '../app.js';

let authMode = null; // 'login' | 'register'
let isPasswordVisible = false;
let isConfirmVisible = false;

export function renderAdminLoginPage() {
  const hasAccounts = hasRegisteredAdminAccounts();
  if (!authMode) {
    authMode = hasAccounts ? 'login' : 'register';
  }

  const isRegister = authMode === 'register';

  return `
    <main class="flex-1 flex items-center justify-center px-4 py-10 sm:py-12">
      <div class="liquid-glass max-w-md w-full p-7 sm:p-9 animate-fade-in">
        <div class="text-center">
          <div class="w-16 h-16 rounded-[22px] bg-white/85 border border-white flex items-center justify-center mx-auto shadow-md p-2">
            <img src="./assets/logo.png" alt="Logo SmartQ&A" class="w-full h-full object-contain drop-shadow-sm" />
          </div>
          <h1 class="text-2xl font-bold text-[#0F172A] mt-4 tracking-tight">
            ${isRegister ? 'Registrasi Akun Admin' : 'Masuk Panel Admin Q&A'}
          </h1>
          <p class="text-xs text-slate-500 mt-1.5 leading-relaxed">
            ${
              isRegister
                ? 'Buat akun penyelenggara/pemateri baru untuk mengelola sesi tanya jawab dan layar undian.'
                : 'Masukkan email dan kata sandi akun admin yang telah terdaftar untuk mengakses panel kontrol.'
            }
          </p>
        </div>

        <!-- Mode Switcher (Masuk / Registrasi) -->
        <div class="ios-segmented grid grid-cols-2 gap-1 p-1 mt-6">
          <button
            type="button"
            id="tab-auth-login"
            class="py-2 text-xs font-semibold rounded-full transition-all ${
              !isRegister ? 'ios-segment-active' : 'text-slate-600 hover:text-[#0F172A]'
            }"
          >
            Masuk Admin
          </button>
          <button
            type="button"
            id="tab-auth-register"
            class="py-2 text-xs font-semibold rounded-full transition-all ${
              isRegister ? 'ios-segment-active' : 'text-slate-600 hover:text-[#0F172A]'
            }"
          >
            Registrasi Baru
          </button>
        </div>

        <form id="admin-auth-form" class="mt-6 space-y-4" autocomplete="off">
          ${
            isRegister
              ? `
            <div>
              <label for="admin-name" class="block text-xs font-semibold text-slate-700 mb-1.5 px-1">
                Nama Lengkap Admin / Pemateri *
              </label>
              <input
                type="text"
                id="admin-name"
                name="name"
                required
                autocomplete="off"
                class="ios-input w-full px-4 py-3 text-sm text-[#0F172A]"
              />
            </div>
          `
              : ''
          }

          <div>
            <label for="admin-email" class="block text-xs font-semibold text-slate-700 mb-1.5 px-1">
              Email Admin *
            </label>
            <input
              type="email"
              id="admin-email"
              name="email"
              required
              autocomplete="off"
              class="ios-input w-full px-4 py-3 text-sm text-[#0F172A]"
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-1.5 px-1">
              <label for="admin-password" class="block text-xs font-semibold text-slate-700">
                Kata Sandi *
              </label>
              <button
                type="button"
                id="btn-toggle-password"
                class="text-[11px] font-semibold text-[#2563EB] hover:underline focus:outline-none"
              >
                ${isPasswordVisible ? 'Sembunyikan' : 'Tampilkan'}
              </button>
            </div>
            <input
              type="${isPasswordVisible ? 'text' : 'password'}"
              id="admin-password"
              name="password"
              required
              minlength="6"
              autocomplete="new-password"
              class="ios-input w-full px-4 py-3 text-sm text-[#0F172A]"
            />
          </div>

          ${
            isRegister
              ? `
            <div>
              <div class="flex items-center justify-between mb-1.5 px-1">
                <label for="admin-confirm-password" class="block text-xs font-semibold text-slate-700">
                  Konfirmasi Kata Sandi *
                </label>
                <button
                  type="button"
                  id="btn-toggle-confirm"
                  class="text-[11px] font-semibold text-[#2563EB] hover:underline focus:outline-none"
                >
                  ${isConfirmVisible ? 'Sembunyikan' : 'Tampilkan'}
                </button>
              </div>
              <input
                type="${isConfirmVisible ? 'text' : 'password'}"
                id="admin-confirm-password"
                name="confirmPassword"
                required
                minlength="6"
                autocomplete="new-password"
                class="ios-input w-full px-4 py-3 text-sm text-[#0F172A]"
              />
            </div>
          `
              : ''
          }

          <div class="pt-2">
            <button
              type="submit"
              id="btn-admin-submit"
              class="ios-btn-primary w-full py-3.5 px-5 font-semibold text-sm inline-flex items-center justify-center gap-2"
            >
              <span>${isRegister ? 'Daftar & Masuk Panel Q&A' : 'Masuk ke Panel Q&A'}</span>
              ${Icons.arrowRight('w-4 h-4')}
            </button>
          </div>
        </form>
      </div>
    </main>
  `;
}

export function bindAdminLoginPageEvents() {
  const loginTab = document.getElementById('tab-auth-login');
  const registerTab = document.getElementById('tab-auth-register');

  if (loginTab) {
    loginTab.addEventListener('click', () => {
      authMode = 'login';
      isPasswordVisible = false;
      isConfirmVisible = false;
      window.dispatchEvent(new CustomEvent('smartqa:rerender'));
    });
  }

  if (registerTab) {
    registerTab.addEventListener('click', () => {
      authMode = 'register';
      isPasswordVisible = false;
      isConfirmVisible = false;
      window.dispatchEvent(new CustomEvent('smartqa:rerender'));
    });
  }

  const togglePassBtn = document.getElementById('btn-toggle-password');
  if (togglePassBtn) {
    togglePassBtn.addEventListener('click', () => {
      const passInput = document.getElementById('admin-password');
      if (!passInput) return;
      isPasswordVisible = !isPasswordVisible;
      passInput.type = isPasswordVisible ? 'text' : 'password';
      togglePassBtn.textContent = isPasswordVisible ? 'Sembunyikan' : 'Tampilkan';
    });
  }

  const toggleConfirmBtn = document.getElementById('btn-toggle-confirm');
  if (toggleConfirmBtn) {
    toggleConfirmBtn.addEventListener('click', () => {
      const confirmInput = document.getElementById('admin-confirm-password');
      if (!confirmInput) return;
      isConfirmVisible = !isConfirmVisible;
      confirmInput.type = isConfirmVisible ? 'text' : 'password';
      toggleConfirmBtn.textContent = isConfirmVisible ? 'Sembunyikan' : 'Tampilkan';
    });
  }

  const form = document.getElementById('admin-auth-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('admin-name')?.value || '';
    const email = document.getElementById('admin-email')?.value || '';
    const password = document.getElementById('admin-password')?.value || '';
    const confirmPassword = document.getElementById('admin-confirm-password')?.value || '';
    const btn = document.getElementById('btn-admin-submit');
    if (btn) btn.disabled = true;

    try {
      if (authMode === 'register') {
        await registerAdmin({ name, email, password, confirmPassword });
        const hasSession = Boolean(getSessionById());
        showToast('Registrasi berhasil. Selamat datang di Panel Admin SmartQ&A.', 'success');
        navigateTo(hasSession ? '/admin/dashboard' : '/admin/sessions');
      } else {
        await loginAdmin(email, password);
        const hasSession = Boolean(getSessionById());
        showToast('Berhasil masuk ke Panel Admin SmartQ&A.', 'success');
        navigateTo(hasSession ? '/admin/dashboard' : '/admin/sessions');
      }
    } catch (err) {
      showToast(err.message || 'Gagal memproses autentikasi.', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}
