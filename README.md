# Simple GIF Editor

Веб-сервіс для перетворення відео на GIF. У планах: обрізання за часом,
накладання тексту та кілька режимів стиснення з прогнозом розміру файла.

## Стек

- **Бекенд:** Python 3.12, FastAPI, FFmpeg (`palettegen` / `paletteuse`)
- **Фронтенд:** React + Vite + TypeScript (з'явиться на етапі 5)
- **Інфраструктура:** Docker, docker-compose, GitHub Actions

## Структура

```
backend/             FastAPI-застосунок і тести (pytest)
frontend/            веб-інтерфейс (поки порожньо)
docker/              Dockerfile-и та docker-compose
.github/workflows/   CI: лінт і тести
```

## Запуск

### Docker

```bash
docker compose -f docker/docker-compose.yml up --build
```

Сервіс буде доступний на <http://localhost:8000>, інтерактивна документація
API на <http://localhost:8000/docs>.

### Локально

Потрібні Python 3.12+ і FFmpeg у `PATH`.

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

## API

### `POST /api/convert`

Приймає відео (`multipart/form-data`) і повертає GIF.

| Поле    | Тип  | За замовчуванням | Опис                              |
|---------|------|------------------|-----------------------------------|
| `file`  | файл | обов'язкове      | відео (mp4, mov, webm тощо)       |
| `fps`   | int  | `10`             | частота кадрів, 1–30              |
| `width` | int  | `480`            | ширина в пікселях, 16–1920; висота підбирається пропорційно |

```bash
curl -F "file=@video.mp4" -F "fps=12" -F "width=320" \
     http://localhost:8000/api/convert -o result.gif
```

Коди помилок: `400` порожній файл, `413` файл завеликий, `422` некоректні
параметри або файл не вдалося конвертувати.

### `GET /health`

Перевірка, що сервіс працює.

## Налаштування

| Змінна             | За замовчуванням | Опис                               |
|--------------------|------------------|------------------------------------|
| `MAX_UPLOAD_MB`    | `100`            | максимальний розмір відео          |
| `FFMPEG_TIMEOUT_S` | `120`            | ліміт часу на одну конвертацію     |
| `FFMPEG_BIN`       | `ffmpeg`         | шлях до FFmpeg                     |

## Розробка

```bash
cd backend
ruff check . && ruff format --check .
pytest
```

`main` захищена, кожен етап робиться в окремій гілці через pull request.

## Етапи

- [x] 1. Каркас репозиторію, Docker, CI, базова конвертація відео → GIF
- [ ] 2. Обрізання за часом
- [ ] 3. Накладання тексту (шрифт, розмір, позиція, колір)
- [ ] 4. Пресети стиснення та прогноз розміру
- [ ] 5. Веб-інтерфейс
- [ ] 6. Підготовка до хостингу: ліміти, очищення файлів, черга
