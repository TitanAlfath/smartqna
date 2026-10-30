/**
 * SmartQ&A — iPhone Liquid Glass Sheet Modals (QR Code & Cloud Config)
 */

import { generateQRDataUrl, downloadSessionQRPng, getParticipantSessionUrl } from '../utils/qrGenerator.js';
import {
  getActiveFirebaseConfig,
  saveRuntimeFirebaseConfig,
  clearRuntimeFirebaseConfig,
  getFirebaseConnectionInfo
} from '../services/firebase.js';
import { escapeHtml } from './Navbar.js';
import { Icons } from './Icons.js';
import { showToast } from '../app.js';

export async function openQRCodeModal(sessionId, sessionName) {
  const existing = document.getElementById('smartqa-modal-overlay');
  if (existing) existing.remove();

  const targetUrl = getParticipantSessionUrl(sessionId);

  const modal = document.createElement('div');
  modal.id = 'smartqa-modal-overlay';
  modal.className =
    'fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = `
    <div class="liquid-glass max-w-md w-full max-h-[90dvh] overflow-y-auto p-5 sm:p-8 relative text-center">
      <!-- iOS Sheet Grabber Handle -->
      <div class="w-10 h-1.5 rounded-full bg-slate-400/40 mx-auto mb-4 sm:mb-5"></div>

      <button
        type="button"
        id="modal-close-btn"
        aria-label="Tutup modal"
        class="absolute top-4 right-4 sm:top-5 sm:right-5 w-8 h-8 rounded-full bg-slate-900/[0.06] hover:bg-slate-900/[0.12] text-slate-600 flex items-center justify-center transition"
      >
        ${Icons.close('w-4 h-4')}
      </button>

      <h3 class="text-lg sm:text-xl font-bold text-[#0F172A] mt-1 tracking-tight pr-6 pl-6">
        ${escapeHtml(sessionName)}
      </h3>
      <p class="text-xs text-slate-500 mt-1">
        Kode Sesi: <strong class="font-mono text-[#2563EB]">${escapeHtml(sessionId)}</strong> • Arahkan kamera ponsel untuk bergabung.
      </p>

      <!-- QR Code Squircle Frame -->
      <div class="my-4 sm:my-6 p-4 sm:p-5 rounded-[24px] bg-white/90 border border-white shadow-sm inline-flex items-center justify-center">
        <img
          id="qr-modal-img"
          alt="QR Code Sesi ${escapeHtml(sessionId)}"
          class="w-44 h-44 sm:w-56 sm:h-56 rounded-2xl object-contain"
        />
      </div>

      <div class="mb-5 text-left">
        <label for="qr-modal-url-input" class="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 px-1">
          Tautan Sesi Peserta
        </label>
        <div class="flex items-center gap-1.5 p-1.5 rounded-full bg-white/80 border border-slate-200/80 shadow-inner">
          <input
            type="text"
            readonly
            id="qr-modal-url-input"
            value="${escapeHtml(targetUrl)}"
            class="w-full px-3 py-1.5 text-xs font-mono text-slate-700 bg-transparent focus:outline-none"
          />
          <button
            type="button"
            id="qr-modal-copy-btn"
            class="px-4 py-2 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition"
          >
            ${Icons.copy('w-3.5 h-3.5')}
            <span>Salin</span>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          type="button"
          id="qr-modal-download-btn"
          class="ios-btn-primary w-full py-3 px-4 font-semibold text-xs inline-flex items-center justify-center gap-2"
        >
          ${Icons.download('w-3.5 h-3.5')}
          <span>Simpan Poster PNG</span>
        </button>
        <a
          href="#/participant?session=${encodeURIComponent(sessionId)}"
          id="qr-modal-open-participant"
          class="ios-btn-glass w-full py-3 px-4 font-semibold text-xs inline-flex items-center justify-center gap-1.5"
        >
          <span>Buka Portal Peserta</span>
          ${Icons.arrowUpRight('w-3.5 h-3.5')}
        </a>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  try {
    const { dataUrl } = await generateQRDataUrl(sessionId, 340);
    const imgEl = document.getElementById('qr-modal-img');
    if (imgEl) imgEl.src = dataUrl;
  } catch {
    showToast('Gagal memuat gambar QR Code.', 'error');
  }

  modal.querySelector('#modal-close-btn').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  modal.querySelector('#qr-modal-open-participant').addEventListener('click', () => {
    modal.remove();
  });

  modal.querySelector('#qr-modal-copy-btn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      showToast('Tautan sesi disalin ke clipboard.', 'success');
    } catch {
      const input = modal.querySelector('#qr-modal-url-input');
      input.select();
      document.execCommand('copy');
      showToast('Tautan sesi disalin.', 'success');
    }
  });

  modal.querySelector('#qr-modal-download-btn').addEventListener('click', async () => {
    try {
      await downloadSessionQRPng(sessionId, sessionName);
      showToast('Poster QR Code PNG berhasil disimpan.', 'success');
    } catch {
      showToast('Gagal mengunduh QR Code.', 'error');
    }
  });
}

export function openFirebaseConfigModal() {
  const existing = document.getElementById('smartqa-modal-overlay');
  if (existing) existing.remove();

  const currentCfg = getActiveFirebaseConfig() || {};
  const fbInfo = getFirebaseConnectionInfo();

  const modal = document.createElement('div');
  modal.id = 'smartqa-modal-overlay';
  modal.className =
    'fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in overflow-y-auto';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = `
    <div class="liquid-glass max-w-lg w-full p-6 sm:p-8 relative my-8">
      <div class="w-10 h-1.5 rounded-full bg-slate-400/40 mx-auto mb-5"></div>

      <button
        type="button"
        id="fb-modal-close"
        aria-label="Tutup modal"
        class="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-900/[0.06] hover:bg-slate-900/[0.12] text-slate-600 flex items-center justify-center transition"
      >
        ${Icons.close('w-4 h-4')}
      </button>

      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full ${fbInfo.connected ? 'bg-emerald-500' : 'bg-[#06B6D4]'}"></span>
        <span class="text-xs font-semibold text-[#2563EB]">
          ${fbInfo.connected ? 'Firebase Cloud Connected' : 'Local Real-Time Sync Active'}
        </span>
      </div>

      <h3 class="text-xl font-bold text-[#0F172A] mt-1.5 tracking-tight">
        Koneksi Database Cloud
      </h3>
      <p class="text-xs text-slate-600 mt-1 leading-relaxed">
        Masukkan kredensial Firebase melalui file <code class="bg-white/80 px-1.5 py-0.5 rounded-md font-mono text-[#2563EB]">.env</code> atau simpan langsung di bawah ini untuk sinkronisasi lintas perangkat via internet.
      </p>

      <form id="fb-config-form" class="mt-5 space-y-3.5 text-left">
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1 px-1">API Key (apiKey) *</label>
          <input
            type="text"
            name="apiKey"
            required
            placeholder="AIzaSy..."
            value="${escapeHtml(currentCfg.apiKey || '')}"
            class="ios-input w-full px-3.5 py-2.5 text-xs font-mono"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1 px-1">Database URL (databaseURL) *</label>
          <input
            type="url"
            name="databaseURL"
            required
            placeholder="https://project-id-default-rtdb.asia-southeast1.firebasedatabase.app"
            value="${escapeHtml(currentCfg.databaseURL || '')}"
            class="ios-input w-full px-3.5 py-2.5 text-xs font-mono"
          />
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1 px-1">Project ID *</label>
            <input
              type="text"
              name="projectId"
              required
              placeholder="smart-qa-project"
              value="${escapeHtml(currentCfg.projectId || '')}"
              class="ios-input w-full px-3.5 py-2.5 text-xs font-mono"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1 px-1">Auth Domain</label>
            <input
              type="text"
              name="authDomain"
              placeholder="smart-qa-project.firebaseapp.com"
              value="${escapeHtml(currentCfg.authDomain || '')}"
              class="ios-input w-full px-3.5 py-2.5 text-xs font-mono"
            />
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1 px-1">App ID</label>
            <input
              type="text"
              name="appId"
              placeholder="1:123456789:web:abcdef"
              value="${escapeHtml(currentCfg.appId || '')}"
              class="ios-input w-full px-3.5 py-2.5 text-xs font-mono"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1 px-1">Messaging Sender ID</label>
            <input
              type="text"
              name="messagingSenderId"
              placeholder="1234567890"
              value="${escapeHtml(currentCfg.messagingSenderId || '')}"
              class="ios-input w-full px-3.5 py-2.5 text-xs font-mono"
            />
          </div>
        </div>

        <div class="pt-4 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          ${
            fbInfo.connected
              ? `
            <button
              type="button"
              id="fb-clear-btn"
              class="ios-btn-glass w-full sm:w-auto px-4 py-2.5 text-red-600 font-semibold text-xs"
            >
              Reset Konfigurasi
            </button>
          `
              : ''
          }
          <button
            type="submit"
            class="ios-btn-primary w-full sm:w-auto px-6 py-2.5 font-semibold text-xs"
          >
            Simpan &amp; Hubungkan
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#fb-modal-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  const clearBtn = modal.querySelector('#fb-clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearRuntimeFirebaseConfig();
    });
  }

  modal.querySelector('#fb-config-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const projectId = (fd.get('projectId') || '').trim();
    const cfg = {
      apiKey: (fd.get('apiKey') || '').trim(),
      databaseURL: (fd.get('databaseURL') || '').trim(),
      projectId,
      authDomain: (fd.get('authDomain') || '').trim() || `${projectId}.firebaseapp.com`,
      storageBucket: `${projectId}.appspot.com`,
      messagingSenderId: (fd.get('messagingSenderId') || '').trim(),
      appId: (fd.get('appId') || '').trim()
    };
    saveRuntimeFirebaseConfig(cfg);
  });
}
