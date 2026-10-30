/**
 * SmartQ&A — 4. Admin Real-Time Question Dashboard (Clean Minimalist Control Center)
 */

import {
  getAppState,
  getSessionById,
  setActiveSession,
  updateSessionConfig,
  updateQuestionStatus,
  deleteQuestion
} from '../services/firebase.js';
import { escapeHtml, formatTimeAgo } from '../components/Navbar.js';
import { Icons } from '../components/Icons.js';
import { openQRCodeModal } from '../components/QRCodeModal.js';
import { showToast } from '../app.js';

let adminStatusFilter = 'all';
let adminSortBy = 'latest';
let adminSearchQuery = '';

export function renderAdminDashboardPage() {
  const state = getAppState();
  const session = getSessionById();

  if (!session) {
    return `
      <main class="max-w-3xl mx-auto px-4 py-12 text-center">
        <div class="liquid-glass p-8 sm:p-10 space-y-4">
          <img src="./assets/logo.png" alt="SmartQ&A" class="w-16 h-16 object-contain mx-auto drop-shadow-sm" />
          <div class="space-y-1">
            <h2 class="text-xl font-bold text-[#0F172A] tracking-tight">Belum Ada Sesi Q&amp;A Aktif</h2>
            <p class="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Sistem belum memiliki sesi kegiatan. Silakan buat sesi kegiatan pertama Anda terlebih dahulu.
            </p>
          </div>
          <a href="#/admin/sessions" class="ios-btn-primary inline-flex items-center gap-2 px-6 py-3 text-xs font-semibold">
            ${Icons.plus('w-4 h-4')}
            <span>Mulai Q&amp;A (Tambah Sesi Baru)</span>
          </a>
        </div>
      </main>
    `;
  }

  const allQuestions = session.questionsList;
  const totalCount = allQuestions.length;
  const pendingCount = allQuestions.filter((q) => q.status === 'pending').length;
  const selectedCount = allQuestions.filter((q) => q.status === 'selected').length;
  const answeredCount = allQuestions.filter((q) => q.status === 'answered').length;
  const skippedCount = allQuestions.filter((q) => q.status === 'skipped').length;

  let filteredQuestions = [...allQuestions];
  if (adminStatusFilter !== 'all') {
    filteredQuestions = filteredQuestions.filter((q) => q.status === adminStatusFilter);
  }
  if (adminSearchQuery.trim()) {
    const qLower = adminSearchQuery.trim().toLowerCase();
    filteredQuestions = filteredQuestions.filter(
      (q) =>
        q.text.toLowerCase().includes(qLower) ||
        q.name.toLowerCase().includes(qLower) ||
        String(q.number).includes(qLower)
    );
  }
  if (adminSortBy === 'votes') {
    filteredQuestions.sort((a, b) => (b.votes || 0) - (a.votes || 0) || b.createdAt - a.createdAt);
  } else {
    filteredQuestions.sort((a, b) => b.createdAt - a.createdAt);
  }

  const selectedQ = session.currentSelectedQuestion;

  const statusText = (st) => {
    if (st === 'selected') return 'Sedang Dibahas';
    if (st === 'answered') return 'Terjawab';
    if (st === 'skipped') return 'Dilewati';
    return 'Menunggu';
  };

  return `
    <main class="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6">
      <!-- Top Control Center Header -->
      <section class="liquid-glass p-6 sm:p-7 space-y-6">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div class="space-y-1.5">
            ${
              state.sessionsList.length > 1
                ? `
              <div class="pb-1">
                <label for="admin-switch-session" class="sr-only">Pilih Sesi</label>
                <select
                  id="admin-switch-session"
                  class="ios-btn-glass px-3.5 py-1.5 text-xs font-semibold text-[#0F172A] focus:outline-none cursor-pointer w-full sm:w-auto max-w-full truncate"
                >
                  ${state.sessionsList
                    .map(
                      (s) => `
                    <option value="${escapeHtml(s.id)}" ${s.id === session.id ? 'selected' : ''}>
                      Sesi: ${escapeHtml(s.name)} (${escapeHtml(s.id)})
                    </option>
                  `
                    )
                    .join('')}
                </select>
              </div>
            `
                : ''
            }
            <h1 class="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
              ${escapeHtml(session.name)}
            </h1>
            <p class="text-xs text-slate-500">
              Narasumber: <strong class="text-[#0F172A] font-semibold">${escapeHtml(session.speaker || '-')}</strong>
              • Kode Sesi: <strong class="font-mono text-[#2563EB]">${escapeHtml(session.id)}</strong>
            </p>
          </div>

          <!-- Action Buttons -->
          <div class="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
            <a
              href="#/admin/draw"
              class="ios-btn-primary px-5 py-3 text-xs font-semibold inline-flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              ${Icons.shuffle('w-4 h-4')}
              <span>Buka Layar Pengundian</span>
            </a>

            <div class="grid grid-cols-2 sm:flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                id="admin-btn-qr"
                class="ios-btn-glass px-4 py-3 text-xs font-semibold inline-flex items-center justify-center gap-2"
              >
                ${Icons.qr('w-4 h-4 text-[#2563EB]')}
                <span>QR Sesi</span>
              </button>

              <button
                type="button"
                id="admin-toggle-accepting"
                class="ios-btn-glass px-4 py-3 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
              >
                ${session.allowQuestions !== false ? Icons.unlock('w-3.5 h-3.5 text-emerald-600') : Icons.lock('w-3.5 h-3.5 text-amber-600')}
                <span>${session.allowQuestions !== false ? 'Input: Dibuka' : 'Input: Ditutup'}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 4 Telemetry Cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
          <div class="liquid-cell p-4 sm:p-5">
            <span class="block text-xs font-semibold text-slate-500">Total Masuk</span>
            <span class="block font-mono text-3xl font-bold text-[#0F172A] mt-1 tabular-nums">${totalCount}</span>
            <span class="block text-[11px] text-slate-400 mt-0.5">Pertanyaan peserta</span>
          </div>

          <div class="liquid-cell p-4 sm:p-5">
            <span class="block text-xs font-semibold text-[#2563EB]">Menunggu</span>
            <span class="block font-mono text-3xl font-bold text-[#2563EB] mt-1 tabular-nums">${pendingCount}</span>
            <span class="block text-[11px] text-slate-400 mt-0.5">Siap diundi / dipilih</span>
          </div>

          <div class="liquid-cell p-4 sm:p-5">
            <span class="block text-xs font-semibold text-[#0F172A]">Sedang Dibahas</span>
            <span class="block font-mono text-3xl font-bold text-[#0F172A] mt-1 tabular-nums">${selectedCount}</span>
            <span class="block text-[11px] text-slate-400 mt-0.5">Aktif di layar panggung</span>
          </div>

          <div class="liquid-cell p-4 sm:p-5">
            <span class="block text-xs font-semibold text-emerald-700">Selesai Dijawab</span>
            <span class="block font-mono text-3xl font-bold text-emerald-600 mt-1 tabular-nums">${answeredCount}</span>
            <span class="block text-[11px] text-slate-400 mt-0.5">${skippedCount} dilewati</span>
          </div>
        </div>
      </section>

      <!-- Live Stage Spotlight Banner -->
      ${
        selectedQ
          ? `
        <section class="liquid-glass p-6 ring-2 ring-[#2563EB]">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="space-y-1.5">
              <div class="text-xs font-semibold text-[#2563EB]">
                Sedang Dibahas • Pertanyaan #${String(selectedQ.number).padStart(2, '0')} oleh ${escapeHtml(selectedQ.name)} (${selectedQ.votes || 0} Dukungan)
              </div>
              <p class="text-lg sm:text-xl font-bold text-[#0F172A] leading-snug">
                "${escapeHtml(selectedQ.text)}"
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button
                type="button"
                data-action="answered"
                data-qid="${escapeHtml(selectedQ.id)}"
                class="btn-admin-q-action px-4 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition inline-flex items-center gap-1.5 shadow-sm"
              >
                ${Icons.check('w-3.5 h-3.5')}
                <span>Tandai Dijawab</span>
              </button>
              <button
                type="button"
                data-action="skipped"
                data-qid="${escapeHtml(selectedQ.id)}"
                class="btn-admin-q-action ios-btn-glass px-4 py-2.5 font-semibold text-xs inline-flex items-center gap-1.5"
              >
                ${Icons.skip('w-3.5 h-3.5')}
                <span>Lewati</span>
              </button>
            </div>
          </div>
        </section>
      `
          : ''
      }

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- Left (8 Cols): Moderation Sheet -->
        <section class="lg:col-span-8 liquid-glass p-5 sm:p-7 space-y-5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/70">
            <div>
              <h2 class="text-base font-bold text-[#0F172A] tracking-tight">Daftar Pertanyaan Masuk (${totalCount})</h2>
              <p class="text-xs text-slate-500 mt-0.5">Pertanyaan dari ponsel peserta muncul otomatis secara real-time.</p>
            </div>

            <select
              id="admin-sort-select"
              class="ios-btn-glass px-3.5 py-2 text-xs font-semibold text-[#0F172A] focus:outline-none cursor-pointer"
            >
              <option value="latest" ${adminSortBy === 'latest' ? 'selected' : ''}>Urutkan: Terbaru</option>
              <option value="votes" ${adminSortBy === 'votes' ? 'selected' : ''}>Urutkan: Dukungan Terbanyak</option>
            </select>
          </div>

          <!-- Filter & Search -->
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div class="ios-segmented flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full">
              ${[
                { id: 'all', label: `Semua (${totalCount})` },
                { id: 'pending', label: `Menunggu (${pendingCount})` },
                { id: 'selected', label: `Dibahas (${selectedCount})` },
                { id: 'answered', label: `Terjawab (${answeredCount})` },
                { id: 'skipped', label: `Dilewati (${skippedCount})` }
              ]
                .map(
                  (f) => `
                <button
                  type="button"
                  data-status-filter="${f.id}"
                  class="admin-status-filter-btn px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                    adminStatusFilter === f.id
                      ? 'ios-segment-active'
                      : 'text-slate-600 hover:text-[#0F172A]'
                  }"
                >
                  ${f.label}
                </button>
              `
                )
                .join('')}
            </div>

            <input
              type="search"
              id="admin-search-input"
              placeholder="Cari pengirim atau isi..."
              value="${escapeHtml(adminSearchQuery)}"
              class="ios-input px-4 py-2 text-xs text-[#0F172A] w-full sm:w-52 rounded-full"
            />
          </div>

          <!-- Question Cells -->
          <div class="space-y-3">
            ${
              filteredQuestions.length === 0
                ? `
              <div class="py-12 text-center">
                <p class="text-sm font-semibold text-slate-600">Belum ada pertanyaan pada tampilan ini.</p>
              </div>
            `
                : filteredQuestions
                    .map((q) => {
                      return `
                        <article class="liquid-cell p-4 sm:p-5 ${
                          q.status === 'selected' ? 'ring-2 ring-[#2563EB] bg-white/95' : ''
                        }">
                          <div class="flex flex-wrap items-center justify-between gap-2">
                            <div class="flex items-center gap-2">
                              <span class="text-xs font-bold text-[#0F172A]">
                                ${String(q.number).padStart(2, '0')}. ${escapeHtml(q.name)}
                              </span>
                              <span class="text-[11px] text-slate-400">• ${formatTimeAgo(q.createdAt)}</span>
                            </div>

                            <div class="flex items-center gap-3 text-xs text-slate-500 font-medium">
                              <span>${q.votes || 0} Dukungan</span>
                              <span>•</span>
                              <span class="font-semibold text-[#0F172A]">${statusText(q.status)}</span>
                            </div>
                          </div>

                          <p class="mt-2.5 text-sm sm:text-[15px] text-[#0F172A] leading-relaxed break-words">
                            ${escapeHtml(q.text)}
                          </p>

                          <div class="mt-4 pt-3 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2">
                            <div class="flex flex-wrap items-center gap-1.5">
                              ${
                                q.status !== 'selected'
                                  ? `
                                <button
                                  type="button"
                                  data-action="selected"
                                  data-qid="${escapeHtml(q.id)}"
                                  class="btn-admin-q-action ios-btn-primary px-3.5 py-1.5 text-xs font-semibold"
                                >
                                  Pilih ke Panggung
                                </button>
                              `
                                  : ''
                              }

                              ${
                                q.status !== 'answered'
                                  ? `
                                <button
                                  type="button"
                                  data-action="answered"
                                  data-qid="${escapeHtml(q.id)}"
                                  class="btn-admin-q-action ios-btn-glass px-3.5 py-1.5 text-xs font-semibold text-emerald-700"
                                >
                                  Tandai Dijawab
                                </button>
                              `
                                  : ''
                              }

                              ${
                                q.status !== 'skipped'
                                  ? `
                                <button
                                  type="button"
                                  data-action="skipped"
                                  data-qid="${escapeHtml(q.id)}"
                                  class="btn-admin-q-action ios-btn-glass px-3.5 py-1.5 text-xs font-semibold text-slate-600"
                                >
                                  Lewati
                                </button>
                              `
                                  : ''
                              }

                              ${
                                q.status !== 'pending'
                                  ? `
                                <button
                                  type="button"
                                  data-action="pending"
                                  data-qid="${escapeHtml(q.id)}"
                                  class="btn-admin-q-action ios-btn-glass px-3.5 py-1.5 text-xs font-semibold text-slate-700"
                                >
                                  Kembalikan ke Antrean
                                </button>
                              `
                                  : ''
                              }
                            </div>

                            <button
                              type="button"
                              data-delete-qid="${escapeHtml(q.id)}"
                              class="btn-admin-q-delete px-3 py-1.5 rounded-full text-slate-400 hover:text-red-600 text-xs font-semibold inline-flex items-center gap-1 transition"
                            >
                              ${Icons.trash('w-3.5 h-3.5')}
                              <span>Hapus</span>
                            </button>
                          </div>
                        </article>
                      `;
                    })
                    .join('')
            }
          </div>
        </section>

        <!-- Right (4 Cols): Control Center Switches & Live Activity -->
        <aside class="lg:col-span-4 space-y-6">
          <div class="liquid-glass p-6 space-y-4">
            <h3 class="text-sm font-bold text-[#0F172A] tracking-tight">Pengaturan Sesi</h3>

            <label class="liquid-cell flex items-center justify-between p-3.5 cursor-pointer">
              <div>
                <span class="block text-xs font-semibold text-[#0F172A]">Terima Pertanyaan Baru</span>
                <span class="block text-[11px] text-slate-500">Buka formulir bagi peserta</span>
              </div>
              <input
                type="checkbox"
                id="chk-allow-questions"
                ${session.allowQuestions !== false ? 'checked' : ''}
                class="w-4 h-4 rounded text-[#2563EB]"
              />
            </label>

            <label class="liquid-cell flex items-center justify-between p-3.5 cursor-pointer">
              <div>
                <span class="block text-xs font-semibold text-[#0F172A]">Izinkan Pertanyaan Anonim</span>
                <span class="block text-[11px] text-slate-500">Peserta dapat menyembunyikan nama</span>
              </div>
              <input
                type="checkbox"
                id="chk-allow-anonymous"
                ${session.allowAnonymous !== false ? 'checked' : ''}
                class="w-4 h-4 rounded text-[#2563EB]"
              />
            </label>

            <div class="pt-1">
              <button
                type="button"
                id="btn-end-or-reopen-session"
                class="ios-btn-glass w-full py-2.5 px-4 font-semibold text-xs ${
                  session.status === 'active' ? 'text-red-600' : 'text-emerald-700'
                }"
              >
                ${session.status === 'active' ? 'Akhiri Sesi Kegiatan Ini' : 'Aktifkan Kembali Sesi Ini'}
              </button>
            </div>
          </div>

          <!-- Activity Feed -->
          <div class="liquid-glass p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-bold text-[#0F172A] tracking-tight">Aktivitas Terbaru</h3>
            </div>
            <div class="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              ${
                state.activities.length === 0
                  ? `<p class="text-xs text-slate-400">Belum ada aktivitas tercatat.</p>`
                  : state.activities
                      .slice(0, 12)
                      .map(
                        (act) => `
                      <div class="liquid-cell p-3 text-xs">
                        <p class="font-medium text-[#0F172A] leading-snug">${escapeHtml(act.message)}</p>
                        <span class="block font-mono text-[10px] text-slate-400 mt-1">${formatTimeAgo(act.timestamp)}</span>
                      </div>
                    `
                      )
                      .join('')
              }
            </div>
          </div>
        </aside>
      </div>
    </main>
  `;
}

export function bindAdminDashboardPageEvents() {
  const session = getSessionById();
  if (!session) return;

  const switchSelect = document.getElementById('admin-switch-session');
  if (switchSelect) {
    switchSelect.addEventListener('change', async (e) => {
      try {
        await setActiveSession(e.target.value);
        showToast('Sesi aktif berhasil dialihkan.', 'success');
      } catch (err) {
        showToast(err.message || 'Gagal mengganti sesi.', 'error');
      }
    });
  }

  const qrBtn = document.getElementById('admin-btn-qr');
  if (qrBtn) {
    qrBtn.addEventListener('click', () => {
      openQRCodeModal(session.id, session.name);
    });
  }

  const toggleAcceptBtn = document.getElementById('admin-toggle-accepting');
  if (toggleAcceptBtn) {
    toggleAcceptBtn.addEventListener('click', async () => {
      const nextVal = session.allowQuestions === false;
      await updateSessionConfig(session.id, { allowQuestions: nextVal });
      showToast(
        nextVal ? 'Penerimaan pertanyaan peserta dibuka.' : 'Penerimaan pertanyaan peserta ditutup.',
        'info'
      );
    });
  }

  const chkAllowQ = document.getElementById('chk-allow-questions');
  if (chkAllowQ) {
    chkAllowQ.addEventListener('change', async (e) => {
      await updateSessionConfig(session.id, { allowQuestions: e.target.checked });
      showToast('Parameter penerimaan pertanyaan diperbarui.', 'info');
    });
  }

  const chkAllowAnon = document.getElementById('chk-allow-anonymous');
  if (chkAllowAnon) {
    chkAllowAnon.addEventListener('change', async (e) => {
      await updateSessionConfig(session.id, { allowAnonymous: e.target.checked });
      showToast('Parameter izin anonim diperbarui.', 'info');
    });
  }

  const endOrReopenBtn = document.getElementById('btn-end-or-reopen-session');
  if (endOrReopenBtn) {
    endOrReopenBtn.addEventListener('click', async () => {
      const nextStatus = session.status === 'active' ? 'ended' : 'active';
      await updateSessionConfig(session.id, {
        status: nextStatus,
        allowQuestions: nextStatus === 'active'
      });
      showToast(
        nextStatus === 'active' ? 'Sesi diaktifkan kembali.' : 'Sesi tanya jawab telah diakhiri.',
        'info'
      );
    });
  }

  document.querySelectorAll('.admin-status-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      adminStatusFilter = btn.getAttribute('data-status-filter') || 'all';
      window.dispatchEvent(new CustomEvent('smartqa:rerender'));
    });
  });

  const sortSelect = document.getElementById('admin-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      adminSortBy = e.target.value;
      window.dispatchEvent(new CustomEvent('smartqa:rerender'));
    });
  }

  const searchInput = document.getElementById('admin-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      adminSearchQuery = e.target.value;
      window.dispatchEvent(new CustomEvent('smartqa:rerender'));
    });
  }

  document.querySelectorAll('.btn-admin-q-action').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const qid = btn.getAttribute('data-qid');
      const action = btn.getAttribute('data-action');
      if (!qid || !action) return;
      try {
        await updateQuestionStatus(session.id, qid, action, 'manual');
        showToast('Status pertanyaan berhasil diperbarui.', 'success');
      } catch (err) {
        showToast(err.message || 'Gagal memperbarui status.', 'error');
      }
    });
  });

  document.querySelectorAll('.btn-admin-q-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const qid = btn.getAttribute('data-delete-qid');
      if (!qid) return;
      try {
        await deleteQuestion(session.id, qid);
        showToast('Pertanyaan dihapus.', 'info');
      } catch (err) {
        showToast(err.message || 'Gagal menghapus pertanyaan.', 'error');
      }
    });
  });
}
