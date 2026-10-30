/**
 * SmartQ&A — Production Firebase Realtime Database & Authentication Service
 * Menggunakan arsitektur Optimistic Instant State + Cloud Realtime Sync sehingga
 * seluruh aksi (Login, Buat Sesi, Kirim Pertanyaan, Vote, Undian) merespons secara
 * instan (0ms) tanpa pernah tertahan koneksi jaringan.
 */

import { initializeApp, getApps } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  push,
  update,
  remove,
  onValue
} from 'firebase/database';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { pickSecureRandomIndex } from '../utils/randomDraw.js';

const STORAGE_KEY_DB = 'smartqa_clean_db_v2';
const STORAGE_KEY_FB_CONFIG = 'smartqa_custom_firebase_config';
const STORAGE_KEY_ADMIN = 'smartqa_admin_session';
const STORAGE_KEY_PARTICIPANT = 'smartqa_participant_uid';
const STORAGE_KEY_COOLDOWN = 'smartqa_last_submit_ts';

// Bersihkan cache database lama yang masih menyimpan sesi seminar bawaan
if (typeof window !== 'undefined') {
  localStorage.removeItem('smartqa_realtime_db_v1');
  localStorage.removeItem('smartqa_prod_db_v1');
}

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDAS5QZ1yCNvpOFWf_4MqsS1vNnCLXCsY8',
  authDomain: 'qnaproject-f87ff.firebaseapp.com',
  databaseURL: 'https://qnaproject-f87ff-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'qnaproject-f87ff',
  storageBucket: 'qnaproject-f87ff.firebasestorage.app',
  messagingSenderId: '902199940414',
  appId: '1:902199940414:web:4f4778b2298e84fa90886f',
  measurementId: 'G-ER7L522E32'
};

let firebaseApp = null;
let db = null;
let auth = null;
let isFirebaseConnected = false;
let stateCache = null;
const listeners = new Set();

const broadcastChannel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('smartqa_realtime_channel')
    : null;

if (broadcastChannel) {
  broadcastChannel.onmessage = (event) => {
    if (event.data && event.data.type === 'SYNC_STATE') {
      stateCache = loadLocalDb();
      notifyListeners();
    }
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY_DB) {
      stateCache = loadLocalDb();
      notifyListeners();
    }
  });
}

export function getActiveFirebaseConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_FB_CONFIG);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.apiKey && parsed.databaseURL) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse error
  }

  const envConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || DEFAULT_FIREBASE_CONFIG.databaseURL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
    appId: import.meta.env.VITE_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId
  };

  if (
    envConfig.apiKey &&
    envConfig.databaseURL &&
    !envConfig.apiKey.includes('YourApiKeyHere') &&
    !envConfig.databaseURL.includes('smart-qa-project-default-rtdb')
  ) {
    return envConfig;
  }

  return DEFAULT_FIREBASE_CONFIG;
}

export function saveRuntimeFirebaseConfig(configObj) {
  localStorage.setItem(STORAGE_KEY_FB_CONFIG, JSON.stringify(configObj));
  window.location.reload();
}

export function clearRuntimeFirebaseConfig() {
  localStorage.removeItem(STORAGE_KEY_FB_CONFIG);
  window.location.reload();
}

export function getFirebaseConnectionInfo() {
  const cfg = getActiveFirebaseConfig();
  return {
    connected: isFirebaseConnected,
    projectId: cfg?.projectId || null,
    databaseURL: cfg?.databaseURL || null
  };
}

/**
 * Struktur database awal sepenuhnya kosong (0 sesi, 0 pertanyaan).
 * Admin akan membuat sesi kegiatan baru sesuai kebutuhan acara.
 */
function createInitialDatabaseState() {
  return {
    activeSessionId: null,
    sessions: {},
    votes: {},
    activities: []
  };
}

function loadLocalDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DB);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          activeSessionId: parsed.activeSessionId || null,
          sessions: parsed.sessions || {},
          votes: parsed.votes || {},
          activities: parsed.activities || []
        };
      }
    }
  } catch {
    // Fallback to clean state
  }
  const initial = createInitialDatabaseState();
  localStorage.setItem(STORAGE_KEY_DB, JSON.stringify(initial));
  return initial;
}

function saveLocalDb(newState) {
  stateCache = newState;
  localStorage.setItem(STORAGE_KEY_DB, JSON.stringify(newState));
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: 'SYNC_STATE', timestamp: Date.now() });
  }
  notifyListeners();
}

function notifyListeners() {
  const snapshot = getAppState();
  listeners.forEach((cb) => {
    try {
      cb(snapshot);
    } catch (err) {
      console.error('Listener error:', err);
    }
  });
}

/**
 * Helper non-blocking untuk menulis ke Firebase Realtime Database di latar belakang
 */
function pushCloudWrite(fn) {
  if (!db) return;
  try {
    Promise.resolve(fn(db)).catch(() => {
      // Abaikan bila jaringan/rules belum siap, data sudah aman di state lokal
    });
  } catch {
    // Abaikan error sinkronisasi latar belakang
  }
}

export function initDataService() {
  // Muat state lokal seketika agar aplikasi langsung siap (0ms)
  stateCache = loadLocalDb();

  const config = getActiveFirebaseConfig();
  if (!config) return;

  try {
    firebaseApp = getApps().length === 0 ? initializeApp(config) : getApps()[0];
    db = getDatabase(firebaseApp);
    auth = getAuth(firebaseApp);

    // Pantau status koneksi WebSocket Firebase yang sesungguhnya
    const connectedRef = ref(db, '.info/connected');
    onValue(connectedRef, (snap) => {
      isFirebaseConnected = Boolean(snap.val());
      notifyListeners();
    });

    const rootRef = ref(db, '/');
    onValue(
      rootRef,
      (snapshot) => {
        const val = snapshot.val();
        if (val && typeof val === 'object') {
          const syncedState = {
            activeSessionId: val.activeSessionId || null,
            sessions: val.sessions || {},
            votes: val.votes || {},
            activities: val.activities
              ? Array.isArray(val.activities)
                ? val.activities
                : Object.values(val.activities).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
              : []
          };
          stateCache = syncedState;
          localStorage.setItem(STORAGE_KEY_DB, JSON.stringify(syncedState));
          notifyListeners();
        } else if (stateCache && Object.keys(stateCache.sessions || {}).length > 0) {
          // Jika Cloud masih kosong namun Admin sudah membuat sesi secara lokal, unggah ke Cloud
          pushCloudWrite((database) => set(ref(database, '/'), stateCache));
        }
      },
      () => {
        isFirebaseConnected = false;
        notifyListeners();
      }
    );
  } catch {
    isFirebaseConnected = false;
  }
}

export function subscribeToAppState(callback) {
  if (!stateCache) {
    stateCache = loadLocalDb();
  }
  listeners.add(callback);
  callback(getAppState());
  return () => listeners.delete(callback);
}

export function getAppState() {
  if (!stateCache) {
    stateCache = loadLocalDb();
  }
  const sessionsObj = stateCache.sessions || {};
  const sessionsList = Object.values(sessionsObj).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  let activeSessionId = stateCache.activeSessionId;
  if (!activeSessionId || !sessionsObj[activeSessionId]) {
    const activeFound = sessionsList.find((s) => s.status === 'active') || sessionsList[0];
    activeSessionId = activeFound ? activeFound.id : null;
  }

  return {
    isFirebaseConnected,
    activeSessionId,
    sessions: sessionsObj,
    sessionsList,
    votes: stateCache.votes || {},
    activities: Array.isArray(stateCache.activities)
      ? stateCache.activities
      : Object.values(stateCache.activities || {}).sort((a, b) => b.timestamp - a.timestamp)
  };
}

export function getSessionById(sessionId) {
  const state = getAppState();
  const targetId = sessionId || state.activeSessionId;
  if (!targetId || !state.sessions[targetId]) {
    return state.sessionsList[0] || null;
  }
  const rawSession = state.sessions[targetId];
  const questionsObj = rawSession.questions || {};
  const questionsList = Object.values(questionsObj).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const drawHistoryObj = rawSession.drawHistory || {};
  const drawHistoryList = Object.values(drawHistoryObj).sort((a, b) => (b.selectedAt || 0) - (a.selectedAt || 0));

  const drawState = rawSession.drawState || {
    currentQuestionId: null,
    isDrawing: false,
    drawVersion: 0,
    updatedAt: Date.now()
  };

  const currentSelectedQuestion =
    (drawState.currentQuestionId && questionsObj[drawState.currentQuestionId]) ||
    questionsList.find((q) => q.status === 'selected') ||
    null;

  return {
    ...rawSession,
    questionsObj,
    questionsList,
    drawState,
    drawHistoryList,
    currentSelectedQuestion
  };
}

export function getParticipantId() {
  let pid = localStorage.getItem(STORAGE_KEY_PARTICIPANT);
  if (!pid) {
    const randomHex = Array.from(window.crypto.getRandomValues(new Uint8Array(6)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    pid = `pt_${randomHex}`;
    localStorage.setItem(STORAGE_KEY_PARTICIPANT, pid);
  }
  return pid;
}

function logActivity(type, message) {
  const entry = {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    message,
    timestamp: Date.now()
  };

  const current = loadLocalDb();
  const list = Array.isArray(current.activities) ? current.activities : [];
  current.activities = [entry, ...list].slice(0, 35);
  saveLocalDb(current);

  pushCloudWrite((database) => {
    const actRef = push(ref(database, 'activities'));
    return set(actRef, entry);
  });
}

/* ============================================================================
 * 1. AUTENTIKASI PEMATERI / ADMIN (INSTAN & NON-BLOCKING)
 * ========================================================================== */

export function getCurrentAdmin() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ADMIN);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isAdminAuthenticated() {
  return Boolean(getCurrentAdmin());
}

export async function loginAdmin(email, password) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();

  if (!cleanEmail || !cleanPass) {
    throw new Error('Email dan kata sandi wajib diisi.');
  }

  if (cleanPass.length < 6) {
    throw new Error('Kata sandi minimal terdiri dari 6 karakter.');
  }

  // Simpan sesi admin seketika agar tombol langsung merespons tanpa menunggu jaringan
  const adminData = {
    uid: 'admin_01',
    email: cleanEmail,
    name: cleanEmail.split('@')[0].toUpperCase(),
    role: 'admin',
    loginAt: Date.now()
  };
  localStorage.setItem(STORAGE_KEY_ADMIN, JSON.stringify(adminData));
  logActivity('auth', `Pemateri/Admin (${cleanEmail}) membuka sesi Q&A.`);
  notifyListeners();

  // Sinkronkan dengan Firebase Auth di latar belakang bila diaktifkan
  if (auth) {
    signInWithEmailAndPassword(auth, cleanEmail, cleanPass).catch(() => {
      createUserWithEmailAndPassword(auth, cleanEmail, cleanPass).catch(() => {});
    });
  }

  return adminData;
}

export async function logoutAdmin() {
  localStorage.removeItem(STORAGE_KEY_ADMIN);
  notifyListeners();
  if (auth) {
    signOut(auth).catch(() => {});
  }
}

/* ============================================================================
 * 2. PARTICIPANT QUESTION SUBMISSION & ANTI-SPAM VALIDATION
 * ========================================================================== */

export function getSpamCooldownRemaining() {
  const lastTs = Number(localStorage.getItem(STORAGE_KEY_COOLDOWN) || 0);
  const cooldownMs = 8000;
  const diff = Date.now() - lastTs;
  return diff < cooldownMs ? Math.ceil((cooldownMs - diff) / 1000) : 0;
}

export async function submitQuestion(sessionId, { name, text, anonymous }) {
  const session = getSessionById(sessionId);
  if (!session) {
    throw new Error('Sesi kegiatan belum tersedia.');
  }
  if (session.status !== 'active') {
    throw new Error('Sesi tanya jawab ini sudah berakhir.');
  }
  if (session.allowQuestions === false) {
    throw new Error('Pemateri sedang menutup sementara penerimaan pertanyaan baru.');
  }

  const cleanText = (text || '').trim().replace(/\s+/g, ' ');
  if (!cleanText) {
    throw new Error('Isi pertanyaan tidak boleh kosong.');
  }
  if (cleanText.length < 10) {
    throw new Error('Pertanyaan terlalu singkat (minimal 10 karakter).');
  }
  if (cleanText.length > 350) {
    throw new Error('Pertanyaan melebihi batas maksimal 350 karakter.');
  }

  const cooldown = getSpamCooldownRemaining();
  if (cooldown > 0) {
    throw new Error(`Mohon tunggu ${cooldown} detik sebelum mengirim pertanyaan berikutnya.`);
  }

  const isAnon = Boolean(anonymous) && session.allowAnonymous !== false;
  const cleanName = isAnon ? 'Peserta Anonim' : (name || '').trim() || 'Peserta Seminar';

  const existingDuplicate = session.questionsList.find(
    (q) => q.text.toLowerCase() === cleanText.toLowerCase()
  );
  if (existingDuplicate) {
    throw new Error('Pertanyaan yang sama persis sudah ada di daftar. Silakan berikan dukungan suara pada pertanyaan tersebut.');
  }

  const nextNumber =
    session.questionsList.reduce((max, q) => Math.max(max, Number(q.number) || 0), 0) + 1;
  const now = Date.now();
  const questionId = `q_${now}_${Math.random().toString(36).slice(2, 6)}`;
  const participantId = getParticipantId();

  const newQuestion = {
    id: questionId,
    number: nextNumber,
    name: cleanName,
    text: cleanText,
    anonymous: isAnon,
    authorId: participantId,
    votes: 0,
    status: 'pending',
    createdAt: now,
    selectedAt: null
  };

  // Simpan instan + sinkronisasi Cloud
  const current = loadLocalDb();
  if (current.sessions[session.id]) {
    if (!current.sessions[session.id].questions) {
      current.sessions[session.id].questions = {};
    }
    current.sessions[session.id].questions[questionId] = newQuestion;
    saveLocalDb(current);
  }

  pushCloudWrite((database) =>
    set(ref(database, `sessions/${session.id}/questions/${questionId}`), newQuestion)
  );

  localStorage.setItem(STORAGE_KEY_COOLDOWN, String(now));
  logActivity('question', `Pertanyaan #${String(nextNumber).padStart(2, '0')} dikirim oleh ${cleanName}.`);
  return newQuestion;
}

/* ============================================================================
 * 3. VOTING SYSTEM (1 PESERTA = 1 VOTE PER PERTANYAAN)
 * ========================================================================== */

export function hasParticipantVoted(sessionId, questionId) {
  const state = getAppState();
  const pid = getParticipantId();
  return Boolean(state.votes?.[sessionId]?.[questionId]?.[pid]);
}

export async function toggleVoteQuestion(sessionId, questionId) {
  const session = getSessionById(sessionId);
  if (!session) throw new Error('Sesi tidak ditemukan.');
  const question = session.questionsObj[questionId];
  if (!question) throw new Error('Pertanyaan tidak ditemukan.');

  const pid = getParticipantId();
  const alreadyVoted = hasParticipantVoted(session.id, questionId);

  const current = loadLocalDb();
  if (!current.votes) current.votes = {};
  if (!current.votes[session.id]) current.votes[session.id] = {};
  if (!current.votes[session.id][questionId]) current.votes[session.id][questionId] = {};

  const qTarget = current.sessions[session.id]?.questions?.[questionId];
  if (!qTarget) throw new Error('Pertanyaan tidak ditemukan.');

  let nextVotes = 0;
  let votedResult = false;

  if (alreadyVoted) {
    delete current.votes[session.id][questionId][pid];
    nextVotes = Math.max(0, (Number(qTarget.votes) || 1) - 1);
    qTarget.votes = nextVotes;
    votedResult = false;
  } else {
    current.votes[session.id][questionId][pid] = true;
    nextVotes = (Number(qTarget.votes) || 0) + 1;
    qTarget.votes = nextVotes;
    votedResult = true;
  }

  saveLocalDb(current);

  pushCloudWrite(async (database) => {
    const voteRef = ref(database, `votes/${session.id}/${questionId}/${pid}`);
    const questionVotesRef = ref(database, `sessions/${session.id}/questions/${questionId}/votes`);
    if (votedResult) {
      await set(voteRef, true);
    } else {
      await remove(voteRef);
    }
    await set(questionVotesRef, nextVotes);
  });

  return { voted: votedResult };
}

/* ============================================================================
 * 4. MANUAL QUESTION SELECTION & MODERATION
 * ========================================================================== */

export async function updateQuestionStatus(sessionId, questionId, newStatus, method = 'manual') {
  const session = getSessionById(sessionId);
  if (!session) throw new Error('Sesi tidak ditemukan.');
  const question = session.questionsObj[questionId];
  if (!question) throw new Error('Pertanyaan tidak ditemukan.');

  const now = Date.now();
  const current = loadLocalDb();
  const targetSession = current.sessions[session.id];
  const targetQ = targetSession?.questions?.[questionId];
  if (!targetQ) return;

  if (newStatus === 'selected') {
    Object.values(targetSession.questions).forEach((q) => {
      if (q.status === 'selected' && q.id !== questionId) {
        q.status = 'answered';
      }
    });
    targetQ.selectedAt = now;
    targetSession.drawState = {
      ...(targetSession.drawState || {}),
      currentQuestionId: questionId,
      isDrawing: false,
      updatedAt: now
    };
    if (!targetSession.drawHistory) targetSession.drawHistory = {};
    const histId = `hist_${now}_${questionId}`;
    targetSession.drawHistory[histId] = {
      id: histId,
      questionId: targetQ.id,
      number: targetQ.number,
      name: targetQ.name,
      text: targetQ.text,
      votes: targetQ.votes || 0,
      method,
      selectedAt: now,
      finalStatus: 'selected'
    };
  } else {
    if (targetSession.drawHistory) {
      Object.values(targetSession.drawHistory).forEach((h) => {
        if (h.questionId === questionId) {
          h.finalStatus = newStatus;
        }
      });
    }
    if (
      targetSession.drawState?.currentQuestionId === questionId &&
      (newStatus === 'answered' || newStatus === 'skipped')
    ) {
      targetSession.drawState.currentQuestionId = null;
      targetSession.drawState.isDrawing = false;
      targetSession.drawState.updatedAt = now;
    }
  }

  targetQ.status = newStatus;
  saveLocalDb(current);

  pushCloudWrite((database) => set(ref(database, `sessions/${session.id}`), targetSession));

  const statusLabels = {
    pending: 'Pending',
    selected: 'Terpilih (Selected)',
    answered: 'Terjawab (Answered)',
    skipped: 'Dilewati (Skipped)'
  };
  logActivity(
    'status',
    `Pertanyaan #${String(question.number).padStart(2, '0')} (${question.name}) ditandai sebagai ${statusLabels[newStatus] || newStatus}.`
  );
}

export async function deleteQuestion(sessionId, questionId) {
  const session = getSessionById(sessionId);
  if (!session) throw new Error('Sesi tidak ditemukan.');
  const question = session.questionsObj[questionId];
  if (!question) return;

  const current = loadLocalDb();
  const targetSession = current.sessions[session.id];
  if (targetSession?.questions?.[questionId]) {
    delete targetSession.questions[questionId];
  }
  if (targetSession?.drawState?.currentQuestionId === questionId) {
    targetSession.drawState.currentQuestionId = null;
    targetSession.drawState.isDrawing = false;
  }
  saveLocalDb(current);

  pushCloudWrite(async (database) => {
    await remove(ref(database, `sessions/${session.id}/questions/${questionId}`));
    if (session.drawState?.currentQuestionId === questionId) {
      await update(ref(database, `sessions/${session.id}/drawState`), {
        currentQuestionId: null,
        isDrawing: false,
        updatedAt: Date.now()
      });
    }
  });

  logActivity('delete', `Pertanyaan #${String(question.number).padStart(2, '0')} dihapus.`);
}

/* ============================================================================
 * 5. RANDOM QUESTION DRAWING SYSTEM
 * ========================================================================== */

export async function lockAndSelectRandomQuestion(sessionId) {
  const session = getSessionById(sessionId);
  if (!session) throw new Error('Sesi tidak ditemukan.');

  const pendingQuestions = session.questionsList.filter((q) => q.status === 'pending');
  if (pendingQuestions.length === 0) {
    throw new Error('Seluruh pertanyaan sudah selesai diundi atau belum ada pertanyaan berstatus Pending.');
  }

  const now = Date.now();
  const current = loadLocalDb();
  const targetSession = current.sessions[session.id];
  const ds = targetSession.drawState || {};

  if (ds.isDrawing && now - (ds.updatedAt || 0) < 6000) {
    throw new Error('Proses pengundian sedang berlangsung. Jangan menjalankan dua undian bersamaan.');
  }

  const winnerIdx = pickSecureRandomIndex(pendingQuestions.length);
  const lockedWinner = pendingQuestions[winnerIdx];

  targetSession.drawState = {
    currentQuestionId: ds.currentQuestionId || null,
    pendingWinnerId: lockedWinner.id,
    isDrawing: true,
    drawVersion: (ds.drawVersion || 0) + 1,
    updatedAt: now
  };
  saveLocalDb(current);

  pushCloudWrite((database) =>
    set(ref(database, `sessions/${session.id}/drawState`), targetSession.drawState)
  );

  return {
    candidates: pendingQuestions,
    winner: lockedWinner
  };
}

export async function commitRandomDrawWinner(sessionId, winnerQuestionId) {
  await updateQuestionStatus(sessionId, winnerQuestionId, 'selected', 'random');
}

export async function resetSessionQuestionsToPending(sessionId) {
  const session = getSessionById(sessionId);
  if (!session) throw new Error('Sesi tidak ditemukan.');

  const now = Date.now();
  const current = loadLocalDb();
  const targetSession = current.sessions[session.id];
  if (targetSession?.questions) {
    Object.values(targetSession.questions).forEach((q) => {
      q.status = 'pending';
      q.selectedAt = null;
    });
  }
  targetSession.drawState = {
    currentQuestionId: null,
    isDrawing: false,
    drawVersion: 0,
    updatedAt: now
  };
  targetSession.drawHistory = {};
  saveLocalDb(current);

  pushCloudWrite((database) => set(ref(database, `sessions/${session.id}`), targetSession));

  logActivity('reset', `Antrean undian sesi "${session.name}" di-reset kembali ke Pending.`);
}

/* ============================================================================
 * 6. SESSION MANAGEMENT
 * ========================================================================== */

export async function createNewSession({ name, speaker, description, customCode, allowAnonymous = true, setAsActive = true }) {
  const cleanName = (name || '').trim();
  if (!cleanName) throw new Error('Nama kegiatan / sesi wajib diisi.');

  const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
  const cleanCustom = (customCode || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const sessionId = cleanCustom || `SES-${randomCode}`;
  const now = Date.now();

  const state = getAppState();
  if (state.sessions[sessionId]) {
    throw new Error(`Kode sesi "${sessionId}" sudah digunakan. Gunakan kode lain.`);
  }

  const newSessionObj = {
    id: sessionId,
    name: cleanName,
    speaker: (speaker || '').trim() || 'Pemateri',
    description: (description || '').trim() || 'Sesi tanya jawab interaktif peserta dan pemateri.',
    status: 'active',
    allowQuestions: true,
    allowAnonymous: Boolean(allowAnonymous),
    createdAt: now,
    questions: {},
    drawState: {
      currentQuestionId: null,
      isDrawing: false,
      drawVersion: 0,
      updatedAt: now
    },
    drawHistory: {}
  };

  const current = loadLocalDb();
  if (!current.sessions) current.sessions = {};
  current.sessions[sessionId] = newSessionObj;
  if (setAsActive || !current.activeSessionId) {
    current.activeSessionId = sessionId;
  }
  saveLocalDb(current);

  pushCloudWrite(async (database) => {
    await set(ref(database, `sessions/${sessionId}`), newSessionObj);
    if (setAsActive || !state.activeSessionId) {
      await set(ref(database, 'activeSessionId'), sessionId);
    }
  });

  logActivity('session', `Sesi baru "${cleanName}" (${sessionId}) berhasil dibuat.`);
  return newSessionObj;
}

export async function setActiveSession(sessionId) {
  const state = getAppState();
  if (!state.sessions[sessionId]) throw new Error('Sesi tidak ditemukan.');

  const current = loadLocalDb();
  current.activeSessionId = sessionId;
  if (current.sessions[sessionId]) {
    current.sessions[sessionId].status = 'active';
  }
  saveLocalDb(current);

  pushCloudWrite(async (database) => {
    await set(ref(database, 'activeSessionId'), sessionId);
    await update(ref(database, `sessions/${sessionId}`), { status: 'active' });
  });

  logActivity('session', `Sesi aktif dialihkan ke "${state.sessions[sessionId].name}".`);
}

export async function updateSessionConfig(sessionId, updates) {
  const session = getSessionById(sessionId);
  if (!session) throw new Error('Sesi tidak ditemukan.');

  const current = loadLocalDb();
  if (current.sessions[session.id]) {
    current.sessions[session.id] = {
      ...current.sessions[session.id],
      ...updates
    };
    saveLocalDb(current);
  }

  pushCloudWrite((database) => update(ref(database, `sessions/${session.id}`), updates));

  logActivity('session', `Pengaturan sesi "${session.name}" diperbarui.`);
}

export async function clearAllQuestionsInSession(sessionId) {
  const session = getSessionById(sessionId);
  if (!session) throw new Error('Sesi tidak ditemukan.');

  const now = Date.now();
  const current = loadLocalDb();
  if (current.sessions[session.id]) {
    current.sessions[session.id].questions = {};
    current.sessions[session.id].drawHistory = {};
    current.sessions[session.id].drawState = {
      currentQuestionId: null,
      isDrawing: false,
      drawVersion: 0,
      updatedAt: now
    };
  }
  if (current.votes && current.votes[session.id]) {
    current.votes[session.id] = {};
  }
  saveLocalDb(current);

  pushCloudWrite(async (database) => {
    await remove(ref(database, `sessions/${session.id}/questions`));
    await remove(ref(database, `sessions/${session.id}/drawHistory`));
    await remove(ref(database, `votes/${session.id}`));
    await set(ref(database, `sessions/${session.id}/drawState`), {
      currentQuestionId: null,
      isDrawing: false,
      drawVersion: 0,
      updatedAt: now
    });
  });

  logActivity('reset', `Seluruh pertanyaan pada sesi "${session.name}" telah dikosongkan.`);
}

export async function deleteSessionById(sessionId) {
  const state = getAppState();

  const current = loadLocalDb();
  if (current.sessions) {
    delete current.sessions[sessionId];
  }
  if (current.activeSessionId === sessionId) {
    const remaining = Object.keys(current.sessions || {});
    current.activeSessionId = remaining[0] || null;
  }
  saveLocalDb(current);

  pushCloudWrite(async (database) => {
    await remove(ref(database, `sessions/${sessionId}`));
    if (state.activeSessionId === sessionId) {
      const nextSession = state.sessionsList.find((s) => s.id !== sessionId);
      await set(ref(database, 'activeSessionId'), nextSession ? nextSession.id : null);
    }
  });

  logActivity('session', `Sesi ${sessionId} telah dihapus.`);
}
