import { NextFrameIcon, PauseIcon, PlayIcon, PrevFrameIcon } from "./Icons";
import { useI18n } from "../i18n/I18nProvider";
import { formatTimecode } from "../lib/format";

interface Props {
  time: number;
  duration: number | null;
  playing: boolean;
  disabled?: boolean;
  onTogglePlay: () => void;
  onStep: (direction: -1 | 1) => void;
}

export function PlayerControls({ time, duration, playing, disabled, onTogglePlay, onStep }: Props) {
  const { t } = useI18n();

  return (
    <div className="player-controls">
      <div className="player-buttons">
        <button
          type="button"
          className="icon-button"
          aria-label={t.player.previousFrame}
          title={t.player.previousFrame}
          disabled={disabled}
          onClick={() => onStep(-1)}
        >
          <PrevFrameIcon size={18} />
        </button>
        <button
          type="button"
          className="play-button"
          aria-label={playing ? t.player.pause : t.player.play}
          title={playing ? t.player.pause : t.player.play}
          disabled={disabled}
          onClick={onTogglePlay}
        >
          {playing ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={t.player.nextFrame}
          title={t.player.nextFrame}
          disabled={disabled}
          onClick={() => onStep(1)}
        >
          <NextFrameIcon size={18} />
        </button>
      </div>
      <div className="timecode mono">
        <span className="timecode-current">{formatTimecode(time)}</span>
        {duration !== null && <span className="timecode-total">/ {formatTimecode(duration)}</span>}
      </div>
    </div>
  );
}
