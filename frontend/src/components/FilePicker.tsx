import { useRef, useState } from "react";
import { FilmIcon, UploadIcon } from "./Icons";
import { useI18n } from "../i18n/I18nProvider";

interface Props {
  onFile: (file: File) => void;
  /** A small header button instead of the big drop zone. */
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

  const fileInput = (
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
  );

  if (compact) {
    return (
      <>
        <button
          type="button"
          className="icon-button"
          aria-label={t.header.replaceVideo}
          title={t.header.replaceVideo}
          onClick={() => input.current?.click()}
        >
          <UploadIcon />
        </button>
        {fileInput}
      </>
    );
  }

  return (
    <div
      className={`dropzone${dragging ? " dragging" : ""}`}
      // The whole zone opens the picker for mouse users; the button below is the keyboard path.
      onClick={() => input.current?.click()}
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
      <FilmIcon size={40} className="dropzone-icon" />
      <p className="dropzone-title">{t.filePicker.dropTitle}</p>
      <p className="note">{t.filePicker.formats}</p>
      <button
        type="button"
        className="button primary"
        onClick={(event) => {
          event.stopPropagation();
          input.current?.click();
        }}
      >
        <UploadIcon size={18} />
        <span>{t.filePicker.choose}</span>
      </button>
      {fileInput}
    </div>
  );
}
