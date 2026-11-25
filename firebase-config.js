/**
 * Firebase Firestore Yapılandırması
 *
 * Gerçek zamanlı, tüm cihazlar arası ortak çekiliş durumu için
 * Firebase Console -> Proje Ayarları -> Web Uygulaması bölümünden aldığınız
 * firebaseConfig bilgilerini aşağıya yapıştırın.
 *
 * Bu değerler placeholder olarak kaldığı sürece uygulama otomatik olarak
 * "Yerel Önizleme Modu"nda (localStorage + BroadcastChannel) çalışır.
 */

export const firebaseConfig = {
  apiKey: 'BURAYA_API_KEY_YAZIN',
  authDomain: 'BURAYA_PROJECT_ID.firebaseapp.com',
  projectId: 'BURAYA_PROJECT_ID',
  storageBucket: 'BURAYA_PROJECT_ID.firebasestorage.app',
  messagingSenderId: 'BURAYA_SENDER_ID',
  appId: 'BURAYA_APP_ID',
};

/**
 * Tüm ziyaretçilerin ortak okuyup güncellediği Firestore belge yolu.
 */
export const FIRESTORE_COLLECTION = 'draws';
export const FIRESTORE_DOC_ID = 'yilbasi-cekilisi-2026';

/**
 * Yapılandırmanın gerçek Firebase değerleriyle doldurulup doldurulmadığını kontrol eder.
 * @returns {boolean}
 */
export function isFirebaseConfigured() {
  const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId'];
  return requiredFields.every((key) => {
    const value = firebaseConfig[key];
    return (
      typeof value === 'string' &&
      value.trim().length > 0 &&
      !value.includes('BURAYA_') &&
      !value.includes('YOUR_')
    );
  });
}
