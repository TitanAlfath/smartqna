/**
 * SmartQ&A — Native Vercel Serverless Real-Time Sync Endpoint (/api/sync)
 * Menyimpan dan menggabungkan state sesi & pertanyaan di memori server Vercel
 * sehingga HP Peserta dan Laptop Admin pada domain Vercel yang sama langsung
 * tersinkronisasi dengan latensi ultra-rendah (~20-50ms) tanpa kendala jaringan.
 */

let serverState = {
  activeSessionId: null,
  sessions: {},
  deletedSessions: {},
  votes: {},
  accounts: {},
  activities: [],
  updatedAt: 0
};

function mergeServerState(incoming) {
  if (!incoming || typeof incoming !== 'object') return;

  // 1. Deleted sessions
  if (incoming.deletedSessions && typeof incoming.deletedSessions === 'object') {
    serverState.deletedSessions = {
      ...serverState.deletedSessions,
      ...incoming.deletedSessions
    };
    Object.keys(serverState.deletedSessions).forEach((delSid) => {
      delete serverState.sessions[delSid];
    });
  }

  // 2. Accounts
  if (incoming.accounts && typeof incoming.accounts === 'object') {
    Object.entries(incoming.accounts).forEach(([emailKey, acc]) => {
      if (
        !serverState.accounts[emailKey] ||
        (acc.createdAt || 0) >= (serverState.accounts[emailKey].createdAt || 0)
      ) {
        serverState.accounts[emailKey] = acc;
      }
    });
  }

  // 3. Sessions & Questions
  if (incoming.sessions && typeof incoming.sessions === 'object') {
    Object.entries(incoming.sessions).forEach(([sid, rSes]) => {
      if (serverState.deletedSessions[sid] || !rSes) return;
      const lSes = serverState.sessions[sid];
      if (!lSes) {
        serverState.sessions[sid] = {
          ...rSes,
          questions: rSes.questions || {},
          deletedQuestions: rSes.deletedQuestions || {},
          drawHistory: rSes.drawHistory || {}
        };
      } else {
        const lQuestions = { ...(lSes.questions || {}) };
        const deletedQ = {
          ...(lSes.deletedQuestions || {}),
          ...(rSes.deletedQuestions || {})
        };
        Object.keys(deletedQ).forEach((dqId) => {
          delete lQuestions[dqId];
        });

        Object.entries(rSes.questions || {}).forEach(([qid, rq]) => {
          if (deletedQ[qid] || !rq) return;
          const lq = lQuestions[qid];
          if (!lq || (rq.updatedAt || rq.createdAt || 0) >= (lq.updatedAt || lq.createdAt || 0)) {
            lQuestions[qid] = rq;
          }
        });

        // Pastikan urutan nomor pertanyaan selalu berurutan
        const sortedByTime = Object.values(lQuestions).sort(
          (a, b) => (a.createdAt || 0) - (b.createdAt || 0)
        );
        sortedByTime.forEach((qItem, idx) => {
          lQuestions[qItem.id] = { ...qItem, number: idx + 1 };
        });

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

        serverState.sessions[sid] = {
          ...baseSes,
          questions: lQuestions,
          deletedQuestions: deletedQ,
          drawState: nextDrawState,
          drawHistory: nextHistory
        };
      }
    });
  }

  // 4. Votes
  if (incoming.votes && typeof incoming.votes === 'object') {
    Object.entries(incoming.votes).forEach(([sid, qMap]) => {
      if (!serverState.votes[sid]) serverState.votes[sid] = {};
      Object.entries(qMap || {}).forEach(([qid, pMap]) => {
        serverState.votes[sid][qid] = {
          ...(serverState.votes[sid][qid] || {}),
          ...(pMap || {})
        };
      });
    });
  }

  // 5. Active Session ID
  if (
    incoming.activeSessionId &&
    !serverState.deletedSessions[incoming.activeSessionId] &&
    (incoming.updatedAt || 0) >= (serverState.updatedAt || 0)
  ) {
    serverState.activeSessionId = incoming.activeSessionId;
  }
  if (!serverState.activeSessionId || !serverState.sessions[serverState.activeSessionId]) {
    const firstActive = Object.values(serverState.sessions).find((s) => s.status === 'active');
    serverState.activeSessionId = firstActive
      ? firstActive.id
      : Object.keys(serverState.sessions)[0] || null;
  }

  // 6. Activities
  if (Array.isArray(incoming.activities)) {
    const actMap = new Map();
    [...incoming.activities, ...(serverState.activities || [])].forEach((a) => {
      if (a && a.id) actMap.set(a.id, a);
    });
    serverState.activities = Array.from(actMap.values())
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 35);
  }

  serverState.updatedAt = Math.max(serverState.updatedAt || 0, incoming.updatedAt || Date.now());
}

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (body && body.state) {
        mergeServerState(body.state);
      } else if (body && body.sessions) {
        mergeServerState(body);
      }
    } catch {
      // Ignore parse error
    }
    return res.status(200).json({
      ok: true,
      state: serverState
    });
  }

  return res.status(200).json({
    ok: true,
    state: serverState
  });
}

