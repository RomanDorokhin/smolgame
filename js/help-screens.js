/**
 * Приветственные слайды и гайд — только внутри экрана «Загрузить», не на ленте.
 */
const WELCOME_SLIDES = [
  {
    title: 'SmolGame',
    html: `<p class="onboarding-text">Лента игр в Telegram. Своё — за пару шагов: ссылка или GitHub.</p>`,
    btn: 'Далее',
  },
  {
    title: 'Как добавить игру',
    html: `<p class="onboarding-text">Попроси ИИ сделать простую HTML-игру, выложи на хостинг с HTTPS — вставь ссылку выше. Или подключи GitHub и создай репозиторий из приложения.</p>`,
    btn: 'Далее',
  },
  {
    title: 'Готово',
    html: `<p class="onboarding-text">Ниже — памятка и форма. Можно сразу заполнять поля.</p>`,
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
    <div class="onboarding-step">Шаг ${welcomeStep + 1} из ${WELCOME_SLIDES.length}</div>
    <div class="onboarding-title">${esc(slide.title)}</div>
    ${slide.html}
  `;

  if (slide.final) {
    footer.innerHTML = `
      <button type="button" class="sg-btn sg-btn--secondary welcome-btn-secondary" data-action="welcome-browse">В ленту</button>
      <button type="button" class="sg-btn sg-btn--primary sg-btn--screen-cta" data-action="welcome-upload">К форме</button>
    `;
  } else {
    footer.innerHTML = `<button type="button" class="sg-btn sg-btn--primary sg-btn--screen-cta" data-action="welcome-next">${esc(slide.btn)}</button>`;
  }
}

/** Первый заход на «Загрузить» — короткий welcome */
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
  document.getElementById('upload-url-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) ||
    document.getElementById('upload-methods-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) ||
    document.getElementById('form-url')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function welcomeAfterSlides() {
  setWelcomeStorageDone();
  hideUploadWelcomeBlock();
  void selectMethod('url');
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
