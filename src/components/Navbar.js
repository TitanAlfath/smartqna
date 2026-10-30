/**
 * SmartQ&A — iPhone Dynamic Island & Liquid Glass Floating Dock Navigation
 */

import { getCurrentAdmin, getFirebaseConnectionInfo, getSessionById, logoutAdmin } from '../services/firebase.js';
import { openQRCodeModal, openFirebaseConfigModal } from './QRCodeModal.js';
import { Icons } from './Icons.js';
import { navigateTo, showToast } from '../app.js';

export function renderNavbar(currentPath) {
  const admin = getCurrentAdmin();
  const fbInfo = getFirebaseConnectionInfo();
  const activeSession = getSessionById();
  const isAdminRoute = currentPath.startsWith('/admin') && currentPath !== '/admin/login';

  const adminNavLinks = [
    { path: '/admin/dashboard', label: 'Moderation' },
    { path: '/admin/draw', label: 'Stage Draw' },
    { path: '/admin/sessions', label: 'Sessions' },
    { path: '/admin/history', label: 'Archive' }
  ];

  return `
    <header class="sticky top-3 z-40 px-3 sm:px-6 pt-1 pb-2 pointer-events-none">
      <div class="max-w-5xl mx-auto flex flex-col items-center gap-2.5">
        <!-- Main iPhone Dynamic Island Capsule -->
        <div class="dynamic-island pointer-events-auto w-full px-3 sm:px-4 py-2 flex items-center justify-between gap-2 text-white">
          <!-- Left: App Emblem & Live Session Activity Pill -->
          <div class="flex items-center gap-2.5 min-w-0">
            <a
              href="#/"
              class="flex items-center gap-2.5 pr-2.5 py-0.5 rounded-full hover:opacity-90 transition shrink-0 focus:outline-none"
            >
              <span class="w-8 h-8 rounded-full bg-gradient-to-b from-[#3B82F6] to-[#2563EB] text-white font-semibold text-xs flex items-center justify-center shadow-inner border border-white/30">
                Q
              </span>
              <span class="font-semibold text-sm tracking-tight text-white">
                Smart<span class="text-[#06B6D4]">Q&amp;A</span>
              </span>
            </a>

            ${
              activeSession
                ? `
              <div class="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.08] border border-white/[0.12] min-w-0">
                <span class="w-2 h-2 rounded-full shrink-0 ${
                  activeSession.status === 'active'
                    ? 'bg-[#06B6D4] shadow-[0_0_8px_#06B6D4]'
                    : 'bg-slate-500'
                }"></span>
                <span class="text-xs text-slate-200 truncate max-w-[190px] font-medium" title="${escapeHtml(activeSession.name)}">
                  ${escapeHtml(activeSession.name)}
                </span>
                <span class="font-mono text-[11px] px-2 py-0.5 rounded-full bg-white/[0.1] text-[#06B6D4]">
                  ${escapeHtml(activeSession.id)}
                </span>
              </div>
            `
                : ''
            }
          </div>

          <!-- Right: Liquid Capsule Controls -->
          <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <!-- Cloud / Sync Status Capsule -->
            <button
              type="button"
              id="nav-btn-firebase-config"
              title="Pengaturan Koneksi Firebase Realtime Database"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition border ${
                fbInfo.connected
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30 hover:bg-emerald-500/25'
                  : 'bg-white/[0.08] text-slate-200 border-white/[0.12] hover:bg-white/[0.14]'
              }"
            >
              ${Icons.database('w-3.5 h-3.5 text-[#06B6D4]')}
              <span class="hidden sm:inline">${fbInfo.connected ? 'iCloud / Firebase' : 'Live Sync'}</span>
            </button>

            ${
              activeSession
                ? `
              <button
                type="button"
                id="nav-btn-qr"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-white border border-white/[0.12] text-xs font-medium transition"
              >
                ${Icons.qr('w-3.5 h-3.5 text-[#06B6D4]')}
                <span class="hidden sm:inline">QR</span>
              </button>
            `
                : ''
            }

            <a
              href="#/participant"
              class="px-3.5 py-1.5 rounded-full text-xs font-medium transition ${
                currentPath === '/participant'
                  ? 'bg-white text-[#0F172A] shadow-sm font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.08]'
              }"
            >
              Peserta
            </a>

            ${
              admin
                ? `
              <div class="flex items-center gap-1">
                <a
                  href="#/admin/dashboard"
                  class="px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                    isAdminRoute
                      ? 'bg-[#2563EB] text-white shadow-[0_0_16px_rgba(37,99,235,0.5)] border border-white/25'
                      : 'bg-white/[0.1] text-white hover:bg-white/[0.18]'
                  }"
                >
                  Kontrol
                </a>
                <button
                  type="button"
                  id="nav-btn-logout"
                  title="Keluar dari sesi Moderator"
                  class="px-2.5 py-1.5 rounded-full text-xs text-slate-400 hover:text-red-300 hover:bg-red-500/15 transition"
                >
                  Keluar
                </button>
              </div>
            `
                : `
              <a
                href="#/admin/login"
                class="px-3.5 py-1.5 rounded-full bg-[#2563EB] hover:bg-blue-500 text-white text-xs font-semibold transition border border-white/25 shadow-sm"
              >
                Moderator
              </a>
            `
            }
          </div>
        </div>

        <!-- Secondary Floating Segmented Control Pill (Admin Views) -->
        ${
          isAdminRoute
            ? `
          <nav
            aria-label="Navigasi Ruang Kontrol"
            class="pointer-events-auto liquid-glass px-1.5 py-1.5 rounded-full inline-flex items-center gap-1 shadow-lg"
          >
            ${adminNavLinks
              .map((item) => {
                const active = currentPath === item.path;
                return `
                  <a
                    href="#${item.path}"
                    class="px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                      active
                        ? 'bg-[#0F172A] text-white shadow-sm'
                        : 'text-slate-600 hover:text-[#0F172A] hover:bg-white/60'
                    }"
                  >
                    ${item.label}
                  </a>
                `;
              })
              .join('')}
          </nav>
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
      showToast('Sesi moderator telah diakhiri.', 'info');
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
