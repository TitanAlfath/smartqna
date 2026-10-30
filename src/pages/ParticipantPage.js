/**
 * SmartQ&A — 2. Participant Page (iPhone Liquid Glass UI)
 */

import {
  getAppState,
  getSessionById,
  submitQuestion,
  toggleVoteQuestion,
  hasParticipantVoted,
  getParticipantId
} from '../services/firebase.js';
import { escapeHtml, formatTimeAgo } from '../components/Navbar.js';
import { Icons } from '../components/Icons.js';
import { openQRCodeModal } from '../components/QRCodeModal.js';
import { showToast, navigateTo } from '../app.js';

let participantFilter = 'latest'; // 'latest' | 'popular' | 'mine' | 'answered'
let savedParticipantName = localStorage.getItem('smartqa_participant_name') || '';
let isAnonChecked = false;
let draftQuestionText = '';

export function getRequestedSessionIdFromHash() {
  const hash = window.location.hash || '';
  const qIndex = hash.indexOf('?');
  if (qIndex === -1) return null;
  const params = new URLSearchParams(hash.slice(qIndex + 1));
  return params.get('session');
}

export function renderParticipantPage() {
  const state = getAppState();
  const requestedId = getRequestedSessionIdFromHash();
  const session = getSessionById(requestedId);

  if (!session) {
    return `
      <main class="max-w-3xl mx-auto px-4 py-12 text-center">
        <div class="liquid-glass p-8 sm:p-10 space-y-4">
          <img src="./assets/logo.png" alt="SmartQ&A" class="w-16 h-16 object-contain mx-auto drop-shadow-sm" />
          <div class="space-y-1">
            <h2 class="text-xl font-bold text-[#0F172A] tracking-tight">Belum Ada Sesi Q&amp;A Aktif</h2>
            <p class="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              Saat ini belum ada sesi tanya jawab yang dibuka oleh penyelenggara. Jika Anda adalah admin/pemateri, klik tombol <strong>Mulai Q&amp;A</strong> di bawah ini.
            </p>
          </div>
          <div class="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <a href="#/admin/sessions" class="ios-btn-primary px-5 py-2.5 text-xs font-semibold inline-flex items-center gap-1.5">
              ${Icons.plus('w-3.5 h-3.5')}
              <span>Mulai Q&amp;A (Buat Sesi)</span>
            </a>
            <a href="#/" class="ios-btn-glass px-5 py-2.5 text-xs font-semibold">
              Kembali ke Beranda
            </a>
          </div>
        </div>
      </main>
    `;
  }

  const isSessionActive = session.status === 'active' && session.allowQuestions !== false;
  const myPid = getParticipantId();
  const selectedQ = session.currentSelectedQuestion;

  let questions = [...session.questionsList];
  if (participantFilter === 'popular') {
    questions.sort((a, b) => (b.votes || 0) - (a.votes || 0) || b.createdAt - a.createdAt);
  } else if (participantFilter === 'mine') {
    questions = questions.filter((q) => q.authorId === myPid);
  } else if (participantFilter === 'answered') {
    questions = questions.filter((q) => q.status === 'answered' || q.status === 'selected');
  } else {
    questions.sort((a, b) => b.createdAt - a.createdAt);
  }

  const statusPill = (status) => {
    switch (status) {
      case 'selected':
        return `<span class="px-3 py-1 rounded-full text-[11px] font-semibold bg-[#0F172A] text-[#06B6D4] shadow-sm">Sedang Dibahas</span>`;
      case 'answered':
        return `<span class="px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-800 border border-emerald-500/20">Terjawab</span>`;
      case 'skipped':
        return `<span class="px-3 py-1 rounded-full text-[11px] font-medium bg-slate-200/80 text-slate-600">Dilewati</span>`;
      default:
        return `<span class="px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-800 border border-amber-500/20">Pending</span>`;
    }
  };

  return `
    <main class="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6">
      <!-- Top Liquid Glass Session Card -->
      <section class="liquid-glass p-5 sm:p-7">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="space-y-1.5">
            <div class="flex flex-wrap items-center gap-2">
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                isSessionActive
                  ? 'bg-emerald-500/15 text-emerald-800 border border-emerald-500/25'
                  : 'bg-amber-500/15 text-amber-800 border border-amber-500/25'
              }">
                <span class="w-2 h-2 rounded-full ${isSessionActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
                ${isSessionActive ? 'Sesi Tanya Jawab Aktif' : 'Penerimaan Ditutup'}
              </span>
              <span class="font-mono text-xs font-semibold px-3 py-1 rounded-full bg-[#0F172A] text-[#06B6D4]">
                ${escapeHtml(session.id)}
              </span>
            </div>
            <h1 class="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight pt-1">
              ${escapeHtml(session.name)}
            </h1>
            <p class="text-xs text-slate-600">
              Narasumber: <strong class="text-[#0F172A] font-semibold">${escapeHtml(session.speaker || 'Pemateri Utama')}</strong>
            </p>
          </div>

          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
            <label for="participant-session-select" class="sr-only">Pilih Sesi</label>
            <select
              id="participant-session-select"
              class="ios-btn-glass px-4 py-2.5 text-xs font-semibold text-[#0F172A] focus:outline-none cursor-pointer w-full sm:w-auto max-w-full truncate"
            >
              ${state.sessionsList
                .map(
                  (s) => `
                <option value="${escapeHtml(s.id)}" ${s.id === session.id ? 'selected' : ''}>
                  ${escapeHtml(s.name)} (${escapeHtml(s.id)})
                </option>
              `
                )
                .join('')}
            </select>

            <button
              type="button"
              id="participant-qr-btn"
              class="ios-btn-glass px-4 py-2.5 text-xs font-semibold inline-flex items-center justify-center gap-1.5 w-full sm:w-auto shrink-0"
            >
              ${Icons.qr('w-3.5 h-3.5 text-[#2563EB]')}
              <span>QR Sesi</span>
            </button>
          </div>
        </div>

        <!-- iOS Live Activity Spotlight Banner (Jika ada pertanyaan yang sedang dipilih pemateri) -->
        ${
          selectedQ
            ? `
          <div class="mt-5 liquid-cell p-5 ring-2 ring-[#2563EB] bg-white/90">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <span class="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#2563EB]">
                <span class="w-2 h-2 rounded-full bg-[#2563EB] animate-ping"></span>
                Sedang Dibahas • Pertanyaan #${String(selectedQ.number).padStart(2, '0')}
              </span>
              <span class="text-xs text-slate-500 font-medium">
                Oleh: <strong class="text-[#0F172A]">${escapeHtml(selectedQ.name)}</strong>
              </span>
            </div>
            <p class="text-base sm:text-lg font-semibold text-[#0F172A] leading-snug">
              "${escapeHtml(selectedQ.text)}"
            </p>
          </div>
        `
            : ''
        }
      </section>

      <!-- Workspace Grid: Left Composer (5 Col) + Right Feed (7 Col) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- Left Column: iOS Liquid Glass Question Sheet -->
        <section class="lg:col-span-5 liquid-glass p-6 sm:p-7 lg:sticky lg:top-24">
          <div class="pb-4 border-b border-slate-200/70 flex items-center justify-between">
            <div>
              <h2 class="text-base font-bold text-[#0F172A] tracking-tight">Kirim Pertanyaan</h2>
              <p class="text-xs text-slate-500 mt-0.5">Langsung tampil di layar pemateri secara real-time.</p>
            </div>
            <span class="font-mono text-xs px-2.5 py-1 rounded-full bg-white/80 text-[#2563EB] font-semibold border border-white">
              ${escapeHtml(session.id)}
            </span>
          </div>

          <div class="mt-5">
            ${
              isSessionActive
                ? `
              <form id="participant-question-form" class="space-y-4">
                <div>
                  <label for="input-participant-name" class="block text-xs font-semibold text-slate-700 mb-1.5 px-1">
                    Nama Anda <span class="text-slate-400 font-normal">(Opsional bila anonim)</span>
                  </label>
                  <input
                    type="text"
                    id="input-participant-name"
                    maxlength="60"
                    value="${escapeHtml(savedParticipantName)}"
                    ${isAnonChecked ? 'disabled' : ''}
                    class="ios-input w-full px-4 py-2.5 text-sm text-[#0F172A] disabled:opacity-50"
                  />
                </div>

                ${
                  session.allowAnonymous !== false
                    ? `
                  <label class="liquid-cell flex items-center justify-between gap-3 cursor-pointer select-none p-3.5">
                    <div>
                      <span class="block text-xs font-semibold text-[#0F172A]">Kirim sebagai Peserta Anonim</span>
                      <span class="block text-[11px] text-slate-500 mt-0.5">Sembunyikan nama Anda di layar publik</span>
                    </div>
                    <input
                      type="checkbox"
                      id="input-participant-anon"
                      ${isAnonChecked ? 'checked' : ''}
                      class="w-4 h-4 rounded text-[#2563EB] focus:ring-[#2563EB]"
                    />
                  </label>
                `
                    : ''
                }

                <div>
                  <div class="flex items-center justify-between mb-1.5 px-1">
                    <label for="input-participant-text" class="block text-xs font-semibold text-slate-700">
                      Isi Pertanyaan *
                    </label>
                    <span id="char-counter" class="font-mono text-[11px] font-medium text-slate-400 tabular-nums">
                      ${draftQuestionText.length} / 350
                    </span>
                  </div>
                  <textarea
                    id="input-participant-text"
                    rows="4"
                    maxlength="350"
                    required
                    class="ios-input w-full px-4 py-3 text-sm text-[#0F172A] resize-none leading-relaxed"
                  >${escapeHtml(draftQuestionText)}</textarea>
                </div>

                <button
                  type="submit"
                  id="btn-submit-question"
                  class="ios-btn-primary w-full py-3.5 px-5 font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2"
                >
                  <span>Kirim Pertanyaan Sekarang</span>
                  ${Icons.arrowRight('w-4 h-4')}
                </button>
              </form>
            `
                : `
              <div class="liquid-cell p-5 text-center space-y-2">
                <div class="w-10 h-10 rounded-full bg-amber-500/15 text-amber-700 flex items-center justify-center mx-auto">
                  ${Icons.lock('w-4 h-4')}
                </div>
                <h3 class="text-sm font-bold text-[#0F172A]">Penerimaan Pertanyaan Ditutup</h3>
                <p class="text-xs text-slate-600 leading-relaxed">
                  Pemateri sedang menutup pengiriman pertanyaan baru, namun Anda tetap dapat memberikan dukungan suara pada pertanyaan yang sudah ada.
                </p>
              </div>
            `
            }
          </div>
        </section>

        <!-- Right Column: Liquid Glass Questions Feed & iOS Segmented Control -->
        <section class="lg:col-span-7 liquid-glass p-5 sm:p-7 space-y-5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/70">
            <div class="flex items-center gap-2">
              <h2 class="text-base font-bold text-[#0F172A] tracking-tight">
                Pertanyaan Audiens
              </h2>
              <span class="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#2563EB]/10 text-[#2563EB] tabular-nums">
                ${session.questionsList.length}
              </span>
            </div>

            <!-- iOS Segmented Control (4-Col Grid on Mobile, Inline Pill on Tablet/Desktop) -->
            <div class="ios-segmented grid grid-cols-4 sm:inline-flex items-center gap-1 w-full sm:w-auto">
              ${[
                { id: 'latest', label: 'Terbaru' },
                { id: 'popular', label: 'Populer' },
                { id: 'answered', label: 'Terjawab' },
                { id: 'mine', label: 'Saya' }
              ]
                .map(
                  (tab) => `
                <button
                  type="button"
                  data-filter="${tab.id}"
                  class="participant-filter-btn px-2 sm:px-3 py-1.5 text-xs font-semibold text-center transition-all ${
                    participantFilter === tab.id
                      ? 'ios-segment-active'
                      : 'text-slate-600 hover:text-[#0F172A]'
                  }"
                >
                  ${tab.label}
                </button>
              `
                )
                .join('')}
            </div>
          </div>

          <!-- Question Cells -->
          <div class="space-y-3">
            ${
              questions.length === 0
                ? `
              <div class="py-12 text-center">
                <p class="text-sm font-semibold text-slate-600">Belum ada pertanyaan pada tampilan ini.</p>
                <p class="text-xs text-slate-400 mt-1">Jadilah peserta pertama yang mengirimkan pertanyaan.</p>
              </div>
            `
                : questions
                    .map((q) => {
                      const voted = hasParticipantVoted(session.id, q.id);
                      const isMine = q.authorId === myPid;
                      const isSelected = q.status === 'selected';
                      return `
                        <article class="liquid-cell p-4 sm:p-5 ${
                          isSelected ? 'ring-2 ring-[#06B6D4] bg-white/90' : ''
                        }">
                          <div class="flex items-start justify-between gap-3">
                            <div class="flex items-center gap-2 flex-wrap">
                              <span class="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#0F172A] text-[#06B6D4]">
                                #${String(q.number).padStart(2, '0')}
                              </span>
                              <span class="text-xs font-bold text-[#0F172A]">
                                ${escapeHtml(q.name)}
                              </span>
                              ${
                                isMine
                                  ? `<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#2563EB]/10 text-[#2563EB]">Anda</span>`
                                  : ''
                              }
                              <span class="text-[11px] text-slate-400">• ${formatTimeAgo(q.createdAt)}</span>
                            </div>
                            ${statusPill(q.status)}
                          </div>

                          <p class="mt-3 text-sm sm:text-[15px] text-[#0F172A] leading-relaxed break-words">
                            ${escapeHtml(q.text)}
                          </p>

                          <div class="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                            <span class="font-mono text-[11px] text-slate-400">
                              ID: ${escapeHtml(q.id.slice(-6))}
                            </span>

                            <button
                              type="button"
                              data-vote-id="${escapeHtml(q.id)}"
                              class="btn-vote-question inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                voted
                                  ? 'ios-btn-primary'
                                  : 'ios-btn-glass hover:border-[#2563EB]/40'
                              }"
                            >
                              ${Icons.upvote('w-3.5 h-3.5')}
                              <span>${voted ? 'Didukung' : 'Dukung'}</span>
                              <span class="font-mono tabular-nums px-1.5 py-0.2 rounded-full ${
                                voted ? 'bg-white/20 text-white' : 'bg-slate-900/[0.06] text-[#0F172A]'
                              }">
                                ${q.votes || 0}
                              </span>
                            </button>
                          </div>
                        </article>
                      `;
                    })
                    .join('')
            }
          </div>
        </section>
      </div>
    </main>
  `;
}

export function bindParticipantPageEvents() {
  const requestedId = getRequestedSessionIdFromHash();
  const session = getSessionById(requestedId);
  if (!session) return;

  const sessionSelect = document.getElementById('participant-session-select');
  if (sessionSelect) {
    sessionSelect.addEventListener('change', (e) => {
      navigateTo(`/participant?session=${encodeURIComponent(e.target.value)}`);
    });
  }

  const qrBtn = document.getElementById('participant-qr-btn');
  if (qrBtn) {
    qrBtn.addEventListener('click', () => {
      openQRCodeModal(session.id, session.name);
    });
  }

  const nameInput = document.getElementById('input-participant-name');
  if (nameInput) {
    nameInput.addEventListener('input', (e) => {
      savedParticipantName = e.target.value;
      localStorage.setItem('smartqa_participant_name', savedParticipantName);
    });
  }

  const anonCheckbox = document.getElementById('input-participant-anon');
  if (anonCheckbox) {
    anonCheckbox.addEventListener('change', (e) => {
      isAnonChecked = e.target.checked;
      if (nameInput) {
        nameInput.disabled = isAnonChecked;
      }
    });
  }

  const textInput = document.getElementById('input-participant-text');
  const charCounter = document.getElementById('char-counter');
  if (textInput) {
    textInput.addEventListener('input', (e) => {
      draftQuestionText = e.target.value;
      if (charCounter) {
        charCounter.textContent = `${draftQuestionText.length} / 350`;
      }
    });
  }

  const form = document.getElementById('participant-question-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-submit-question');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const created = await submitQuestion(session.id, {
          name: savedParticipantName,
          text: draftQuestionText,
          anonymous: isAnonChecked
        });
        draftQuestionText = '';
        if (textInput) textInput.value = '';
        if (charCounter) charCounter.textContent = '0 / 350';
        showToast(`Pertanyaan #${String(created.number).padStart(2, '0')} berhasil dikirim.`, 'success');
      } catch (err) {
        showToast(err.message || 'Gagal mengirim pertanyaan.', 'error');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  document.querySelectorAll('.participant-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      participantFilter = btn.getAttribute('data-filter') || 'latest';
      window.dispatchEvent(new CustomEvent('smartqa:rerender'));
    });
  });

  document.querySelectorAll('.btn-vote-question').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const qId = btn.getAttribute('data-vote-id');
      if (!qId) return;
      try {
        const res = await toggleVoteQuestion(session.id, qId);
        showToast(
          res.voted ? 'Dukungan suara tercatat.' : 'Dukungan suara dibatalkan.',
          'info'
        );
      } catch (err) {
        showToast(err.message || 'Gagal memproses vote.', 'error');
      }
    });
  });
}
