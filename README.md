# SmolGame

Telegram Mini App в формате TikTok-ленты для коротких HTML5-игр.

## Структура

```
index.html, styles.css, js/   — фронтенд (живёт на GitHub Pages)
backend/                      — API на Cloudflare Workers + D1
```

---

## 🚀 Как обновляются изменения

> Короткий ответ: **фронт обновляется сам, бэк — одной командой.**

Когда я правлю код и пушу в `main`:

### Если менялся только фронт (`index.html`, `styles.css`, `js/*`, картинки)

**Ничего делать не надо.** GitHub Pages видит пуш в `main` и автоматически выкатывает новую версию сайта. Обычно это занимает 30–90 секунд.

На телефоне в Telegram может кэшироваться — достаточно **свайпнуть мини-апп сверху вниз** (pull-to-refresh) или закрыть/открыть заново.

### Если менялся бэкенд (`backend/**`)

**Нужно одной командой выкатить на Cloudflare.** Делается у тебя на Маке:

```bash
cd smolgame/backend
git pull                 # подтянуть мои свежие изменения
npm run deploy           # залить на Cloudflare
```

Это ~5 секунд. Всё.

### Если менялась схема БД (`backend/schema.sql`)

Редкий случай. Тогда дополнительно:

```bash
npm run db:migrate:remote
```

### Как понять что менялось?

Я в каждом ответе пишу что трогал. Если упомянул файлы из `backend/` — нужно `npm run deploy`. Если только `js/`, `styles.css`, `index.html` — ничего делать не нужно, ждёшь минуту и обновляешь мини-апп.

**Если вдруг забыл — не страшно**, просто запусти `npm run deploy`, ничего не сломается.

---

## Включить GitHub Pages (один раз)

1. Settings → Pages
2. Source: **Deploy from a branch**
3. Branch: `main`, folder `/` (root)
4. Save

Сайт будет на `https://romandorokhin.github.io/smolgame/`.

## Бэкенд — первая настройка

См. [`backend/README.md`](backend/README.md).
