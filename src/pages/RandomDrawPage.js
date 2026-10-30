/**
 * SmartQ&A — 5. Random Question Drawing Page (iOS Dark Liquid Glass Projector Stage)
 */

import {
  getSessionById,
  lockAndSelectRandomQuestion,
  commitRandomDrawWinner,
  updateQuestionStatus,
  resetSessionQuestionsToPending
} from '../services/firebase.js';
import { runSlotMachineAnimation } from '../utils/randomDraw.js';
import { soundFX } from '../utils/sound.js';
import { escapeHtml, formatTimeAgo } from '../components/Navbar.js';
import { Icons } from '../components/Icons.js';
import { openQRCodeModal } from '../components/QRCodeModal.js';
import { showToast } from '../app.js';

let isLocalAnimating = false;

export function renderRandomDrawPage() {
  const session = getSessionById();

  if (!session) {
    return `
      <main class="flex-1 bg-[#060A14] text-white flex items-center justify-center p-6 rounded-t-[32px] mt-2">
        <div class="liquid-glass-dark p-8 text-center">
          <h2 class="text-xl font-bold">Sesi Tidak Ditemukan</h2>
          <a href="#/admin/sessions" class="ios-btn-primary inline-block mt-4 px-5 py-2.5 text-xs font-semibold">
            Kelola Sesi
          </a>
        </div>
      </main>
    `;
  }

  const pendingList = session.questionsList.filter((q) => q.status === 'pending');
  const answeredList = session.questionsList.filter((q) => q.status === 'answered');
  const skippedList = session.questionsList.filter((q) => q.status === 'skipped');
  const selectedQ = session.currentSelectedQuestion;
  const soundOn = soundFX.isEnabled();

  return `
    <main class="flex-1 bg-[#060A14] text-white flex flex-col justify-between px-4 sm:px-8 lg:px-12 py-6 sm:py-8 relative overflow-hidden rounded-t-[36px] mt-2 shadow-2xl border-t border-white/[0.12]">
      <!-- Subtle Ambient Liquid Refraction -->
      <div class="pointer-events-none absolute -top-28 left-1/4 w-[520px] h-[260px] bg-[#2563EB]/20 blur-[110px] rounded-full"></div>
      <div class="pointer-events-none absolute -bottom-28 right-1/4 w-[520px] h-[260px] bg-[#06B6D4]/15 blur-[110px] rounded-full"></div>

      <!-- Top Projector Capsule Bar -->
      <div class="max-w-6xl w-full mx-auto relative z-10 flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-white/[0.1]">
        <div>
          <div class="flex items-center gap-2.5">
            <span class="px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-[#06B6D4]/15 text-[#06B6D4] border border-[#06B6D4]/30">
              Stage Projector • Random Draw
            </span>
            <span class="font-mono text-xs px-3 py-1 rounded-full bg-white/[0.08] text-slate-200 border border-white/[0.12]">
              ${escapeHtml(session.id)}
            </span>
          </div>
          <h1 class="text-xl sm:text-2xl font-bold text-white mt-2 tracking-tight">
            ${escapeHtml(session.name)}
          </h1>
        </div>

        <!-- Telemetry Capsule & Utility Pills -->
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex items-center gap-3 px-4 py-2 rounded-full bg-white/[0.07] border border-white/[0.12] backdrop-blur-xl">
            <div class="text-center px-1">
              <span class="block font-mono text-base font-bold text-[#06B6D4] tabular-nums" id="draw-stat-pending">${pendingList.length}</span>
              <span class="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Pending</span>
            </div>
            <div class="h-5 w-px bg-white/[0.12]"></div>
            <div class="text-center px-1">
              <span class="block font-mono text-base font-bold text-emerald-400 tabular-nums">${answeredList.length}</span>
              <span class="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Terjawab</span>
            </div>
            <div class="h-5 w-px bg-white/[0.12]"></div>
            <div class="text-center px-1">
              <span class="block font-mono text-base font-bold text-slate-400 tabular-nums">${skippedList.length}</span>
              <span class="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Dilewati</span>
            </div>
          </div>

          <button
            type="button"
            id="draw-btn-sound"
            class="px-3.5 py-2.5 rounded-full border text-xs font-semibold transition inline-flex items-center gap-1.5 ${
              soundOn
                ? 'bg-[#2563EB]/25 border-[#2563EB]/60 text-[#06B6D4]'
                : 'bg-white/[0.06] border-white/[0.12] text-slate-400'
            }"
          >
            ${soundOn ? Icons.volumeOn('w-3.5 h-3.5') : Icons.volumeOff('w-3.5 h-3.5')}
            <span>${soundOn ? 'Audio: ON' : 'Audio: OFF'}</span>
          </button>

          <button
            type="button"
            id="draw-btn-qr"
            class="px-3.5 py-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-xs font-semibold text-white transition inline-flex items-center gap-1.5"
          >
            ${Icons.qr('w-3.5 h-3.5 text-[#06B6D4]')}
            <span>QR Sesi</span>
          </button>

          <button
            type="button"
            id="draw-btn-fullscreen"
            class="px-3.5 py-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-xs font-semibold text-white transition inline-flex items-center gap-1.5"
          >
            ${Icons.maximize('w-3.5 h-3.5')}
            <span class="hidden sm:inline">Layar Penuh</span>
          </button>

          <button
            type="button"
            id="draw-btn-reset"
            class="px-3.5 py-2.5 rounded-full bg-red-500/15 hover:bg-red-500/25 border border-red-400/30 text-xs font-semibold text-red-300 transition inline-flex items-center gap-1.5"
          >
            ${Icons.reset('w-3.5 h-3.5')}
            <span>Reset</span>
          </button>
        </div>
      </div>

      <!-- CENTER LIQUID GLASS STAGE MONITOR -->
      <section class="max-w-5xl w-full mx-auto my-8 relative z-10 flex-1 flex flex-col justify-center">
        <div
          id="draw-stage-card"
          class="liquid-glass-dark p-8 sm:p-12 lg:p-14 relative overflow-hidden min-h-[340px] flex flex-col justify-between transition-all ${
            selectedQ ? 'stage-active-frame' : ''
          }"
        >
          <!-- Countdown Overlay -->
          <div
            id="draw-countdown-overlay"
            class="hidden absolute inset-0 z-30 bg-[#060A14]/90 backdrop-blur-2xl flex-col items-center justify-center"
          >
            <span class="text-xs font-semibold uppercase tracking-widest text-[#06B6D4] mb-3">
              Mengacak Antrean Pertanyaan...
            </span>
            <span
              id="draw-countdown-number"
              class="font-mono text-7xl sm:text-9xl font-bold text-white tabular-nums"
            >
              3
            </span>
          </div>

          <!-- Progress Pill Bar -->
          <div id="draw-progress-wrapper" class="hidden w-full h-1.5 bg-white/[0.08] rounded-full overflow-hidden mb-6">
            <div
              id="draw-progress-bar"
              class="h-full bg-gradient-to-r from-[#2563EB] to-[#06B6D4] transition-all duration-100"
              style="width: 0%"
            ></div>
          </div>

          <!-- Stage Dynamic Content -->
          <div id="draw-stage-content" class="my-auto">
            ${
              selectedQ
                ? `
              <div class="space-y-7">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <span class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[#06B6D4] text-[#0F172A] shadow-sm">
                    Pertanyaan Terpilih • #${String(selectedQ.number).padStart(2, '0')}
                  </span>
                  <span class="font-mono text-xs font-semibold px-3.5 py-1.5 rounded-full bg-white/[0.08] text-[#06B6D4] border border-white/[0.12] tabular-nums">
                    ▲ ${selectedQ.votes || 0} Dukungan Audiens
                  </span>
                </div>

                <blockquote class="text-2xl sm:text-4xl lg:text-[42px] font-bold text-white leading-[1.2] tracking-tight">
                  "${escapeHtml(selectedQ.text)}"
                </blockquote>

                <div class="pt-5 border-t border-white/[0.1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-gradient-to-b from-[#3B82F6] to-[#2563EB] text-white font-bold flex items-center justify-center text-sm border border-white/30">
                      ${escapeHtml((selectedQ.name || 'P')[0].toUpperCase())}
                    </div>
                    <div>
                      <span class="block text-xs text-slate-400">Dikirim oleh Peserta</span>
                      <strong class="text-base sm:text-lg font-bold text-[#06B6D4]">${escapeHtml(selectedQ.name)}</strong>
                    </div>
                  </div>
                  <span class="font-mono text-xs text-emerald-400 font-semibold uppercase">
                    ● ON STAGE
                  </span>
                </div>
              </div>
            `
                : pendingList.length === 0
                ? `
              <div class="text-center py-8 space-y-3 max-w-xl mx-auto">
                <span class="inline-block px-3.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                  Antrean Selesai
                </span>
                <h2 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Seluruh pertanyaan Pending telah selesai diundi.
                </h2>
                <p class="text-sm text-slate-400 leading-relaxed">
                  Peserta masih dapat mengirim pertanyaan baru atau Anda dapat menekan tombol <strong>Reset</strong> di kanan atas untuk mengulang antrean undian.
                </p>
              </div>
            `
                : `
              <div class="text-center py-8 space-y-4 max-w-2xl mx-auto">
                <div class="w-16 h-16 rounded-[22px] bg-white/[0.08] border border-white/[0.15] flex items-center justify-center text-[#06B6D4] mx-auto shadow-inner">
                  ${Icons.shuffle('w-7 h-7')}
                </div>
                <span class="inline-block text-xs font-semibold uppercase tracking-widest text-[#06B6D4]">
                  Siap Mengundi ${pendingList.length} Pertanyaan Pending
                </span>
                <h2 class="text-2xl sm:text-4xl font-bold text-white leading-tight tracking-tight">
                  Tekan tombol di bawah untuk mengundi pertanyaan audiens secara acak.
                </h2>
                <p class="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
                  Pertanyaan yang sudah terpilih, selesai dijawab, atau dilewati tidak akan masuk ke putaran undian berikutnya.
                </p>
              </div>
            `
            }
          </div>
        </div>

        <!-- CAPSULE TRANSPORT CONTROLS -->
        <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
          ${
            !selectedQ
              ? `
            <button
              type="button"
              id="btn-start-random-draw"
              ${pendingList.length === 0 || isLocalAnimating ? 'disabled' : ''}
              class="ios-btn-primary px-8 py-4 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-sm sm:text-base inline-flex items-center gap-3"
            >
              ${Icons.shuffle('w-5 h-5')}
              <span>Mulai Pengundian (${pendingList.length} Tersedia)</span>
            </button>
          `
              : `
            <button
              type="button"
              id="btn-mark-selected-answered"
              data-qid="${escapeHtml(selectedQ.id)}"
              class="px-6 py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg transition inline-flex items-center gap-2"
            >
              ${Icons.check('w-4 h-4')}
              <span>Tandai Selesai Dijawab</span>
            </button>

            <button
              type="button"
              id="btn-draw-next-question"
              data-current-qid="${escapeHtml(selectedQ.id)}"
              ${pendingList.length === 0 || isLocalAnimating ? 'disabled' : ''}
              class="ios-btn-primary px-7 py-3.5 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-xs sm:text-sm inline-flex items-center gap-2"
            >
              ${Icons.shuffle('w-4 h-4')}
              <span>Pertanyaan Berikutnya (${pendingList.length} Tersisa)</span>
            </button>

            <button
              type="button"
              id="btn-skip-selected-question"
              data-qid="${escapeHtml(selectedQ.id)}"
              class="px-5 py-3.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-white border border-white/[0.15] font-semibold text-xs sm:text-sm transition inline-flex items-center gap-2"
            >
              ${Icons.skip('w-4 h-4')}
              <span>Lewati</span>
            </button>
          `
          }
        </div>
      </section>

      <!-- BOTTOM DRAW HISTORY CAPSULES -->
      <section class="max-w-6xl w-full mx-auto relative z-10 pt-5 border-t border-white/[0.1]">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Riwayat Terpilih Sesi Ini (${session.drawHistoryList.length})
          </h3>
          <a href="#/admin/history" class="text-xs font-semibold text-[#06B6D4] hover:underline inline-flex items-center gap-1">
            <span>Arsip Lengkap</span>
            ${Icons.arrowRight('w-3.5 h-3.5')}
          </a>
        </div>

        ${
          session.drawHistoryList.length === 0
            ? `<p class="text-xs text-slate-500">Belum ada pertanyaan yang diundi pada sesi ini.</p>`
            : `
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            ${session.drawHistoryList
              .slice(0, 3)
              .map(
                (h) => `
              <div class="p-4 rounded-2xl bg-white/[0.06] border border-white/[0.1] backdrop-blur-md flex flex-col justify-between gap-2">
                <div class="flex items-center justify-between gap-2">
                  <span class="font-mono text-xs font-bold text-[#06B6D4]">#${String(h.number).padStart(2, '0')} • ${escapeHtml(h.name)}</span>
                  <span class="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.08] text-slate-300 uppercase font-semibold">
                    ${escapeHtml(h.finalStatus || 'selected')}
                  </span>
                </div>
                <p class="text-xs text-slate-200 line-clamp-2 leading-relaxed">"${escapeHtml(h.text)}"</p>
                <span class="text-[10px] text-slate-500 font-mono">${formatTimeAgo(h.selectedAt)}</span>
              </div>
            `
              )
              .join('')}
          </div>
        `
        }
      </section>
    </main>
  `;
}

async function triggerRandomDrawProcess(sessionId) {
  if (isLocalAnimating) return;
  isLocalAnimating = true;

  try {
    const { candidates, winner } = await lockAndSelectRandomQuestion(sessionId);

    const stageCard = document.getElementById('draw-stage-card');
    const stageContent = document.getElementById('draw-stage-content');
    const countdownOverlay = document.getElementById('draw-countdown-overlay');
    const countdownNumber = document.getElementById('draw-countdown-number');
    const progressWrapper = document.getElementById('draw-progress-wrapper');
    const progressBar = document.getElementById('draw-progress-bar');
    const startBtn = document.getElementById('btn-start-random-draw');
    const nextBtn = document.getElementById('btn-draw-next-question');

    if (startBtn) startBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;

    if (stageCard) {
      stageCard.classList.remove('stage-active-frame');
    }

    await runSlotMachineAnimation({
      candidates,
      winnerQuestion: winner,
      onCountdownFrame: (count) => {
        if (!countdownOverlay || !countdownNumber) return;
        if (count > 0) {
          countdownOverlay.classList.remove('hidden');
          countdownOverlay.classList.add('flex');
          countdownNumber.textContent = String(count);
        } else {
          countdownOverlay.classList.add('hidden');
          countdownOverlay.classList.remove('flex');
          if (progressWrapper) progressWrapper.classList.remove('hidden');
        }
      },
      onTickFrame: (currentCandidate, step, totalSteps) => {
        if (progressBar) {
          const pct = Math.min(100, Math.round(((step + 1) / totalSteps) * 100));
          progressBar.style.width = `${pct}%`;
        }
        if (stageContent && currentCandidate) {
          stageContent.innerHTML = `
            <div class="space-y-4 text-center">
              <span class="inline-block px-3.5 py-1 rounded-full text-xs font-mono font-bold bg-[#2563EB]/30 text-[#06B6D4] border border-[#06B6D4]/40">
                Mengundi Kandidat #${String(currentCandidate.number).padStart(2, '0')}
              </span>
              <p class="text-2xl sm:text-4xl font-bold text-white leading-snug">
                "${escapeHtml(currentCandidate.text)}"
              </p>
              <p class="text-sm font-semibold text-[#06B6D4]">
                Pengirim: ${escapeHtml(currentCandidate.name)}
              </p>
            </div>
          `;
        }
      }
    });

    await commitRandomDrawWinner(sessionId, winner.id);
    showToast(`Pertanyaan #${String(winner.number).padStart(2, '0')} (${winner.name}) terpilih.`, 'success');
  } catch (err) {
    showToast(err.message || 'Gagal menjalankan pengundian.', 'error');
  } finally {
    isLocalAnimating = false;
    window.dispatchEvent(new CustomEvent('smartqa:rerender'));
  }
}

export function bindRandomDrawPageEvents() {
  const session = getSessionById();
  if (!session) return;

  const startBtn = document.getElementById('btn-start-random-draw');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      triggerRandomDrawProcess(session.id);
    });
  }

  const nextBtn = document.getElementById('btn-draw-next-question');
  if (nextBtn) {
    nextBtn.addEventListener('click', async () => {
      const currentQid = nextBtn.getAttribute('data-current-qid');
      if (currentQid) {
        await updateQuestionStatus(session.id, currentQid, 'answered', 'random');
      }
      await triggerRandomDrawProcess(session.id);
    });
  }

  const answeredBtn = document.getElementById('btn-mark-selected-answered');
  if (answeredBtn) {
    answeredBtn.addEventListener('click', async () => {
      const qid = answeredBtn.getAttribute('data-qid');
      if (!qid) return;
      await updateQuestionStatus(session.id, qid, 'answered', 'random');
      showToast('Pertanyaan ditandai selesai dijawab.', 'success');
    });
  }

  const skipBtn = document.getElementById('btn-skip-selected-question');
  if (skipBtn) {
    skipBtn.addEventListener('click', async () => {
      const qid = skipBtn.getAttribute('data-qid');
      if (!qid) return;
      await updateQuestionStatus(session.id, qid, 'skipped', 'random');
      showToast('Pertanyaan dilewati dan dikeluarkan dari antrean undian.', 'info');
    });
  }

  const soundBtn = document.getElementById('draw-btn-sound');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      const enabled = soundFX.toggle();
      showToast(enabled ? 'Audio undian diaktifkan.' : 'Audio undian dinonaktifkan.', 'info');
      window.dispatchEvent(new CustomEvent('smartqa:rerender'));
    });
  }

  const qrBtn = document.getElementById('draw-btn-qr');
  if (qrBtn) {
    qrBtn.addEventListener('click', () => {
      openQRCodeModal(session.id, session.name);
    });
  }

  const fsBtn = document.getElementById('draw-btn-fullscreen');
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  const resetBtn = document.getElementById('draw-btn-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      openResetConfirmModal(session.id, session.name);
    });
  }
}

function openResetConfirmModal(sessionId, sessionName) {
  const existing = document.getElementById('smartqa-modal-overlay');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'smartqa-modal-overlay';
  modal.className =
    'fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = `
    <div class="liquid-glass max-w-md w-full p-6 sm:p-8 text-center">
      <div class="w-10 h-1.5 rounded-full bg-slate-400/40 mx-auto mb-5"></div>
      <h3 class="text-lg font-bold text-[#0F172A] tracking-tight">
        Reset Antrean Undian?
      </h3>
      <p class="text-xs text-slate-600 mt-2 leading-relaxed">
        Seluruh pertanyaan pada sesi <strong>"${escapeHtml(sessionName)}"</strong> akan dikembalikan ke status <strong>Pending</strong> agar dapat diundi kembali dari awal.
      </p>
      <div class="mt-6 flex items-center justify-center gap-2.5">
        <button
          type="button"
          id="reset-cancel-btn"
          class="ios-btn-glass flex-1 py-2.5 px-4 font-semibold text-xs"
        >
          Batal
        </button>
        <button
          type="button"
          id="reset-confirm-btn"
          class="flex-1 py-2.5 px-4 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition shadow-sm"
        >
          Reset Antrean
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#reset-cancel-btn').addEventListener('click', () => modal.remove());
  modal.querySelector('#reset-confirm-btn').addEventListener('click', async () => {
    modal.remove();
    try {
      await resetSessionQuestionsToPending(sessionId);
      showToast('Seluruh pertanyaan dikembalikan ke status Pending.', 'success');
    } catch (err) {
      showToast(err.message || 'Gagal mereset sesi.', 'error');
    }
  });
}
