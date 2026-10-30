/**
 * SmartQ&A — QR Code Generator Utility
 * Menghasilkan QR Code dinamis berdasarkan URL Production/Localhost dan Session ID aktif,
 * serta menyediakan fitur unduh PNG beresolusi tinggi untuk ditampilkan di slide presentasi.
 */

import QRCode from 'qrcode';
import { getSessionById } from '../services/firebase.js';

/**
 * Membentuk URL halaman peserta untuk sesi tertentu.
 * Tetap berfungsi otomatis baik di localhost maupun setelah di-deploy ke Netlify / Vercel / GitHub Pages.
 */
export function getParticipantSessionUrl(sessionId) {
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const ses = getSessionById(sessionId);
  const params = new URLSearchParams();
  params.set('session', sessionId);
  if (ses && ses.name) params.set('title', ses.name);
  if (ses && ses.speaker) params.set('speaker', ses.speaker);
  return `${cleanBase}#/participant?${params.toString()}`;
}

/**
 * Merender QR Code ke elemen <canvas> atau menghasilkan Data URL PNG
 */
export async function generateQRDataUrl(sessionId, size = 360) {
  const targetUrl = getParticipantSessionUrl(sessionId);
  try {
    const dataUrl = await QRCode.toDataURL(targetUrl, {
      width: size,
      margin: 2,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'H'
    });
    return { dataUrl, targetUrl };
  } catch (err) {
    console.error('Gagal membuat QR Code:', err);
    throw err;
  }
}

/**
 * Mengunduh QR Code sebagai gambar poster PNG siap proyektor lengkap dengan judul sesi
 */
export async function downloadSessionQRPng(sessionId, sessionName = 'Sesi Tanya Jawab') {
  const { dataUrl, targetUrl } = await generateQRDataUrl(sessionId, 520);

  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 880;
  const ctx = canvas.getContext('2d');

  // Background Navy
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Header Accent Bar
  const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
  grad.addColorStop(0, '#2563EB');
  grad.addColorStop(1, '#06B6D4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, 14);

  // Brand Title
  ctx.fillStyle = '#06B6D4';
  ctx.font = 'bold 26px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SMART Q&A — INTERACTIVE SESSION', canvas.width / 2, 75);

  // Session Name
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 32px "Plus Jakarta Sans", sans-serif';
  const truncatedTitle = sessionName.length > 34 ? sessionName.slice(0, 32) + '...' : sessionName;
  ctx.fillText(truncatedTitle, canvas.width / 2, 125);

  // White Card Container for QR
  ctx.fillStyle = '#FFFFFF';
  const cardX = 100;
  const cardY = 165;
  const cardW = 520;
  const cardH = 520;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 24);
  ctx.fill();

  // Draw QR Image inside White Card
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = dataUrl;
  });
  ctx.drawImage(img, cardX + 20, cardY + 20, 480, 480);

  // Footer Instruction
  ctx.fillStyle = '#F1F5F9';
  ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Scan QR Code untuk Mengirim Pertanyaan', canvas.width / 2, 745);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 15px "JetBrains Mono", monospace';
  const shortUrl = targetUrl.length > 62 ? targetUrl.slice(0, 59) + '...' : targetUrl;
  ctx.fillText(shortUrl, canvas.width / 2, 790);

  ctx.fillStyle = '#06B6D4';
  ctx.font = 'bold 16px "JetBrains Mono", monospace';
  ctx.fillText(`Kode Sesi: ${sessionId}`, canvas.width / 2, 830);

  const link = document.createElement('a');
  const safeName = sessionName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  link.download = `QR-SmartQA-${safeName || sessionId}.png`;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

