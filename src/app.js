/**
 * SmartQ&A — Core Application Router, State Subscriber & Page Controller (iOS Liquid Glass UI)
 */

import {
  initDataService,
  subscribeToAppState,
  isAdminAuthenticated,
  getSessionById
} from './services/firebase.js';
import { renderNavbar, bindNavbarEvents, escapeHtml } from './components/Navbar.js';
import { Icons } from './components/Icons.js';
import { renderLandingPage, bindLandingPageEvents } from './pages/LandingPage.js';
import { renderParticipantPage, bindParticipantPageEvents } from './pages/ParticipantPage.js';
import { renderAdminLoginPage, bindAdminLoginPageEvents } from './pages/AdminLoginPage.js';
import { renderAdminDashboardPage, bindAdminDashboardPageEvents } from './pages/AdminDashboardPage.js';
import { renderRandomDrawPage, bindRandomDrawPageEvents } from './pages/RandomDrawPage.js';
import { renderQuestionHistoryPage, bindQuestionHistoryPageEvents } from './pages/QuestionHistoryPage.js';
import { renderSessionManagementPage, bindSessionManagementPageEvents } from './pages/SessionManagementPage.js';

export function navigateTo(hashPath) {
  window.location.hash = hashPath;
}

export function getCurrentPath() {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  const [path] = hash.split('?');
  return path || '/';
}

export function renderApp() {
  const appEl = document.getElementById('app');
  if (!appEl) return;

  const currentPath = getCurrentPath();
  const isProtectedAdminRoute =
    currentPath.startsWith('/admin') && currentPath !== '/admin/login';

  if (isProtectedAdminRoute && !isAdminAuthenticated()) {
    navigateTo('/admin/login');
    return;
  }

  let pageHtml = '';
  let bindPageEvents = null;

  switch (currentPath) {
    case '/':
      pageHtml = renderLandingPage();
      bindPageEvents = bindLandingPageEvents;
      break;
    case '/participant':
      pageHtml = renderParticipantPage();
      bindPageEvents = bindParticipantPageEvents;
      break;
    case '/admin/login':
      pageHtml = renderAdminLoginPage();
      bindPageEvents = bindAdminLoginPageEvents;
      break;
    case '/admin/dashboard':
      pageHtml = renderAdminDashboardPage();
      bindPageEvents = bindAdminDashboardPageEvents;
      break;
    case '/admin/draw':
      pageHtml = renderRandomDrawPage();
      bindPageEvents = bindRandomDrawPageEvents;
      break;
    case '/admin/history':
      pageHtml = renderQuestionHistoryPage();
      bindPageEvents = bindQuestionHistoryPageEvents;
      break;
    case '/admin/sessions':
      pageHtml = renderSessionManagementPage();
      bindPageEvents = bindSessionManagementPageEvents;
      break;
    default:
      pageHtml = renderLandingPage();
      bindPageEvents = bindLandingPageEvents;
      break;
  }

  const activeEl = document.activeElement;
  const activeId = activeEl ? activeEl.id : null;
  const selectionStart = activeEl && 'selectionStart' in activeEl ? activeEl.selectionStart : null;
  const selectionEnd = activeEl && 'selectionEnd' in activeEl ? activeEl.selectionEnd : null;

  const activeSession = getSessionById();
  const isDarkStageRoute = currentPath === '/admin/draw';

  appEl.innerHTML = `
    ${renderNavbar(currentPath)}
    <div class="flex-1 flex flex-col">
      ${pageHtml}
    </div>
    <footer class="${
      isDarkStageRoute
        ? 'bg-[#060A14] border-t border-white/[0.08] text-slate-400'
        : 'text-slate-500'
    } py-6 px-4 sm:px-6 lg:px-8 text-xs">
      <div class="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <span class="font-bold ${isDarkStageRoute ? 'text-white' : 'text-[#0F172A]'}">SmartQ&amp;A</span>
          <span>•</span>
          <span>Interactive Audience Question &amp; Answer System</span>
        </div>
        <div class="flex flex-wrap items-center gap-4 text-xs font-medium">
          ${
            activeSession
              ? `<span class="font-mono text-[11px]">Sesi: <strong class="${isDarkStageRoute ? 'text-[#06B6D4]' : 'text-[#2563EB]'}">${escapeHtml(activeSession.id)}</strong></span>`
              : ''
          }
          <a href="#/participant" class="hover:underline">Peserta</a>
          <a href="#/admin/dashboard" class="hover:underline">Ruang Kontrol</a>
          <a href="#/admin/draw" class="hover:underline">Layar Proyektor</a>
        </div>
      </div>
    </footer>
  `;

  bindNavbarEvents();
  if (typeof bindPageEvents === 'function') {
    bindPageEvents();
  }

  if (activeId) {
    const restoredEl = document.getElementById(activeId);
    if (restoredEl) {
      restoredEl.focus();
      if (selectionStart !== null && 'setSelectionRange' in restoredEl) {
        try {
          restoredEl.setSelectionRange(selectionStart, selectionEnd);
        } catch {
          // Ignore for inputs without selection range support
        }
      }
    }
  }
}

export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const dotMap = {
    success: 'bg-[#06B6D4] shadow-[0_0_8px_#06B6D4]',
    error: 'bg-red-400 shadow-[0_0_8px_#f87171]',
    info: 'bg-[#3B82F6] shadow-[0_0_8px_#3B82F6]'
  };

  const toast = document.createElement('div');
  toast.className =
    'dynamic-island text-white px-4 py-3 text-xs font-semibold pointer-events-auto animate-fade-in flex items-center justify-between gap-3';
  toast.innerHTML = `
    <div class="flex items-center gap-2.5">
      <span class="w-2 h-2 rounded-full shrink-0 ${dotMap[type] || dotMap.info}"></span>
      <span class="leading-snug">${escapeHtml(message)}</span>
    </div>
    <button type="button" aria-label="Tutup notifikasi" class="text-slate-400 hover:text-white p-0.5 transition">
      ${Icons.close('w-3.5 h-3.5')}
    </button>
  `;

  toast.querySelector('button').addEventListener('click', () => toast.remove());
  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 3800);
}

export function initApp() {
  initDataService();
  window.addEventListener('hashchange', renderApp);
  window.addEventListener('smartqa:rerender', renderApp);
  subscribeToAppState(() => {
    renderApp();
  });
}
