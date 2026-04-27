/**
 * Приветственный онбординг (3 слайда, один раз) + экраны «Как добавить игру» и FAQ.
 */
const WELCOME_SLIDES = [
  {
    title: 'Добро пожаловать 👾',
    html: `<p class="onboarding-text">Здесь тысячи игр, сделанных обычными людьми с помощью ИИ. Без опыта в разработке. Бесплатно. За 10 минут.</p>`,
    btn: 'Далее →',
  },
  {
    title: 'Как это работает?',
    html: `<p class="onboarding-text">Ты просишь ИИ написать игру → получаешь готовый HTML-файл → выкладываешь на GitHub → вставляешь ссылку → игра появляется здесь.</p>`,
    btn: 'Далее →',
  },
  {
    title: 'Готов попробовать?',
    html: `<p class="onboarding-text">Это занимает 10–15 минут. Никаких установок, никакого кода руками.</p>`,
    final: true,
  },
];

let welcomeStep = 0;

function welcomeStorageDone() {
  try {
    return localStorage.getItem(STORAGE_KEYS.welcomeOnboarding) === '1';
  } catch (e) {
    return true;
  }
}

function setWelcomeStorageDone() {
  try {
    localStorage.setItem(STORAGE_KEYS.welcomeOnboarding, '1');
  } catch (e) { /* ignore */ }
}

function renderWelcomeSlide() {
  const body = document.getElementById('welcomeBody');
  const footer = document.getElementById('welcomeFooter');
  if (!body || !footer) return;
  const slide = WELCOME_SLIDES[welcomeStep];
  if (!slide) return;

  body.innerHTML = `
    <div class="onboarding-step">Слайд ${welcomeStep + 1} из 3</div>
    <div class="onboarding-title">${esc(slide.title)}</div>
    ${slide.html}
  `;

  if (slide.final) {
    footer.innerHTML = `
      <button type="button" class="submit-btn welcome-btn-secondary" data-action="welcome-browse">Сначала посмотрю</button>
      <button type="button" class="submit-btn" data-action="welcome-upload">Добавить свою игру</button>
    `;
  } else {
    footer.innerHTML = `<button type="button" class="submit-btn" data-action="welcome-next">${esc(slide.btn)}</button>`;
  }
}

function openWelcomeScreen() {
  welcomeStep = 0;
  document.getElementById('welcome-screen')?.classList.add('open');
  renderWelcomeSlide();
}

function closeWelcomeScreen() {
  document.getElementById('welcome-screen')?.classList.remove('open');
}

function welcomeNext() {
  if (welcomeStep < WELCOME_SLIDES.length - 1) {
    welcomeStep += 1;
    renderWelcomeSlide();
  }
}

function welcomeFinishBrowse() {
  setWelcomeStorageDone();
  closeWelcomeScreen();
  if (typeof maybeShowFeedNavTipAfterGames === 'function') maybeShowFeedNavTipAfterGames();
}

function welcomeFinishUpload() {
  setWelcomeStorageDone();
  closeWelcomeScreen();
  if (typeof openUpload === 'function') openUpload();
  if (typeof maybeShowFeedNavTipAfterGames === 'function') maybeShowFeedNavTipAfterGames();
}

/** После успешной регистрации — показать приветствие один раз */
function maybeShowWelcomeAfterRegister() {
  if (welcomeStorageDone()) return;
  openWelcomeScreen();
}

function openHelpHowScreen() {
  document.getElementById('help-how-screen')?.classList.add('open');
}

function closeHelpHowScreen() {
  document.getElementById('help-how-screen')?.classList.remove('open');
}

function openHelpFaqScreen() {
  document.getElementById('help-faq-screen')?.classList.add('open');
}

function closeHelpFaqScreen() {
  document.getElementById('help-faq-screen')?.classList.remove('open');
}

/** С главной: гайд, затем форма загрузки */
function openHowToAddFromFeed() {
  openHelpHowScreen();
}

function openUploadFromHelpHow() {
  closeHelpHowScreen();
  if (typeof openUpload === 'function') openUpload();
  if (typeof selectMethod === 'function') selectMethod('url');
}

window.welcomeNext = welcomeNext;
window.welcomeFinishBrowse = welcomeFinishBrowse;
window.welcomeFinishUpload = welcomeFinishUpload;
window.maybeShowWelcomeAfterRegister = maybeShowWelcomeAfterRegister;
window.openHelpHowScreen = openHelpHowScreen;
window.closeHelpHowScreen = closeHelpHowScreen;
window.openHelpFaqScreen = openHelpFaqScreen;
window.closeHelpFaqScreen = closeHelpFaqScreen;
window.openHowToAddFromFeed = openHowToAddFromFeed;
window.openUploadFromHelpHow = openUploadFromHelpHow;
