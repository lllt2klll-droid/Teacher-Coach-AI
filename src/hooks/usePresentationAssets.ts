import { useEffect, useState } from 'react';
import type { PresentationAsset } from '@/types/domain';

/**
 * Creates object URLs for extracted slide images and revokes them when the
 * presentation changes or the viewer unmounts. The original PPTX is never
 * available at this point; only the locally stored image blobs are.
 */
export function usePresentationAssets(assets: PresentationAsset[] | null | undefined): Map<string, string> {
  const [urls, setUrls] = useState<Map<string, string>>(() => new Map());

  useEffect(() => {
    if (!assets?.length) {
      setUrls(new Map());
      return;
    }
    const next = new Map<string, string>();
    for (const asset of assets) {
      try {
        next.set(asset.id, URL.createObjectURL(asset.blob));
      } catch (error) {
        console.warn('[Teacher Coach AI] Could not create slide image URL:', error);
      }
    }
    setUrls(next);
    return () => {
      for (const url of next.values()) URL.revokeObjectURL(url);
    };
  }, [assets]);

  return urls;
}
