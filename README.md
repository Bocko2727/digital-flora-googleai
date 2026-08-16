# Digital Flora

## Работен поток за нови снимки

1. Качвай JPG, JPEG, PNG или WEBP файлове само в `images/review/`.
2. GitHub Action `Analyze herbarium review images` изпраща всеки нов файл към Gemini чрез тайния ключ `GEMINI_API_KEY` и записва чернова в `data/review-results.json`.
3. Всеки резултат е само предварителна оценка със статус `needs_human_review`; не е научно потвърден профил и не се публикува автоматично.
4. След ботаническа проверка премествай одобрените изображения в `images/herbarium/` и добавяй профила им към хербария.

Не поставяй API ключове в repository-то, HTML или JavaScript. Ключът остава единствено в GitHub Actions Secrets.
