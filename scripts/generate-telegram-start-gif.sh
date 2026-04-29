#!/usr/bin/env bash
# Пересобрать анимацию для /start в Telegram (sendAnimation). Нужны: ffmpeg, brand/telegram-start-mark.svg
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p assets
ffmpeg -y -stream_loop -1 -i brand/telegram-start-mark.svg -t 0.9 \
  -vf "fps=10,format=rgba,rotate=2*PI*t/0.9:c=black@0:ow=256:oh=256,scale=180:180" \
  -c:v gif -f gif assets/telegram-start-logo.gif
ls -la assets/telegram-start-logo.gif
