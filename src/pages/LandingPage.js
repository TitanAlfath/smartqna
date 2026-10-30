/**
 * SmartQ&A — 1. Landing Page (Apple iOS Liquid Glass & Bento Spatial UI)
 */

import { getAppState, getSessionById } from '../services/firebase.js';
import { escapeHtml } from '../components/Navbar.js';
import { Icons } from '../components/Icons.js';
import { openQRCodeModal } from '../components/QRCodeModal.js';
import { navigateTo, showToast } from '../app.js';

export function renderLandingPage() {
  const state = getAppState();
  const activeSession = getSessionById();
  const totalQuestions = activeSession ? activeSession.questionsList.length : 0;
  const pendingCount = activeSession
    ? activeSession.questionsList.filter((q) => q.status === 'pending').length
    : 0;
  const answeredCount = activeSession
    ? activeSession.questionsList.filter((q) => q.status === 'answered').length
    : 0;
  const latestQuestion =
    activeSession && activeSession.questionsList.length > 0
      ? activeSession.questionsList[0]
      : null;

  return `
    <div class="flex-1 flex flex-col">
      <!-- Hero Section: Spatial Liquid Glass & Live Activity Widget -->
      <section class="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 lg:py-14">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          <!-- Left Column (7 Cols): Cupertino Typography & Capsule Controls -->
          <div class="lg:col-span-7 space-y-5">
            <div class="space-y-2.5">
              <p class="text-sm sm:text-base font-semibold tracking-tight text-[#2563EB]">
                Interactive Q&amp;A Platform
              </p>
              <h1 class="text-3xl sm:text-5xl font-bold tracking-tight text-[#0F172A] leading-[1.1]">
                Make Every
                <span class="font-serif italic font-normal text-[#2563EB]">Question</span>
                Count.
              </h1>
              <p class="text-base sm:text-xl font-medium text-[#0F172A]/85 leading-snug max-w-xl pt-1">
                A new way to make discussions more engaging, interactive, and exciting.
              </p>
            </div>

            <p class="text-slate-600 text-sm sm:text-base leading-relaxed max-w-xl">
              SmartQ&amp;A helps you create interactive question sessions with random question selection, bringing a fresh experience to every discussion, presentation, and learning session.
            </p>

            <!-- Tactile Capsule Buttons -->
            <div class="flex flex-wrap items-center gap-3 pt-1">
              <a
                href="${activeSession ? '#/admin/dashboard' : '#/admin/sessions'}"
                class="ios-btn-primary px-6 py-3.5 text-xs sm:text-sm font-semibold inline-flex items-center gap-2.5"
              >
                <span>Mulai Q&amp;A</span>
                ${Icons.arrowRight('w-4 h-4')}
              </a>

              <a
                href="#/participant${activeSession ? `?session=${encodeURIComponent(activeSession.id)}` : ''}"
                class="ios-btn-glass px-5 py-3.5 text-xs sm:text-sm font-semibold inline-flex items-center gap-2"
              >
                <span>Halaman Peserta</span>
              </a>

              <a
                href="#/admin/draw"
                class="ios-btn-glass px-5 py-3.5 text-xs sm:text-sm font-semibold text-[#2563EB] inline-flex items-center gap-2"
              >
                ${Icons.shuffle('w-4 h-4')}
                <span>Layar Undian</span>
              </a>
            </div>

            <!-- iOS Spotlight-Style Session Code Capsule -->
            <div class="pt-3 max-w-md">
              <form
                id="landing-join-form"
                class="p-1.5 rounded-full bg-white/80 backdrop-blur-xl border border-white shadow-sm flex items-center gap-2"
              >
                <div class="pl-3.5 text-slate-400">
                  ${Icons.search('w-4 h-4')}
                </div>
                <input
                  type="text"
                  id="landing-session-code"
                  placeholder="Masukkan kode sesi Q&A..."
                  class="flex-1 bg-transparent py-2 text-xs text-[#0F172A] font-mono uppercase placeholder:normal-case placeholder:font-sans placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="submit"
                  class="px-5 py-2 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold transition shrink-0"
                >
                  Gabung
                </button>
              </form>
            </div>
          </div>

          <!-- Right Column (5 Cols): iOS Liquid Glass Live Activity Widget -->
          <div class="lg:col-span-5">
            <div class="liquid-glass p-6 sm:p-7 relative overflow-hidden">
              <!-- Top Status Header -->
              <div class="flex items-center justify-between gap-2 pb-4 border-b border-slate-200/70">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full ${
                    activeSession && activeSession.status === 'active'
                      ? 'bg-[#06B6D4] shadow-[0_0_10px_#06B6D4]'
                      : 'bg-slate-400'
                  }"></span>
                  <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Status Sesi Saat Ini
                  </span>
                </div>
                <span class="font-mono text-xs font-semibold px-3 py-1 rounded-full bg-[#2563EB]/10 text-[#2563EB]">
                  ${activeSession ? escapeHtml(activeSession.id) : 'BELUM ADA SESI'}
                </span>
              </div>

              ${
                activeSession
                  ? `
                <div class="mt-5 space-y-5">
                  <div>
                    <h2 class="text-xl font-bold text-[#0F172A] leading-snug tracking-tight">
                      ${escapeHtml(activeSession.name)}
                    </h2>
                    <p class="text-xs text-[#2563EB] font-semibold mt-1">
                      ${escapeHtml(activeSession.speaker || 'Pemateri Utama')}
                    </p>
                    <p class="text-xs text-slate-600 mt-2 leading-relaxed line-clamp-2">
                      ${escapeHtml(activeSession.description || '')}
                    </p>
                  </div>

                  <!-- iOS Widget Sub-Pills -->
                  <div class="grid grid-cols-3 gap-2.5">
                    <div class="liquid-cell p-3.5 text-center">
                      <span class="block font-mono text-2xl font-bold text-[#0F172A] tabular-nums">${totalQuestions}</span>
                      <span class="text-[11px] text-slate-500 font-medium">Masuk</span>
                    </div>
                    <div class="liquid-cell p-3.5 text-center">
                      <span class="block font-mono text-2xl font-bold text-[#2563EB] tabular-nums">${pendingCount}</span>
                      <span class="text-[11px] text-slate-500 font-medium">Pending</span>
                    </div>
                    <div class="liquid-cell p-3.5 text-center">
                      <span class="block font-mono text-2xl font-bold text-emerald-600 tabular-nums">${answeredCount}</span>
                      <span class="text-[11px] text-slate-500 font-medium">Terjawab</span>
                    </div>
                  </div>

                  ${
                    latestQuestion
                      ? `
                    <div class="liquid-cell p-3.5">
                      <div class="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                        <span class="font-semibold text-[#2563EB]">Pertanyaan Terbaru (#${String(latestQuestion.number).padStart(2, '0')})</span>
                        <span>${escapeHtml(latestQuestion.name)}</span>
                      </div>
                      <p class="text-xs text-[#0F172A] line-clamp-2 leading-relaxed">
                        "${escapeHtml(latestQuestion.text)}"
                      </p>
                    </div>
                  `
                      : ''
                  }

                  <div class="flex flex-col sm:flex-row gap-2.5 pt-1">
                    <a
                      href="#/participant?session=${encodeURIComponent(activeSession.id)}"
                      class="ios-btn-primary flex-1 py-3 px-4 text-xs font-semibold text-center inline-flex items-center justify-center gap-2"
                    >
                      <span>Buka Sesi Ini</span>
                      ${Icons.arrowUpRight('w-3.5 h-3.5')}
                    </a>
                    <button
                      type="button"
                      id="landing-btn-qr"
                      class="ios-btn-glass py-3 px-4 text-xs font-semibold inline-flex items-center justify-center gap-2"
                    >
                      ${Icons.qr('w-3.5 h-3.5 text-[#2563EB]')}
                      <span>QR Code</span>
                    </button>
                  </div>
                </div>
              `
                  : `
                <div class="py-8 text-center space-y-4">
                  <img
                    src="./assets/logo.png"
                    alt="SmartQ&A Logo"
                    class="w-16 h-16 object-contain mx-auto drop-shadow-sm"
                  />
                  <div class="space-y-1.5 max-w-xs mx-auto">
                    <h2 class="text-base font-bold text-[#0F172A] tracking-tight">
                      Belum Ada Sesi Q&amp;A Aktif
                    </h2>
                    <p class="text-xs text-slate-500 leading-relaxed">
                      Sistem masih kosong. Tekan tombol <strong>Mulai Q&amp;A</strong> untuk menambahkan sesi kegiatan baru beserta QR Code peserta.
                    </p>
                  </div>
                  <div class="pt-1">
                    <a
                      href="#/admin/sessions"
                      class="ios-btn-primary py-3 px-6 text-xs font-semibold inline-flex items-center justify-center gap-2"
                    >
                      ${Icons.plus('w-4 h-4')}
                      <span>Mulai Q&amp;A (Buat Sesi)</span>
                    </a>
                  </div>
                </div>
              `
              }
            </div>
          </div>
        </div>
      </section>

      <!-- Section 2: Asymmetric Bento Liquid Glass Widgets -->
      <section class="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-5">
          <!-- Bento Widget 1 (7 Cols) -->
          <div class="md:col-span-7 liquid-glass p-6 sm:p-8 flex flex-col justify-between gap-4">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h3 class="text-xl font-bold text-[#0F172A] tracking-tight">
                  Pengundian Pertanyaan Acak Siap Proyektor
                </h3>
                <p class="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                  Dirancang untuk ditampilkan di layar utama acara. Dilengkapi animasi perputaran pertanyaan yang halus, efek suara prosedural, serta penguncian transaksi database agar pertanyaan yang sudah terpilih tidak terundi kembali.
                </p>
              </div>
              <span class="w-10 h-10 rounded-2xl bg-white/80 border border-white flex items-center justify-center text-[#2563EB] shadow-sm shrink-0">
                ${Icons.shuffle('w-4 h-4')}
              </span>
            </div>
          </div>

          <!-- Bento Widget 2 (5 Cols) -->
          <div class="md:col-span-5 liquid-glass p-6 sm:p-8 flex flex-col justify-between gap-4">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h3 class="text-xl font-bold text-[#0F172A] tracking-tight">
                  Scan QR Tanpa Login
                </h3>
                <p class="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                  Peserta cukup memindai QR Code untuk bertanya atas nama pribadi maupun anonim, serta memberikan upvote secara real-time.
                </p>
              </div>
              <span class="w-10 h-10 rounded-2xl bg-white/80 border border-white flex items-center justify-center text-[#0F172A] shadow-sm shrink-0">
                ${Icons.qr('w-4 h-4')}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 3: iOS Grouped Inset Session Directory -->
      <section class="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-14">
        <div class="liquid-glass p-6 sm:p-8">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h2 class="text-lg sm:text-xl font-bold text-[#0F172A] tracking-tight">Direktori Sesi Q&amp;A</h2>
              <p class="text-xs text-slate-500 mt-0.5">Daftar sesi tanya jawab yang telah dibuat oleh penyelenggara.</p>
            </div>
            <a
              href="#/admin/sessions"
              class="ios-btn-primary px-4 py-2.5 text-xs font-semibold inline-flex items-center gap-1.5 self-start sm:self-auto"
            >
              ${Icons.plus('w-3.5 h-3.5')}
              <span>Tambah Sesi Q&amp;A</span>
            </a>
          </div>

          ${
            state.sessionsList.length === 0
              ? `
            <div class="liquid-cell p-8 text-center space-y-3">
              <img src="./assets/logo.png" alt="SmartQ&A" class="w-12 h-12 object-contain mx-auto opacity-90" />
              <div>
                <h3 class="text-sm font-bold text-[#0F172A]">Belum Ada Sesi Kegiatan</h3>
                <p class="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Silakan klik tombol <strong>Mulai Q&amp;A</strong> atau <strong>Tambah Sesi Q&amp;A</strong> untuk membuat sesi pertama Anda.
                </p>
              </div>
            </div>
          `
              : `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${state.sessionsList
                .map((ses) => {
                  const qCount = Object.keys(ses.questions || {}).length;
                  const isAct = ses.status === 'active';
                  return `
                    <div class="liquid-cell p-5 flex flex-col justify-between gap-4">
                      <div>
                        <div class="flex items-center justify-between gap-2">
                          <span class="font-mono text-xs font-semibold px-3 py-1 rounded-full bg-[#0F172A] text-[#06B6D4]">
                            ${escapeHtml(ses.id)}
                          </span>
                          <span class="px-3 py-1 rounded-full text-[11px] font-semibold ${
                            isAct
                              ? 'bg-emerald-500/15 text-emerald-800 border border-emerald-500/20'
                              : 'bg-slate-200/70 text-slate-600'
                          }">
                            ${isAct ? '● Sesi Aktif' : 'Selesai'}
                          </span>
                        </div>
                        <h3 class="font-bold text-base text-[#0F172A] mt-3 leading-snug">
                          ${escapeHtml(ses.name)}
                        </h3>
                        <p class="text-xs text-slate-500 mt-1">
                          ${escapeHtml(ses.speaker || '-')}
                        </p>
                      </div>

                      <div class="pt-3 border-t border-slate-200/60 flex items-center justify-between">
                        <span class="text-xs font-semibold text-slate-600 font-mono">${qCount} Pertanyaan</span>
                        <a
                          href="#/participant?session=${encodeURIComponent(ses.id)}"
                          class="${
                            isAct ? 'ios-btn-primary' : 'ios-btn-glass'
                          } px-4 py-2 text-xs font-semibold inline-flex items-center gap-1.5"
                        >
                          <span>${isAct ? 'Masuk Sesi' : 'Lihat Arsip'}</span>
                          ${Icons.arrowUpRight('w-3.5 h-3.5')}
                        </a>
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          `
          }
        </div>
      </section>
    </div>
  `;
}

export function bindLandingPageEvents() {
  const qrBtn = document.getElementById('landing-btn-qr');
  if (qrBtn) {
    qrBtn.addEventListener('click', () => {
      const activeSession = getSessionById();
      if (activeSession) {
        openQRCodeModal(activeSession.id, activeSession.name);
      }
    });
  }

  const joinForm = document.getElementById('landing-join-form');
  if (joinForm) {
    joinForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('landing-session-code');
      const code = (input?.value || '').trim().toUpperCase();
      if (!code) {
        showToast('Masukkan kode sesi terlebih dahulu.', 'error');
        return;
      }
      const state = getAppState();
      if (!state.sessions[code]) {
        showToast(`Kode sesi "${code}" belum terdaftar.`, 'error');
        return;
      }
      navigateTo(`/participant?session=${encodeURIComponent(code)}`);
    });
  }
}
