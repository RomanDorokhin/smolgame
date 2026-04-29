/**
 * Приветственные слайды и гайд — только внутри экрана «Загрузить», не на ленте.
 */
function getWelcomeSlides() {
  const tf = typeof window.t === 'function' ? window.t : k => k;
  const en = typeof window.getLang === 'function' && window.getLang() === 'en';
  if (en) {
    return [
      {
        title: 'SmolGame',
        html: `<p class="onboarding-text onboarding-value-prop">A TikTok-style feed, but mini-games in Telegram: swipe, tap Play, follow authors. No mandatory ad before play right now.</p><p class="onboarding-text">Publish your game in a few steps — by link or via GitHub.</p>`,
        btn: tf('welcome_slide1_btn'),
      },
      {
        title: tf('welcome_slide2_title'),
        html: `<p class="onboarding-text">Ask an AI for a simple HTML game, host it on HTTPS, paste the URL in the form above. Or connect GitHub and create a repo from the app.</p>`,
        btn: tf('welcome_slide2_btn'),
      },
      {
        title: tf('welcome_slide3_title'),
        html: `<p class="onboarding-text">The checklist and form are below. You can fill the fields right away.</p>`,
        final: true,
      },
    ];
  }
  return [
    {
      title: 'SmolGame',
      html: `<p class="onboarding-text onboarding-value-prop">Лента в духе TikTok, только вместо роликов — мини-игры в Telegram: листаешь, заходишь в игру по кнопке, на автора можно подписаться. Сейчас без обязательной рекламы перед игрой.</p><p class="onboarding-text">Свою игру выложи за пару шагов — по ссылке или через GitHub.</p>`,
      btn: tf('welcome_slide1_btn'),
    },
    {
      title: tf('welcome_slide2_title'),
      html: `<p class="onboarding-text">Попроси ИИ сделать простую HTML-игру, выложи на хостинг с HTTPS — вставь ссылку в форму выше. Или подключи GitHub и создай репозиторий из приложения.</p>`,
      btn: tf('welcome_slide2_btn'),
    },
    {
      title: tf('welcome_slide3_title'),
      html: `<p class="onboarding-text">Ниже — памятка и форма. Можно сразу заполнять поля.</p>`,
      final: true,
    },
  ];
}

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
  const slides = getWelcomeSlides();
  const slide = slides[welcomeStep];
  if (!slide) return;
  const tf = typeof window.t === 'function' ? window.t : k => k;

  body.innerHTML = `
    <div class="onboarding-step">${tf('welcome_step', { n: welcomeStep + 1, total: slides.length })}</div>
    <div class="onboarding-title">${esc(slide.title)}</div>
    ${slide.html}
  `;

  if (slide.final) {
    footer.innerHTML = `
      <button type="button" class="sg-btn sg-btn--secondary welcome-btn-secondary" data-action="welcome-browse">${esc(tf('welcome_browse'))}</button>
      <button type="button" class="sg-btn sg-btn--primary sg-btn--screen-cta" data-action="welcome-upload">${esc(tf('welcome_form'))}</button>
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
  const slides = getWelcomeSlides();
  if (welcomeStep < slides.length - 1) {
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

function refreshWelcomeI18n() {
  const b = document.getElementById('upload-welcome-block');
  if (b && !b.hidden && !welcomeStorageDone()) {
    renderWelcomeSlide();
  }
}

window.welcomeNext = welcomeNext;
window.welcomeFinishBrowse = welcomeFinishBrowse;
window.welcomeFinishUpload = welcomeFinishUpload;
window.maybeShowWelcomeOnUploadOpen = maybeShowWelcomeOnUploadOpen;
window.hideUploadWelcomeBlock = hideUploadWelcomeBlock;
window.uploadScrollToForm = uploadScrollToForm;
window.refreshWelcomeI18n = refreshWelcomeI18n;
