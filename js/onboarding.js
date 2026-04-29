const ONBOARDING_STEPS = ['birth', 'privacy', 'tos', 'handle'];
let onboardingStep = 0;
let onboardingData = {};

function hasTelegramInitData() {
  try { return Boolean(Telegram.WebApp.initData); } catch (e) { return false; }
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
  const body = document.getElementById('onboardingBody');
  const footer = document.getElementById('onboardingFooter');
  const step = ONBOARDING_STEPS[onboardingStep];

  if (step === 'birth') {
    body.innerHTML = `
      <div class="onboarding-step">Шаг 1 из 4</div>
      <div class="onboarding-title">Дата рождения</div>
      <p class="onboarding-value-prop">SmolGame — лента мини-игр в Telegram (как TikTok: листаешь, играешь, подписываешься на авторов). Сейчас без принудительной рекламы перед игрой. Свою игру — вкладка «Загрузить». Укажи дату рождения для входа.</p>
      <input class="field-input" type="date" id="birthDateInput" value="${esc(onboardingData.dateOfBirth || '')}">
      <label class="check-row" id="parentConsentRow" style="display:none">
        <input type="checkbox" id="parentConsentInput">
        <span>Мой родитель или опекун разрешил создание аккаунта</span>
      </label>
      <div class="onboarding-blocked" id="ageBlocked" style="display:none">К сожалению, вы не можете использовать приложение.</div>
    `;
    footer.innerHTML = `<button class="submit-btn" data-action="onboarding-next">Дальше</button>`;
    document.getElementById('birthDateInput').addEventListener('input', updateAgeNotice);
    updateAgeNotice();
    return;
  }

  if (step === 'privacy') {
    body.innerHTML = `
      <div class="onboarding-step">Шаг 2 из 4</div>
      <div class="onboarding-title">Политика приватности</div>
      <div class="onboarding-text">Вход через Telegram; публично виден только твой ID SmolGame.</div>
      <label class="check-row">
        <input type="checkbox" id="privacyInput">
        <span>Я принимаю политику конфиденциальности</span>
      </label>
    `;
    footer.innerHTML = `<button class="submit-btn" data-action="onboarding-next">Дальше</button>`;
    return;
  }

  if (step === 'tos') {
    body.innerHTML = `
      <div class="onboarding-step">Шаг 3 из 4</div>
      <div class="onboarding-title">Пользовательское соглашение</div>
      <div class="onboarding-text">Только свои игры и правила площадки.</div>
      <label class="check-row">
        <input type="checkbox" id="tosInput">
        <span>Я принимаю пользовательское соглашение</span>
      </label>
    `;
    footer.innerHTML = `<button class="submit-btn" data-action="onboarding-next">Дальше</button>`;
    return;
  }

  body.innerHTML = `
    <div class="onboarding-step">Шаг 4 из 4</div>
    <div class="onboarding-title">Публичный ID</div>
    <div class="onboarding-text">Виден другим вместо @username в Telegram.</div>
    <input class="field-input" type="text" id="siteHandleInput" placeholder="smol_player" maxlength="24" value="${esc(onboardingData.siteHandle || '')}">
  `;
  footer.innerHTML = `<button class="submit-btn" data-action="onboarding-finish">Создать аккаунт</button>`;
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
  const step = ONBOARDING_STEPS[onboardingStep];
  if (step === 'birth') {
    const dateOfBirth = document.getElementById('birthDateInput').value;
    const age = ageFromDate(dateOfBirth);
    if (!age) { showToast('⚠️ Укажи дату рождения'); return; }
    if (age < 13) return;
    const parentConsent = document.getElementById('parentConsentInput')?.checked || false;
    if (age < 18 && !parentConsent) { showToast('⚠️ Нужно согласие родителя'); return; }
    onboardingData.dateOfBirth = dateOfBirth;
    onboardingData.parentConsent = parentConsent;
  }
  if (step === 'privacy') {
    if (!document.getElementById('privacyInput').checked) { showToast('⚠️ Подтверди согласие'); return; }
    onboardingData.privacyAccepted = true;
  }
  if (step === 'tos') {
    if (!document.getElementById('tosInput').checked) { showToast('⚠️ Подтверди соглашение'); return; }
    onboardingData.tosAccepted = true;
  }
  onboardingStep += 1;
  renderOnboarding();
}

async function finishOnboarding() {
  const siteHandle = document.getElementById('siteHandleInput').value.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(siteHandle)) {
    showToast('⚠️ 3-24 символа: a-z, 0-9, _');
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
    showToast('⚠️ ' + (e.message || 'не получилось'));
  }
}

window.checkOnboarding = checkOnboarding;
window.showOnboardingScreen = showOnboardingScreen;
window.onboardingNext = onboardingNext;
window.nextOnboardingStep = onboardingNext;
window.finishOnboarding = finishOnboarding;
