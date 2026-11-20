/** Ukrainian UI text. */

import type { Messages } from "./en";

const plural = new Intl.PluralRules("uk");

/** Pick the Ukrainian word form for a count: 1 колір, 2 кольори, 5 кольорів. */
function pluralize(count: number, one: string, few: string, many: string): string {
  const rule = plural.select(count);
  return rule === "one" ? one : rule === "few" ? few : many;
}

export const uk: Messages = {
  app: {
    title: "Simple GIF Editor",
    tagline: "Перетворіть відео на GIF: обріжте його, додайте підпис, оберіть розмір.",
    unplayable:
      "Ваш браузер не може відтворити цей формат, тому прев'ю немає. Ви все одно можете вручну задати фрагмент і конвертувати відео.",
    conversionFailed: "Не вдалося конвертувати",
    uploading: (percent) => `Завантаження ${percent}%`,
    converting: "Конвертація…",
    cancel: "Скасувати",
    convert: "Конвертувати в GIF",
  },

  language: {
    label: "Мова",
  },

  units: {
    b: "Б",
    kb: "КБ",
    mb: "МБ",
    px: "пкс",
    seconds: "с",
  },

  filePicker: {
    chooseAnother: "Вибрати інше відео",
    dropTitle: "Перетягніть відео сюди або натисніть, щоб вибрати",
    formats: "MP4, MOV, WebM та інші формати, які читає FFmpeg",
  },

  trim: {
    title: "Обрізання",
    gifLength: (time) => `Тривалість GIF ${time}`,
    start: "Початок",
    end: "Кінець",
    useCurrentFrame: "Поточний кадр",
    endOfVideo: "кінець відео",
    videoLength: (time) =>
      `Тривалість відео ${time}. Вибраний фрагмент відтворюється по колу.`,
  },

  text: {
    title: "Текст",
    remove: "Прибрати",
    caption: "Підпис",
    captionPlaceholder: "Необов'язково. Переноси рядків зберігаються.",
    position: "Позиція",
    positionGroup: "Позиція тексту",
    positions: {
      "top-left": "вгорі ліворуч",
      top: "вгорі",
      "top-right": "вгорі праворуч",
      center: "по центру",
      "bottom-left": "внизу ліворуч",
      bottom: "внизу",
      "bottom-right": "внизу праворуч",
    },
    fontSize: "Розмір шрифту",
    color: "Колір",
    outline: "Обведення",
    outlineColor: "Колір обведення",
    backgroundBox: "Підкладка",
    boxColor: "Колір підкладки",
    opacity: (percent) => `Непрозорість ${percent}%`,
    showFrom: "Показати з",
    hideAt: "Сховати на",
    startPlaceholder: "початок",
    endPlaceholder: "кінець",
    note: "Час рахується від початку GIF. Розміри вказано в пікселях GIF. Прев'ю наближене.",
  },

  compression: {
    title: "Якість і розмір",
    modePreset: "Пресет",
    modeTarget: "Цільовий розмір",
    maxSize: "Максимальний розмір GIF",
    targetNote:
      "Пресет нижче — відправна точка. Спершу зменшуються кольори, потім частота кадрів і ширина, доки GIF не вкладеться в розмір.",
    presetGroup: "Пресет стиснення",
    presets: {
      high: { title: "Висока", note: "Найкраща якість, найбільший файл" },
      medium: { title: "Середня", note: "Збалансовано" },
      low: { title: "Низька", note: "Найменший файл" },
    },
    fineTune: "Тонке налаштування",
    custom: "змінено",
    leaveEmpty: "Залиште поле порожнім, щоб узяти значення з пресету.",
    fps: "Кадр/с",
    width: "Ширина",
    colors: "Кольори",
    lossy: "Lossy",
    reset: "Скинути до пресету",
  },

  summary: {
    fps: (fps) => `${fps} кадр/с`,
    colors: (colors) => `${colors} ${pluralize(colors, "колір", "кольори", "кольорів")}`,
    lossy: (level) => `lossy ${level}`,
  },

  estimate: {
    title: "Орієнтовний розмір",
    cantReachSize: "Цього розміру не досягти",
    cantEstimate: "Не вдалося оцінити розмір",
    fromSamples: "за зразками",
    estimating: "Оцінюємо",
  },

  result: {
    title: "Ваш GIF",
    close: "Закрити",
    imageAlt: "Готовий GIF",
    madeIn: (seconds) => `створено за ${seconds} с`,
    download: (filename) => `Завантажити ${filename}`,
  },

  errors: {
    tooLarge: "Відео завелике для сервера.",
    unreachable: "Не вдалося з'єднатися із сервером. Бекенд запущено?",
    http: (status) => `Сервер повернув помилку (HTTP ${status}).`,
  },

  validation: {
    startNegative: "Початок не може бути меншим за 0.",
    startAfterVideo: "Початок має бути раніше за кінець відео.",
    endBeforeStart: "Кінець має бути пізніше за початок.",
    endAfterVideo: "Кінець виходить за межі відео.",
    textTooLong: (max) => `Текст може мати щонайбільше ${max} символів.`,
    fontSize: (min, max) => `Розмір шрифту має бути від ${min} до ${max}.`,
    outline: (min, max) => `Обведення має бути від ${min} до ${max}.`,
    textAfterGif: "Текст має з'явитися до кінця GIF.",
    textHiddenBeforeShown: "Текст має зникнути після того, як з'явиться.",
    overrideRange: (label, min, max) => `${label}: значення має бути від ${min} до ${max}.`,
    overrideLabels: {
      fps: "Кадр/с",
      width: "Ширина",
      colors: "Кольори",
      lossy: "Рівень lossy",
    },
    targetTooSmall: (min) => `Цільовий розмір має бути щонайменше ${min} КБ.`,
  },
};
