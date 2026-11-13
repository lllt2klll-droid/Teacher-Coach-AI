import { useEffect } from 'react';

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · Teacher Coach AI` : 'Teacher Coach AI';
  }, [title]);
}
