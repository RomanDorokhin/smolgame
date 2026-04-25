# SmolGame

Telegram Mini App в формате TikTok-ленты для коротких HTML5-игр.

## Структура

```
index.html, styles.css, js/   — фронтенд (GitHub Pages)
backend/                      — API на Cloudflare Workers + D1
```

## Фронт

Статика, без сборки. Деплоится GitHub Pages из main-ветки. URL: `https://romandorokhin.github.io/smolgame/`.

### Включить GitHub Pages

Один раз:
1. Settings → Pages
2. Source: Deploy from a branch
3. Branch: `main` / root
4. Save

## Бэк

См. [`backend/README.md`](backend/README.md).
