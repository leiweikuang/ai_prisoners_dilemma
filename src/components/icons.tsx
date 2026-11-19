/** Authored line icons: one 1.75px stroke, square caps, matching the glazing bars. */
type P = { className?: string; size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "square" as const,
  strokeLinejoin: "miter" as const,
  "aria-hidden": true,
});

export const IconBack = ({ className, size = 16 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M20 12H5M11 6l-6 6 6 6" />
  </svg>
);

export const IconForward = ({ className, size = 16 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </svg>
);

export const IconPlay = ({ className, size = 16 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M7 5v14l11-7z" />
  </svg>
);

export const IconStep = ({ className, size = 16 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M6 5v14l9-7zM18 5v14" />
  </svg>
);

export const IconPause = ({ className, size = 16 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M8 5v14M16 5v14" />
  </svg>
);

export const IconRestart = ({ className, size = 16 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5" />
  </svg>
);

export const IconFile = ({ className, size = 16 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6" />
  </svg>
);

export const IconDownload = ({ className, size = 16 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
);

export const IconSeal = ({ className, size = 16 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5zM12 15v2" />
  </svg>
);
