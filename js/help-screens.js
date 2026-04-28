/**
 * Приветственные 3 слайда и гайд — только внутри экрана «Загрузить», не на ленте.
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
    html: `<p class="onboarding-text">Это занимает 10–15 минут. Никаких установок, никакого кода руками. Ниже — шаги и форма.</p>`,
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

function hideUploadWelcomeBlock() {
  const b = document.getElementById('upload-welcome-block');
  if (b) b.setAttribute('hidden', '');
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
      <button type="button" class="submit-btn" data-action="welcome-upload">К шагам и форме</button>
    `;
  } else {
    footer.innerHTML = `<button type="button" class="submit-btn" data-action="welcome-next">${esc(slide.btn)}</button>`;
  }
}

/** Первый заход на «Загрузить» — показать 3 слайда поверх гайда */
function maybeShowWelcomeOnUploadOpen() {
  if (welcomeStorageDone()) return;
  const b = document.getElementById('upload-welcome-block');
  if (!b) return;
  welcomeStep = 0;
  b.removeAttribute('hidden');
  renderWelcomeSlide();
}

function welcomeNext() {
  if (welcomeStep < WELCOME_SLIDES.length - 1) {
    welcomeStep += 1;
    renderWelcomeSlide();
  }
}

function scrollUploadToForm() {
  document.getElementById('upload-active-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    || document.getElementById('upload-methods-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function welcomeAfterSlides() {
  setWelcomeStorageDone();
  hideUploadWelcomeBlock();
  if (typeof selectMethod === 'function') selectMethod('url');
  scrollUploadToForm();
}

function welcomeFinishBrowse() {
  welcomeAfterSlides();
  if (typeof closeUpload === 'function') closeUpload();
  if (typeof maybeShowFeedNavTipAfterGames === 'function') maybeShowFeedNavTipAfterGames();
}

function welcomeFinishUpload() {
  welcomeAfterSlides();
}

function uploadScrollToForm() {
  scrollUploadToForm();
}

window.welcomeNext = welcomeNext;
window.welcomeFinishBrowse = welcomeFinishBrowse;
window.welcomeFinishUpload = welcomeFinishUpload;
window.maybeShowWelcomeOnUploadOpen = maybeShowWelcomeOnUploadOpen;
window.hideUploadWelcomeBlock = hideUploadWelcomeBlock;
window.uploadScrollToForm = uploadScrollToForm;
