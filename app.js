import { PARTICIPANTS } from './participants.js';
import { createDrawStore } from './sync-store.js';
import { initAmbientSnow, triggerFestiveConfetti } from './effects.js';

const ADMIN_PIN = '1971';

const elements = {
  snowCanvas: document.getElementById('snow-canvas'),
  confettiCanvas: document.getElementById('confetti-canvas'),
  syncPill: document.getElementById('sync-pill'),
  syncStatusText: document.getElementById('sync-status-text'),
  alertBanner: document.getElementById('alert-banner'),
  alertBannerText: document.getElementById('alert-banner-text'),
  envelopesGrid: document.getElementById('envelopes-grid'),
  drawRoundLabel: document.getElementById('draw-round-label'),
  drawUpdatedLabel: document.getElementById('draw-updated-label'),
  openReshuffleBtn: document.getElementById('open-reshuffle-btn'),

  revealModal: document.getElementById('reveal-modal'),
  revealStepConfirm: document.getElementById('reveal-step-confirm'),
  revealStepResult: document.getElementById('reveal-step-result'),
  revealModalTitle: document.getElementById('reveal-modal-title'),
  confirmPersonInline: document.getElementById('confirm-person-inline'),
  confirmRevealBtn: document.getElementById('confirm-reveal-btn'),
  revealGiverName: document.getElementById('reveal-giver-name'),
  revealReceiverName: document.getElementById('reveal-receiver-name'),

  adminModal: document.getElementById('admin-modal'),
  adminPinForm: document.getElementById('admin-pin-form'),
  adminPinInput: document.getElementById('admin-pin-input'),
  adminPinError: document.getElementById('admin-pin-error'),
  adminSubmitBtn: document.getElementById('admin-submit-btn'),

  toast: document.getElementById('toast'),
  toastText: document.getElementById('toast-text'),
};

let drawState = null;
let storeHandle = null;
let activeParticipant = null;
let lastFocusedElement = null;
let toastTimer = null;

function showToast(message) {
  if (toastTimer) {
    window.clearTimeout(toastTimer);
  }
  elements.toastText.textContent = message;
  elements.toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 4200);
}

function showAlert(message) {
  elements.alertBannerText.textContent = message;
  elements.alertBanner.hidden = false;
}

function clearAlert() {
  elements.alertBanner.hidden = true;
  elements.alertBannerText.textContent = '';
}

function formatTurkishDate(ms) {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ms));
  } catch {
    return 'Az önce';
  }
}

function updateSyncStatus(mode, isError = false) {
  elements.syncPill.classList.remove(
    'sync-pill--live',
    'sync-pill--local',
    'sync-pill--error'
  );

  if (isError) {
    elements.syncPill.classList.add('sync-pill--error');
    elements.syncStatusText.textContent = 'Bağlantı Hatası';
    return;
  }

  if (mode === 'firebase') {
    elements.syncPill.classList.add('sync-pill--live');
    elements.syncStatusText.textContent = 'Canlı Senkronizasyon Aktif';
  } else {
    elements.syncPill.classList.add('sync-pill--local');
    elements.syncStatusText.textContent = 'Yerel Önizleme Modu';
  }
}

function renderSkeletons() {
  elements.envelopesGrid.setAttribute('aria-busy', 'true');
  elements.envelopesGrid.innerHTML = '';
  for (let i = 0; i < PARTICIPANTS.length; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = 'envelope-skeleton';
    skeleton.setAttribute('aria-hidden', 'true');
    elements.envelopesGrid.appendChild(skeleton);
  }
}

function createEnvelopeCard(name) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'envelope-card';
  button.dataset.participant = name;
  button.setAttribute('aria-label', `${name} adına mühürlü zarfı aç`);

  button.innerHTML = `
    <svg class="envelope-card__flap" viewBox="0 0 220 56" preserveAspectRatio="none" fill="none" aria-hidden="true">
      <path d="M2 2L110 48L218 2" stroke="#C59B27" stroke-opacity="0.45" stroke-width="1.2" />
    </svg>
    <svg class="envelope-card__seal" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path
        d="M32 4C36 4 39 6.5 43 6.5C47 6.5 51 9 53.5 13C56 17 60 19.5 60 24C60 28.5 61.5 33 59 37.5C56.5 42 56.5 47 52.5 50.5C48.5 54 45.5 58.5 40.5 58.5C35.5 58.5 32 61 27 59C22 57 17.5 57 13.5 53C9.5 49 5.5 46 5.5 40.5C5.5 35 3.5 31 5.5 26C7.5 21 7 16 11 12.5C15 9 19 5.5 24 5.5C28 5.5 29.5 4 32 4Z"
        fill="#A62639"
      />
      <circle cx="32" cy="32" r="19" stroke="#DFBC5E" stroke-width="1.1" stroke-opacity="0.72" />
      <path
        d="M32 19L34.7 29.3L45 32L34.7 34.7L32 45L29.3 34.7L19 32L29.3 29.3L32 19Z"
        fill="#E8CA74"
      />
    </svg>
    <span class="envelope-card__name"></span>
    <span class="envelope-card__hint">Zarfı Aç →</span>
  `;

  button.querySelector('.envelope-card__name').textContent = name;
  button.addEventListener('click', () => openRevealConfirmModal(name, button));
  return button;
}

function renderParticipants() {
  elements.envelopesGrid.setAttribute('aria-busy', 'false');
  elements.envelopesGrid.innerHTML = '';
  const fragment = document.createDocumentFragment();
  for (const name of PARTICIPANTS) {
    fragment.appendChild(createEnvelopeCard(name));
  }
  elements.envelopesGrid.appendChild(fragment);
}

function updateFooterMeta(state) {
  elements.drawRoundLabel.textContent = `Çekiliş #${state.round}`;
  elements.drawUpdatedLabel.textContent = `Son güncelleme: ${formatTurkishDate(state.updatedAtMs)}`;
}

function openRevealConfirmModal(participantName, triggerEl) {
  if (!drawState) {
    showToast('Çekiliş verisi henüz hazırlanıyor, lütfen bir saniye bekleyin.');
    return;
  }

  activeParticipant = participantName;
  lastFocusedElement = triggerEl || document.activeElement;

  elements.revealModalTitle.textContent = participantName;
  elements.confirmPersonInline.textContent = participantName;
  elements.confirmRevealBtn.textContent = `Ben ${participantName}, devam et`;

  elements.revealStepConfirm.hidden = false;
  elements.revealStepResult.hidden = true;
  elements.revealModal.hidden = false;

  elements.confirmRevealBtn.focus();
}

function revealMatch() {
  if (!activeParticipant || !drawState) return;
  const receiver = drawState.assignments[activeParticipant];
  if (!receiver) {
    showAlert('Eşleşme bilgisi okunamadı. Lütfen sayfayı yenileyin.');
    closeRevealModal();
    return;
  }

  elements.revealGiverName.textContent = activeParticipant;
  elements.revealReceiverName.textContent = receiver;

  elements.revealStepConfirm.hidden = true;
  elements.revealStepResult.hidden = false;

  triggerFestiveConfetti(elements.confettiCanvas);
  document.getElementById('close-revealed-btn')?.focus();
}

function closeRevealModal() {
  elements.revealModal.hidden = true;
  elements.revealStepConfirm.hidden = false;
  elements.revealStepResult.hidden = true;
  elements.revealReceiverName.textContent = '';
  activeParticipant = null;

  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    lastFocusedElement.focus();
  }
}

function openAdminModal(triggerEl) {
  lastFocusedElement = triggerEl || document.activeElement;
  elements.adminPinInput.value = '';
  elements.adminPinInput.classList.remove('pin-input--shake');
  elements.adminPinError.hidden = true;
  elements.adminPinError.textContent = '';
  elements.adminModal.hidden = false;

  window.requestAnimationFrame(() => {
    elements.adminPinInput.focus();
  });
}

function closeAdminModal() {
  elements.adminModal.hidden = true;
  elements.adminPinInput.value = '';
  elements.adminPinError.hidden = true;

  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    lastFocusedElement.focus();
  }
}

async function handleAdminSubmit(event) {
  event.preventDefault();
  const enteredPin = elements.adminPinInput.value.trim();

  if (enteredPin !== ADMIN_PIN) {
    elements.adminPinError.textContent =
      'Hatalı şifre. Lütfen yönetici şifresini kontrol edip tekrar deneyin.';
    elements.adminPinError.hidden = false;
    elements.adminPinInput.classList.remove('pin-input--shake');
    void elements.adminPinInput.offsetWidth; // Reflow ile animasyonu yeniden tetikle
    elements.adminPinInput.classList.add('pin-input--shake');
    elements.adminPinInput.select();
    return;
  }

  if (!storeHandle) return;

  elements.adminSubmitBtn.disabled = true;
  elements.adminSubmitBtn.textContent = 'Karıştırılıyor…';

  try {
    await storeHandle.reshuffle();
    closeAdminModal();
    triggerFestiveConfetti(elements.confettiCanvas);
    showToast('Çekiliş yeniden karıştırıldı! Yeni eşleşmeler tüm cihazlarda yayında.');
  } catch (err) {
    console.error('Yeniden karıştırma hatası:', err);
    elements.adminPinError.textContent =
      'Çekiliş güncellenemedi. Lütfen bağlantınızı kontrol edip tekrar deneyin.';
    elements.adminPinError.hidden = false;
  } finally {
    elements.adminSubmitBtn.disabled = false;
    elements.adminSubmitBtn.textContent = 'Onayla ve Karıştır';
  }
}

function bindEvents() {
  elements.confirmRevealBtn.addEventListener('click', revealMatch);

  elements.openReshuffleBtn.addEventListener('click', (e) => {
    openAdminModal(e.currentTarget);
  });

  elements.adminPinForm.addEventListener('submit', handleAdminSubmit);

  document.querySelectorAll('[data-close-modal="reveal"]').forEach((btn) => {
    btn.addEventListener('click', closeRevealModal);
  });

  document.querySelectorAll('[data-close-modal="admin"]').forEach((btn) => {
    btn.addEventListener('click', closeAdminModal);
  });

  elements.revealModal.addEventListener('click', (e) => {
    if (e.target === elements.revealModal) {
      closeRevealModal();
    }
  });

  elements.adminModal.addEventListener('click', (e) => {
    if (e.target === elements.adminModal) {
      closeAdminModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!elements.revealModal.hidden) closeRevealModal();
    if (!elements.adminModal.hidden) closeAdminModal();
  });
}

async function bootstrap() {
  initAmbientSnow(elements.snowCanvas);
  renderSkeletons();
  bindEvents();

  try {
    storeHandle = await createDrawStore({
      onState(nextState, meta) {
        clearAlert();
        const hadState = drawState !== null;
        drawState = nextState;

        updateSyncStatus(meta.mode, false);
        updateFooterMeta(nextState);

        if (!hadState) {
          renderParticipants();
        } else if (meta.fromRemote) {
          if (!elements.revealModal.hidden) {
            closeRevealModal();
          }
          showToast('Çekiliş yönetici tarafından yeniden karıştırıldı!');
        }
      },
      onError(message) {
        updateSyncStatus('firebase', true);
        showAlert(message);
        if (!drawState) {
          renderParticipants();
        }
      },
    });
  } catch (err) {
    console.error('Uygulama başlatma hatası:', err);
    updateSyncStatus('firebase', true);
    showAlert(
      'Çekiliş servisi başlatılırken bir sorun oluştu. Lütfen ayarları kontrol edin.'
    );
    renderParticipants();
  }
}

void bootstrap();
