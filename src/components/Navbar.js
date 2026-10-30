/**
 * SmartQ&A — Clean Floating Navigation Bar (Responsive Mobile, Tablet & Desktop)
 */

import { getCurrentAdmin, getSessionById, logoutAdmin } from '../services/firebase.js';
import { openQRCodeModal, openFirebaseConfigModal } from './QRCodeModal.js';
import { Icons } from './Icons.js';
import { navigateTo, showToast } from '../app.js';

export function renderNavbar(currentPath) {
  const admin = getCurrentAdmin();
  const activeSession = getSessionById();
  const isAdminRoute = currentPath.startsWith('/admin') && currentPath !== '/admin/login';

  const adminNavLinks = [
    { path: '/admin/dashboard', label: 'Dashboard Q&A' },
    { path: '/admin/draw', label: 'Undian Proyektor' },
    { path: '/admin/sessions', label: 'Kelola Sesi' },
    { path: '/admin/history', label: 'Riwayat & CSV' }
  ];

  return `
    <header class="sticky top-2 sm:top-3 z-40 px-2.5 sm:px-6 pt-1 pb-2 pointer-events-none safe-top">
      <div class="max-w-5xl mx-auto flex flex-col items-center gap-2">
        <!-- Main Navigation Bar -->
        <div class="liquid-glass rounded-full pointer-events-auto w-full px-3.5 sm:px-5 py-2 sm:py-2.5 flex items-center justify-between gap-2 text-[#0F172A]">
          <!-- Left: Brand Logo -->
          <div class="flex items-center gap-2.5 min-w-0">
            <a
              href="#/"
              class="flex items-center gap-2 pr-1 sm:pr-2 py-0.5 rounded-full hover:opacity-90 transition shrink-0 focus:outline-none"
            >
              <img
                src="./assets/logo.png"
                alt="Logo SmartQ&A"
                class="w-7 h-7 sm:w-8 sm:h-8 object-contain drop-shadow-sm shrink-0"
              />
              <span class="font-bold text-xs sm:text-sm tracking-tight text-[#0F172A]">
                Smart<span class="text-[#2563EB]">Q&amp;A</span>
              </span>
            </a>
          </div>

          <!-- Right: Navigation Controls -->
          <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
            ${
              activeSession
                ? `
              <button
                type="button"
                id="nav-btn-qr"
                title="Tampilkan QR Code Sesi"
                class="inline-flex items-center justify-center gap-1.5 p-2 sm:px-3.5 sm:py-1.5 rounded-full bg-white/80 hover:bg-white text-[#0F172A] border border-white text-xs font-semibold transition shadow-sm"
              >
                ${Icons.qr('w-3.5 h-3.5 text-[#2563EB] shrink-0')}
                <span class="hidden sm:inline">QR</span>
              </button>
            `
                : ''
            }

            <a
              href="#/participant"
              class="px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap ${
                currentPath === '/participant'
                  ? 'bg-white text-[#2563EB] shadow-sm'
                  : 'text-slate-600 hover:text-[#0F172A] hover:bg-white/70'
              }"
            >
              <span class="sm:hidden">Peserta</span>
              <span class="hidden sm:inline">Tanya Jawab</span>
            </a>

            ${
              admin
                ? `
              <div class="flex items-center gap-1.5">
                <a
                  href="#${activeSession ? '/admin/dashboard' : '/admin/sessions'}"
                  class="ios-btn-primary px-3.5 sm:px-4 py-1.5 text-xs font-semibold transition whitespace-nowrap"
                >
                  ${activeSession ? 'Panel Q&A' : 'Mulai Q&A'}
                </a>
                <button
                  type="button"
                  id="nav-btn-logout"
                  title="Keluar dari akun Admin"
                  class="px-2.5 py-1.5 rounded-full text-[11px] sm:text-xs font-medium text-slate-500 hover:text-red-600 transition"
                >
                  Keluar
                </button>
              </div>
            `
                : `
              <a
                href="#/admin/login"
                class="ios-btn-primary px-3.5 sm:px-4 py-1.5 text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap"
              >
                <span>Mulai Q&amp;A</span>
                ${Icons.arrowRight('w-3 h-3 hidden xs:inline')}
              </a>
            `
            }
          </div>
        </div>

        <!-- Secondary Admin Navigation Bar -->
        ${
          isAdminRoute
            ? `
          <div class="w-full sm:w-auto max-w-full flex justify-center pointer-events-auto">
            <nav
              aria-label="Navigasi Panel Q&A"
              class="liquid-glass rounded-full p-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full"
            >
              ${adminNavLinks
                .map((item) => {
                  const active = currentPath === item.path;
                  return `
                    <a
                      href="#${item.path}"
                      class="px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                        active
                          ? 'ios-btn-primary shadow-sm'
                          : 'text-slate-600 hover:text-[#0F172A] hover:bg-white/60'
                      }"
                    >
                      ${item.label}
                    </a>
                  `;
                })
                .join('')}
            </nav>
          </div>
        `
            : ''
        }
      </div>
    </header>
  `;
}

export function bindNavbarEvents() {
  const qrBtn = document.getElementById('nav-btn-qr');
  if (qrBtn) {
    qrBtn.addEventListener('click', () => {
      const session = getSessionById();
      if (session) {
        openQRCodeModal(session.id, session.name);
      }
    });
  }

  const fbBtn = document.getElementById('nav-btn-firebase-config');
  if (fbBtn) {
    fbBtn.addEventListener('click', () => {
      openFirebaseConfigModal();
    });
  }

  const logoutBtn = document.getElementById('nav-btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await logoutAdmin();
      showToast('Anda telah keluar dari panel Q&A.', 'info');
      navigateTo('/');
    });
  }
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatTimeAgo(ts) {
  if (!ts) return '-';
  const diffSec = Math.max(0, Math.floor((Date.now() - Number(ts)) / 1000));
  if (diffSec < 10) return 'Baru saja';
  if (diffSec < 60) return `${diffSec}d lalu`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}j lalu`;
  return new Date(Number(ts)).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}
