import { useId } from 'react';
import { cn } from '@/lib/utils';

interface CoachBotProps {
  size?: number;
  mood?: 'happy' | 'thinking' | 'waving';
  floating?: boolean;
  className?: string;
}

/** Original cute coach robot illustration (no external assets). */
export function CoachBot({ size = 150, mood = 'happy', floating = true, className }: CoachBotProps) {
  const uid = useId().replace(/[:]/g, '');
  const bodyId = `bot-body-${uid}`;
  const faceId = `bot-face-${uid}`;
  const accentId = `bot-accent-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 220 220"
      fill="none"
      role="img"
      aria-label="Trợ lý Teacher Coach AI"
      className={cn(floating && 'animate-float', className)}
    >
      <defs>
        <linearGradient id={bodyId} x1="45" y1="90" x2="178" y2="205" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E4EBFF" />
        </linearGradient>
        <linearGradient id={faceId} x1="60" y1="55" x2="160" y2="135" gradientUnits="userSpaceOnUse">
          <stop stopColor="#31446B" />
          <stop offset="1" stopColor="#1F2C49" />
        </linearGradient>
        <linearGradient id={accentId} x1="55" y1="70" x2="170" y2="160" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8FB2FF" />
          <stop offset="1" stopColor="#9C8CF5" />
        </linearGradient>
      </defs>

      <ellipse cx="110" cy="203" rx="56" ry="9" fill="#5A6F9E" opacity="0.14" />

      {/* antenna */}
      <path d="M110 38V24" stroke="#A69AF5" strokeWidth="4" strokeLinecap="round" />
      <circle cx="110" cy="19" r="8" fill="#FFD27D" stroke="#fff" strokeWidth="2.5" />
      <path d="M110 11.5v-4M118 19h4M102 19h-4" stroke="#F0B85A" strokeWidth="2" strokeLinecap="round" />

      {/* head */}
      <rect x="42" y="34" width="136" height="108" rx="46" fill={bodyId} stroke="#FFFFFF" strokeWidth="3" />
      <rect x="42" y="34" width="136" height="108" rx="46" stroke="#C9D7F8" strokeWidth="1" opacity="0.7" />
      <rect x="56" y="47" width="108" height="80" rx="32" fill={faceId} />
      <rect x="58" y="49" width="104" height="36" rx="24" fill="#FFFFFF" opacity="0.08" />

      {/* eyes */}
      {mood === 'thinking' ? (
        <>
          <circle cx="89" cy="82" r="5.5" fill="#E9F1FF" />
          <circle cx="132" cy="82" r="5.5" fill="#E9F1FF" />
          <circle cx="91" cy="79.5" r="2.4" fill="#8FB2FF" />
          <circle cx="134" cy="79.5" r="2.4" fill="#8FB2FF" />
          <path d="M79 68c5-4 13-4 18-1M124 67c5-3 12-3 17 0" stroke="#8FB2FF" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="89" cy="81" rx="7" ry="8" fill="#E9F1FF" />
          <ellipse cx="132" cy="81" rx="7" ry="8" fill="#E9F1FF" />
          <circle cx="91" cy="78" r="2.5" fill="#4778D8" />
          <circle cx="134" cy="78" r="2.5" fill="#4778D8" />
          <circle cx="87" cy="84" r="1.3" fill="#fff" opacity="0.7" />
          <circle cx="130" cy="84" r="1.3" fill="#fff" opacity="0.7" />
        </>
      )}

      {/* smile */}
      <path d="M98 100c6 7 18 7 24 0" stroke="#8FB2FF" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="73" cy="95" r="5" fill="#8FB2FF" opacity="0.28" />
      <circle cx="148" cy="95" r="5" fill="#8FB2FF" opacity="0.28" />

      {/* ears */}
      <rect x="29" y="70" width="15" height="34" rx="7.5" fill={accentId} />
      <rect x="176" y="70" width="15" height="34" rx="7.5" fill={accentId} />

      {/* body */}
      <path d="M58 150c0-12 10-20 24-22h56c14 2 24 10 24 22v30c0 13-10 22-24 22H82c-14 0-24-9-24-22v-30z" fill={bodyId} stroke="#FFFFFF" strokeWidth="3" />
      <path d="M62 155c0-12 10-19 22-20h52c12 1 22 8 22 20v25c0 12-9 20-22 20H84c-13 0-22-8-22-20v-25z" stroke="#C9D7F8" strokeWidth="1" opacity="0.8" />
      <circle cx="110" cy="172" r="16" fill={accentId} opacity="0.98" />
      <path d="M110 163v18M104 168l12 8M116 168l-12 8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
      <circle cx="110" cy="172" r="21" stroke="#8FB2FF" strokeWidth="1.4" strokeDasharray="3 4" opacity="0.5" />

      {/* arms */}
      <path
        d={mood === 'waving' ? 'M58 158c-13 2-25 12-25 24 0 5 4 8 8 6 5-3 4-11 16-16' : 'M57 160c-14 2-24 11-24 22'}
        stroke="#E9EFFF"
        strokeWidth="15"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={mood === 'waving' ? 'M58 158c-13 2-25 12-25 24 0 5 4 8 8 6 5-3 4-11 16-16' : 'M57 160c-14 2-24 11-24 22'}
        stroke="#C9D7F8"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.65"
      />
      <path d="M163 160c14 2 25 11 25 22" stroke="#E9EFFF" strokeWidth="15" strokeLinecap="round" />
      <path d="M163 160c14 2 25 11 25 22" stroke="#C9D7F8" strokeWidth="1" strokeLinecap="round" opacity="0.65" />
      <circle cx="33" cy="186" r="7.5" fill="#fff" stroke="#C9D7F8" />
      <circle cx="188" cy="185" r="7.5" fill="#fff" stroke="#C9D7F8" />

      {/* floating star */}
      <g opacity="0.95">
        <path
          d="M184 52l3.2 7.2 7.8.8-5.9 5.2 1.7 7.7-6.8-4-6.8 4 1.7-7.7-5.9-5.2 7.8-.8L184 52z"
          fill="#FFD27D"
          stroke="#fff"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </g>
      {mood === 'thinking' && (
        <g>
          <circle cx="184" cy="120" r="4" fill="#A69AF5" opacity="0.8" />
          <circle cx="193" cy="110" r="3" fill="#A69AF5" opacity="0.6" />
          <circle cx="198" cy="101" r="2" fill="#A69AF5" opacity="0.45" />
        </g>
      )}
    </svg>
  );
}
