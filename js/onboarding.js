const ONBOARDING_STEPS = ['birth', 'legal', 'handle'];
const ONBOARDING_TOTAL = ONBOARDING_STEPS.length;
let onboardingStep = 0;
let onboardingData = {};

function tf() {
  return typeof window.t === 'function' ? window.t : k => k;
}

function hasTelegramInitData() {
  try {
    const o = window.__smolgameInitDataOverride;
    if (o && String(o).includes('hash=')) return true;
    const d = Telegram.WebApp.initData;
    return Boolean(d && String(d).includes('hash='));
  } catch (e) {
    return false;
  }
}

async function checkOnboarding() {
  if (!hasTelegramInitData()) return false;
  try {
    const data = await API.checkRegistered();
    if (data?.user?.siteHandle) USER.siteHandle = data.user.siteHandle;
    return !data?.registered;
  } catch (e) {
    console.warn('registration check failed', e);
    return false;
  }
}

function showOnboardingScreen() {
  onboardingStep = 0;
  onboardingData = {};
  document.getElementById('onboarding-screen').classList.add('open');
  renderOnboarding();
}

function closeOnboardingScreen() {
  document.getElementById('onboarding-screen').classList.remove('open');
}

function renderOnboarding() {
  const t = tf();
  const body = document.getElementById('onboardingBody');
  const footer = document.getElementById('onboardingFooter');
  const step = ONBOARDING_STEPS[onboardingStep];

  if (step === 'birth') {
    body.innerHTML = `
      <div class="onboarding-step">${t('onboarding_step', { n: 1, total: ONBOARDING_TOTAL })}</div>
      <div class="onboarding-title">${esc(t('onboarding_dob_title'))}</div>
      <p class="onboarding-value-prop">${esc(t('onboarding_dob_lead'))}</p>
      <input class="field-input" type="date" id="birthDateInput" value="${esc(onboardingData.dateOfBirth || '')}">
      <label class="check-row" id="parentConsentRow" style="display:none">
        <input type="checkbox" id="parentConsentInput">
        <span>${esc(t('onboarding_parent'))}</span>
      </label>
      <div class="onboarding-blocked" id="ageBlocked" style="display:none">${esc(t('onboarding_blocked'))}</div>
    `;
    footer.innerHTML = `<button class="submit-btn" data-action="onboarding-next">${esc(t('onboarding_next'))}</button>`;
    document.getElementById('birthDateInput').addEventListener('input', updateAgeNotice);
    updateAgeNotice();
    return;
  }

  if (step === 'legal') {
    body.innerHTML = `
      <div class="onboarding-step">${t('onboarding_step', { n: 2, total: ONBOARDING_TOTAL })}</div>
      <div class="onboarding-title">${esc(t('onboarding_terms_title'))}</div>
      <div class="onboarding-text">${esc(t('onboarding_terms_text'))}</div>
      <label class="check-row">
        <input type="checkbox" id="legalAgreeInput">
        <span>${t('onboarding_accept_html')}</span>
      </label>
    `;
    footer.innerHTML = `<button class="submit-btn" data-action="onboarding-next">${esc(t('onboarding_next'))}</button>`;
    return;
  }

  body.innerHTML = `
    <div class="onboarding-step">${t('onboarding_step', { n: 3, total: ONBOARDING_TOTAL })}</div>
    <div class="onboarding-title">${esc(t('onboarding_handle_title'))}</div>
    <div class="onboarding-text">${esc(t('onboarding_handle_text'))}</div>
    <input class="field-input" type="text" id="siteHandleInput" placeholder="smol_player" maxlength="24" value="${esc(onboardingData.siteHandle || '')}">
  `;
  footer.innerHTML = `<button class="submit-btn" data-action="onboarding-finish">${esc(t('onboarding_create'))}</button>`;
}

function updateAgeNotice() {
  const input = document.getElementById('birthDateInput');
  const row = document.getElementById('parentConsentRow');
  const blocked = document.getElementById('ageBlocked');
  const age = ageFromDate(input?.value);
  if (!age) {
    row.style.display = 'none';
    blocked.style.display = 'none';
    return;
  }
  row.style.display = age >= 13 && age < 18 ? 'flex' : 'none';
  blocked.style.display = age < 13 ? 'block' : 'none';
}

function ageFromDate(value) {
  if (!value) return 0;
  const birth = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(birth.getTime())) return 0;
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const hadBirthday = now.getUTCMonth() > birth.getUTCMonth()
    || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() >= birth.getUTCDate());
  return hadBirthday ? age : age - 1;
}

function onboardingNext() {
  const t = tf();
  const step = ONBOARDING_STEPS[onboardingStep];
  if (step === 'birth') {
    const dateOfBirth = document.getElementById('birthDateInput').value;
    const age = ageFromDate(dateOfBirth);
    if (!age) { showToast(t('toast_dob')); return; }
    if (age < 13) return;
    const parentConsent = document.getElementById('parentConsentInput')?.checked || false;
    if (age < 18 && !parentConsent) { showToast(t('toast_parent')); return; }
    onboardingData.dateOfBirth = dateOfBirth;
    onboardingData.parentConsent = parentConsent;
  }
  if (step === 'legal') {
    if (!document.getElementById('legalAgreeInput')?.checked) {
      showToast(t('toast_policy'));
      return;
    }
    onboardingData.privacyAccepted = true;
    onboardingData.tosAccepted = true;
  }
  onboardingStep += 1;
  renderOnboarding();
}

async function finishOnboarding() {
  const t = tf();
  const siteHandle = document.getElementById('siteHandleInput').value.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(siteHandle)) {
    showToast(t('toast_handle'));
    return;
  }
  try {
    const res = await API.register({ ...onboardingData, siteHandle });
    USER.siteHandle = res?.user?.siteHandle || siteHandle;
    closeOnboardingScreen();
    await loadGames();
    if (typeof hideBootSplash === 'function') hideBootSplash();
    if (typeof maybeShowFeedNavTipAfterGames === 'function') maybeShowFeedNavTipAfterGames();
  } catch (e) {
    showToast(t('toast_register_fail') + (e.message ? ' ' + e.message : ''));
  }
}

window.checkOnboarding = checkOnboarding;
window.showOnboardingScreen = showOnboardingScreen;
window.renderOnboarding = renderOnboarding;
window.onboardingNext = onboardingNext;
window.nextOnboardingStep = onboardingNext;
window.finishOnboarding = finishOnboarding;
