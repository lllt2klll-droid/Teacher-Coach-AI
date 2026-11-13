import { useId } from 'react';
import type { StudentAvatarState } from '@/types/domain';
import { cn } from '@/lib/utils';

const SKIN_TONES = ['#F7D7BE', '#F0C6A6', '#E7B48D', '#D79E76', '#C68D66'];
const HAIR_COLORS = ['#3A2E2B', '#4B382A', '#2C2A2E', '#5A4033', '#232B3A', '#6B4B35'];

interface StudentAvatarProps {
  name: string;
  color: string;
  seed: number;
  state?: StudentAvatarState;
  size?: number;
  className?: string;
}

/** Deterministic 2D illustrated avatar. Purely fictional, generated locally. */
export function StudentAvatar({ name, color, seed, state = 'idle', size = 88, className }: StudentAvatarProps) {
  const uid = useId().replace(/[:]/g, '');
  const skin = SKIN_TONES[seed % SKIN_TONES.length];
  const hair = HAIR_COLORS[seed % HAIR_COLORS.length];
  const hairStyle = seed % 5;
  const shirt = color;
  const shirtDark = 'color-mix(in srgb, ' + color + ' 72%, #2c3a57)';
  const cheer = state === 'speaking' || state === 'hand';
  const confused = state === 'confused';
  const thinking = state === 'thinking';
  const working = state === 'working';
  const bgId = `avatar-bg-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 140 140"
      role="img"
      aria-label={`${name}${state === 'hand' ? ' đang giơ tay' : state === 'speaking' ? ' đang nói' : ''}`}
      className={cn('shrink-0', className)}
    >
      <defs>
        <linearGradient id={bgId} x1="14" y1="10" x2="128" y2="132" gradientUnits="userSpaceOnUse">
          <stop stopColor={color} stopOpacity="0.24" />
          <stop offset="1" stopColor={color} stopOpacity="0.08" />
        </linearGradient>
      </defs>
      <circle cx="70" cy="70" r="68" fill={`url(#${bgId})`} stroke="#fff" strokeWidth="3" opacity="0.98" />
      <circle cx="26" cy="34" r="5" fill={color} opacity="0.24" />
      <circle cx="116" cy="36" r="3.5" fill={color} opacity="0.3" />
      <circle cx="24" cy="106" r="3" fill={color} opacity="0.22" />
      <path d="M114 100l2.2 4.6 5 .5-3.7 3.4 1 5-4.5-2.6-4.5 2.6 1-5-3.7-3.4 5-.5 2.2-4.6z" fill="#F6C86B" opacity="0.8" />

      {/* raised hand for hand state */}
      {state === 'hand' && (
        <g className="animate-hand">
          <path d="M104 96c7-4 12-11 12-20" stroke={shirtDark} strokeWidth="9" strokeLinecap="round" fill="none" />
          <circle cx="116" cy="71" r="8" fill={skin} stroke="#fff" strokeWidth="2" />
          <path d="M112 66v-7M116 64v-8M120 66v-7" stroke={skin} strokeWidth="3.4" strokeLinecap="round" />
        </g>
      )}

      {/* body */}
      <path d="M28 140c2-23 17-34 42-34s40 11 42 34H28z" fill={shirt} stroke="#fff" strokeWidth="2.5" />
      <path d="M55 108c3 9 7 13 15 13s12-4 15-13" fill={skin} />
      <path d="M59 107c6 4 16 4 22 0v9c-5 5-17 5-22 0v-9z" fill="#fff" opacity="0.9" />
      <path d="M63 128c2 4 5 6 7 6s5-2 7-6" stroke={shirtDark} strokeWidth="2.6" strokeLinecap="round" fill="none" />

      {/* pigtails behind head */}
      {hairStyle === 2 && (
        <>
          <circle cx="38" cy="62" r="12" fill={hair} />
          <circle cx="102" cy="62" r="12" fill={hair} />
          <circle cx="37" cy="51" r="4" fill="#F18BA6" />
          <circle cx="103" cy="51" r="4" fill="#F18BA6" />
        </>
      )}

      {/* ears */}
      <circle cx="40" cy="67" r="7" fill={skin} />
      <circle cx="100" cy="67" r="7" fill={skin} />

      {/* head */}
      <circle cx="70" cy="65" r="31" fill={skin} />
      <path d="M50 79c2 10 9 17 20 17s18-7 20-17c-6 6-13 8-20 8s-14-2-20-8z" fill="#000" opacity="0.035" />

      {/* hair */}
      {hairStyle === 0 && (
        <path
          d="M39 64c0-19 13-31 31-31s31 12 31 31c0 2-1 3-2 2-2-12-12-19-29-19s-27 7-29 19c-1 1-2 0-2-2z"
          fill={hair}
        />
      )}
      {hairStyle === 1 && (
        <>
          <path d="M39 64c0-19 13-31 31-31s31 12 31 31v13c0 6-5 8-8 4V67c-3-9-11-14-23-14s-20 5-23 14v13c-3 4-8 2-8-4V64z" fill={hair} />
          <path d="M47 48c5-9 14-14 23-14 10 0 18 5 23 14-7-5-14-7-23-7s-16 2-23 7z" fill="#fff" opacity="0.1" />
        </>
      )}
      {hairStyle === 2 && (
        <path d="M39 65c-1-20 13-32 31-32s32 12 31 32c-2-11-12-18-31-18s-29 7-31 18z" fill={hair} />
      )}
      {hairStyle === 3 && (
        <>
          <circle cx="70" cy="27" r="12" fill={hair} />
          <path d="M39 64c0-19 13-31 31-31s31 12 31 31c0 2-1 3-2 2-2-12-12-19-29-19s-27 7-29 19c-1 1-2 0-2-2z" fill={hair} />
        </>
      )}
      {hairStyle === 4 && (
        <>
          <circle cx="48" cy="48" r="14" fill={hair} />
          <circle cx="70" cy="39" r="15" fill={hair} />
          <circle cx="92" cy="48" r="14" fill={hair} />
          <path d="M39 64c0-19 13-31 31-31s31 12 31 31c0 2-1 3-2 2-2-12-12-19-29-19s-27 7-29 19c-1 1-2 0-2-2z" fill={hair} />
        </>
      )}

      {/* cheeks */}
      <ellipse cx="49" cy="77" rx="6.5" ry="4" fill="#F19B9B" opacity="0.4" />
      <ellipse cx="91" cy="77" rx="6.5" ry="4" fill="#F19B9B" opacity="0.4" />

      {/* eyes / brows / mouth */}
      {confused ? (
        <>
          <path d="M51 59c3-3 7-3 10 0M79 59c3-3 7-3 10 0" stroke={hair} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="56" cy="67" r="3.2" fill="#33302F" />
          <circle cx="84" cy="67" r="3.2" fill="#33302F" />
          <path d="M62 82c3-3 5 3 8 0s5 3 8 0" stroke="#7A5140" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <path d="M99 76c2 3 2 6 0 9-2-3-2-6 0-9z" fill="#8FB2FF" />
        </>
      ) : thinking ? (
        <>
          <path d="M52 60c3-2 7-2 10 0M78 60c3-2 7-2 10 0" stroke={hair} strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="57" cy="66" r="3.2" fill="#33302F" />
          <circle cx="83" cy="66" r="3.2" fill="#33302F" />
          <circle cx="58" cy="64" r="1" fill="#fff" />
          <circle cx="84" cy="64" r="1" fill="#fff" />
          <path d="M65 80h10" stroke="#7A5140" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="105" cy="46" r="3" fill={color} opacity="0.55" />
          <circle cx="112" cy="38" r="2" fill={color} opacity="0.4" />
        </>
      ) : working ? (
        <>
          <path d="M52 61c3 2 7 2 10 0M78 61c3 2 7 2 10 0" stroke={hair} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M53 67c2 2 5 2 7 0M80 67c2 2 5 2 7 0" stroke="#33302F" strokeWidth="2.6" strokeLinecap="round" fill="none" />
          <path d="M64 81c4 3 8 3 12 0" stroke="#7A5140" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <path d="M52 61c3-2 7-2 10 0M78 61c3-2 7-2 10 0" stroke={hair} strokeWidth="2.2" strokeLinecap="round" />
          <ellipse cx="57" cy="67" rx="3.4" ry={cheer ? 2.6 : 3.8} fill="#33302F" />
          <ellipse cx="83" cy="67" rx="3.4" ry={cheer ? 2.6 : 3.8} fill="#33302F" />
          <circle cx="58" cy="65.5" r="1" fill="#fff" />
          <circle cx="84" cy="65.5" r="1" fill="#fff" />
          {state === 'speaking' ? (
            <ellipse cx="70" cy="81" rx="5.5" ry="4.5" fill="#B55F5F" opacity="0.85" />
          ) : cheer ? (
            <path d="M62 79c4 6 12 6 16 0" stroke="#7A5140" strokeWidth="2.6" strokeLinecap="round" fill="none" />
          ) : (
            <path d="M64 81c3 2.5 8 2.5 12 0" stroke="#7A5140" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          )}
        </>
      )}

      {/* speaking sound waves */}
      {state === 'speaking' && (
        <g stroke={color} strokeWidth="2.2" strokeLinecap="round" opacity="0.75">
          <path d="M108 48c4 3 6 7 6 12" />
          <path d="M114 43c6 5 9 11 9 17" />
        </g>
      )}
    </svg>
  );
}
