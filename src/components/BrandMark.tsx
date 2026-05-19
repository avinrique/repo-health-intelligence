"use client";

export default function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bm-stroke" x1="0" y1="0" x2="28" y2="28">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#67e8f9" />
        </linearGradient>
        <radialGradient id="bm-core" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#a78bfa" stopOpacity="0.6" />
          <stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* outer ring */}
      <circle cx="14" cy="14" r="11" stroke="url(#bm-stroke)" strokeWidth="1.5" />
      {/* heartbeat line */}
      <path
        d="M4 14 L9 14 L11 8 L14 20 L17 11 L19 14 L24 14"
        stroke="url(#bm-stroke)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* core glow */}
      <circle cx="14" cy="14" r="11" fill="url(#bm-core)" opacity="0.45" />
    </svg>
  );
}
