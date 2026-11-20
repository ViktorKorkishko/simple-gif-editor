import { useI18n } from "../i18n/I18nProvider";
import { LANGUAGES, LANGUAGE_NAMES } from "../i18n/language";

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();

  return (
    <div className="language-switcher" role="group" aria-label={t.language.label}>
      {LANGUAGES.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          title={LANGUAGE_NAMES[option].name}
          aria-label={LANGUAGE_NAMES[option].name}
          aria-pressed={language === option}
          className={language === option ? "selected" : ""}
          onClick={() => setLanguage(option)}
        >
          {LANGUAGE_NAMES[option].short}
        </button>
      ))}
    </div>
  );
}
