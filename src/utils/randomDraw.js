/**
 * SmartQ&A — Random Question Drawing Engine
 * Mengelola pemilihan acak kriptografis (Crypto CSPRNG) dan animasi slot-machine
 * dengan perlambatan bertahap (easing deceleration) selama ~4 detik.
 */

import { soundFX } from './sound.js';

/**
 * Memilih 1 indeks acak secara murni menggunakan Web Crypto API (unbiased CSPRNG)
 */
export function pickSecureRandomIndex(length) {
  if (length <= 0) return -1;
  if (length === 1) return 0;

  const array = new Uint32Array(1);
  const maxUint = 0xffffffff;
  const limit = maxUint - (maxUint % length);

  let randomValue;
  do {
    window.crypto.getRandomValues(array);
    randomValue = array[0];
  } while (randomValue >= limit);

  return randomValue % length;
}

/**
 * Menjalankan animasi mesin undian pertanyaan selama ~3.8 detik:
 * 1. Countdown singkat atau langsung shuffle cepat
 * 2. Pergantian pertanyaan secara cepat lalu melambat (slot-machine easing)
 * 3. Berhenti tepat pada pemenang yang telah dikunci oleh transaksi backend/store
 */
export async function runSlotMachineAnimation({
  candidates,
  winnerQuestion,
  onTickFrame,
  onCountdownFrame,
  durationMs = 3800
}) {
  if (!candidates || candidates.length === 0 || !winnerQuestion) {
    return null;
  }

  // Tahap 1: Countdown visual cepat (3 - 2 - 1) ~ 900ms total
  if (typeof onCountdownFrame === 'function') {
    for (let count = 3; count >= 1; count--) {
      onCountdownFrame(count);
      soundFX.playCountdownBeep(count === 1);
      await new Promise((r) => setTimeout(r, 280));
    }
    onCountdownFrame(0);
  }

  // Tahap 2: Animasi Slot Machine Shuffle (~3.2 detik dengan perlambatan eksponensial)
  const totalSteps = 28;
  let lastIndex = -1;

  for (let step = 0; step < totalSteps; step++) {
    const progress = step / totalSteps; // 0.0 -> 1.0
    // Delay mulai dari 55ms di awal, melambat hingga 280ms di akhir
    const stepDelay = Math.round(55 + Math.pow(progress, 2.4) * 230);

    let displayQuestion;
    if (step === totalSteps - 1) {
      displayQuestion = winnerQuestion;
    } else if (candidates.length === 1) {
      displayQuestion = candidates[0];
    } else {
      let idx = pickSecureRandomIndex(candidates.length);
      if (idx === lastIndex) {
        idx = (idx + 1) % candidates.length;
      }
      lastIndex = idx;
      displayQuestion = candidates[idx];
    }

    if (typeof onTickFrame === 'function') {
      onTickFrame(displayQuestion, step, totalSteps);
    }

    // Nada tick meningkat sedikit menjelang berhenti
    const pitch = 420 + Math.round(progress * 320);
    soundFX.playTick(pitch);

    await new Promise((r) => setTimeout(r, stepDelay));
  }

  // Bunyikan fanfare pemenang
  soundFX.playWinnerFanfare();
  return winnerQuestion;
}

