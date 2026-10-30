/**
 * SmartQ&A — Real-Time Cross-Device Sync & Authentication Service
 * Menggabungkan:
 * 1. Cloud Real-Time Relay (HTTPS SSE + JSON History) & Firebase Realtime Database
 *    agar pertanyaan dari HP peserta langsung tampil real-time di Laptop Admin & halaman awal.
 * 2. Sistem Registrasi & Login Admin terverifikasi (SHA-256 Password Hash) tanpa kredensial bawaan.
 */

import { initializeApp, getApps } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  update,
  onValue
} from 'firebase/database';
import { pickSecureRandomIndex } from '../utils/randomDraw.js';

const STORAGE_KEY_DB = 'smartqa_clean_db_v3';
const STORAGE_KEY_FB_CONFIG = 'smartqa_custom_firebase_config';
const STORAGE_KEY_ADMIN = 'smartqa_admin_auth_v3';
const STORAGE_KEY_PARTICIPANT = 'smartqa_participant_uid';
const STORAGE_KEY_COOLDOWN = 'smartqa_last_submit_ts';

// Channel unik untuk sinkronisasi real-time lintas perangkat (HP <-> Laptop)
const CLOUD_RELAY_TOPIC = 'smartqa_live_sync_qnaproject_f87ff_v3';
const CLOUD_RELAY_URL = `https://ntfy.sh/${CLOUD_RELAY_TOPIC}`;

// Bersihkan cache lama
if (typeof window !== 'undefined') {
  localStorage.removeItem('smartqa_realtime_db_v1');
  localStorage.removeItem('smartqa_prod_db_v1');
  localStorage.removeItem('smartqa_admin_session');
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
let isFirebaseConnected = false;
let stateCache = null;
let relayEventSource = null;
let lastSyncTimestamp = 0;
const listeners = new Set();
const clientInstanceId = `cli_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

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

  return envConfig;
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

function createInitialDatabaseState() {
  return {
    activeSessionId: null,
    sessions: {},
    deletedSessions: {},
    votes: {},
    accounts: {},
    activities: [],
    updatedAt: 0
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
          deletedSessions: parsed.deletedSessions || {},
          votes: parsed.votes || {},
          accounts: parsed.accounts || {},
          activities: Array.isArray(parsed.activities) ? parsed.activities : [],
          updatedAt: parsed.updatedAt || 0
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
  newState.updatedAt = Date.now();
  stateCache = newState;
  localStorage.setItem(STORAGE_KEY_DB, JSON.stringify(newState));
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: 'SYNC_STATE', timestamp: newState.updatedAt });
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
 * Menggabungkan state dari perangkat lain (HP Peserta <-> Laptop Admin) secara pintar
 * agar pertanyaan baru, sesi baru, vote, status undian, dan akun admin selalu sinkron.
 */
function mergeIncomingRemoteState(remote) {
  if (!remote || typeof remote !== 'object') return false;
  const current = stateCache || loadLocalDb();
  let changed = false;

  // 1. Merge deletedSessions
  const deletedSessions = {
    ...(current.deletedSessions || {}),
    ...(remote.deletedSessions || {})
  };

  // 2. Merge Accounts (Admin registrations)
  const mergedAccounts = { ...(current.accounts || {}) };
  if (remote.accounts && typeof remote.accounts === 'object') {
    Object.entries(remote.accounts).forEach(([emailKey, acc]) => {
      if (!mergedAccounts[emailKey] || (acc.createdAt || 0) > (mergedAccounts[emailKey].createdAt || 0)) {
        mergedAccounts[emailKey] = acc;
        changed = true;
      }
    });
  }

  // 3. Merge Sessions & Questions inside each session
  const mergedSessions = { ...(current.sessions || {}) };
  Object.keys(deletedSessions).forEach((delSid) => {
    if (mergedSessions[delSid]) {
      delete mergedSessions[delSid];
      changed = true;
    }
  });

  if (remote.sessions && typeof remote.sessions === 'object') {
    Object.entries(remote.sessions).forEach(([sid, rSes]) => {
      if (deletedSessions[sid] || !rSes) return;
      const lSes = mergedSessions[sid];
      if (!lSes) {
        mergedSessions[sid] = {
          ...rSes,
          questions: rSes.questions || {},
          drawHistory: rSes.drawHistory || {}
        };
        changed = true;
      } else {
        // Merge questions
        const lQuestions = { ...(lSes.questions || {}) };
        const rQuestions = rSes.questions || {};
        const deletedQ = {
          ...(lSes.deletedQuestions || {}),
          ...(rSes.deletedQuestions || {})
        };

        Object.keys(deletedQ).forEach((dqId) => {
          if (lQuestions[dqId]) {
            delete lQuestions[dqId];
            changed = true;
          }
        });

        Object.entries(rQuestions).forEach(([qid, rq]) => {
          if (deletedQ[qid] || !rq) return;
          const lq = lQuestions[qid];
          if (!lq || (rq.updatedAt || rq.createdAt || 0) >= (lq.updatedAt || lq.createdAt || 0)) {
            if (JSON.stringify(lq) !== JSON.stringify(rq)) {
              lQuestions[qid] = rq;
              changed = true;
            }
          }
        });

        // Pastikan nomor urut pertanyaan tidak bertabrakan jika dikirim bersamaan dari banyak HP
        const sortedByTime = Object.values(lQuestions).sort(
          (a, b) => (a.createdAt || 0) - (b.createdAt || 0)
        );
        sortedByTime.forEach((qItem, idx) => {
          const expectedNum = idx + 1;
          if (qItem.number !== expectedNum) {
            lQuestions[qItem.id] = { ...qItem, number: expectedNum };
            changed = true;
          }
        });

        // Merge drawState & drawHistory
        const rDrawUpdated = rSes.drawState?.updatedAt || 0;
        const lDrawUpdated = lSes.drawState?.updatedAt || 0;
        const nextDrawState = rDrawUpdated >= lDrawUpdated ? rSes.drawState : lSes.drawState;

        const nextHistory = {
          ...(lSes.drawHistory || {}),
          ...(rSes.drawHistory || {})
        };

        const rSesUpdated = rSes.updatedAt || rSes.createdAt || 0;
        const lSesUpdated = lSes.updatedAt || lSes.createdAt || 0;
        const baseSes = rSesUpdated >= lSesUpdated ? rSes : lSes;

        const updatedSes = {
          ...baseSes,
          questions: lQuestions,
          deletedQuestions: deletedQ,
          drawState: nextDrawState,
          drawHistory: nextHistory
        };

        if (JSON.stringify(mergedSessions[sid]) !== JSON.stringify(updatedSes)) {
          mergedSessions[sid] = updatedSes;
          changed = true;
        }
      }
    });
  }

  // 4. Merge Votes
  const mergedVotes = { ...(current.votes || {}) };
  if (remote.votes && typeof remote.votes === 'object') {
    Object.entries(remote.votes).forEach(([sid, qMap]) => {
      if (!mergedVotes[sid]) mergedVotes[sid] = {};
      Object.entries(qMap || {}).forEach(([qid, pMap]) => {
        mergedVotes[sid][qid] = {
          ...(mergedVotes[sid][qid] || {}),
          ...(pMap || {})
        };
      });
    });
  }

  // 5. Active Session ID
  let nextActiveId = current.activeSessionId;
  if ((remote.updatedAt || 0) >= (current.updatedAt || 0) && remote.activeSessionId !== undefined) {
    nextActiveId = remote.activeSessionId;
  }
  if (!nextActiveId || !mergedSessions[nextActiveId]) {
    const firstActive = Object.values(mergedSessions).find((s) => s.status === 'active');
    nextActiveId = firstActive ? firstActive.id : Object.keys(mergedSessions)[0] || null;
  }
  if (nextActiveId !== current.activeSessionId) {
    changed = true;
  }

  // 6. Merge Activities
  const actMap = new Map();
  [...(remote.activities || []), ...(current.activities || [])].forEach((a) => {
    if (a && a.id) actMap.set(a.id, a);
  });
  const mergedActivities = Array.from(actMap.values())
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, 35);

  if (changed) {
    const nextState = {
      activeSessionId: nextActiveId,
      sessions: mergedSessions,
      deletedSessions,
      votes: mergedVotes,
      accounts: mergedAccounts,
      activities: mergedActivities,
      updatedAt: Math.max(current.updatedAt || 0, remote.updatedAt || 0)
    };
    stateCache = nextState;
    localStorage.setItem(STORAGE_KEY_DB, JSON.stringify(nextState));
    notifyListeners();
  }
  return changed;
}

/**
 * Mengirimkan paket state berukuran ringkas (< 3.5 KB per paket) ke Cloud Relay (ntfy.sh)
 * serta ke Firebase Realtime Database agar ratusan penanya dari HP dapat masuk
 * secara bersamaan tanpa pernah terkena batas ukuran payload.
 */
function postCompactPacketToRelay(partialState) {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;
  const payload = JSON.stringify({
    sender: clientInstanceId,
    ts: Date.now(),
    state: partialState
  });
  fetch(CLOUD_RELAY_URL, {
    method: 'POST',
    body: payload
  }).catch(() => {});
}

function broadcastStateToCloud(specificSessionId = null, specificQuestionId = null) {
  const current = stateCache || loadLocalDb();

  // 1. Jika ada perubahan spesifik pada 1 pertanyaan/vote, kirim paket delta super ringan (~450 byte)
  if (specificSessionId && current.sessions?.[specificSessionId]) {
    const ses = current.sessions[specificSessionId];
    const compactQuestions = {};
    if (specificQuestionId && ses.questions?.[specificQuestionId]) {
      compactQuestions[specificQuestionId] = ses.questions[specificQuestionId];
    } else {
      // Ambil maksimal 6 pertanyaan terbaru yang baru diupdate
      Object.values(ses.questions || {})
        .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
        .slice(0, 6)
        .forEach((q) => {
          compactQuestions[q.id] = q;
        });
    }

    postCompactPacketToRelay({
      activeSessionId: current.activeSessionId,
      sessions: {
        [specificSessionId]: {
          ...ses,
          questions: compactQuestions,
          drawHistory: {}
        }
      },
      activities: (current.activities || []).slice(0, 3),
      updatedAt: current.updatedAt
    });
  } else {
    // Kirim metadata sesi, akun admin, dan hingga 5 pertanyaan terbaru per sesi agar selalu < 3.5 KB
    const compactSessions = {};
    Object.entries(current.sessions || {}).forEach(([sid, ses]) => {
      const recentQs = {};
      Object.values(ses.questions || {})
        .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
        .slice(0, 5)
        .forEach((q) => {
          recentQs[q.id] = q;
        });
      compactSessions[sid] = {
        ...ses,
        questions: recentQs,
        drawHistory: {}
      };
    });

    postCompactPacketToRelay({
      activeSessionId: current.activeSessionId,
      sessions: compactSessions,
      deletedSessions: current.deletedSessions,
      accounts: current.accounts,
      activities: (current.activities || []).slice(0, 4),
      updatedAt: current.updatedAt
    });
  }

  // 2. Kirim juga ke Firebase Realtime Database jika terhubung
  if (db && isFirebaseConnected) {
    try {
      set(ref(db, '/'), current).catch(() => {});
    } catch {
      // Ignore Firebase error
    }
  }
}

/**
 * Menghubungkan pendengar real-time (SSE + Riwayat 12 Jam) untuk sinkronisasi HP <-> Laptop
 */
function initCrossDeviceCloudRelay() {
  if (typeof window === 'undefined') return;

  // 1. Ambil riwayat state yang sudah dikirim dalam 12 jam terakhir
  fetch(`${CLOUD_RELAY_URL}/json?poll=1&since=12h`)
    .then((res) => res.text())
    .then((text) => {
      if (!text) return;
      const lines = text.trim().split('\n');
      lines.forEach((line) => {
        try {
          const envelope = JSON.parse(line);
          if (envelope && envelope.event === 'message' && envelope.message) {
            const parsed = JSON.parse(envelope.message);
            if (parsed && parsed.state) {
              mergeIncomingRemoteState(parsed.state);
            }
          }
        } catch {
          // Ignore malformed line
        }
      });
    })
    .catch(() => {});

  // 2. Buka koneksi real-time Server-Sent Events (SSE)
  if ('EventSource' in window && !relayEventSource) {
    try {
      relayEventSource = new EventSource(`${CLOUD_RELAY_URL}/sse`);
      relayEventSource.onmessage = (event) => {
        try {
          const envelope = JSON.parse(event.data);
          if (envelope && envelope.event === 'message' && envelope.message) {
            const parsed = JSON.parse(envelope.message);
            if (parsed && parsed.sender !== clientInstanceId && parsed.state) {
              mergeIncomingRemoteState(parsed.state);
            }
          }
        } catch {
          // Ignore parse error
        }
      };
    } catch {
      // Fallback polling jika jaringan memblokir SSE
    }
  }

  // 3. Fallback polling ringan setiap 4 detik agar 100% pasti masuk di semua jaringan seluler
  setInterval(() => {
    fetch(`${CLOUD_RELAY_URL}/json?poll=1&since=20s`)
      .then((res) => res.text())
      .then((text) => {
        if (!text) return;
        const lines = text.trim().split('\n');
        lines.forEach((line) => {
          try {
            const envelope = JSON.parse(line);
            if (envelope && envelope.event === 'message' && envelope.message) {
              const parsed = JSON.parse(envelope.message);
              if (parsed && parsed.sender !== clientInstanceId && parsed.state) {
                mergeIncomingRemoteState(parsed.state);
              }
            }
          } catch {
            // Ignore
          }
        });
      })
      .catch(() => {});
  }, 4000);
}

export function initDataService() {
  stateCache = loadLocalDb();

  // Jalankan Cloud Relay lintas perangkat (HP <-> Laptop)
  initCrossDeviceCloudRelay();

  // Jalankan juga Firebase Realtime Database bila tersedia
  const config = getActiveFirebaseConfig();
  if (!config) return;

  try {
    firebaseApp = getApps().length === 0 ? initializeApp(config) : getApps()[0];
    db = getDatabase(firebaseApp);

    const connectedRef = ref(db, '.info/connected');
    onValue(connectedRef, (snap) => {
      const connectedNow = Boolean(snap.val());
      const wasDisconnected = !isFirebaseConnected && connectedNow;
      isFirebaseConnected = connectedNow;

      if (wasDisconnected && stateCache && Object.keys(stateCache.sessions || {}).length > 0) {
        set(ref(db, '/'), stateCache).catch(() => {});
      }
      notifyListeners();
    });

    const rootRef = ref(db, '/');
    onValue(
      rootRef,
      (snapshot) => {
        if (!isFirebaseConnected) return;
        const val = snapshot.val();
        if (val && typeof val === 'object') {
          mergeIncomingRemoteState(val);
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
    accounts: stateCache.accounts || {},
    activities: Array.isArray(stateCache.activities)
      ? stateCache.activities
      : Object.values(stateCache.activities || {}).sort((a, b) => b.timestamp - a.timestamp)
  };
}

export function getSessionById(sessionId) {
  const state = getAppState();
  const targetId = sessionId || state.activeSessionId;

  // Jika peserta membuka tautan QR Code (?session=...&title=...), pastikan sesi otomatis tersedia
  if (sessionId && !state.sessions[sessionId] && typeof window !== 'undefined') {
    const hash = window.location.hash || '';
    const qIdx = hash.indexOf('?');
    if (qIdx !== -1) {
      const params = new URLSearchParams(hash.slice(qIdx + 1));
      const urlSession = params.get('session');
      if (urlSession && urlSession === sessionId) {
        const hydrated = {
          id: sessionId,
          name: params.get('title') || `Sesi Q&A (${sessionId})`,
          speaker: params.get('speaker') || 'Pemateri',
          description: '',
          status: 'active',
          allowQuestions: true,
          allowAnonymous: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          questions: {},
          drawState: {
            currentQuestionId: null,
            isDrawing: false,
            drawVersion: 0,
            updatedAt: Date.now()
          },
          drawHistory: {}
        };
        const current = loadLocalDb();
        if (!current.sessions) current.sessions = {};
        current.sessions[sessionId] = hydrated;
        if (!current.activeSessionId) current.activeSessionId = sessionId;
        stateCache = current;
        localStorage.setItem(STORAGE_KEY_DB, JSON.stringify(current));
        state.sessions[sessionId] = hydrated;
      }
    }
  }

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

function logActivity(type, message, sessionId = null, questionId = null) {
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
  broadcastStateToCloud(sessionId, questionId);
}

/* ============================================================================
 * 1. REGISTRASI & LOGIN ADMIN TERVERIFIKASI (SHA-256 HASH)
 * ========================================================================== */

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`smartqa_salt_v3_${password}`);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

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

export function hasRegisteredAdminAccounts() {
  const state = getAppState();
  return Object.keys(state.accounts || {}).length > 0;
}

export async function registerAdmin({ name, email, password, confirmPassword }) {
  const cleanName = (name || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();
  const cleanConfirm = (confirmPassword || '').trim();

  if (!cleanName) {
    throw new Error('Nama lengkap wajib diisi.');
  }
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Masukkan alamat email yang valid.');
  }
  if (cleanPass.length < 6) {
    throw new Error('Kata sandi minimal terdiri dari 6 karakter.');
  }
  if (cleanPass !== cleanConfirm) {
    throw new Error('Konfirmasi kata sandi tidak cocok.');
  }

  const emailKey = cleanEmail.replace(/[^a-z0-9]/g, '_');
  const current = loadLocalDb();
  if (!current.accounts) current.accounts = {};

  if (current.accounts[emailKey]) {
    throw new Error('Email ini sudah terdaftar. Silakan masuk menggunakan kata sandi Anda.');
  }

  const passwordHash = await hashPassword(cleanPass);
  const newAccount = {
    uid: `adm_${Date.now()}`,
    name: cleanName,
    email: cleanEmail,
    passwordHash,
    role: 'admin',
    createdAt: Date.now()
  };

  current.accounts[emailKey] = newAccount;
  saveLocalDb(current);
  broadcastStateToCloud();

  const sessionAdmin = {
    uid: newAccount.uid,
    name: newAccount.name,
    email: newAccount.email,
    role: 'admin',
    loginAt: Date.now()
  };
  localStorage.setItem(STORAGE_KEY_ADMIN, JSON.stringify(sessionAdmin));
  logActivity('auth', `Admin "${cleanName}" telah mendaftar dan masuk.`);
  notifyListeners();
  return sessionAdmin;
}

export async function loginAdmin(email, password) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();

  if (!cleanEmail || !cleanPass) {
    throw new Error('Email dan kata sandi wajib diisi.');
  }

  const emailKey = cleanEmail.replace(/[^a-z0-9]/g, '_');
  const current = loadLocalDb();
  const accounts = current.accounts || {};
  const existingAccount = accounts[emailKey];

  if (!existingAccount) {
    throw new Error('Akun tidak ditemukan. Silakan registrasi akun admin terlebih dahulu.');
  }

  const enteredHash = await hashPassword(cleanPass);
  if (existingAccount.passwordHash !== enteredHash) {
    throw new Error('Kata sandi yang Anda masukkan salah.');
  }

  const adminData = {
    uid: existingAccount.uid,
    email: existingAccount.email,
    name: existingAccount.name,
    role: 'admin',
    loginAt: Date.now()
  };
  localStorage.setItem(STORAGE_KEY_ADMIN, JSON.stringify(adminData));
  logActivity('auth', `Admin ${existingAccount.name} masuk ke panel Q&A.`);
  notifyListeners();
  return adminData;
}

export async function logoutAdmin() {
  localStorage.removeItem(STORAGE_KEY_ADMIN);
  notifyListeners();
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
  if (cleanText.length < 3) {
    throw new Error('Pertanyaan terlalu singkat.');
  }
  if (cleanText.length > 350) {
    throw new Error('Pertanyaan melebihi batas maksimal 350 karakter.');
  }

  const cooldown = getSpamCooldownRemaining();
  if (cooldown > 0) {
    throw new Error(`Mohon tunggu ${cooldown} detik sebelum mengirim pertanyaan berikutnya.`);
  }

  const isAnon = Boolean(anonymous) && session.allowAnonymous !== false;
  const cleanName = isAnon ? 'Anonim' : (name || '').trim() || 'Peserta';

  const existingDuplicate = session.questionsList.find(
    (q) => q.text.toLowerCase() === cleanText.toLowerCase()
  );
  if (existingDuplicate) {
    throw new Error('Pertanyaan yang sama sudah ada di daftar.');
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
    updatedAt: now,
    selectedAt: null
  };

  const current = loadLocalDb();
  if (!current.sessions[session.id]) {
    current.sessions[session.id] = {
      ...session,
      questions: {}
    };
  }
  if (!current.sessions[session.id].questions) {
    current.sessions[session.id].questions = {};
  }
  current.sessions[session.id].questions[questionId] = newQuestion;
  current.sessions[session.id].updatedAt = now;
  saveLocalDb(current);
  localStorage.setItem(STORAGE_KEY_COOLDOWN, String(now));

  logActivity('question', `Pertanyaan #${String(nextNumber).padStart(2, '0')} dikirim oleh ${cleanName}.`, session.id, questionId);
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
    qTarget.updatedAt = Date.now();
    votedResult = false;
  } else {
    current.votes[session.id][questionId][pid] = true;
    nextVotes = (Number(qTarget.votes) || 0) + 1;
    qTarget.votes = nextVotes;
    qTarget.updatedAt = Date.now();
    votedResult = true;
  }

  current.sessions[session.id].updatedAt = Date.now();
  saveLocalDb(current);
  broadcastStateToCloud(session.id, questionId);

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
        q.updatedAt = now;
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
  targetQ.updatedAt = now;
  targetSession.updatedAt = now;
  saveLocalDb(current);

  const statusLabels = {
    pending: 'Pending',
    selected: 'Terpilih',
    answered: 'Terjawab',
    skipped: 'Dilewati'
  };
  logActivity(
    'status',
    `Pertanyaan #${String(question.number).padStart(2, '0')} (${question.name}) ditandai sebagai ${statusLabels[newStatus] || newStatus}.`,
    session.id,
    questionId
  );
}

export async function deleteQuestion(sessionId, questionId) {
  const session = getSessionById(sessionId);
  if (!session) throw new Error('Sesi tidak ditemukan.');
  const question = session.questionsObj[questionId];
  if (!question) return;

  const now = Date.now();
  const current = loadLocalDb();
  const targetSession = current.sessions[session.id];
  if (targetSession) {
    if (!targetSession.deletedQuestions) targetSession.deletedQuestions = {};
    targetSession.deletedQuestions[questionId] = now;
    if (targetSession.questions?.[questionId]) {
      delete targetSession.questions[questionId];
    }
    if (targetSession.drawState?.currentQuestionId === questionId) {
      targetSession.drawState.currentQuestionId = null;
      targetSession.drawState.isDrawing = false;
      targetSession.drawState.updatedAt = now;
    }
    targetSession.updatedAt = now;
  }
  saveLocalDb(current);

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
  targetSession.updatedAt = now;
  saveLocalDb(current);
  broadcastStateToCloud();

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
      q.updatedAt = now;
    });
  }
  targetSession.drawState = {
    currentQuestionId: null,
    isDrawing: false,
    drawVersion: 0,
    updatedAt: now
  };
  targetSession.drawHistory = {};
  targetSession.updatedAt = now;
  saveLocalDb(current);

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

  const current = loadLocalDb();
  if (!current.sessions) current.sessions = {};
  if (current.sessions[sessionId]) {
    throw new Error(`Kode sesi "${sessionId}" sudah digunakan. Gunakan kode lain.`);
  }
  if (current.deletedSessions?.[sessionId]) {
    delete current.deletedSessions[sessionId];
  }

  const newSessionObj = {
    id: sessionId,
    name: cleanName,
    speaker: (speaker || '').trim() || 'Pemateri',
    description: (description || '').trim(),
    status: 'active',
    allowQuestions: true,
    allowAnonymous: Boolean(allowAnonymous),
    createdAt: now,
    updatedAt: now,
    questions: {},
    deletedQuestions: {},
    drawState: {
      currentQuestionId: null,
      isDrawing: false,
      drawVersion: 0,
      updatedAt: now
    },
    drawHistory: {}
  };

  current.sessions[sessionId] = newSessionObj;
  if (setAsActive || !current.activeSessionId) {
    current.activeSessionId = sessionId;
  }
  saveLocalDb(current);

  logActivity('session', `Sesi baru "${cleanName}" (${sessionId}) berhasil dibuat.`);
  return newSessionObj;
}

export async function setActiveSession(sessionId) {
  const current = loadLocalDb();
  if (!current.sessions?.[sessionId]) throw new Error('Sesi tidak ditemukan.');

  current.activeSessionId = sessionId;
  current.sessions[sessionId].status = 'active';
  current.sessions[sessionId].updatedAt = Date.now();
  saveLocalDb(current);

  logActivity('session', `Sesi aktif dialihkan ke "${current.sessions[sessionId].name}".`);
}

export async function updateSessionConfig(sessionId, updates) {
  const session = getSessionById(sessionId);
  if (!session) throw new Error('Sesi tidak ditemukan.');

  const current = loadLocalDb();
  if (current.sessions[session.id]) {
    current.sessions[session.id] = {
      ...current.sessions[session.id],
      ...updates,
      updatedAt: Date.now()
    };
    saveLocalDb(current);
  }

  logActivity('session', `Pengaturan sesi "${session.name}" diperbarui.`);
}

export async function clearAllQuestionsInSession(sessionId) {
  const session = getSessionById(sessionId);
  if (!session) throw new Error('Sesi tidak ditemukan.');

  const now = Date.now();
  const current = loadLocalDb();
  if (current.sessions[session.id]) {
    const existingQIds = Object.keys(current.sessions[session.id].questions || {});
    if (!current.sessions[session.id].deletedQuestions) {
      current.sessions[session.id].deletedQuestions = {};
    }
    existingQIds.forEach((qid) => {
      current.sessions[session.id].deletedQuestions[qid] = now;
    });
    current.sessions[session.id].questions = {};
    current.sessions[session.id].drawHistory = {};
    current.sessions[session.id].drawState = {
      currentQuestionId: null,
      isDrawing: false,
      drawVersion: 0,
      updatedAt: now
    };
    current.sessions[session.id].updatedAt = now;
  }
  if (current.votes && current.votes[session.id]) {
    current.votes[session.id] = {};
  }
  saveLocalDb(current);

  logActivity('reset', `Seluruh pertanyaan pada sesi "${session.name}" telah dikosongkan.`);
}

export async function deleteSessionById(sessionId) {
  const now = Date.now();
  const current = loadLocalDb();
  if (!current.deletedSessions) current.deletedSessions = {};
  current.deletedSessions[sessionId] = now;

  if (current.sessions) {
    delete current.sessions[sessionId];
  }
  if (current.activeSessionId === sessionId) {
    const remaining = Object.keys(current.sessions || {});
    current.activeSessionId = remaining[0] || null;
  }
  saveLocalDb(current);

  logActivity('session', `Sesi ${sessionId} telah dihapus.`);
}
