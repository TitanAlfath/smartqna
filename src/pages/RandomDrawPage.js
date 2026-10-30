/**
 * SmartQ&A — 5. Random Question Drawing Page (Unified Apple iOS Liquid Glass Projector Stage)
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
      <main class="max-w-3xl mx-auto px-4 py-12 text-center">
        <div class="liquid-glass p-8 sm:p-10 text-center space-y-4">
          <img src="./assets/logo.png" alt="SmartQ&A" class="w-16 h-16 object-contain mx-auto drop-shadow-sm" />
          <div class="space-y-1">
            <h2 class="text-xl font-bold text-[#0F172A] tracking-tight">Belum Ada Sesi Q&amp;A Aktif</h2>
            <p class="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Buat sesi kegiatan terlebih dahulu sebelum membuka layar pengundian proyektor.
            </p>
          </div>
          <a href="#/admin/sessions" class="ios-btn-primary inline-flex items-center gap-2 px-6 py-3 text-xs font-semibold">
            ${Icons.plus('w-4 h-4')}
            <span>Mulai Q&amp;A (Buat Sesi)</span>
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
    <main class="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 flex-1 flex flex-col justify-between">
      <!-- Top Projector Capsule Bar -->
      <section class="liquid-glass p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <img src="./assets/logo.png" alt="SmartQ&A" class="w-10 h-10 object-contain drop-shadow-sm shrink-0" />
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
                ${escapeHtml(session.name)}
              </h1>
              <span class="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#2563EB]/10 text-[#2563EB]">
                ${escapeHtml(session.id)}
              </span>
            </div>
            <p class="text-xs text-slate-500 mt-0.5">
              ${escapeHtml(session.speaker || 'Sesi Tanya Jawab')}
            </p>
          </div>
        </div>

        <!-- Telemetry Capsule & Utility Pills -->
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex items-center gap-3 px-4 py-2 rounded-full bg-white/80 border border-white shadow-sm">
            <div class="text-center px-1">
              <span class="block font-mono text-base font-bold text-[#2563EB] tabular-nums" id="draw-stat-pending">${pendingList.length}</span>
              <span class="block text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Pending</span>
            </div>
            <div class="h-5 w-px bg-slate-200"></div>
            <div class="text-center px-1">
              <span class="block font-mono text-base font-bold text-emerald-600 tabular-nums">${answeredList.length}</span>
              <span class="block text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Terjawab</span>
            </div>
            <div class="h-5 w-px bg-slate-200"></div>
            <div class="text-center px-1">
              <span class="block font-mono text-base font-bold text-slate-500 tabular-nums">${skippedList.length}</span>
              <span class="block text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Dilewati</span>
            </div>
          </div>

          <button
            type="button"
            id="draw-btn-sound"
            class="px-3.5 py-2.5 rounded-full border text-xs font-semibold transition inline-flex items-center gap-1.5 ${
              soundOn
                ? 'bg-[#2563EB]/12 border-[#2563EB]/30 text-[#2563EB]'
                : 'ios-btn-glass text-slate-500'
            }"
          >
            ${soundOn ? Icons.volumeOn('w-3.5 h-3.5') : Icons.volumeOff('w-3.5 h-3.5')}
            <span>${soundOn ? 'Audio: ON' : 'Audio: OFF'}</span>
          </button>

          <button
            type="button"
            id="draw-btn-qr"
            class="ios-btn-glass px-3.5 py-2.5 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            ${Icons.qr('w-3.5 h-3.5 text-[#2563EB]')}
            <span>QR Sesi</span>
          </button>

          <button
            type="button"
            id="draw-btn-fullscreen"
            class="ios-btn-glass px-3.5 py-2.5 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            ${Icons.maximize('w-3.5 h-3.5 text-[#2563EB]')}
            <span class="hidden sm:inline">Layar Penuh</span>
          </button>

          <button
            type="button"
            id="draw-btn-reset"
            class="px-3.5 py-2.5 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-xs font-semibold text-red-600 transition inline-flex items-center gap-1.5"
          >
            ${Icons.reset('w-3.5 h-3.5')}
            <span>Reset</span>
          </button>
        </div>
      </section>

      <!-- CENTER LIQUID GLASS STAGE MONITOR -->
      <section class="w-full my-auto flex-1 flex flex-col justify-center">
        <div
          id="draw-stage-card"
          class="liquid-glass p-8 sm:p-12 lg:p-14 relative overflow-hidden min-h-[340px] flex flex-col justify-between transition-all ${
            selectedQ ? 'ring-2 ring-[#2563EB]' : ''
          }"
        >
          <!-- Countdown Overlay -->
          <div
            id="draw-countdown-overlay"
            class="hidden absolute inset-0 z-30 bg-white/90 backdrop-blur-2xl flex-col items-center justify-center"
          >
            <span class="text-xs font-semibold uppercase tracking-widest text-[#2563EB] mb-3">
              Mengacak Antrean Pertanyaan...
            </span>
            <span
              id="draw-countdown-number"
              class="font-mono text-7xl sm:text-9xl font-bold text-[#0F172A] tabular-nums"
            >
              3
            </span>
          </div>

          <!-- Progress Pill Bar -->
          <div id="draw-progress-wrapper" class="hidden w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden mb-6">
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
                  <span class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[#2563EB] text-white shadow-sm">
                    Pertanyaan Terpilih • #${String(selectedQ.number).padStart(2, '0')}
                  </span>
                  <span class="font-mono text-xs font-semibold px-3.5 py-1.5 rounded-full bg-[#2563EB]/10 text-[#2563EB] tabular-nums">
                    ▲ ${selectedQ.votes || 0} Dukungan Audiens
                  </span>
                </div>

                <blockquote class="text-2xl sm:text-4xl lg:text-[42px] font-bold text-[#0F172A] leading-[1.2] tracking-tight">
                  "${escapeHtml(selectedQ.text)}"
                </blockquote>

                <div class="pt-5 border-t border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-gradient-to-b from-[#3B82F6] to-[#2563EB] text-white font-bold flex items-center justify-center text-sm shadow-sm">
                      ${escapeHtml((selectedQ.name || 'P')[0].toUpperCase())}
                    </div>
                    <div>
                      <span class="block text-xs text-slate-500">Dikirim oleh Peserta</span>
                      <strong class="text-base sm:text-lg font-bold text-[#2563EB]">${escapeHtml(selectedQ.name)}</strong>
                    </div>
                  </div>
                  <span class="font-mono text-xs text-emerald-600 font-semibold uppercase">
                    ● SEDANG DIBAHAS
                  </span>
                </div>
              </div>
            `
                : pendingList.length === 0
                ? `
              <div class="text-center py-8 space-y-3 max-w-xl mx-auto">
                <img src="./assets/logo.png" alt="SmartQ&A" class="w-14 h-14 object-contain mx-auto drop-shadow-sm" />
                <h2 class="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight">
                  Belum ada pertanyaan Pending di antrean undian.
                </h2>
                <p class="text-sm text-slate-500 leading-relaxed">
                  Peserta dapat mengirim pertanyaan baru melalui QR Code atau Anda dapat menekan tombol <strong>Reset</strong> di kanan atas untuk mengulang antrean undian.
                </p>
              </div>
            `
                : `
              <div class="text-center py-8 space-y-4 max-w-2xl mx-auto">
                <div class="w-16 h-16 rounded-[22px] bg-[#2563EB]/10 border border-white flex items-center justify-center text-[#2563EB] mx-auto shadow-sm">
                  ${Icons.shuffle('w-7 h-7')}
                </div>
                <h2 class="text-2xl sm:text-4xl font-bold text-[#0F172A] leading-tight tracking-tight">
                  Tekan tombol di bawah untuk mengundi pertanyaan audiens secara acak.
                </h2>
                <p class="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
                  Tersedia <strong class="text-[#2563EB]">${pendingList.length} pertanyaan</strong> siap diundi. Pertanyaan yang sudah terpilih tidak akan terundi kembali.
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
              class="px-6 py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-md transition inline-flex items-center gap-2"
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
              class="ios-btn-glass px-5 py-3.5 font-semibold text-xs sm:text-sm inline-flex items-center gap-2"
            >
              ${Icons.skip('w-4 h-4')}
              <span>Lewati</span>
            </button>
          `
          }
        </div>
      </section>

      <!-- BOTTOM DRAW HISTORY CAPSULES -->
      <section class="liquid-glass p-6">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500">
            Riwayat Terpilih Sesi Ini (${session.drawHistoryList.length})
          </h3>
          <a href="#/admin/history" class="text-xs font-semibold text-[#2563EB] hover:underline inline-flex items-center gap-1">
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
              <div class="liquid-cell p-4 flex flex-col justify-between gap-2">
                <div class="flex items-center justify-between gap-2">
                  <span class="font-mono text-xs font-bold text-[#2563EB]">#${String(h.number).padStart(2, '0')} • ${escapeHtml(h.name)}</span>
                  <span class="text-[10px] px-2 py-0.5 rounded-full bg-[#2563EB]/10 text-[#2563EB] uppercase font-semibold">
                    ${escapeHtml(h.finalStatus || 'selected')}
                  </span>
                </div>
                <p class="text-xs text-slate-700 line-clamp-2 leading-relaxed">"${escapeHtml(h.text)}"</p>
                <span class="text-[10px] text-slate-400 font-mono">${formatTimeAgo(h.selectedAt)}</span>
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
      stageCard.classList.remove('ring-2', 'ring-[#2563EB]');
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
              <span class="inline-block px-3.5 py-1 rounded-full text-xs font-mono font-bold bg-[#2563EB]/12 text-[#2563EB]">
                Mengundi Kandidat #${String(currentCandidate.number).padStart(2, '0')}
              </span>
              <p class="text-2xl sm:text-4xl font-bold text-[#0F172A] leading-snug">
                "${escapeHtml(currentCandidate.text)}"
              </p>
              <p class="text-sm font-semibold text-[#2563EB]">
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
