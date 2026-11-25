/**
 * Katılımcı listesi ve matematiksel derangement (tam düzensizlik) algoritması.
 * Hiç kimse kendini çekemez; herkes tam olarak bir kişiye hediye alır ve
 * herkes tam olarak bir kişiden hediye alır.
 */

export const PARTICIPANTS = Object.freeze([
  'Mehlika',
  'Zehra',
  'Tuana',
  'Sena',
  'Melis Ela',
  'Ela',
  'Didem',
  'Zeynep',
  'Gül Nihal',
]);

/**
 * Kriptografik rastgele tam sayı üretir: [0, maxExclusive) aralığında.
 * @param {number} maxExclusive
 * @returns {number}
 */
function secureRandomInt(maxExclusive) {
  if (maxExclusive <= 1) return 0;

  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
    const buffer = new Uint32Array(1);
    let value;
    do {
      globalThis.crypto.getRandomValues(buffer);
      value = buffer[0];
    } while (value >= limit);
    return value % maxExclusive;
  }

  return Math.floor(Math.random() * maxExclusive);
}

/**
 * Fisher-Yates karıştırması uygular (yeni dizi döndürür).
 * @template T
 * @param {readonly T[]} items
 * @returns {T[]}
 */
function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Sattolo algoritması: her zaman tek döngülü (single-cycle) bir derangement üretir.
 * @template T
 * @param {readonly T[]} items
 * @returns {T[]}
 */
function sattoloDerangement(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = secureRandomInt(i); // [0, i - 1]
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Verilen eşleşmenin geçerli bir matematiksel derangement olup olmadığını doğrular.
 * @param {Record<string, string>} assignments
 * @param {readonly string[]} participants
 * @returns {boolean}
 */
export function validateDerangement(assignments, participants = PARTICIPANTS) {
  if (!assignments || typeof assignments !== 'object' || Array.isArray(assignments)) {
    return false;
  }

  const keys = Object.keys(assignments);
  if (keys.length !== participants.length) {
    return false;
  }

  const participantSet = new Set(participants);
  const seenReceivers = new Set();

  for (const giver of participants) {
    if (!Object.prototype.hasOwnProperty.call(assignments, giver)) {
      return false;
    }

    const receiver = assignments[giver];
    if (typeof receiver !== 'string' || !participantSet.has(receiver)) {
      return false;
    }

    if (giver === receiver) {
      return false;
    }

    if (seenReceivers.has(receiver)) {
      return false;
    }

    seenReceivers.add(receiver);
  }

  return seenReceivers.size === participants.length;
}

/**
 * Tüm katılımcılar için rastgele ve geçerli bir derangement eşleştirmesi üretir.
 * Reddedici örnekleme (rejection sampling) tüm olası derangement'lar üzerinde
 * eşit olasılık dağılımı sağlar; güvenlik ağı olarak Sattolo yedeklenir.
 * @param {readonly string[]} participants
 * @returns {Record<string, string>}
 */
export function generateDerangement(participants = PARTICIPANTS) {
  if (participants.length < 2) {
    throw new Error('Çekiliş için en az 2 katılımcı gereklidir.');
  }

  const maxAttempts = 128;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const receivers = shuffle(participants);
    const hasFixedPoint = participants.some((giver, idx) => giver === receivers[idx]);
    if (!hasFixedPoint) {
      const result = {};
      participants.forEach((giver, idx) => {
        result[giver] = receivers[idx];
      });
      if (validateDerangement(result, participants)) {
        return result;
      }
    }
  }

  // Nadir durumlar için garantili tek döngülü derangement yedeği
  const fallbackReceivers = sattoloDerangement(participants);
  const fallback = {};
  participants.forEach((giver, idx) => {
    fallback[giver] = fallbackReceivers[idx];
  });
  return fallback;
}
