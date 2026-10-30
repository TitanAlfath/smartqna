/**
 * SmartQ&A — 6. Question History Page (iOS Liquid Glass Archive & CSV Export)
 */

import { getAppState, getSessionById } from '../services/firebase.js';
import { escapeHtml, formatTimeAgo } from '../components/Navbar.js';
import { Icons } from '../components/Icons.js';
import { showToast } from '../app.js';

let historySessionId = null;

export function renderQuestionHistoryPage() {
  const state = getAppState();
  const session = getSessionById(historySessionId || state.activeSessionId);

  if (!session) {
    return `
      <main class="max-w-3xl mx-auto px-4 py-12 text-center">
        <div class="liquid-glass p-8 sm:p-10 space-y-4">
          <img src="./assets/logo.png" alt="SmartQ&A" class="w-16 h-16 object-contain mx-auto drop-shadow-sm" />
          <div class="space-y-1">
            <h2 class="text-xl font-bold text-[#0F172A] tracking-tight">Belum Ada Riwayat Sesi</h2>
            <p class="text-xs text-slate-500 max-w-md mx-auto">
              Tambahkan sesi kegiatan terlebih dahulu untuk melihat dan mengekspor riwayat pertanyaan.
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

  const historyItems = session.drawHistoryList || [];
  const answeredOrSelectedQuestions = session.questionsList.filter(
    (q) => q.status === 'answered' || q.status === 'selected' || q.status === 'skipped'
  );
  const displayRows = historyItems.length > 0 ? historyItems : answeredOrSelectedQuestions;

  return `
    <main class="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6">
      <!-- Liquid Glass Header -->
      <section class="liquid-glass p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="space-y-1">
          <span class="inline-block px-3 py-1 rounded-full text-[11px] font-semibold bg-[#2563EB]/10 text-[#2563EB]">
            ARSIP &amp; REKAPITULASI
          </span>
          <h1 class="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight pt-1">
            Riwayat Pertanyaan Terpilih
          </h1>
          <p class="text-xs text-slate-500">
            Daftar pertanyaan yang telah diundi maupun dipilih secara manual selama sesi kegiatan.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2.5">
          <label for="history-session-select" class="sr-only">Pilih Sesi</label>
          <select
            id="history-session-select"
            class="ios-btn-glass px-4 py-2.5 text-xs font-semibold text-[#0F172A] focus:outline-none cursor-pointer"
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

          <button
            type="button"
            id="btn-export-csv"
            class="ios-btn-primary px-5 py-2.5 font-semibold text-xs inline-flex items-center gap-2"
          >
            ${Icons.download('w-3.5 h-3.5')}
            <span>Export CSV (${session.questionsList.length})</span>
          </button>
        </div>
      </section>

      <!-- Liquid Glass Table Sheet -->
      <section class="liquid-glass p-6 sm:p-7">
        <div class="flex items-center justify-between pb-4 border-b border-slate-200/70 mb-4">
          <h2 class="text-sm font-bold text-[#0F172A] tracking-tight">
            Log Sesi: ${escapeHtml(session.name)} (${displayRows.length})
          </h2>
          <span class="font-mono text-xs px-3 py-0.5 rounded-full bg-[#0F172A] text-[#06B6D4] font-semibold">
            ${escapeHtml(session.id)}
          </span>
        </div>

        ${
          displayRows.length === 0
            ? `
          <div class="py-14 text-center">
            <p class="text-sm font-semibold text-slate-600">Belum ada riwayat pertanyaan terpilih pada sesi ini.</p>
            <p class="text-xs text-slate-400 mt-1">Gunakan Layar Pengundian atau pilih pertanyaan di Meja Moderasi.</p>
          </div>
        `
            : `
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th class="py-3 px-4">No</th>
                  <th class="py-3 px-4">Pengirim</th>
                  <th class="py-3 px-4">Pertanyaan</th>
                  <th class="py-3 px-4">Metode</th>
                  <th class="py-3 px-4">Suara</th>
                  <th class="py-3 px-4">Status Akhir</th>
                  <th class="py-3 px-4">Waktu</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200/60 text-xs sm:text-sm">
                ${displayRows
                  .map((item) => {
                    const statusVal = item.finalStatus || item.status || 'selected';
                    return `
                      <tr class="hover:bg-white/60 transition">
                        <td class="py-3.5 px-4 font-mono font-bold text-[#2563EB] tabular-nums">
                          #${String(item.number).padStart(2, '0')}
                        </td>
                        <td class="py-3.5 px-4 font-bold text-[#0F172A] whitespace-nowrap">
                          ${escapeHtml(item.name)}
                        </td>
                        <td class="py-3.5 px-4 text-slate-700 max-w-md leading-relaxed">
                          ${escapeHtml(item.text)}
                        </td>
                        <td class="py-3.5 px-4 whitespace-nowrap">
                          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            item.method === 'manual'
                              ? 'bg-slate-200/80 text-slate-700'
                              : 'bg-[#2563EB]/10 text-[#2563EB]'
                          }">
                            ${item.method === 'manual' ? 'Manual' : 'Random Draw'}
                          </span>
                        </td>
                        <td class="py-3.5 px-4 font-mono font-semibold text-slate-700 tabular-nums">
                          ▲ ${item.votes || 0}
                        </td>
                        <td class="py-3.5 px-4 whitespace-nowrap">
                          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase ${
                            statusVal === 'answered'
                              ? 'bg-emerald-500/15 text-emerald-800'
                              : statusVal === 'skipped'
                              ? 'bg-slate-200/80 text-slate-600'
                              : 'bg-[#0F172A] text-[#06B6D4]'
                          }">
                            ${escapeHtml(statusVal)}
                          </span>
                        </td>
                        <td class="py-3.5 px-4 text-xs text-slate-500 font-mono whitespace-nowrap">
                          ${formatTimeAgo(item.selectedAt || item.createdAt)}
                        </td>
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        `
        }
      </section>
    </main>
  `;
}

export function bindQuestionHistoryPageEvents() {
  const state = getAppState();
  const session = getSessionById(historySessionId || state.activeSessionId);
  if (!session) return;

  const selectEl = document.getElementById('history-session-select');
  if (selectEl) {
    selectEl.addEventListener('change', (e) => {
      historySessionId = e.target.value;
      window.dispatchEvent(new CustomEvent('smartqa:rerender'));
    });
  }

  const exportBtn = document.getElementById('btn-export-csv');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const rows = [
        ['Nomor', 'Nama Pengirim', 'Pertanyaan', 'Anonim', 'Jumlah Vote', 'Status', 'Waktu Kirim']
      ];
      session.questionsList.forEach((q) => {
        rows.push([
          q.number,
          `"${String(q.name || '').replace(/"/g, '""')}"`,
          `"${String(q.text || '').replace(/"/g, '""')}"`,
          q.anonymous ? 'Ya' : 'Tidak',
          q.votes || 0,
          q.status,
          new Date(q.createdAt).toLocaleString('id-ID')
        ]);
      });

      const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((r) => r.join(',')).join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Rekap-SmartQA-${session.id}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('File CSV rekap pertanyaan berhasil disimpan.', 'success');
    });
  }
}
