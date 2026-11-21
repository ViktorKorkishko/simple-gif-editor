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
    unplayable:
      "Ваш браузер не може відтворити цей формат, тому прев'ю немає. Ви все одно можете вручну задати фрагмент і експортувати відео.",
  },

  header: {
    replaceVideo: "Замінити відео",
    export: "Експорт",
  },

  language: {
    label: "Мова інтерфейсу",
  },

  units: {
    b: "Б",
    kb: "КБ",
    mb: "МБ",
    px: "пкс",
    seconds: "с",
  },

  filePicker: {
    dropTitle: "Перетягніть відео сюди або натисніть, щоб вибрати",
    formats: "MP4, MOV, WebM та інші формати, які читає FFmpeg",
    choose: "Вибрати відео",
  },

  player: {
    previousFrame: "Попередній кадр",
    nextFrame: "Наступний кадр",
    play: "Відтворити",
    pause: "Пауза",
  },

  timeline: {
    label: "Шкала часу",
    setStart: "Початок тут",
    setEnd: "Кінець тут",
    clip: "Фрагмент",
    clipStart: "Початок фрагмента",
    clipEnd: "Кінець фрагмента",
    endOfVideo: "кінець",
    scrub: "Вибрати кадр на шкалі",
    video: "Відео",
    text: "Текст",
  },

  text: {
    title: "Текст",
    caption: "Текст",
    captionPlaceholder: "Введіть підпис, щоб додати його в GIF. Переноси рядків зберігаються.",
    remove: "Видалити текст",
    timeRange: "Проміжок",
    from: "від",
    to: "до",
    showFrom: "Показати з",
    hideAt: "Сховати на",
    startPlaceholder: "початок",
    endPlaceholder: "кінець",
    size: "Розмір",
    color: "Колір",
    customColor: "Свій колір",
    hexColor: "Колір у форматі HEX",
    swatches: {
      white: "Білий",
      yellow: "Жовтий",
      red: "Червоний",
      blue: "Блакитний",
      black: "Чорний",
    },
    position: "Позиція",
    positionGroup: "Позиція тексту",
    positions: {
      "top-left": "Вгорі ліворуч",
      top: "Вгорі по центру",
      "top-right": "Вгорі праворуч",
      center: "По центру",
      "bottom-left": "Внизу ліворуч",
      bottom: "Внизу по центру",
      "bottom-right": "Внизу праворуч",
    },
    outline: "Обведення",
    outlineColor: "Колір обведення",
    backgroundBox: "Підкладка під текстом",
    boxColor: "Колір підкладки",
    opacity: "Непрозорість",
    note: "Час рахується від початку GIF. Розміри вказано в пікселях GIF. Прев'ю наближене.",
  },

  exporter: {
    title: "Експорт",
    close: "Закрити",
    closeMenu: "Закрити меню експорту",
    format: "Формат",
    formats: {
      gif: "Працює всюди",
      webp: "Менший файл",
      mp4: "Краща якість",
    },
    modeGroup: "Як вибрати якість",
    modePreset: "Пресет",
    modeTarget: "Цільовий розмір",
    quality: "Якість",
    presets: {
      high: "Висока",
      medium: "Середня",
      low: "Низька",
    },
    maxSize: "Максимальний розмір файла",
    targetNote:
      "Вибрана якість — відправна точка. Спершу знижується якість, потім частота кадрів і ширина, доки файл не вкладеться в розмір.",
    width: "Ширина, пкс",
    fps: "Кадрів за секунду",
    more: "Більше налаштувань",
    colors: "Кольори",
    lossy: "Стиснення з втратами",
    compression: "Стиснення",
    compressionNote: "Більше значення дає менший файл нижчої якості.",
    leaveEmpty: "Залиште поле порожнім, щоб узяти значення з пресету.",
    reset: "Скинути до пресету",
    frameSize: "Розмір кадру",
    frameCount: "Кількість кадрів",
    estimate: "Прогноз розміру файла",
    fromSamples: "оцінка за зразками",
    estimating: "Оцінюємо",
    cantReachSize: "Цього розміру не досягти",
    cantEstimate: "Не вдалося оцінити розмір",
    conversionFailed: "Не вдалося конвертувати",
    uploading: (percent) => `Завантаження ${percent}%`,
    converting: "Конвертація…",
    cancel: "Скасувати",
    submit: (format) => `Експортувати ${format}`,
  },

  result: {
    title: (format) => `Ваш ${format}`,
    back: "Назад до налаштувань",
    imageAlt: "Готовий файл",
    madeIn: (seconds) => `створено за ${seconds} с`,
    download: "Завантажити",
  },

  summary: {
    fps: (fps) => `${fps} кадр/с`,
    colors: (colors) => `${colors} ${pluralize(colors, "колір", "кольори", "кольорів")}`,
    lossy: (level) => `lossy ${level}`,
    compression: (level) => `стиснення ${level}`,
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
