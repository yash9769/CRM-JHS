import { useEffect, type RefObject } from "react";

/**
 * Closes an open dropdown/popover when the user clicks or taps outside `ref`,
 * or presses Escape. Used for all non-modal popups (notification bell, user
 * menu, quick actions, saved views, etc.) — full-screen modals use `Modal`
 * in `ui.tsx`, whose backdrop already closes on outside click.
 */
export function useClickOutside(ref: RefObject<HTMLElement | null>, isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, ref]);
}
