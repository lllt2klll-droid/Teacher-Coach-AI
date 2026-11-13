import { useId } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface LogoProps {
  collapsed?: boolean;
  size?: number;
  className?: string;
}

export function Logo({ collapsed, size = 46, className }: LogoProps) {
  const uid = useId().replace(/[:]/g, '');
  const gradient = `logo-gradient-${uid}`;
  return (
    <Link to="/" className={cn('flex items-center gap-3 rounded-2xl outline-none', className)} aria-label="Teacher Coach AI – Trang chủ">
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className="shrink-0 drop-shadow-sm">
        <defs>
          <linearGradient id={gradient} x1="8" y1="8" x2="56" y2="58" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8FB2FF" />
            <stop offset="1" stopColor="#7B6CF0" />
          </linearGradient>
        </defs>
        <rect x="5" y="9" width="54" height="46" rx="19" fill={`url(#${gradient})`} />
        <rect x="13" y="19" width="38" height="26" rx="11" fill="#fff" opacity="0.96" />
        <circle cx="24.5" cy="30.5" r="4" fill="#4778D8" />
        <circle cx="39.5" cy="30.5" r="4" fill="#4778D8" />
        <circle cx="23.2" cy="29" r="1.2" fill="#fff" />
        <circle cx="38.2" cy="29" r="1.2" fill="#fff" />
        <path d="M27 38.5c3.3 2.8 6.7 2.8 10 0" stroke="#4778D8" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M32 9V4" stroke="#A69AF5" strokeWidth="3" strokeLinecap="round" />
        <circle cx="32" cy="3" r="4" fill="#FFD27D" stroke="#fff" strokeWidth="1.5" />
        <rect x="1" y="23" width="5" height="14" rx="2.5" fill="#A69AF5" />
        <rect x="58" y="23" width="5" height="14" rx="2.5" fill="#A69AF5" />
      </svg>
      {!collapsed && (
        <span className="min-w-0">
          <span className="block font-display text-[19px] font-bold leading-[1.05] tracking-[-0.02em] text-[var(--text)]">
            Teacher
            <br />
            <span className="accent-gradient-text">Coach AI</span>
          </span>
          <span className="mt-1 hidden text-[10px] font-medium leading-tight text-[var(--muted)] sm:block">
            Luyện giảng thông minh
          </span>
        </span>
      )}
    </Link>
  );
}
