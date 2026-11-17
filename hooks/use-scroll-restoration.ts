"use client"
import { useEffect, useCallback } from "react"

export function useScrollRestoration() {
  // Save and restore scroll position
  useEffect(() => {
    const savedScroll = sessionStorage.getItem('masterFormScrollTop');
    if (savedScroll) {
      setTimeout(() => {
        const container = document.querySelector('[data-slot="dialog-content"]') || document.querySelector('.overflow-y-auto');
        if (container) {
          container.scrollTop = parseInt(savedScroll, 10);
        }
      }, 50);
      sessionStorage.removeItem('masterFormScrollTop');
    }
  }, []);

  const handleOpenEffectiveDatesView = useCallback((originalCallback: Function) => {
    return (...args: any[]) => {
      const container = document.querySelector('[data-slot="dialog-content"]') || document.querySelector('.overflow-y-auto');
      if (container) {
        sessionStorage.setItem('masterFormScrollTop', container.scrollTop.toString());
        // Immediately reset to top BEFORE history view mounts, so it opens at top
        container.scrollTop = 0;
      }
      originalCallback(...args);
    };
  }, []);

  return handleOpenEffectiveDatesView;
}
