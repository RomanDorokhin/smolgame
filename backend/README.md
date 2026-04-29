# SmolGame backend

Cloudflare Workers + D1 (SQLite). Весь API живёт в одном Worker.

## Миграции D1 без клона репы на компьютере (GitHub Actions)

В корне репозитория есть workflow **«D1 migrate (remote)»**.

1. GitHub репозитория → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:
   - **`CLOUDFLARE_API_TOKEN`** — [Create API token](https://dash.cloudflare.com/profile/api-tokens) с правами на **D1 Edit** (и при необходимости **Workers**).
   - **`CLOUDFLARE_ACCOUNT_ID`** — на [Cloudflare Dashboard](https://dash.cloudflare.com/) справа в блоке **Account ID** (Overview).
2. **Actions** → слева **D1 migrate (remote)** → **Run workflow** → выбери файл (например `0002_oauth_states.sql`) → **Run workflow**.

Команда внутри — то же самое, что локально: `wrangler d1 execute smolgame --remote --file=...`.

---

## Что нужно один раз

1. **Установи Node.js** (если ещё нет): https://nodejs.org — бери LTS.
2. **Получи Telegram bot token**:
   - Открой в Telegram [@BotFather](https://t.me/BotFather)
   - `/newbot` → имя → username
   - Он пришлёт строку вида `123456:ABC-DEF...` — это токен, сохрани его.
   - Потом в `@BotFather`: `/mybots` → выбери бота → Bot Settings → Menu Button → Configure menu button → URL = `https://romandorokhin.github.io/smolgame/`.
3. **Залогинься в Cloudflare из терминала** (делается один раз):

   ```bash
   cd backend
   npm install
   npx wrangler login
   ```

   Откроется браузер, жми Allow.

## Первый деплой (один раз)

```bash
cd backend

# 1) Создать БД в облаке Cloudflare
npm run db:create
```

Команда выведет строку вида:

```
[[d1_databases]]
binding = "DB"
database_name = "smolgame"
database_id = "abcd1234-..."
```

Скопируй значение `database_id` и вставь в `wrangler.toml` вместо `PASTE_DATABASE_ID_AFTER_CREATE`, сохрани файл.

```bash
# 2) Накатить схему таблиц
npm run db:migrate:remote

# 3) Положить секрет бота (НЕ в wrangler.toml, секреты живут отдельно)
npx wrangler secret put TELEGRAM_BOT_TOKEN
# Вставь токен от BotFather, Enter.

# 4) Задеплоить
npm run deploy
```

В конце wrangler напишет URL, что-то вроде:

```
https://smolgame.dorokhin731.workers.dev
```

Если он совпадает с `API_BASE` в `js/api.js` — всё, фронт уже подключён.

Зайди в бота в Telegram, нажми Menu кнопку — откроется мини-апп, лента пустая.

### Ответ бота на `/start` в чате

Пока не настроен **webhook**, бот может молчать на `/start` — мини-апп при этом работает через Menu. Чтобы бот отвечал в личке:

1. Сгенерируй секрет (например `openssl rand -hex 24`) и сохрани в Worker:
   ```bash
   cd backend
   npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
   ```
2. Укажи URL воркера и вызови `setWebhook` (подставь свои значения):

   ```bash
   WEBHOOK_URL='https://<твой-worker>.workers.dev/api/telegram/webhook'
   SECRET='<тот же TELEGRAM_WEBHOOK_SECRET>'
   BOT_TOKEN='<токен от BotFather>'
   curl -fsS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
     -d "url=${WEBHOOK_URL}" \
     -d "secret_token=${SECRET}"
   ```

3. Проверка: `curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"`

Telegram шлёт `POST` с заголовком `X-Telegram-Bot-Api-Secret-Token` — он должен совпадать с секретом. Обработчик: `POST /api/telegram/webhook` → анимация логотипа (`sendAnimation` с URL `FRONTEND_ORIGIN` + `GITHUB_APP_PATH` + `/assets/telegram-start-logo.gif`), затем текст и кнопка **«Открыть SmolGame»**.

Анимация лежит в репозитории как **`assets/telegram-start-logo.gif`** (GitHub Pages отдаёт её по HTTPS). Пересборка из SVG-марки: `bash scripts/generate-telegram-start-gif.sh` (нужен `ffmpeg`). Сначала пуш в `main` (чтобы файл появился на Pages), потом **`npm run deploy`** воркера — иначе Telegram не сможет скачать GIF по URL.

### Обложки игр (файл)

Загрузка файла обложки идёт в **R2** (`IMAGES` binding) и публичный URL (`PUBLIC_IMAGE_BASE_URL` или `R2_PUBLIC_URL`). Если R2 не подключён, в форме **«Ссылка»** и на GitHub-ветке можно указать **HTTPS-ссылку на обложку** или отправить игру **без обложки**. Сам HTML игры на Worker **не хранится**: код публикуешь через **GitHub** (репозиторий + Pages) или даёшь готовую ссылку. Эндпоинт `POST /api/submit-html-game` отключён (410) — через премиум нельзя залить игровой HTML на сервер.

**После каждого `npm run deploy` смотри вывод Wrangler.** Должна быть строка **`R2 Buckets: IMAGES: smolgame-images`**. Если её нет (только D1 и Vars) — у тебя в `wrangler.toml` нет блока `[[r2_buckets]]` (часто это старый клон без `git pull`): тогда деплой **снимает** R2 с воркера → в приложении *image storage is not configured*. Сначала `git pull`, потом снова deploy.

Команда **`cd backend`** из домашней папки (`~`) всегда падает — сначала **`cd ~/smolgame`** (или где лежит репозиторий), потом **`cd backend`**. В zsh не вставляй строки вида `[[r2_buckets]]` в терминал как команду — `[[` это синтаксис shell; правь **`backend/wrangler.toml`** в редакторе.

**Премиум в мини-аппе:** в `wrangler.toml` (или Variables) задай **`PREMIUM_TG_IDS`** — список Telegram numeric id через запятую. Только эти пользователи видят вкладку «Премиум» и получают `isPremium: true` в `GET /api/me`. Содержимое вкладки — заглушка/описание; дополнительные премиум-фичи подключай в Worker по `user.isPremium` без приёма полного HTML игры.

**Загрузка на GitHub:** при каждом «Войти через GitHub» для текущего Telegram id сначала сбрасывается привязка в D1, затем после OAuth снова записываются логин и токен — один и тот же аккаунт GitHub можно подключать с **разных** Telegram, каждый раз с отдельным подтверждением в GitHub. Один GitHub может быть привязан к нескольким TG (на проде один раз выполни `migrations/0006_github_user_id_drop_unique_index.sql`, если раньше создавали уникальный индекс по `github_user_id`).

После OAuth Worker сохраняет **зашифрованный** access token в D1 (`github_access_token_enc`, ключ — `GITHUB_CLIENT_SECRET`). Эндпоинт `POST /api/github/publish-game` создаёт публичный репозиторий, заливает файлы, включает GitHub Pages и возвращает URL `https://<login>.github.io/<repo>/`. Нужна миграция:

```bash
cd backend
npm run db:migrate:remote:github-token
```

После миграции пользователь должен **ещё раз** пройти «Войти через GitHub», чтобы токен записался в базу.

**Экран «Игры» (лайки + недавно играл):** `GET /api/me/games-library` — один ответ `{ likedGames, playedGames }`, меньше задержки, чем два отдельных запроса. Фронт использует его с fallback на `/api/me/liked-games` и `/api/me/played-games`.

**Отвязать GitHub:** в мини-аппе кнопка вызывает `POST /api/auth/github/unlink` (очищает `github_user_id`, `github_login`, `github_access_token_enc`).

**Старая D1 без `display_name`:** если профиль автора падает с `no such column: display_name`, выполни `npm run db:migrate:remote:display-name` в `backend/` (файл `migrations/0007_users_display_name.sql`). Worker сам перебирает варианты SQL, но колонка нужна для редактирования имени в профиле.

**Старая D1 без `bio`:** `npm run db:migrate:remote:bio` (`migrations/0008_users_bio.sql`). В коде профиль автора обходит отсутствие `bio`, но для PATCH профиля колонка в БД всё равно нужна.

**Отзывы к играм:** таблица `game_reviews`. Один раз на проде:

```bash
cd backend
npm run db:migrate:remote:reviews
```

Без миграции отзывы в UI пустые; `POST` вернёт 503 с подсказкой.

Если в D1 в таблице `users` **нет** колонок `github_user_id` и `github_login` (старая база), OAuth не сможет сохранить привязку — выполни:

```bash
cd backend
npm run db:migrate:remote:github-user-columns
```

(Если SQLite вернёт «duplicate column» на одной из строк — колонка уже есть, остальное всё равно примени вручную в консоли D1 по одной строке из `migrations/0004_github_user_columns.sql`.)

## Что дальше

Просто пилим код.

- Я правлю код → коммит в main → ты в терминале:

  ```bash
  cd backend
  npm run deploy
  ```

  Это занимает ~5 секунд.

- Если изменилась схема БД (добавилась таблица/колонка):

  ```bash
  npm run db:migrate:remote
  ```

- Если при входе через GitHub ошибка **`no such table: oauth_states`**:

  ```bash
  cd backend
  npm run db:migrate:remote:oauth
  ```

- Если API публикации пишет про **`github_access_token_enc`** — накати миграцию токена и повтори вход через GitHub:

  ```bash
  npm run db:migrate:remote:github-token
  ```

## Как добавить первую игру

1. Открой мини-апп в Telegram.
2. Вкладка «Загрузить» → «Ссылка» → вбей любой https URL с игрой.
3. Нажми «Отправить на модерацию» — игра уйдёт в очередь.
4. Вкладка «Профиль» — у тебя (админа) будет виден блок «На модерации» с кнопками «Одобрить / Отклонить».
5. Одобрил → игра появляется в ленте у всех.

## Структура

```
backend/
  wrangler.toml      — конфиг Workers + D1 + env-переменные
  schema.sql         — схема БД
  package.json       — скрипты (dev / deploy / db:*)
  src/
    index.js         — точка входа + роутер
    http.js          — CORS, JSON-хелперы, генератор id
    telegram.js      — валидация initData (HMAC-SHA256)
    auth.js          — authenticate() + upsertUser()
    validators.js    — валидация submit-payload
    routes.js        — все эндпоинты (feed, me, submit, like, follow, play, admin/*)
```

## Эндпоинты

| Метод  | Путь                              | Описание                            |
|--------|-----------------------------------|-------------------------------------|
| GET    | `/api/feed?offset=0&limit=15`     | Лента с пагинацией; в ответе `hasMore` |
| GET    | `/api/me`                         | Профиль текущего юзера + статы      |
| PATCH  | `/api/me`                         | Имя, bio, публичный ID, фото (JSON)  |
| GET    | `/api/me/games`                   | Все свои игры (включая pending)     |
| GET    | `/api/games/:id`                  | Одна игра (для открытия из профиля)  |
| GET    | `/api/auth/github/start`          | JSON `{ url }` — открыть в браузере (OAuth) |
| GET    | `/auth/github/callback`          | Callback GitHub, затем редирект на `/auth/github/done` |
| GET    | `/auth/github/done`              | HTML с ссылкой `t.me/...` в Telegram (не GitHub Pages) |

OAuth `state` подписывается HMAC (`GITHUB_CLIENT_SECRET`) и содержит Telegram id — не зависит от таблицы `oauth_states` в D1.
| POST   | `/api/submit`                     | Отправить игру на модерацию         |
| POST   | `/api/games/:id/like`             | Лайк                                |
| DELETE | `/api/games/:id/like`             | Убрать лайк                         |
| POST   | `/api/games/:id/play`             | +1 просмотр                         |
| POST   | `/api/users/:id/follow`           | Подписаться                         |
| DELETE | `/api/users/:id/follow`           | Отписаться                          |
| GET    | `/api/admin/pending`              | Очередь модерации (только админ)    |
| POST   | `/api/admin/approve/:id`          | Одобрить                            |
| POST   | `/api/admin/reject/:id`           | Отклонить                           |

Все запросы отправляют заголовок `x-telegram-init-data`. Сервер проверяет подпись и достаёт из неё юзера.

### GitHub OAuth (привязка аккаунта)

Если в мини-аппе тост **«GitHub OAuth не настроен на сервере»** — на Worker **нет** `GITHUB_CLIENT_ID` или **`npm run deploy` стёр переменные из Dashboard**. У `wrangler deploy` источник правды — **`wrangler.toml` + secrets**; то, что добавили только в UI Cloudflare без записи в toml, при следующем деплое **пропадает**. Держи **`GITHUB_CLIENT_ID` в `[vars]`** в `wrangler.toml`, а **`GITHUB_CLIENT_SECRET`** — через `wrangler secret put`.

1. [GitHub → Settings → Developer settings → OAuth Apps](https://github.com/settings/developers) → **New OAuth App**.
2. **Authorization callback URL** — **ровно** такой URL (подставь свой Worker из `npm run deploy` или из `js/api.js` → `PROD_API_BASE`):
   - `https://<твой-worker>.workers.dev/auth/github/callback`  
   Если в `wrangler.toml` задан `GITHUB_OAUTH_REDIRECT_BASE`, callback в GitHub должен совпадать с `{GITHUB_OAUTH_REDIRECT_BASE}/auth/github/callback`.
3. **Cloudflare** → Workers → **smolgame** → **Settings** → **Variables**:
   - **GITHUB_CLIENT_ID** — вставь **Client ID** из GitHub (тип **Plaintext** ок: это не секрет).
   - **GITHUB_CLIENT_SECRET** — **Encrypt** и вставь секрет из GitHub, либо в терминале:  
     `cd backend && npx wrangler secret put GITHUB_CLIENT_SECRET`
4. В D1 добавь колонки и таблицу (если база старая): см. комментарии в `schema.sql` — `github_user_id`, `github_login`, таблица `oauth_states`, индекс уникальности по `github_user_id`.
5. `npm run deploy`. В мини-аппе: «Загрузить» → «Войти через GitHub».

Локально: скопируй `backend/.env.example` → `backend/.dev.vars`, заполни id/secret, `npx wrangler dev`.
