/** Stroke icons used across the editor. They inherit the text color and are hidden from screen readers. */

import type { ReactNode, SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

function icon(paths: ReactNode, defaults: SVGProps<SVGSVGElement> = {}) {
  return function Icon({ size = 16, ...props }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        focusable={false}
        {...defaults}
        {...props}
      >
        {paths}
      </svg>
    );
  };
}

export const FilmIcon = icon(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M7 5v14M17 5v14M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4" />
  </>,
  { strokeWidth: 1.75 },
);

export const ImageIcon = icon(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="8.5" cy="10" r="1.5" />
    <path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4" />
  </>,
  { strokeWidth: 1.25 },
);

export const GlobeIcon = icon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.5 2.6 3.7 5.4 3.7 8.5s-1.2 5.9-3.7 8.5c-2.5-2.6-3.7-5.4-3.7-8.5s1.2-5.9 3.7-8.5z" />
  </>,
  { strokeWidth: 1.75 },
);

export const DownloadIcon = icon(<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" />);
export const UploadIcon = icon(<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19h14" />);
export const CloseIcon = icon(<path d="M6 6l12 12M18 6 6 18" />);
export const PlusIcon = icon(<path d="M12 5v14M5 12h14" />);
export const TextIcon = icon(<path d="M5 6.5V5h14v1.5M12 5v14M9.5 19h5" />);
export const TrashIcon = icon(
  <path d="M5 7h14M10 7V5h4v2M7 7l.8 12h8.4L17 7M10 11v5M14 11v5" />,
  { strokeWidth: 1.75 },
);
export const PrevFrameIcon = icon(<path d="M7 6v12M18 6.5v11l-8-5.5z" />, { strokeWidth: 1.75 });
export const NextFrameIcon = icon(<path d="M17 6v12M6 6.5v11l8-5.5z" />, { strokeWidth: 1.75 });
export const PlayIcon = icon(<path d="M8.5 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" />);
export const PauseIcon = icon(<path d="M8.5 6v12M15.5 6v12" />, { strokeWidth: 2.75 });
export const MarkInIcon = icon(<path d="M13 5H8v14h5" />, { strokeWidth: 2.5 });
export const MarkOutIcon = icon(<path d="M11 5h5v14h-5" />, { strokeWidth: 2.5 });
export const BackIcon = icon(<path d="M15 6l-6 6 6 6" />);

/** The app mark: a rounded square in the accent color with a play triangle. */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden focusable={false}>
      <rect x="1" y="1" width="24" height="24" rx="7" fill="var(--accent)" />
      <path d="M10.5 8.5v9l7.5-4.5z" fill="var(--on-accent)" />
    </svg>
  );
}
