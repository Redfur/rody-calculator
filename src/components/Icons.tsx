import type { ReactNode } from 'react';

function Svg({ size = 18, width = 2, children }: { size?: number; width?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const ChevronLeft = () => (
  <Svg width={2.2}>
    <path d="M15 18l-6-6 6-6" />
  </Svg>
);
export const ChevronRight = () => (
  <Svg width={2.2}>
    <path d="M9 18l6-6-6-6" />
  </Svg>
);
export const DropIcon = () => (
  <Svg>
    <path d="M12 3c-3 4.5-6 7.7-6 11a6 6 0 0 0 12 0c0-3.3-3-6.5-6-11z" />
  </Svg>
);
export const ClockIcon = () => (
  <Svg>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2.5M9 2h6" />
  </Svg>
);
export const SyringeIcon = () => (
  <Svg>
    <path d="M18 2l4 4M17 7l3-3M19 9l-8.7 8.7a1 1 0 0 1-1.4 0l-2.6-2.6a1 1 0 0 1 0-1.4L15 5M9 11l4 4M5 19l-3 3M14 4l6 6" />
  </Svg>
);
export const CopyIcon = () => (
  <Svg>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Svg>
);
export const CheckIcon = () => (
  <Svg width={2.4}>
    <path d="M20 6L9 17l-5-5" />
  </Svg>
);
export const AlertIcon = () => (
  <Svg>
    <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </Svg>
);
export const PillIcon = () => (
  <Svg>
    <path d="M10.5 20.5a4.95 4.95 0 0 1-7-7l6-6a4.95 4.95 0 0 1 7 7z" />
    <path d="M8.5 8.5l7 7" />
  </Svg>
);
export const ChartIcon = () => (
  <Svg>
    <path d="M3 3v18h18" />
    <path d="M7 15l4-5 3 3 5-7" />
  </Svg>
);
export const InfoIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Svg>
);
export const PlusIcon = () => (
  <Svg width={2.2}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const DripIcon = () => (
  <Svg>
    <path d="M8 2h8M9 2v6l-3 4v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8l-3-4V2" />
    <path d="M7 14h10" />
  </Svg>
);
export const PersonIcon = () => (
  <Svg>
    <circle cx="12" cy="7" r="4" />
    <path d="M5 21v-1a7 7 0 0 1 14 0v1" />
  </Svg>
);
