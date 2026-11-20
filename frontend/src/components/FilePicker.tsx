import { useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";

interface Props {
  onFile: (file: File) => void;
  compact?: boolean;
}

export function FilePicker({ onFile, compact }: Props) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  if (compact) {
    return (
      <>
        <button type="button" className="button secondary" onClick={() => input.current?.click()}>
          {t.filePicker.chooseAnother}
        </button>
        <input
          ref={input}
          type="file"
          accept="video/*"
          hidden
          onChange={(event) => {
            pick(event.target.files);
            event.target.value = "";
          }}
        />
      </>
    );
  }

  return (
    <div
      className={`dropzone${dragging ? " dragging" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          input.current?.click();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        pick(event.dataTransfer.files);
      }}
    >
      <div className="dropzone-icon" aria-hidden>
        🎬
      </div>
      <p className="dropzone-title">{t.filePicker.dropTitle}</p>
      <p className="muted">{t.filePicker.formats}</p>
      <input
        ref={input}
        type="file"
        accept="video/*"
        hidden
        onChange={(event) => {
          pick(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
