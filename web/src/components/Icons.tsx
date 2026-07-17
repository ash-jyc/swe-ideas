import type { SVGProps } from 'react';

// Minimal lucide-style icon set (1.75px stroke, 24-grid), inlined so there is
// no icon-font or extra dependency. Size defaults to 16.

type P = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 16, ...props }: P): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    ...props,
  };
}

export const IconPlay = (p: P) => (
  <svg {...base(p)}><path d="M6 4.5v15l13-7.5-13-7.5Z" /></svg>
);
export const IconStop = (p: P) => (
  <svg {...base(p)}><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
);
export const IconReload = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 12a9 9 0 1 0 2.6-6.4" /><path d="M3 4v4h4" />
  </svg>
);
export const IconDeploy = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3 5 10h4v7h6v-7h4L12 3Z" /><path d="M8 21h8" />
  </svg>
);
export const IconGithub = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
  </svg>
);
export const IconSettings = (p: P) => (
  <svg {...base(p)}>
    <line x1="4" y1="7" x2="20" y2="7" /><circle cx="9" cy="7" r="2.2" />
    <line x1="4" y1="17" x2="20" y2="17" /><circle cx="15" cy="17" r="2.2" />
  </svg>
);
export const IconTerminal = (p: P) => (
  <svg {...base(p)}><path d="m5 8 4 4-4 4" /><line x1="12" y1="16" x2="19" y2="16" /></svg>
);
export const IconPlus = (p: P) => (
  <svg {...base(p)}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
export const IconArrowLeft = (p: P) => (
  <svg {...base(p)}><line x1="19" y1="12" x2="5" y2="12" /><path d="m12 19-7-7 7-7" /></svg>
);
export const IconEye = (p: P) => (
  <svg {...base(p)}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const IconCode = (p: P) => (
  <svg {...base(p)}><path d="m16 18 6-6-6-6" /><path d="m8 6-6 6 6 6" /></svg>
);
export const IconHistory = (p: P) => (
  <svg {...base(p)}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></svg>
);
export const IconShield = (p: P) => (
  <svg {...base(p)}><path d="M12 22c5-2 8-6 8-11V5l-8-3-8 3v6c0 5 3 9 8 11Z" /></svg>
);
export const IconTrash = (p: P) => (
  <svg {...base(p)}><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="M6 7l1 12h10l1-12" /></svg>
);
export const IconExternal = (p: P) => (
  <svg {...base(p)}><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M20 14v6H4V4h6" /></svg>
);
export const IconCopy = (p: P) => (
  <svg {...base(p)}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>
);
export const IconSend = (p: P) => (
  <svg {...base(p)}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7Z" /></svg>
);
export const IconSparkle = (p: P) => (
  <svg {...base(p)}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></svg>
);
export const IconChevron = (p: P) => (
  <svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>
);
