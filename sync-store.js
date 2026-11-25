/**
 * Gerçek zamanlı kalıcı veri katmanı.
 * - Firebase yapılandırılmışsa: Firestore + onSnapshot + runTransaction kullanır.
 * - Yapılandırılmamışsa: Yerel Önizleme Modu (localStorage + BroadcastChannel) kullanır.
 */

import {
  firebaseConfig,
  FIRESTORE_COLLECTION,
  FIRESTORE_DOC_ID,
  isFirebaseConfigured,
} from './firebase-config.js';
import {
  PARTICIPANTS,
  generateDerangement,
  validateDerangement,
} from './participants.js';

const LOCAL_STORAGE_KEY_LEGACY = 'yilbasi_cekilisi_shared_state_v1';
const LOCAL_STORAGE_KEY = 'yilbasi_cekilisi_shared_state_v2';
const BROADCAST_CHANNEL_NAME = 'yilbasi_cekilisi_sync_v2';

/**
 * Yeni bir çekiliş kaydı oluşturur.
 * @param {number} round
 * @returns {{ drawId: string, round: number, assignments: Record<string, string>, updatedAtMs: number }}
 */
function createDrawPayload(round = 1) {
  const drawId =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `draw-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return {
    drawId,
    round,
    assignments: generateDerangement(PARTICIPANTS),
    updatedAtMs: Date.now(),
  };
}

/**
 * Gelen veriyi normalize eder ve geçerli bir derangement olup olmadığını kontrol eder.
 * @param {any} raw
 */
function normalizeState(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!validateDerangement(raw.assignments, PARTICIPANTS)) return null;

  let updatedAtMs = typeof raw.updatedAtMs === 'number' ? raw.updatedAtMs : Date.now();
  if (raw.updatedAt && typeof raw.updatedAt.toMillis === 'function') {
    updatedAtMs = raw.updatedAt.toMillis();
  }

  return {
    drawId: typeof raw.drawId === 'string' && raw.drawId ? raw.drawId : 'initial',
    round: typeof raw.round === 'number' && raw.round >= 1 ? raw.round : 1,
    assignments: raw.assignments,
    updatedAtMs,
  };
}

/**
 * Ortak çekiliş deposunu başlatır.
 * @param {{
 *   onState: (state: { drawId: string, round: number, assignments: Record<string, string>, updatedAtMs: number }, meta: { mode: 'firebase' | 'local', fromRemote: boolean }) => void,
 *   onError: (message: string) => void
 * }} handlers
 */
export async function createDrawStore({ onState, onError }) {
  if (isFirebaseConfigured()) {
    return initFirebaseStore({ onState, onError });
  }
  return initLocalPreviewStore({ onState, onError });
}

async function initFirebaseStore({ onState, onError }) {
  const [{ initializeApp }, firestore] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js'),
  ]);

  const {
    getFirestore,
    doc,
    onSnapshot,
    runTransaction,
    serverTimestamp,
  } = firestore;

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const docRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID);

  let currentState = null;
  let ensuringInitial = false;
  let pendingLocalDrawId = null;

  async function ensureInitialDraw() {
    if (ensuringInitial) return;
    ensuringInitial = true;
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(docRef);
        const existing = snap.exists() ? normalizeState(snap.data()) : null;
        if (existing) return;

        const next = createDrawPayload(1);
        pendingLocalDrawId = next.drawId;
        tx.set(docRef, {
          ...next,
          participants: [...PARTICIPANTS],
          updatedAt: serverTimestamp(),
        });
      });
    } catch (err) {
      console.error('İlk çekiliş oluşturulurken hata:', err);
      onError(
        'Veritabanına ilk çekiliş kaydedilemedi. Lütfen Firestore kurallarınızı ve bağlantınızı kontrol edin.'
      );
    } finally {
      ensuringInitial = false;
    }
  }

  const unsubscribe = onSnapshot(
    docRef,
    (snap) => {
      if (!snap.exists()) {
        void ensureInitialDraw();
        return;
      }

      const normalized = normalizeState(snap.data());
      if (!normalized) {
        void ensureInitialDraw();
        return;
      }

      const isSelfTriggered = normalized.drawId === pendingLocalDrawId;
      if (isSelfTriggered) {
        pendingLocalDrawId = null;
      }

      const isUpdate =
        currentState !== null &&
        currentState.drawId !== normalized.drawId;
      currentState = normalized;

      onState(normalized, {
        mode: 'firebase',
        fromRemote: isUpdate && !isSelfTriggered && !snap.metadata.hasPendingWrites,
      });
    },
    (err) => {
      console.error('Firestore dinleme hatası:', err);
      onError(
        'Canlı senkronizasyon bağlantısı kurulamadı. Firestore erişim izinlerini kontrol edin.'
      );
    }
  );

  async function reshuffle() {
    let updatedState = null;
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(docRef);
      const existing = snap.exists() ? normalizeState(snap.data()) : null;
      const nextRound = existing ? existing.round + 1 : 1;
      const next = createDrawPayload(nextRound);

      pendingLocalDrawId = next.drawId;
      tx.set(docRef, {
        ...next,
        participants: [...PARTICIPANTS],
        updatedAt: serverTimestamp(),
      });
      updatedState = next;
    });
    return updatedState;
  }

  return {
    mode: 'firebase',
    reshuffle,
    destroy: unsubscribe,
  };
}

function initLocalPreviewStore({ onState }) {
  const channel =
    typeof globalThis.BroadcastChannel === 'function'
      ? new BroadcastChannel(BROADCAST_CHANNEL_NAME)
      : null;

  function readLocal() {
    try {
      globalThis.localStorage.removeItem(LOCAL_STORAGE_KEY_LEGACY);
      const raw = globalThis.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return null;
      return normalizeState(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  function writeLocal(state) {
    globalThis.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  }

  let currentState = readLocal();
  if (!currentState) {
    currentState = createDrawPayload(1);
    writeLocal(currentState);
  }

  // İlk yüklemeyi bildir
  queueMicrotask(() => {
    onState(currentState, { mode: 'local', fromRemote: false });
  });

  function handleIncoming(next, fromRemote) {
    if (!next) return;
    if (currentState && currentState.drawId === next.drawId) return;
    currentState = next;
    onState(next, { mode: 'local', fromRemote });
  }

  const onStorage = (event) => {
    if (event.key !== LOCAL_STORAGE_KEY || !event.newValue) return;
    try {
      const parsed = normalizeState(JSON.parse(event.newValue));
      handleIncoming(parsed, true);
    } catch {
      // Bozuk yerel veriyi yoksay
    }
  };

  const onBroadcast = (event) => {
    const parsed = normalizeState(event.data);
    handleIncoming(parsed, true);
  };

  window.addEventListener('storage', onStorage);
  channel?.addEventListener('message', onBroadcast);

  async function reshuffle() {
    const nextRound = currentState ? currentState.round + 1 : 1;
    const next = createDrawPayload(nextRound);
    currentState = next;
    writeLocal(next);
    channel?.postMessage(next);
    onState(next, { mode: 'local', fromRemote: false });
    return next;
  }

  function destroy() {
    window.removeEventListener('storage', onStorage);
    channel?.removeEventListener('message', onBroadcast);
    channel?.close();
  }

  return {
    mode: 'local',
    reshuffle,
    destroy,
  };
}
