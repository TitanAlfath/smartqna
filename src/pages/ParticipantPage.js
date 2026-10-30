/**
 * SmartQ&A — 2. Participant Page (Private & Focused Question Submission UI)
 * Peserta bebas mengajukan pertanyaan tanpa melihat daftar pertanyaan dari audiens lain.
 */

import {
  getAppState,
  getSessionById,
  submitQuestion,
  getParticipantId
} from '../services/firebase.js';
import { escapeHtml, formatTimeAgo } from '../components/Navbar.js';
import { Icons } from '../components/Icons.js';
import { openQRCodeModal } from '../components/QRCodeModal.js';
import { showToast, navigateTo } from '../app.js';

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
      <main class="max-w-xl mx-auto px-4 py-12 text-center">
        <div class="liquid-glass p-7 sm:p-10 space-y-5">
          <img src="./assets/logo.png" alt="SmartQ&A" class="w-16 h-16 object-contain mx-auto drop-shadow-sm" />
          <div class="space-y-1.5">
            <h2 class="text-xl font-bold text-[#0F172A] tracking-tight">Gabung Sesi Tanya Jawab</h2>
            <p class="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              Peserta <strong>tidak perlu login</strong> untuk bertanya. Silakan pindai QR Code di layar acara atau masukkan kode sesi di bawah ini:
            </p>
          </div>
          <form id="participant-join-code-form" class="max-w-sm mx-auto flex items-center gap-2 p-1.5 rounded-full bg-white/85 border border-white shadow-sm">
            <input
              type="text"
              id="participant-join-code-input"
              required
              placeholder="Masukkan kode sesi..."
              class="flex-1 min-w-0 bg-transparent px-3.5 py-2 text-xs sm:text-sm font-mono uppercase text-[#0F172A] placeholder:normal-case placeholder:font-sans placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              class="ios-btn-primary px-5 py-2.5 text-xs font-semibold shrink-0"
            >
              Masuk Sesi
            </button>
          </form>
          <div class="pt-1">
            <a href="#/" class="text-xs font-semibold text-slate-500 hover:text-[#0F172A] hover:underline">
              Kembali ke Beranda
            </a>
          </div>
        </div>
      </main>
    `;
  }

  const isSessionActive = session.status === 'active' && session.allowQuestions !== false;
  const myPid = getParticipantId();
  const myOwnQuestions = session.questionsList
    .filter((q) => q.authorId === myPid)
    .sort((a, b) => b.createdAt - a.createdAt);

  return `
    <main class="max-w-2xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-6">
      <!-- Top Session Header Card -->
      <section class="liquid-glass p-5 sm:p-7">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="space-y-1">
            <h1 class="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
              ${escapeHtml(session.name)}
            </h1>
            <p class="text-xs text-slate-600">
              Narasumber: <strong class="text-[#0F172A] font-semibold">${escapeHtml(session.speaker || 'Pemateri Utama')}</strong>
              ${session.description ? ` • ${escapeHtml(session.description)}` : ''}
            </p>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            ${
              state.sessionsList.length > 1
                ? `
              <label for="participant-session-select" class="sr-only">Pilih Sesi</label>
              <select
                id="participant-session-select"
                class="ios-btn-glass px-3.5 py-2 text-xs font-semibold text-[#0F172A] focus:outline-none cursor-pointer max-w-[180px] truncate"
              >
                ${state.sessionsList
                  .map(
                    (s) => `
                  <option value="${escapeHtml(s.id)}" ${s.id === session.id ? 'selected' : ''}>
                    ${escapeHtml(s.name)}
                  </option>
                `
                  )
                  .join('')}
              </select>
            `
                : ''
            }

            <button
              type="button"
              id="participant-qr-btn"
              class="ios-btn-glass px-3.5 py-2 text-xs font-semibold inline-flex items-center justify-center gap-1.5 shrink-0"
            >
              ${Icons.qr('w-3.5 h-3.5 text-[#2563EB]')}
              <span>QR Sesi</span>
            </button>
          </div>
        </div>
      </section>

      <!-- Focused Question Submission Card (No Other Audience Questions Shown) -->
      <section class="liquid-glass p-6 sm:p-8">
        <div class="pb-4 border-b border-slate-200/70">
          <h2 class="text-base sm:text-lg font-bold text-[#0F172A] tracking-tight">Ajukan Pertanyaan Anda</h2>
          <p class="text-xs text-slate-500 mt-0.5">
            Pertanyaan Anda dikirim langsung ke layar pemateri/moderator secara privat.
          </p>
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
                  class="ios-input w-full px-4 py-3 text-sm text-[#0F172A] disabled:opacity-50"
                />
              </div>

              ${
                session.allowAnonymous !== false
                  ? `
                <label class="liquid-cell flex items-center justify-between gap-3 cursor-pointer select-none p-3.5">
                  <div>
                    <span class="block text-xs font-semibold text-[#0F172A]">Kirim sebagai Peserta Anonim</span>
                    <span class="block text-[11px] text-slate-500 mt-0.5">Sembunyikan nama Anda saat pertanyaan ditampilkan</span>
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
              <h3 class="text-sm font-bold text-[#0F172A]">Penerimaan Pertanyaan Ditutup</h3>
              <p class="text-xs text-slate-600 leading-relaxed">
                Pemateri sedang menutup sementara pengiriman pertanyaan baru untuk sesi ini.
              </p>
            </div>
          `
          }
        </div>
      </section>

      <!-- Hanya menampilkan riwayat pertanyaan milik peserta di perangkat ini sendiri (jika ada) -->
      ${
        myOwnQuestions.length > 0
          ? `
        <section class="liquid-glass p-5 sm:p-7 space-y-3.5">
          <div class="pb-3 border-b border-slate-200/70 flex items-center justify-between">
            <h3 class="text-sm font-bold text-[#0F172A]">
              Pertanyaan yang Anda Kirim (${myOwnQuestions.length})
            </h3>
            <span class="text-[11px] text-slate-400">Hanya terlihat di perangkat Anda</span>
          </div>
          <div class="space-y-2.5">
            ${myOwnQuestions
              .map(
                (q) => `
              <article class="liquid-cell p-4">
                <div class="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <strong class="text-[#0F172A]">${escapeHtml(q.name)}</strong>
                  <span>${formatTimeAgo(q.createdAt)}</span>
                </div>
                <p class="mt-1.5 text-sm text-[#0F172A] leading-relaxed break-words">
                  ${escapeHtml(q.text)}
                </p>
                <div class="mt-2 pt-2 border-t border-slate-200/50 text-[11px] text-emerald-700 font-medium">
                  ${
                    q.status === 'answered'
                      ? 'Telah dijawab pemateri'
                      : q.status === 'selected'
                      ? 'Sedang dibahas di layar utama'
                      : 'Terkirim ke pemateri'
                  }
                </div>
              </article>
            `
              )
              .join('')}
          </div>
        </section>
      `
          : ''
      }
    </main>
  `;
}

export function bindParticipantPageEvents() {
  const joinCodeForm = document.getElementById('participant-join-code-form');
  if (joinCodeForm) {
    joinCodeForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const codeInput = document.getElementById('participant-join-code-input');
      const code = (codeInput?.value || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
      if (code) {
        navigateTo(`/participant?session=${encodeURIComponent(code)}`);
      }
    });
  }

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
        await submitQuestion(session.id, {
          name: savedParticipantName,
          text: draftQuestionText,
          anonymous: isAnonChecked
        });
        draftQuestionText = '';
        if (textInput) textInput.value = '';
        if (charCounter) charCounter.textContent = '0 / 350';
        showToast('Pertanyaan Anda berhasil dikirim ke pemateri.', 'success');
      } catch (err) {
        showToast(err.message || 'Gagal mengirim pertanyaan.', 'error');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
}
