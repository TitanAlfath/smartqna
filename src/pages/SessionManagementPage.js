/**
 * SmartQ&A — 7. Session Management Page (iOS Liquid Glass Grouped Sheets)
 */

import {
  getAppState,
  getSessionById,
  createNewSession,
  setActiveSession,
  updateSessionConfig,
  clearAllQuestionsInSession,
  deleteSessionById
} from '../services/firebase.js';
import { escapeHtml, formatTimeAgo } from '../components/Navbar.js';
import { Icons } from '../components/Icons.js';
import { openQRCodeModal } from '../components/QRCodeModal.js';
import { showToast, navigateTo } from '../app.js';

export function renderSessionManagementPage() {
  const state = getAppState();

  return `
    <main class="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6">
      <!-- Liquid Glass Header -->
      <section class="liquid-glass p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <img src="./assets/logo.png" alt="SmartQ&A" class="w-11 h-11 object-contain drop-shadow-sm shrink-0" />
          <div>
            <h1 class="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
              Tambah &amp; Kelola Sesi Q&amp;A
            </h1>
            <p class="text-xs text-slate-500 mt-0.5">
              Buat sesi kegiatan baru, atur kode sesi unik, dan bagikan QR Code kepada peserta.
            </p>
          </div>
        </div>
        ${
          state.activeSessionId
            ? `
          <a
            href="#/admin/dashboard"
            class="ios-btn-primary px-5 py-2.5 text-xs font-semibold inline-flex items-center gap-2 self-start sm:self-auto"
          >
            <span>Buka Panel Q&amp;A</span>
            ${Icons.arrowRight('w-3.5 h-3.5')}
          </a>
        `
            : ''
        }
      </section>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- Left (5 Cols): iOS Form Sheet -->
        <section class="lg:col-span-5 liquid-glass p-6 sm:p-7">
          <div class="pb-4 border-b border-slate-200/70 flex items-center justify-between">
            <h2 class="text-base font-bold text-[#0F172A] tracking-tight">
              Buat Sesi Q&amp;A Baru
            </h2>
            <span class="w-8 h-8 rounded-full bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
              ${Icons.plus('w-4 h-4')}
            </span>
          </div>

          <form id="create-session-form" class="mt-5 space-y-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1.5 px-1">Nama Kegiatan / Sesi *</label>
              <input
                type="text"
                name="name"
                required
                class="ios-input w-full px-4 py-2.5 text-sm text-[#0F172A]"
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1.5 px-1">Nama Pemateri</label>
                <input
                  type="text"
                  name="speaker"
                  class="ios-input w-full px-3.5 py-2.5 text-xs sm:text-sm text-[#0F172A]"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1.5 px-1">Kode Sesi (Opsional)</label>
                <input
                  type="text"
                  name="customCode"
                  maxlength="16"
                  class="ios-input w-full px-3.5 py-2.5 text-xs sm:text-sm font-mono uppercase text-[#0F172A]"
                />
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1.5 px-1">Deskripsi Singkat Topik</label>
              <textarea
                name="description"
                rows="3"
                class="ios-input w-full px-4 py-2.5 text-sm text-[#0F172A] resize-none"
              ></textarea>
            </div>

            <label class="liquid-cell flex items-center justify-between p-3.5 cursor-pointer">
              <span class="text-xs font-semibold text-[#0F172A]">Izinkan peserta bertanya secara anonim</span>
              <input type="checkbox" name="allowAnonymous" checked class="w-4 h-4 rounded text-[#2563EB]" />
            </label>

            <label class="liquid-cell flex items-center justify-between p-3.5 cursor-pointer">
              <span class="text-xs font-semibold text-[#0F172A]">Jadikan Sesi Utama yang aktif sekarang</span>
              <input type="checkbox" name="setAsActive" checked class="w-4 h-4 rounded text-[#2563EB]" />
            </label>

            <button
              type="submit"
              class="ios-btn-primary w-full py-3.5 px-5 font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2"
            >
              ${Icons.plus('w-4 h-4')}
              <span>Tambah &amp; Mulai Sesi Q&amp;A</span>
            </button>
          </form>
        </section>

        <!-- Right (7 Cols): Session Cards -->
        <section class="lg:col-span-7 space-y-4">
          ${
            state.sessionsList.length === 0
              ? `
            <div class="liquid-glass p-10 text-center space-y-3">
              <img src="./assets/logo.png" alt="SmartQ&A" class="w-16 h-16 object-contain mx-auto drop-shadow-sm" />
              <h3 class="text-lg font-bold text-[#0F172A] tracking-tight">
                Belum Ada Sesi Q&amp;A
              </h3>
              <p class="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Seluruh daftar sesi masih kosong. Gunakan formulir <strong>Buat Sesi Q&amp;A Baru</strong> di sebelah kiri untuk membuat sesi kegiatan pertama Anda.
              </p>
            </div>
          `
              : state.sessionsList
                  .map((ses) => {
                    const isPrimaryActive = ses.id === state.activeSessionId;
                    const qCount = Object.keys(ses.questions || {}).length;
                    const hCount = Object.keys(ses.drawHistory || {}).length;

                    return `
                      <article class="liquid-glass p-6 transition ${
                        isPrimaryActive ? 'ring-2 ring-[#2563EB]' : ''
                      }">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                          <div class="flex items-center gap-2">
                            <span class="font-mono text-xs font-bold px-3 py-1 rounded-full bg-[#0F172A] text-[#06B6D4]">
                              ${escapeHtml(ses.id)}
                            </span>
                            ${
                              isPrimaryActive
                                ? `<span class="px-3 py-1 rounded-full text-[11px] font-semibold bg-[#2563EB]/15 text-[#2563EB]">★ Sesi Utama</span>`
                                : ''
                            }
                            <span class="px-3 py-1 rounded-full text-[11px] font-semibold ${
                              ses.status === 'active'
                                ? 'bg-emerald-500/15 text-emerald-800 border border-emerald-500/20'
                                : 'bg-slate-200/80 text-slate-600'
                            }">
                              ${ses.status === 'active' ? '● Aktif' : 'Selesai'}
                            </span>
                          </div>
                          <span class="text-xs text-slate-400 font-mono">Dibuat ${formatTimeAgo(ses.createdAt)}</span>
                        </div>

                        <h3 class="text-lg font-bold text-[#0F172A] mt-3 tracking-tight">
                          ${escapeHtml(ses.name)}
                        </h3>
                        <p class="text-xs font-semibold text-[#2563EB] mt-0.5">
                          Pemateri: ${escapeHtml(ses.speaker || '-')}
                        </p>
                        <p class="text-xs text-slate-500 mt-1 leading-relaxed">
                          ${escapeHtml(ses.description || '')}
                        </p>

                        <div class="mt-4 pt-4 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-3">
                          <div class="flex items-center gap-4 text-xs font-semibold text-slate-600 font-mono tabular-nums">
                            <span>${qCount} Pertanyaan</span>
                            <span>•</span>
                            <span>${hCount} Diundi</span>
                          </div>

                          <div class="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              data-qr-sid="${escapeHtml(ses.id)}"
                              data-qr-sname="${escapeHtml(ses.name)}"
                              class="btn-session-qr ios-btn-glass px-3.5 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5"
                            >
                              ${Icons.qr('w-3.5 h-3.5 text-[#2563EB]')}
                              <span>QR Code</span>
                            </button>

                            <button
                              type="button"
                              data-edit-sid="${escapeHtml(ses.id)}"
                              class="btn-session-edit ios-btn-glass px-3.5 py-1.5 text-xs font-semibold text-slate-700"
                            >
                              Edit Info
                            </button>

                            ${
                              !isPrimaryActive
                                ? `
                              <button
                                type="button"
                                data-activate-sid="${escapeHtml(ses.id)}"
                                class="btn-session-activate ios-btn-primary px-4 py-1.5 text-xs font-semibold"
                              >
                                Jadikan Utama
                              </button>
                            `
                                : `
                              <a
                                href="#/admin/dashboard"
                                class="ios-btn-primary px-4 py-1.5 text-xs font-semibold inline-flex items-center gap-1"
                              >
                                <span>Panel Q&amp;A</span>
                                ${Icons.arrowRight('w-3 h-3')}
                              </a>
                            `
                            }

                            <button
                              type="button"
                              data-toggle-status-sid="${escapeHtml(ses.id)}"
                              data-current-status="${escapeHtml(ses.status)}"
                              class="btn-session-toggle-status ios-btn-glass px-3.5 py-1.5 text-xs font-semibold ${
                                ses.status === 'active' ? 'text-amber-800' : 'text-emerald-700'
                              }"
                            >
                              ${ses.status === 'active' ? 'Akhiri Sesi' : 'Buka Kembali'}
                            </button>

                            ${
                              qCount > 0
                                ? `
                              <button
                                type="button"
                                data-clear-sid="${escapeHtml(ses.id)}"
                                class="btn-session-clear ios-btn-glass px-3 py-1.5 text-xs font-semibold text-red-600"
                                title="Kosongkan seluruh pertanyaan pada sesi ini"
                              >
                                Kosongkan (${qCount})
                              </button>
                            `
                                : ''
                            }

                            <button
                              type="button"
                              data-delete-sid="${escapeHtml(ses.id)}"
                              class="btn-session-delete p-2 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-500/10 transition"
                              title="Hapus sesi ini"
                            >
                              ${Icons.trash('w-3.5 h-3.5')}
                            </button>
                          </div>
                        </div>
                      </article>
                    `;
                  })
                  .join('')
          }
        </section>
      </div>
    </main>
  `;
}

export function bindSessionManagementPageEvents() {
  const form = document.getElementById('create-session-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        const created = await createNewSession({
          name: fd.get('name'),
          speaker: fd.get('speaker'),
          description: fd.get('description'),
          customCode: fd.get('customCode'),
          allowAnonymous: fd.get('allowAnonymous') === 'on',
          setAsActive: fd.get('setAsActive') === 'on'
        });
        form.reset();
        showToast(`Sesi "${created.name}" (${created.id}) berhasil dibuat.`, 'success');
      } catch (err) {
        showToast(err.message || 'Gagal membuat sesi baru.', 'error');
      }
    });
  }

  document.querySelectorAll('.btn-session-qr').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sid = btn.getAttribute('data-qr-sid');
      const sname = btn.getAttribute('data-qr-sname');
      if (sid) openQRCodeModal(sid, sname);
    });
  });

  document.querySelectorAll('.btn-session-edit').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sid = btn.getAttribute('data-edit-sid');
      if (sid) openEditSessionModal(sid);
    });
  });

  document.querySelectorAll('.btn-session-activate').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const sid = btn.getAttribute('data-activate-sid');
      if (!sid) return;
      try {
        await setActiveSession(sid);
        showToast(`Sesi ${sid} ditetapkan sebagai Sesi Utama.`, 'success');
      } catch (err) {
        showToast(err.message || 'Gagal mengaktifkan sesi.', 'error');
      }
    });
  });

  document.querySelectorAll('.btn-session-toggle-status').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const sid = btn.getAttribute('data-toggle-status-sid');
      const cur = btn.getAttribute('data-current-status');
      if (!sid) return;
      const nextStatus = cur === 'active' ? 'ended' : 'active';
      await updateSessionConfig(sid, {
        status: nextStatus,
        allowQuestions: nextStatus === 'active'
      });
      showToast(
        nextStatus === 'active' ? `Sesi ${sid} dibuka kembali.` : `Sesi ${sid} telah diakhiri.`,
        'info'
      );
    });
  });

  document.querySelectorAll('.btn-session-clear').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const sid = btn.getAttribute('data-clear-sid');
      if (!sid) return;
      await clearAllQuestionsInSession(sid);
      showToast(`Seluruh pertanyaan pada sesi ${sid} telah dikosongkan.`, 'success');
    });
  });

  document.querySelectorAll('.btn-session-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const sid = btn.getAttribute('data-delete-sid');
      if (!sid) return;
      try {
        await deleteSessionById(sid);
        showToast(`Sesi ${sid} berhasil dihapus.`, 'info');
      } catch (err) {
        showToast(err.message || 'Gagal menghapus sesi.', 'error');
      }
    });
  });
}

function openEditSessionModal(sessionId) {
  const session = getSessionById(sessionId);
  if (!session) return;

  const existing = document.getElementById('smartqa-modal-overlay');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'smartqa-modal-overlay';
  modal.className =
    'fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = `
    <div class="liquid-glass max-w-md w-full p-6 sm:p-8 relative">
      <div class="w-10 h-1.5 rounded-full bg-slate-400/40 mx-auto mb-5"></div>
      <h3 class="text-lg font-bold text-[#0F172A] tracking-tight">
        Edit Informasi Sesi (${escapeHtml(session.id)})
      </h3>
      <form id="edit-session-form" class="mt-4 space-y-3.5">
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1 px-1">Nama Kegiatan / Sesi *</label>
          <input
            type="text"
            name="name"
            required
            value="${escapeHtml(session.name)}"
            class="ios-input w-full px-3.5 py-2.5 text-sm text-[#0F172A]"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1 px-1">Nama Narasumber / Pemateri</label>
          <input
            type="text"
            name="speaker"
            value="${escapeHtml(session.speaker || '')}"
            class="ios-input w-full px-3.5 py-2.5 text-sm text-[#0F172A]"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1 px-1">Deskripsi Topik</label>
          <textarea
            name="description"
            rows="3"
            class="ios-input w-full px-3.5 py-2.5 text-sm text-[#0F172A] resize-none"
          >${escapeHtml(session.description || '')}</textarea>
        </div>
        <div class="pt-3 flex items-center justify-end gap-2">
          <button type="button" id="edit-cancel-btn" class="ios-btn-glass px-4 py-2.5 text-xs font-semibold">
            Batal
          </button>
          <button type="submit" class="ios-btn-primary px-5 py-2.5 text-xs font-semibold">
            Simpan Perubahan
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector('#edit-cancel-btn').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  modal.querySelector('#edit-session-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const cleanName = (fd.get('name') || '').trim();
    if (!cleanName) return;
    await updateSessionConfig(session.id, {
      name: cleanName,
      speaker: (fd.get('speaker') || '').trim() || 'Pemateri Utama',
      description: (fd.get('description') || '').trim()
    });
    modal.remove();
    showToast('Informasi sesi berhasil diperbarui.', 'success');
  });
}
