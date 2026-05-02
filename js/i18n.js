/**
 * UI language: Russian (default) + English. API still sends Russian genre labels.
 * Storage: localStorage smolgame:lang:v1 = ru | en
 */
(function () {
  const STORAGE_KEY = 'smolgame:lang:v1';
  const SUPPORTED = ['ru', 'en'];

  const STR = {
    ru: {
      nav_feed: 'Лента',
      nav_games: 'Игры',
      nav_upload: 'Загрузить',
      nav_search: 'Поиск',
      nav_profile: 'Профиль',
      lang_ru: 'RU',
      lang_en: 'EN',
      lang_hint: 'Язык интерфейса',

      boot_loading: 'Загрузка…',
      tg_only_title: 'Открой в Telegram',
      tg_only_text: 'Открой из Telegram: меню бота → мини-приложение.',

      feed_back: '← Лента',
      feed_exit_aria: 'Выйти из игры',
      action_like_title: 'Лайк и в избранное',
      caption_likes: 'лайков',
      caption_reviews: 'отзывов',
      caption_plays: 'запусков',
      action_reviews_title: 'Отзывы',
      action_plays_title: 'Запуски в ленте',
      share: 'Поделиться',
      report: 'Жалоба',

      empty_feed_title: 'Пока без игр',
      empty_feed_sub:
        'Как короткие ролики, только это мини-игры в Telegram: листаешь — смотришь превью, понравилось — «Играть», зашёл за автором — «Подписаться», не зашла — свайп дальше. Без обязательных «посмотри рекламу, чтобы поиграть» — так задумано сейчас. Свою игру — снизу «Загрузить».',
      empty_feed_cta: 'Загрузить игру',
      empty_err_title: 'Лента не загрузилась',
      empty_err_sub: 'Проверь интернет и попробуй снова.',
      empty_retry: 'Повторить',

      author_role: 'Разработчик',
      author_you: 'Это вы',
      follow_add: 'Подписаться',
      follow_done: 'Вы подписаны',
      follow_add_author: 'Подписаться на автора',
      reviews_drawer_title: 'Отзывы',
      close_aria: 'Закрыть',
      review_short_placeholder: 'Коротко об игре…',
      send: 'Отправить',

      game_detail_back_aria: 'Назад',
      game_word: 'Игра',
      play: 'Играть',
      reviews_section: 'Отзывы',
      review_write_placeholder: 'Написать отзыв…',
      review_submit_btn: 'Отправить отзыв',

      feed_nav_what_title: 'Что это?',
      feed_nav_what_lead:
        'SmolGame — лента мини-игр в Telegram в духе TikTok: листаешь карточки, заходишь в игру по кнопке, на автора можно подписаться. Сейчас без обязательной рекламы перед игрой (никаких «смотри 10 сек, потом играй»). Свайп вверх / вниз — другая игра; «Играть» — полный экран, выход — «← Лента».',
      feed_nav_swipe_label: 'свайп',
      feed_nav_help_link: 'Подробная справка',
      close: 'Закрыть',
      got_it: 'Понятно',
      feed_nav_how_title: 'Как листать ленту',
      feed_nav_how_lead: 'Свайп по экрану (не по кнопкам сбоку и снизу) — следующая или предыдущая игра.',
      feed_nav_how_li1: 'Вверх — следующая игра',
      feed_nav_how_li2: 'Вниз — предыдущая',
      feed_nav_how_li3: '«Играть» — только игра, без лайков и табов; «← Лента» — выход',
      feed_nav_how_li4: 'В режиме игры свайп ленты отключён',
      feed_nav_back_detail: 'Назад к кратко',

      feed_onboard_title: 'Добро пожаловать в SmolGame',
      feed_onboard_sub:
        'Листай как в TikTok: превью → «Играть», понравился автор — подписка, не зашло — свайп дальше. Сейчас без принудительной рекламы перед игрой. Свою игру выложи через «Загрузить».',
      feed_onboard_cta: 'Начать',

      upload_title: 'Загрузить игру',
      upload_back_aria: 'Назад к ленте',
      method_url_title: 'По ссылке',
      method_url_desc: 'Уже есть HTTPS URL',
      method_gh_title: 'Через GitHub',
      method_gh_desc: 'Код → репозиторий → Pages',
      premium_btn: 'Премиум',
      premium_soon: 'скоро',
      premium_aria: 'О премиуме',

      gh_account: 'Аккаунт GitHub',
      gh_login: 'Войти через GitHub',
      gh_switch: 'Сменить аккаунт GitHub',
      gh_unlink: 'Отвязать GitHub',
      gh_hint_connect: 'Привяжи GitHub — появится форма ниже.',
      gh_step_label: 'Этап',
      gh_heading_1: 'Код и карточка',
      gh_heading_2: 'Обложка и модерация',
      github_word: 'GitHub',
      gh_sub_1: 'Публичный репозиторий и GitHub Pages.',
      stack_code: 'Код',
      stack_card: 'Карточка в ленте',
      gh_mode_paste: 'HTML',
      gh_mode_files: 'Файлы',
      gh_code_upload_aria: 'Способ загрузки кода',
      gh_one_file: 'Один файл index.html',
      gh_files_hint: 'До 20 файлов, латиница в именах, нужен index.html',
      choose_files: 'Выбрать файлы',
      field_title: 'Название',
      field_title_placeholder: 'Название в ленте',
      field_desc: 'Описание',
      field_desc_short: 'Коротко о геймплее…',
      field_desc_url: 'Пара слов о чём игра...',
      field_genre: 'Жанр',
      field_game_url: 'Ссылка на игру',
      field_game_url_ph: 'https://username.github.io/game',
      field_hint_hosting: 'GitHub Pages или любой хостинг с HTTPS',
      cover_optional: 'Обложка (необязательно)',
      cover_hint: 'Ссылка или файл — что удобнее.',
      cover_url_ph: 'https://… картинка',
      cover_file_device: 'Файл с устройства',
      no_cover: 'Нет обложки',
      submit_moderation: 'На модерацию',
      create_repo: 'Создать репозиторий',
      gh_step2_lead: 'Репозиторий готов — добавь обложку и отправь на модерацию.',
      cover_url_short: 'https://… jpg/png',
      cover_file: 'Файл',
      back: 'Назад',

      upload_url_lead: 'Ссылка на игру и как она выглядит в ленте.',
      upload_guide_intro: 'Пошаговая памятка — форма выше.',
      upload_scroll_form: 'К форме',
      upload_wizard_hint: 'Войди через GitHub — откроется форма для кода и карточки в ленте.',

      premium_title: 'Премиум',
      premium_lead:
        'Закрытое хранение кода на стороне SmolGame вместо публичного репозитория — для команд, где важна тайна. Сейчас в разработке; игры в ленту по-прежнему через ссылку или GitHub.',
      premium_why: 'Зачем',
      premium_why_p:
        'По ссылке и через GitHub игра обычно доступна всем с интернета. Премиум — отдельный путь, когда код не должен светиться в открытом Git.',
      premium_active_p:
        'Ранний доступ включён. Шаги загрузки в закрытое хранилище появятся здесь, когда подключим сценарий.',
      premium_waitlist_p:
        'Список тестеров закрытый — напиши владельцу бота. Пока можно пользоваться ссылкой и GitHub без ограничений.',
      premium_plans: 'В планах',
      premium_plans_p:
        'Подписки для игроков и отдельно для разработчиков (как премиум в Telegram). Поддержка авторов донатами и сигналами от аудитории, какие игры делать дальше. Реклама между играми — только если появится, заранее и аккуратно — не «смотри видео, иначе не поиграешь».',

      profile_title: 'Профиль',
      stat_games: 'Игр',
      stat_followers: 'Подписчиков',
      stat_likes: 'Лайков',
      profile_stats_hint: 'Игры — опубликованные карточки. Лайки — сумма по всем твоим играм в ленте.',
      guest: 'Гость',
      profile_edit: 'Редактировать профиль',
      profile_save_btn: 'Сохранить',
      profile_discard: 'Отмена',
      profile_id_hint: 'при регистрации',
      profile_display_lbl: 'Имя в SmolGame',
      profile_display_ph: 'Как тебя видят другие',
      profile_bio_lbl: 'О себе',
      profile_bio_ph: 'Коротко о себе или своих играх…',
      profile_photo_lbl: 'Фото профиля',
      profile_theme_lbl: 'Тема оформления',
      theme_dark: 'Тёмная',
      theme_light: 'Светлая',
      profile_photo_upload: 'Загрузить фото',
      profile_photo_reset: 'Как в Telegram',
      profile_photo_max: 'До 2 МБ',
      profile_save_main: 'Сохранить профиль',
      badge_player: '🎮 Игрок',
      badge_dev: '⚡ Разработчик',
      badge_premium: '✦ Премиум',
      profile_upload_hint: 'Как добавить игру, шаги и FAQ — на экране Загрузить (＋).',
      admin_queue_title: 'На модерации',
      my_games_title: 'Мои игры',
      no_games_grid: 'Нет игр',
      delete_account_btn: 'Удалить аккаунт',
      delete_account_hint: 'Все твои игры, отзывы и посты будут удалены навсегда.',
      delete_account_confirm: 'Удалить аккаунт и все данные навсегда? Это действие нельзя отменить.',
      delete_account_done: 'Аккаунт удалён',

      games_lib_title: 'Игры',
      games_lib_lead: 'Лайкнул и недавно открывал — в двух списках ниже.',
      games_liked: 'Лайкнул',
      games_played: 'Играл',

      search_title: 'Поиск',
      search_ph: 'Название или автор…',
      genre_filter_lbl: 'Жанр',

      author_screen_title: 'Разработчик',
      author_back_aria: 'Назад',
      author_screen_back: '← Лента',
      author_games_title: 'Игры автора',
      author_follow: 'Подписаться',

      genre_all: 'Все',
      genre_arcade: 'Аркада',
      genre_puzzle: 'Головоломка',
      genre_action: 'Экшен',
      genre_casual: 'Казуалка',
      genre_strategy: 'Стратегия',
      genre_racing: 'Гонки',
      genre_platform: 'Платформер',
      genre_other: 'Прочее',

      free: 'Бесплатно',
      game_fallback: 'Игра',
      err_generic: 'Что-то пошло не так. Попробуй ещё раз.',
      err_network: 'Нет сети. Проверь интернет и попробуй снова.',
      err_load: 'Не загрузилось',
      try_again: 'Не вышло. Попробуй ещё раз',
      copied: '🔗 Ссылка скопирована',
      unsubscribed: 'Отписались',
      subscribed: 'Подписка оформлена',
      share_text:
        '{title}{author} — мини-игра в SmolGame (лента в Telegram, без обязательной рекламы перед игрой). Запусти по ссылке:',

      activity_title: 'События',
      activity_empty: 'Здесь будут уведомления о лайках и отзывах.',
      act_like: 'оценил игру «{game}»',
      act_review: 'оставил отзыв к «{game}»',
      act_reply: 'ответил на твой отзыв к «{game}»',
      act_follow: 'подписался на тебя',
      act_repost: 'поделился игрой «{game}»',
      profile_tab_wall: 'Стена',

      search_empty_title: 'Поиск по играм',
      search_empty_sub: 'Введи название или ник. Жанр — полоска выше.',
      search_no_results: 'Ничего не нашли',
      search_no_hint: 'Смени запрос или жанр.',
      search_clear_genre_aria: 'Сбросить фильтр жанра',

      liked_empty_title: 'Пока пусто',
      liked_empty_sub: 'Лайкни игры в ленте — они появятся здесь.',
      played_empty_title: 'Пока пусто',
      played_empty_sub: 'Открой игры в ленте (кнопка «Играть») — список заполнится.',
      to_feed: 'В ленту',
      loading: 'Загрузка…',
      load_failed_title: 'Не загрузилось',

      onboarding_step: 'Шаг {n} из {total}',
      onboarding_dob_title: 'Дата рождения',
      onboarding_dob_lead:
        'SmolGame — лента мини-игр в Telegram (как TikTok: листаешь, играешь, подписываешься на авторов). Сейчас без принудительной рекламы перед игрой. Свою игру — вкладка «Загрузить». Укажи дату рождения для входа.',
      onboarding_parent: 'Мой родитель или опекун разрешил создание аккаунта',
      onboarding_blocked: 'К сожалению, вы не можете использовать приложение.',
      onboarding_next: 'Дальше',
      onboarding_terms_title: 'Условия',
      onboarding_terms_text:
        'Вход через Telegram; публично виден только твой ID SmolGame. На площадке — только свои игры и общие правила.',
      onboarding_accept: 'Я принимаю политику конфиденциальности и пользовательское соглашение',
      onboarding_accept_html:
        'Я принимаю <strong>политику конфиденциальности</strong> и <strong>пользовательское соглашение</strong>',
      onboarding_handle_title: 'Публичный ID',
      onboarding_handle_text: 'Виден другим вместо @username в Telegram.',
      onboarding_create: 'Создать аккаунт',
      toast_dob: '⚠️ Укажи дату рождения',
      toast_parent: '⚠️ Нужно согласие родителя',
      toast_policy: '⚠️ Подтверди политику и пользовательское соглашение',
      toast_handle: '⚠️ 3-24 символа: a-z, 0-9, _',
      toast_register_fail: '⚠️ не получилось',

      welcome_slide1_btn: 'Далее',
      welcome_slide2_btn: 'Далее',
      welcome_slide3_btn: 'Готово',
      welcome_slide2_title: 'Как добавить игру',
      welcome_slide3_title: 'Готово',
      welcome_browse: 'В ленту',
      welcome_form: 'К форме',
      welcome_step: 'Шаг {n} из {total}',

      help_acc1_sum: '1 Создай игру с ИИ',
      help_acc2_sum: '2 Выложи на GitHub Pages',
      help_acc3_sum: '3 Скопируй ссылку',
      faq_title: 'FAQ',

      moderation: 'Модерация',
      rejected: 'Отклонено',
      pending_banner: 'На модерации',
      rejected_banner: 'Не прошла модерацию',
      placeholder_loading: 'Загрузка…',
      placeholder_fail_title: 'Не загрузилась',
      placeholder_bad_url: 'Некорректная ссылка',

      github_connected: '✅ GitHub подключён',
      github_error: '⚠️ GitHub: ',
      github_error_generic: 'ошибка',

      admin_approve: '✓ Одобрить',
      admin_reject: '✗ Отклонить',
      admin_delete: '🗑 Удалить',

      author_loading: 'Загрузка...',
      author_loading_games: 'Загружаем игры',
      author_anon: 'Аноним',
      author_load_fail: 'Не удалось загрузить',
      author_no_games: 'Нет игр',
      author_no_games_sub: 'У этого автора пока ничего не опубликовано.',
      profile_err: 'ошибка профиля',

      premium_soon_locked: 'скоро',
      premium_available: 'доступ',
      gh_hint_connected_detail:
        'Подключи GitHub — ниже появится форма. Каждый вход из Telegram подтверждается в GitHub отдельно.',
      gh_hint_reauth:
        'Доступ к GitHub не сохранился. Нажми «Войти через GitHub» ещё раз и разреши публикацию.',
      gh_hint_ready:
        'Вставь код или файлы, заполни карточку и создай репозиторий. Код уходит в твой публичный GitHub.',
      gh_files_none: 'Файлы не выбраны',
      toast_open_telegram: '⚠️ Открой мини-апп из Telegram-бота',
      toast_gh_unlinked: '✅ GitHub отвязан',
      toast_gh_unlink_fail: '⚠️ не удалось',
      toast_gh_config:
        '⚠️ GitHub: задай GITHUB_CLIENT_ID и GITHUB_CLIENT_SECRET в Cloudflare → Worker → Variables',
      toast_gh_oauth_fail: '⚠️ не удалось начать вход',
      gh_pick_files: '⚠️ Выбери файлы',
      gh_bad_filename: '⚠️ Имена файлов только латиница, цифры, . _ - : ',
      gh_need_index: '⚠️ Нужен файл index.html в корне',
      gh_need_title: '⚠️ Укажи название игры',
      gh_pick_genre: '⚠️ Выбери жанр',
      gh_creating: '🔍 Создаём репозиторий на GitHub…',
      gh_repo_ready: '✅ Репозиторий создан, страница открывается',
      gh_repo_pages_wait: '✅ Репозиторий создан — Pages до 1–3 мин',
      gh_submitting: '🔍 Отправляем на модерацию…',
      gh_need_repo: '⚠️ Сначала создай репозиторий',
      gh_need_title_short: '⚠️ Укажи название',
      game_sent_review: '✅ Игра отправлена на модерацию',
      err_generic_short: '⚠️ ошибка',
      err_submit_fail: '⚠️ не получилось',
      cover_bad_url: '⚠️ Некорректная ссылка на обложку',
      cover_upload_unavailable: '⚠️ Загрузка файла недоступна — укажи URL обложки или без обложки',
      cover_bad_url_http: '⚠️ Некорректная ссылка на обложку (нужен https или http)',
      cover_file_unavailable: '⚠️ Файл недоступен — укажи URL обложки или без неё',
      paste_html_empty: '⚠️ Вставь HTML-код игры',
      paste_html_need_doctype: '⚠️ Нужен полный HTML-документ (с <!DOCTYPE html> или <html>)',
      paste_html_too_big: '⚠️ Файл слишком большой',
      url_need_link_title: '⚠️ Заполни ссылку и название',
      url_need_genre: '⚠️ Выбери жанр',
      url_need_valid: '⚠️ Нужна рабочая ссылка (https://… или http:// — превратим в https)',
      url_need_telegram_detail:
        '⚠️ Открой мини-апп из Telegram-бота — иначе сервер не узнает тебя и не примет игру.',
      url_submitting: '🔍 Отправляем...',
      url_submitted: '✅ Отправлено на модерацию!',
      upload_restart: 'Загрузку можно начать снова',
      review_lbl_game_url: 'Ссылка на игру:',
      review_lbl_title: 'Название:',
      review_lbl_desc: 'Описание:',
      review_lbl_genre: 'Жанр:',
      review_lbl_cover: 'Обложка:',
      review_cover_file: 'файл (загрузится при отправке)',
      review_cover_none: 'нет',
      gh_bad_pages: 'Некорректная ссылка GitHub Pages',
      gh_need_title_api: 'Укажи название игры',

      gd_reviews_loading: 'Загрузка…',
      gd_reviews_empty_drawer: 'Пока без отзывов — будь первым.',
      gd_reviews_empty_page: 'Пока нет отзывов.',
      gd_player: 'Игрок',
      gd_review_saved: '✅ Отзыв сохранён',
      gd_review_empty: '⚠️ Напиши отзыв',
      gd_no_data: 'Нет данных',
      gd_no_desc: 'Без описания.',
      gd_badge_rejected: 'Отклонена',
      gd_in_catalog: 'В каталоге с {date}',
      gd_pending_check: 'Карточка на проверке',
      gd_not_listed: 'Не в каталоге',
      meta_genre: 'Жанр',
      meta_likes: 'Лайки',
      meta_plays: 'Запуски',
      meta_date: 'Дата',
      gd_author: 'Автор',
      gd_owner_your_game: 'Твоя игра',
      gd_edit: 'Редактировать',
      gd_open_in_feed: 'Открыть в ленте',
      gd_delete: 'Удалить',

      profile_game_actions_aria: 'Действия с игрой',
      profile_empty_games_title: 'Пока без своих игр',
      profile_empty_games_sub: 'Добавь через вкладку «Загрузить» (＋).',
      profile_editor_lead:
        'Карточка в ленте: название, описание, жанр, обложка. Ссылка на игру не меняется. После сохранения снова на модерацию.',
      profile_cover_url_hint: 'https://… jpg/png',
      profile_choose_file: 'Выбрать файл',
      profile_clear_cover: 'Убрать обложку',
      profile_game_url_label: 'URL игры:',
      profile_save_review: 'Сохранить и на модерацию',
      profile_open_in_feed_aria: 'Открыть в ленте',
      profile_delete_game_aria: 'Удалить игру',
      profile_toast_name: '⚠️ Укажи имя',
      profile_saved: 'Сохранено',
      profile_photo_tg: '✅ Фото из Telegram',
      profile_photo_updated: '✅ Фото обновлено',
      profile_delete_fail: 'не удалось удалить',
      profile_me_failed:
        'Не удалось загрузить профиль с сервера. Потяни экран вниз для обновления или нажми «Повторить». Имя ниже может быть из Telegram до успешной загрузки.',
      profile_me_retry: 'Повторить',
      profile_me_reload: 'Перезапустить мини-апп',
      profile_delete_this: 'эту игру',
      profile_delete_confirm_generic: 'Удалить игру из SmolGame? Это действие нельзя отменить.',
      profile_delete_confirm_named: 'Удалить «{title}» из SmolGame? Это действие нельзя отменить.',
      profile_delete_gh_confirm:
        'Удалить также репозиторий на GitHub (страница {host})?\n\nOK — да, убрать и репозиторий (если ты автор и вход через GitHub сохранён).\nОтмена — удалить только карточку в SmolGame.',
      profile_delete_done: '🗑 Игра удалена из SmolGame',
      profile_delete_repo_done: '; репозиторий на GitHub удалён',
      profile_editor_no_edit: '⚠️ Отклонённые игры не редактируются',
      profile_editor_upload_cover: '⏳ Загружаем обложку…',
      profile_editor_saving: '⏳ Сохраняем…',
      profile_editor_sent: '✅ Отправлено на модерацию',
      profile_editor_need_title: '⚠️ Укажи название',
      profile_cover_upload_fail: 'обложка не загрузилась',
      err_no_url: 'нет URL',
      err_empty_response: 'пустой ответ',
      err_error: 'ошибка',
      genre_api_other: 'Прочее',

      report_to_admin: '⚑ Жалоба: напиши админу бота',
    },
    en: {
      nav_feed: 'Feed',
      nav_games: 'Games',
      nav_upload: 'Upload',
      nav_search: 'Search',
      nav_profile: 'Profile',
      lang_ru: 'RU',
      lang_en: 'EN',
      lang_hint: 'Interface language',

      boot_loading: 'Loading…',
      tg_only_title: 'Open in Telegram',
      tg_only_text: 'Open from Telegram: bot menu → Mini App.',

      feed_back: '← Feed',
      feed_exit_aria: 'Exit game',
      action_like_title: 'Like & bookmark',
      caption_likes: 'likes',
      caption_reviews: 'reviews',
      caption_plays: 'plays',
      action_reviews_title: 'Reviews',
      action_plays_title: 'Plays in feed',
      share: 'Share',
      report: 'Report',

      empty_feed_title: 'No games yet',
      empty_feed_sub:
        'Like short videos, but mini-games in Telegram: swipe previews, tap Play, follow authors you like, swipe away the rest. No forced “watch an ad to play” for now. Add yours via Upload below.',
      empty_feed_cta: 'Upload a game',
      empty_err_title: 'Feed failed to load',
      empty_err_sub: 'Check your connection and try again.',
      empty_retry: 'Retry',

      author_role: 'Developer',
      author_you: "It's you",
      follow_add: 'Follow',
      follow_done: 'Following',
      follow_add_author: 'Follow author',
      reviews_drawer_title: 'Reviews',
      close_aria: 'Close',
      review_short_placeholder: 'Short note about the game…',
      send: 'Send',

      game_detail_back_aria: 'Back',
      game_word: 'Game',
      play: 'Play',
      reviews_section: 'Reviews',
      review_write_placeholder: 'Write a review…',
      review_submit_btn: 'Post review',

      feed_nav_what_title: 'What is this?',
      feed_nav_what_lead:
        'SmolGame is a mini-game feed in Telegram, TikTok-style: swipe cards, tap Play, follow creators. No mandatory ad before play right now. Swipe up/down for another game; Play is fullscreen, use ← Feed to exit.',
      feed_nav_swipe_label: 'swipe',
      feed_nav_help_link: 'Full help',
      close: 'Close',
      got_it: 'Got it',
      feed_nav_how_title: 'How to browse',
      feed_nav_how_lead: 'Swipe on the screen (not on side or bottom buttons) for next or previous game.',
      feed_nav_how_li1: 'Up — next game',
      feed_nav_how_li2: 'Down — previous',
      feed_nav_how_li3: 'Play — game only, no likes/tabs; ← Feed — exit',
      feed_nav_how_li4: 'Feed swipe is disabled while playing',
      feed_nav_back_detail: 'Back to summary',

      feed_onboard_title: 'Welcome to SmolGame',
      feed_onboard_sub:
        'Swipe like TikTok: preview → Play, follow authors you like, swipe on if not. No forced ads before play. Upload your game via Upload.',
      feed_onboard_cta: 'Start',

      upload_title: 'Upload game',
      upload_back_aria: 'Back to feed',
      method_url_title: 'By link',
      method_url_desc: 'HTTPS URL ready',
      method_gh_title: 'Via GitHub',
      method_gh_desc: 'Code → repo → Pages',
      premium_btn: 'Premium',
      premium_soon: 'soon',
      premium_aria: 'About premium',

      gh_account: 'GitHub account',
      gh_login: 'Sign in with GitHub',
      gh_switch: 'Switch GitHub account',
      gh_unlink: 'Unlink GitHub',
      gh_hint_connect: 'Connect GitHub — the form will appear below.',
      gh_step_label: 'Step',
      gh_heading_1: 'Code & listing',
      gh_heading_2: 'Cover & review',
      github_word: 'GitHub',
      gh_sub_1: 'Public repository and GitHub Pages.',
      stack_code: 'Code',
      stack_card: 'Feed card',
      gh_mode_paste: 'HTML',
      gh_mode_files: 'Files',
      gh_code_upload_aria: 'How to add code',
      gh_one_file: 'Single index.html file',
      gh_files_hint: 'Up to 20 files, Latin names, index.html required',
      choose_files: 'Choose files',
      field_title: 'Title',
      field_title_placeholder: 'Title in feed',
      field_desc: 'Description',
      field_desc_short: 'Short gameplay note…',
      field_desc_url: 'A few words about the game…',
      field_genre: 'Genre',
      field_game_url: 'Game URL',
      field_game_url_ph: 'https://username.github.io/game',
      field_hint_hosting: 'GitHub Pages or any HTTPS host',
      cover_optional: 'Cover (optional)',
      cover_hint: 'URL or file — your choice.',
      cover_url_ph: 'https://… image',
      cover_file_device: 'File from device',
      no_cover: 'No cover',
      submit_moderation: 'Submit for review',
      create_repo: 'Create repository',
      gh_step2_lead: 'Repo ready — add cover art and submit for review.',
      cover_url_short: 'https://… jpg/png',
      cover_file: 'File',
      back: 'Back',

      upload_url_lead: 'Game URL and how it looks in the feed.',
      upload_guide_intro: 'Step-by-step guide — form above.',
      upload_scroll_form: 'To form',
      upload_wizard_hint: 'Sign in with GitHub — the code and listing form will open.',

      premium_title: 'Premium',
      premium_lead:
        'Private code hosting on SmolGame instead of a public repo — for teams that need secrecy. In development; publishing still via link or GitHub.',
      premium_why: 'Why',
      premium_why_p:
        'With a link or GitHub the game is usually public on the web. Premium is a separate path when code must not sit in open Git.',
      premium_active_p:
        'Early access is on. Closed-hosting upload steps will appear here when the flow is ready.',
      premium_waitlist_p:
        'Tester list is closed — message the bot owner. You can still use link and GitHub without limits.',
      premium_plans: 'Planned',
      premium_plans_p:
        'Subscriptions for players and creators (Telegram-style premium). Author support via tips and signals. Between-game ads only if added, clearly and lightly — never “watch video or you cannot play”.',

      profile_title: 'Profile',
      stat_games: 'Games',
      stat_followers: 'Followers',
      stat_likes: 'Likes',
      profile_stats_hint: 'Games — published cards. Likes — total across your games in the feed.',
      guest: 'Guest',
      profile_edit: 'Edit profile',
      profile_save_btn: 'Save',
      profile_discard: 'Cancel',
      profile_id_hint: 'set at signup',
      profile_display_lbl: 'Name in SmolGame',
      profile_display_ph: 'How others see you',
      profile_bio_lbl: 'About',
      profile_bio_ph: 'Short bio or your games…',
      profile_photo_lbl: 'Profile photo',
      profile_theme_lbl: 'App Theme',
      theme_dark: 'Dark',
      theme_light: 'Light',
      profile_photo_upload: 'Upload photo',
      profile_photo_reset: 'Use Telegram',
      profile_photo_max: 'Up to 2 MB',
      profile_save_main: 'Save profile',
      badge_player: '🎮 Player',
      badge_dev: '⚡ Developer',
      badge_premium: '✦ Premium',
      profile_upload_hint: 'How to add a game, steps and FAQ — on the Upload (+) tab.',
      admin_queue_title: 'In review',
      my_games_title: 'My games',
      no_games_grid: 'No games',
      delete_account_btn: 'Delete account',
      delete_account_hint: 'All your games, reviews, and posts will be deleted forever.',
      delete_account_confirm: 'Delete account and all data forever? This cannot be undone.',
      delete_account_done: 'Account deleted',

      games_lib_title: 'Games',
      games_lib_lead: 'Liked and recently played — two lists below.',
      games_liked: 'Liked',
      games_played: 'Played',

      search_title: 'Search',
      search_ph: 'Title or author…',
      genre_filter_lbl: 'Genre',

      author_screen_title: 'Developer',
      author_back_aria: 'Back',
      author_screen_back: '← Feed',
      author_games_title: "Author's games",
      author_follow: 'Follow',

      genre_all: 'All',
      genre_arcade: 'Arcade',
      genre_puzzle: 'Puzzle',
      genre_action: 'Action',
      genre_casual: 'Casual',
      genre_strategy: 'Strategy',
      genre_racing: 'Racing',
      genre_platform: 'Platformer',
      genre_other: 'Other',

      free: 'Free',
      game_fallback: 'Game',
      err_generic: 'Something went wrong. Try again.',
      err_network: 'No connection. Check the internet and try again.',
      err_load: 'Failed to load',
      try_again: 'Could not complete. Try again',
      copied: '🔗 Link copied',
      unsubscribed: 'Unfollowed',
      subscribed: 'Subscribed',
      share_text:
        '{title}{author} — a mini-game on SmolGame (Telegram feed, no forced ad before play). Open via link:',

      activity_title: 'Activity',
      activity_empty: 'Notifications about likes and reviews will appear here.',
      act_like: 'liked your game "{game}"',
      act_review: 'reviewed your game "{game}"',
      act_reply: 'replied to your review of "{game}"',
      act_follow: 'started following you',
      act_repost: 'shared your game "{game}"',
      profile_tab_wall: 'Wall',

      search_empty_title: 'Search games',
      search_empty_sub: 'Enter a title or handle. Genre — chips above.',
      search_no_results: 'Nothing found',
      search_no_hint: 'Change query or genre.',
      search_clear_genre_aria: 'Clear genre filter',

      liked_empty_title: 'Empty for now',
      liked_empty_sub: 'Like games in the feed — they appear here.',
      played_empty_title: 'Empty for now',
      played_empty_sub: 'Open games from the feed (Play) — the list fills up.',
      to_feed: 'To feed',
      loading: 'Loading…',
      load_failed_title: 'Failed to load',

      onboarding_step: 'Step {n} of {total}',
      onboarding_dob_title: 'Date of birth',
      onboarding_dob_lead:
        'SmolGame is a mini-game feed in Telegram (TikTok-style: swipe, play, follow authors). No forced ads before play. Upload your game from the Upload tab. Enter your date of birth to continue.',
      onboarding_parent: 'My parent or guardian allows me to create an account',
      onboarding_blocked: 'Unfortunately you cannot use the app.',
      onboarding_next: 'Next',
      onboarding_terms_title: 'Terms',
      onboarding_terms_text:
        'Sign-in via Telegram; only your SmolGame ID is public. On the platform — your own games and shared rules.',
      onboarding_accept: 'I accept the Privacy Policy and Terms of Service',
      onboarding_accept_html:
        'I accept the <strong>Privacy Policy</strong> and <strong>Terms of Service</strong>',
      onboarding_handle_title: 'Public ID',
      onboarding_handle_text: 'Shown to others instead of your Telegram @username.',
      onboarding_create: 'Create account',
      toast_dob: '⚠️ Enter date of birth',
      toast_parent: '⚠️ Parental consent required',
      toast_policy: '⚠️ Accept the policy and terms',
      toast_handle: '⚠️ 3–24 chars: a-z, 0-9, _',
      toast_register_fail: '⚠️ something went wrong',

      welcome_slide1_btn: 'Next',
      welcome_slide2_btn: 'Next',
      welcome_slide3_btn: 'Done',
      welcome_slide2_title: 'How to add a game',
      welcome_slide3_title: 'Done',
      welcome_browse: 'To feed',
      welcome_form: 'To form',
      welcome_step: 'Step {n} of {total}',

      help_acc1_sum: '1 Build a game with AI',
      help_acc2_sum: '2 Publish on GitHub Pages',
      help_acc3_sum: '3 Copy the link',
      faq_title: 'FAQ',

      moderation: 'In review',
      rejected: 'Rejected',
      pending_banner: 'In review',
      rejected_banner: 'Not approved',
      placeholder_loading: 'Loading…',
      placeholder_fail_title: 'Failed to load',
      placeholder_bad_url: 'Invalid URL',

      github_connected: '✅ GitHub connected',
      github_error: '⚠️ GitHub: ',
      github_error_generic: 'error',

      admin_approve: '✓ Approve',
      admin_reject: '✗ Reject',
      admin_delete: '🗑 Delete',

      author_loading: 'Loading...',
      author_loading_games: 'Loading games',
      author_anon: 'Anonymous',
      author_load_fail: 'Failed to load',
      author_no_games: 'No games',
      author_no_games_sub: 'This author has not published anything yet.',
      profile_err: 'profile error',

      premium_soon_locked: 'soon',
      premium_available: 'on',
      gh_hint_connected_detail:
        'Connect GitHub — the form appears below. Each Telegram session is confirmed in GitHub separately.',
      gh_hint_reauth:
        'GitHub access was not saved. Tap Sign in with GitHub again and allow publishing.',
      gh_hint_ready:
        'Paste code or files, fill the listing, and create the repository. Code goes to your public GitHub.',
      gh_files_none: 'No files selected',
      toast_open_telegram: '⚠️ Open the mini app from the Telegram bot',
      toast_gh_unlinked: '✅ GitHub unlinked',
      toast_gh_unlink_fail: '⚠️ could not unlink',
      toast_gh_config:
        '⚠️ GitHub: set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in Cloudflare → Worker → Variables',
      toast_gh_oauth_fail: '⚠️ could not start sign-in',
      gh_pick_files: '⚠️ Select files',
      gh_bad_filename: '⚠️ File names: Latin letters, digits, . _ - only: ',
      gh_need_index: '⚠️ index.html is required in the root',
      gh_need_title: '⚠️ Enter game title',
      gh_pick_genre: '⚠️ Pick a genre',
      gh_creating: '🔍 Creating GitHub repository…',
      gh_repo_ready: '✅ Repository created, page is live',
      gh_repo_pages_wait: '✅ Repository created — Pages may take 1–3 min',
      gh_submitting: '🔍 Submitting for review…',
      gh_need_repo: '⚠️ Create the repository first',
      gh_need_title_short: '⚠️ Enter title',
      game_sent_review: '✅ Game submitted for review',
      err_generic_short: '⚠️ error',
      err_submit_fail: '⚠️ something went wrong',
      cover_bad_url: '⚠️ Invalid cover URL',
      cover_upload_unavailable: '⚠️ File upload unavailable — use a cover URL or skip',
      cover_bad_url_http: '⚠️ Invalid cover URL (use https or http)',
      cover_file_unavailable: '⚠️ File unavailable — use a cover URL or skip',
      paste_html_empty: '⚠️ Paste the game HTML',
      paste_html_need_doctype: '⚠️ Full HTML document required (<!DOCTYPE html> or <html>)',
      paste_html_too_big: '⚠️ File too large',
      url_need_link_title: '⚠️ Fill in URL and title',
      url_need_genre: '⚠️ Pick a genre',
      url_need_valid: '⚠️ Need a working URL (https://… or http:// — we will use https)',
      url_need_telegram_detail:
        '⚠️ Open the mini app from the Telegram bot — otherwise the server cannot identify you.',
      url_submitting: '🔍 Submitting...',
      url_submitted: '✅ Submitted for review!',
      upload_restart: 'You can start upload again',
      review_lbl_game_url: 'Game URL:',
      review_lbl_title: 'Title:',
      review_lbl_desc: 'Description:',
      review_lbl_genre: 'Genre:',
      review_lbl_cover: 'Cover:',
      review_cover_file: 'file (uploads on submit)',
      review_cover_none: 'none',
      gh_bad_pages: 'Invalid GitHub Pages URL',
      gh_need_title_api: 'Enter game title',

      gd_reviews_loading: 'Loading…',
      gd_reviews_empty_drawer: 'No reviews yet — be the first.',
      gd_reviews_empty_page: 'No reviews yet.',
      gd_player: 'Player',
      gd_review_saved: '✅ Review saved',
      gd_review_empty: '⚠️ Write a review',
      gd_no_data: 'No data',
      gd_no_desc: 'No description.',
      gd_badge_rejected: 'Rejected',
      gd_in_catalog: 'In catalog since {date}',
      gd_pending_check: 'Card in review',
      gd_not_listed: 'Not in catalog',
      meta_genre: 'Genre',
      meta_likes: 'Likes',
      meta_plays: 'Plays',
      meta_date: 'Date',
      gd_author: 'Author',
      gd_owner_your_game: 'Your game',
      gd_edit: 'Edit',
      gd_open_in_feed: 'Open in feed',
      gd_delete: 'Delete',

      profile_game_actions_aria: 'Game actions',
      profile_empty_games_title: 'No games of yours yet',
      profile_empty_games_sub: 'Add one from the Upload tab (＋).',
      profile_editor_lead:
        'Feed card: title, description, genre, cover. The game URL does not change. After saving it goes to review again.',
      profile_cover_url_hint: 'https://… jpg/png',
      profile_choose_file: 'Choose file',
      profile_clear_cover: 'Remove cover',
      profile_game_url_label: 'Game URL:',
      profile_save_review: 'Save and submit for review',
      profile_open_in_feed_aria: 'Open in feed',
      profile_delete_game_aria: 'Delete game',
      profile_toast_name: '⚠️ Enter a display name',
      profile_saved: 'Saved',
      profile_photo_tg: '✅ Photo from Telegram',
      profile_photo_updated: '✅ Photo updated',
      profile_delete_fail: 'could not delete',
      profile_me_failed:
        'Could not load profile from the server. Pull down to refresh or tap Retry. The name below may come from Telegram until load succeeds.',
      profile_me_retry: 'Retry',
      profile_me_reload: 'Restart mini app',
      profile_delete_this: 'this game',
      profile_delete_confirm_generic: 'Remove this game from SmolGame? This cannot be undone.',
      profile_delete_confirm_named: 'Remove “{title}” from SmolGame? This cannot be undone.',
      profile_delete_gh_confirm:
        'Also delete the GitHub repository ({host})?\n\nOK — yes, remove the repo too (if you are the author and GitHub sign-in is saved).\nCancel — remove only the SmolGame listing.',
      profile_delete_done: '🗑 Game removed from SmolGame',
      profile_delete_repo_done: '; GitHub repository removed',
      profile_editor_no_edit: '⚠️ Rejected games cannot be edited',
      profile_editor_upload_cover: '⏳ Uploading cover…',
      profile_editor_saving: '⏳ Saving…',
      profile_editor_sent: '✅ Submitted for review',
      profile_editor_need_title: '⚠️ Enter a title',
      profile_cover_upload_fail: 'cover failed to upload',
      err_no_url: 'no URL',
      err_empty_response: 'empty response',
      err_error: 'error',
      genre_api_other: 'Прочее',

      report_to_admin: '⚑ Report: message the bot admin',
    },
  };

  function telegramSuggestedLang() {
    try {
      const langs = Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
      if (langs && String(langs).toLowerCase().startsWith('en')) return 'en';
    } catch (e) { /* ignore */ }
    return null;
  }

  function getLang() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v && SUPPORTED.includes(v)) return v;
    } catch (e) { /* ignore */ }
    const sug = telegramSuggestedLang();
    if (sug) return sug;
    return 'ru';
  }

  function setLang(lng) {
    const l = SUPPORTED.includes(lng) ? lng : 'ru';
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch (e) { /* ignore */ }
    document.documentElement.lang = l === 'en' ? 'en' : 'ru';
    
    // Toggle active class on all language switchers
    document.querySelectorAll('.lang-switch').forEach(btn => {
      const action = btn.getAttribute('data-action');
      const active = (l === 'ru' && action === 'set-lang-ru') || (l === 'en' && action === 'set-lang-en');
      btn.classList.toggle('lang-switch--active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    applyDomI18n();
    if (typeof window.refreshDynamicI18n === 'function') window.refreshDynamicI18n();
  }

  function t(key, vars) {
    const lng = getLang();
    let s = (STR[lng] && STR[lng][key]) || STR.ru[key] || key;
    if (vars && typeof s === 'string') {
      Object.keys(vars).forEach(k => {
        s = s.split(`{${k}}`).join(String(vars[k]));
      });
    }
    return s;
  }

  function applyDomI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
        el.placeholder = t(key);
      }
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      if (key) el.setAttribute('aria-label', t(key));
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) el.setAttribute('title', t(key));
    });
    const lr = document.getElementById('langSwitchRu');
    const le = document.getElementById('langSwitchEn');
    if (lr) lr.setAttribute('aria-pressed', getLang() === 'ru' ? 'true' : 'false');
    if (le) le.setAttribute('aria-pressed', getLang() === 'en' ? 'true' : 'false');
    if (lr) lr.classList.toggle('lang-switch--active', getLang() === 'ru');
    if (le) le.classList.toggle('lang-switch--active', getLang() === 'en');

    // Update modern lang pills
    const currentLang = getLang();
    document.querySelectorAll('.lang-option').forEach(p => {
      p.classList.toggle('active', p.dataset.lang === currentLang);
    });
  }

  function initI18n() {
    document.documentElement.lang = getLang() === 'en' ? 'en' : 'ru';
    applyDomI18n();
  }

  function genreLabelForKey(key) {
    const k = String(key || 'other');
    const mapKey = `genre_${k}`;
    return t(mapKey in STR.ru ? mapKey : 'genre_other');
  }

  /** Жанр из API (русская строка) → подпись в текущем языке UI */
  function genreDisplayFromApi(apiGenre) {
    const s = String(apiGenre || '').trim();
    if (!s || s === 'Все') return t('genre_all');
    try {
      const rows = typeof window !== 'undefined' && window.GENRES ? window.GENRES : [];
      const row = rows.find(x => x.label === s);
      if (row && row.key) return genreLabelForKey(row.key);
    } catch (e) { /* ignore */ }
    if (typeof genreIconKeyFromLabel === 'function') {
      const k = genreIconKeyFromLabel(s);
      return genreLabelForKey(k);
    }
    return s;
  }

  window.getLang = getLang;
  window.setLang = setLang;
  window.t = t;
  window.initI18n = initI18n;
  window.applyDomI18n = applyDomI18n;
  window.genreLabelForKey = genreLabelForKey;
  window.genreDisplayFromApi = genreDisplayFromApi;

  window.refreshDynamicI18n = function () {
    try {
      const tab = window._activeMainTab;
      if (tab && typeof window.t === 'function') {
        const map = {
          feed: 'nav_feed',
          games: 'nav_games',
          search: 'nav_search',
          profile: 'nav_profile',
          upload: 'nav_upload',
        };
        const k = map[tab];
        const el = document.getElementById('app-tab-chrome-label');
        if (k && el) el.textContent = window.t(k);
      }
    } catch (e) { /* ignore */ }
    if (typeof window.renderGenreFilter === 'function') {
      try {
        window.renderGenreFilter();
      } catch (e) { /* ignore */ }
    }
    if (typeof window.renderGenrePills === 'function') {
      try {
        if (document.getElementById('genrePills2')) window.renderGenrePills('genrePills2', 'url');
        if (document.getElementById('genrePillsGhCode')) window.renderGenrePills('genrePillsGhCode', 'ghCode');
      } catch (e) { /* ignore */ }
    }
    if (typeof window.onSearch === 'function') {
      try {
        const q = document.getElementById('searchInput')?.value || '';
        window.onSearch(q);
      } catch (e) { /* ignore */ }
    }
    if (typeof window.renderOnboarding === 'function') {
      try {
        const ob = document.getElementById('onboarding-screen');
        if (ob && ob.classList.contains('open')) window.renderOnboarding();
      } catch (e) { /* ignore */ }
    }
    if (typeof window.refreshWelcomeI18n === 'function') {
      try {
        window.refreshWelcomeI18n();
      } catch (e) { /* ignore */ }
    }
    if (typeof window.updateGithubUploadUi === 'function') {
      try {
        window.updateGithubUploadUi();
      } catch (e) { /* ignore */ }
    }
    if (typeof window.ghwzSetStep === 'function') {
      try {
        if (typeof window._ghWizardStep === 'number') window.ghwzSetStep(window._ghWizardStep);
      } catch (e) { /* ignore */ }
    }
    if (typeof window.refreshGhPublishReviewBox === 'function') {
      try {
        const flow = document.getElementById('github-publish-flow');
        if (flow && !flow.hidden) window.refreshGhPublishReviewBox();
      } catch (e) { /* ignore */ }
    }
    if (typeof window.loadGamesLibrary === 'function') {
      try {
        if (document.getElementById('games-library-screen')?.classList.contains('open')) {
          window.loadGamesLibrary();
        }
      } catch (e) { /* ignore */ }
    }
    if (typeof window.renderProfile === 'function') {
      try {
        if (document.getElementById('profile-screen')?.classList.contains('open')) {
          window.renderProfile();
        }
      } catch (e) { /* ignore */ }
    }
    if (typeof window.loadAdminPending === 'function') {
      try {
        if (document.body.classList.contains('is-admin')) window.loadAdminPending();
      } catch (e) { /* ignore */ }
    }
    if (typeof window.updateOverlay === 'function') {
      try {
        if (document.body.classList.contains('is-tab-feed') && window.GAMES && window.GAMES.length) {
          window.updateOverlay();
        }
      } catch (e) { /* ignore */ }
    }
    if (typeof window.renderFeed === 'function') {
      try {
        if (document.body.classList.contains('is-tab-feed') && window.GAMES && window.GAMES.length) {
          window.renderFeed();
        }
      } catch (e) { /* ignore */ }
    }
  };
})();
