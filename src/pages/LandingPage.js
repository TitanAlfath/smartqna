/**
 * SmartQ&A — 1. Landing Page (Clean Liquid Glass & Live Audience Feed)
 */

import { getAppState, getSessionById, isAdminAuthenticated } from '../services/firebase.js';
import { escapeHtml, formatTimeAgo } from '../components/Navbar.js';
import { Icons } from '../components/Icons.js';
import { openQRCodeModal } from '../components/QRCodeModal.js';
import { navigateTo, showToast } from '../app.js';

export function renderLandingPage() {
  const state = getAppState();
  const isAdmin = isAdminAuthenticated();
  const activeSession = getSessionById();
  const totalQuestions = activeSession ? activeSession.questionsList.length : 0;
  const pendingCount = activeSession
    ? activeSession.questionsList.filter((q) => q.status === 'pending').length
    : 0;
  const answeredCount = activeSession
    ? activeSession.questionsList.filter((q) => q.status === 'answered').length
    : 0;
  const recentQuestions =
    isAdmin && activeSession ? activeSession.questionsList.slice(0, 6) : [];

  return `
    <div class="flex-1 flex flex-col">
      <!-- Hero Section -->
      <section class="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10 lg:py-14">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          <!-- Left Column (7 Cols) -->
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

            <!-- Action Buttons -->
            <div class="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3 pt-1">
              <a
                href="${activeSession ? '#/admin/dashboard' : '#/admin/sessions'}"
                class="ios-btn-primary px-6 py-3.5 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2.5 w-full sm:w-auto"
              >
                <span>Mulai Q&amp;A</span>
                ${Icons.arrowRight('w-4 h-4')}
              </a>

              <div class="grid grid-cols-2 sm:flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                <a
                  href="#/participant${activeSession ? `?session=${encodeURIComponent(activeSession.id)}` : ''}"
                  class="ios-btn-glass px-4 sm:px-5 py-3.5 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2"
                >
                  <span>Halaman Peserta</span>
                </a>

                <a
                  href="#/admin/draw"
                  class="ios-btn-glass px-4 sm:px-5 py-3.5 text-xs sm:text-sm font-semibold text-[#2563EB] inline-flex items-center justify-center gap-2"
                >
                  ${Icons.shuffle('w-4 h-4 shrink-0')}
                  <span>Layar Undian</span>
                </a>
              </div>
            </div>

            <!-- Session Code Join Bar -->
            <div class="pt-2 sm:pt-3 max-w-md w-full">
              <form
                id="landing-join-form"
                class="p-1.5 rounded-full bg-white/80 backdrop-blur-xl border border-white shadow-sm flex items-center gap-1.5 sm:gap-2 w-full"
              >
                <div class="pl-3 text-slate-400 shrink-0">
                  ${Icons.search('w-4 h-4')}
                </div>
                <input
                  type="text"
                  id="landing-session-code"
                  placeholder="Masukkan kode sesi Q&A..."
                  class="flex-1 min-w-0 bg-transparent py-2 text-xs sm:text-sm text-[#0F172A] font-mono uppercase placeholder:normal-case placeholder:font-sans placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="submit"
                  class="px-4 sm:px-5 py-2.5 sm:py-2 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold transition shrink-0"
                >
                  Gabung
                </button>
              </form>
            </div>
          </div>

          <!-- Right Column (5 Cols): Live Session Summary -->
          <div class="lg:col-span-5">
            <div class="liquid-glass p-6 sm:p-7 relative overflow-hidden">
              <div class="flex items-center justify-between gap-2 pb-4 border-b border-slate-200/70">
                <span class="text-xs font-bold text-[#0F172A]">
                  Sesi Tanya Jawab Saat Ini
                </span>
                <span class="text-xs font-semibold text-slate-500">
                  ${activeSession ? `Kode: ${escapeHtml(activeSession.id)}` : 'Belum Ada Sesi'}
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
                      Narasumber: ${escapeHtml(activeSession.speaker || 'Pemateri Utama')}
                    </p>
                    ${
                      activeSession.description
                        ? `
                      <p class="text-xs text-slate-600 mt-1.5 leading-relaxed line-clamp-2">
                        ${escapeHtml(activeSession.description)}
                      </p>
                    `
                        : ''
                    }
                  </div>

                  <!-- Stats Grid -->
                  <div class="grid grid-cols-3 gap-2.5">
                    <div class="liquid-cell p-3.5 text-center">
                      <span class="block font-mono text-2xl font-bold text-[#0F172A] tabular-nums">${totalQuestions}</span>
                      <span class="text-[11px] text-slate-500 font-medium">Masuk</span>
                    </div>
                    <div class="liquid-cell p-3.5 text-center">
                      <span class="block font-mono text-2xl font-bold text-[#2563EB] tabular-nums">${pendingCount}</span>
                      <span class="text-[11px] text-slate-500 font-medium">Menunggu</span>
                    </div>
                    <div class="liquid-cell p-3.5 text-center">
                      <span class="block font-mono text-2xl font-bold text-emerald-600 tabular-nums">${answeredCount}</span>
                      <span class="text-[11px] text-slate-500 font-medium">Terjawab</span>
                    </div>
                  </div>

                  <!-- Live Recent Questions inside Hero Card -->
                  ${
                    recentQuestions.length > 0
                      ? `
                    <div class="space-y-2">
                      <div class="flex items-center justify-between text-xs">
                        <span class="font-bold text-[#0F172A]">Pertanyaan Terbaru Peserta</span>
                        <span class="text-slate-400">${totalQuestions} total</span>
                      </div>
                      <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
                        ${recentQuestions
                          .slice(0, 3)
                          .map(
                            (q) => `
                          <div class="liquid-cell p-3">
                            <div class="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                              <strong class="text-[#0F172A]">${String(q.number).padStart(2, '0')}. ${escapeHtml(q.name)}</strong>
                              <span>${formatTimeAgo(q.createdAt)}</span>
                            </div>
                            <p class="text-xs text-slate-700 leading-relaxed line-clamp-2">
                              ${escapeHtml(q.text)}
                            </p>
                          </div>
                        `
                          )
                          .join('')}
                      </div>
                    </div>
                  `
                      : `
                    <div class="liquid-cell p-3.5 text-center">
                      <p class="text-xs text-slate-500">Belum ada pertanyaan masuk. Pindai QR Code untuk mulai bertanya dari ponsel.</p>
                    </div>
                  `
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
                      Tekan tombol <strong>Mulai Q&amp;A</strong> untuk menambahkan sesi kegiatan baru beserta QR Code peserta.
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

      <!-- Live Incoming Questions Section on Home Page (When Active Session Exists) -->
      ${
        activeSession && recentQuestions.length > 0
          ? `
        <section class="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div class="liquid-glass p-6 sm:p-8 space-y-5">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/70">
              <div>
                <h2 class="text-lg sm:text-xl font-bold text-[#0F172A] tracking-tight">
                  Pertanyaan Masuk — ${escapeHtml(activeSession.name)} (${totalQuestions})
                </h2>
                <p class="text-xs text-slate-500 mt-0.5">
                  Pertanyaan yang dikirim peserta dari HP tampil secara langsung di halaman ini.
                </p>
              </div>
              <a
                href="#/participant?session=${encodeURIComponent(activeSession.id)}"
                class="ios-btn-primary px-4 py-2.5 text-xs font-semibold inline-flex items-center gap-1.5 self-start sm:self-auto"
              >
                <span>Kirim / Lihat Semua Pertanyaan</span>
                ${Icons.arrowUpRight('w-3.5 h-3.5')}
              </a>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${recentQuestions
                .map(
                  (q) => `
                <article class="liquid-cell p-4 sm:p-5 flex flex-col justify-between gap-3">
                  <div>
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-xs font-bold text-[#0F172A]">
                        ${String(q.number).padStart(2, '0')}. ${escapeHtml(q.name)}
                      </span>
                      <span class="text-[11px] text-slate-400">
                        ${formatTimeAgo(q.createdAt)}
                      </span>
                    </div>
                    <p class="mt-2 text-sm text-[#0F172A] leading-relaxed break-words">
                      ${escapeHtml(q.text)}
                    </p>
                  </div>
                  <div class="pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
                    <span>${q.status === 'answered' ? 'Selesai dijawab' : q.status === 'selected' ? 'Sedang dibahas' : 'Menunggu giliran'}</span>
                    <span class="font-semibold text-[#2563EB]">${q.votes || 0} Dukungan</span>
                  </div>
                </article>
              `
                )
                .join('')}
            </div>
          </div>
        </section>
      `
          : ''
      }

      <!-- Section 2: Feature Highlights -->
      <section class="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-5">
          <div class="md:col-span-7 liquid-glass p-6 sm:p-8 flex flex-col justify-between gap-4">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h3 class="text-xl font-bold text-[#0F172A] tracking-tight">
                  Pengundian Pertanyaan Acak Siap Proyektor
                </h3>
                <p class="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                  Dirancang untuk ditampilkan di layar utama acara. Dilengkapi animasi perputaran pertanyaan yang halus, efek suara prosedural, serta penguncian antrean agar pertanyaan yang sudah terpilih tidak terundi kembali.
                </p>
              </div>
              <span class="w-10 h-10 rounded-2xl bg-white/80 border border-white flex items-center justify-center text-[#2563EB] shadow-sm shrink-0">
                ${Icons.shuffle('w-4 h-4')}
              </span>
            </div>
          </div>

          <div class="md:col-span-5 liquid-glass p-6 sm:p-8 flex flex-col justify-between gap-4">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h3 class="text-xl font-bold text-[#0F172A] tracking-tight">
                  Scan QR Tanpa Login Peserta
                </h3>
                <p class="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                  Peserta cukup memindai QR Code dari HP untuk bertanya atas nama pribadi maupun anonim, serta memberikan dukungan suara secara real-time.
                </p>
              </div>
              <span class="w-10 h-10 rounded-2xl bg-white/80 border border-white flex items-center justify-center text-[#0F172A] shadow-sm shrink-0">
                ${Icons.qr('w-4 h-4')}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 3: Session Directory -->
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
                        <div class="flex items-center justify-between gap-2 text-xs text-slate-500">
                          <span class="font-mono font-semibold text-[#2563EB]">
                            Kode: ${escapeHtml(ses.id)}
                          </span>
                          <span>
                            ${isAct ? 'Sesi Aktif' : 'Selesai'}
                          </span>
                        </div>
                        <h3 class="font-bold text-base text-[#0F172A] mt-2 leading-snug">
                          ${escapeHtml(ses.name)}
                        </h3>
                        <p class="text-xs text-slate-500 mt-1">
                          Narasumber: ${escapeHtml(ses.speaker || '-')}
                        </p>
                      </div>

                      <div class="pt-3 border-t border-slate-200/60 flex items-center justify-between">
                        <span class="text-xs font-semibold text-slate-600">${qCount} Pertanyaan</span>
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
      navigateTo(`/participant?session=${encodeURIComponent(code)}`);
    });
  }
}
