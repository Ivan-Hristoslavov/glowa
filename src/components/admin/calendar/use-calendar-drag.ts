"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Dragging and resizing on the calendar, with a pointer rather than HTML5
 * drag-and-drop.
 *
 * HTML5 `draggable` does not fire on touch, so on the tablet propped up at the
 * front desk - which is where a salon actually runs its day - appointments
 * could not be moved at all. Pointer events cover mouse, pen and finger with
 * one code path.
 *
 * Nothing is written until the pointer is released. While it is down the
 * caller draws a preview, so a mis-drag costs nothing and there is no
 * round-trip per pixel.
 */

export type DragMode = "move" | "resize";

export type DragTarget = {
  id: string;
  /** Minutes from local midnight where the appointment currently starts. */
  startMinutes: number;
  durationMinutes: number;
  dateKey: string;
  staffProfileId: string | null;
};

export type DragPreview = {
  id: string;
  mode: DragMode;
  startMinutes: number;
  durationMinutes: number;
  dateKey: string;
  staffProfileId: string | null;
};

type Options = {
  pxPerMinute: number;
  snapMinutes: number;
  /** Bounds of the rendered day, so a drag cannot leave the grid. */
  minMinutes: number;
  maxMinutes: number;
  enabled: boolean;
  /** Called once on release, and only when something actually changed. */
  onCommit: (preview: DragPreview) => void;
};

/** How far the pointer must travel before this counts as a drag and not a tap. */
const DRAG_THRESHOLD_PX = 4;

export function useCalendarDrag({
  pxPerMinute,
  snapMinutes,
  minMinutes,
  maxMinutes,
  enabled,
  onCommit,
}: Options) {
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const state = useRef<{
    mode: DragMode;
    origin: DragTarget;
    startX: number;
    startY: number;
    moved: boolean;
    latest: DragPreview;
  } | null>(null);

  const snap = useCallback(
    (minutes: number) => Math.round(minutes / snapMinutes) * snapMinutes,
    [snapMinutes],
  );

  const begin = useCallback(
    (event: React.PointerEvent, mode: DragMode, origin: DragTarget) => {
      if (!enabled) return;
      // Secondary buttons open context menus; leave them alone.
      if (event.button !== 0 && event.pointerType === "mouse") return;

      event.stopPropagation();
      state.current = {
        mode,
        origin,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        latest: { ...origin, mode },
      };
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled) return;

    function findColumn(x: number, y: number) {
      const element = document
        .elementsFromPoint(x, y)
        .find((node) => node instanceof HTMLElement && node.dataset.calendarColumn);
      if (!(element instanceof HTMLElement)) return null;
      return {
        dateKey: element.dataset.calendarDate ?? null,
        staffProfileId: element.dataset.calendarStaff ?? null,
      };
    }

    function onMove(event: PointerEvent) {
      const current = state.current;
      if (!current) return;

      const dx = Math.abs(event.clientX - current.startX);
      const dy = Math.abs(event.clientY - current.startY);
      if (!current.moved && dx < DRAG_THRESHOLD_PX && dy < DRAG_THRESHOLD_PX) return;

      // Past the threshold this is a drag, so stop the page from scrolling
      // under the finger.
      current.moved = true;
      event.preventDefault();

      const deltaMinutes = (event.clientY - current.startY) / pxPerMinute;

      if (current.mode === "resize") {
        const duration = Math.max(
          snapMinutes,
          snap(current.origin.durationMinutes + deltaMinutes),
        );
        current.latest = {
          ...current.origin,
          mode: "resize",
          durationMinutes: Math.min(duration, maxMinutes - current.origin.startMinutes),
        };
      } else {
        const rawStart = snap(current.origin.startMinutes + deltaMinutes);
        const startMinutes = Math.min(
          Math.max(rawStart, minMinutes),
          maxMinutes - current.origin.durationMinutes,
        );
        const column = findColumn(event.clientX, event.clientY);
        current.latest = {
          ...current.origin,
          mode: "move",
          startMinutes,
          dateKey: column?.dateKey ?? current.origin.dateKey,
          staffProfileId: column?.staffProfileId ?? current.origin.staffProfileId,
        };
      }

      setPreview(current.latest);
    }

    function onUp() {
      const current = state.current;
      state.current = null;
      setPreview(null);
      if (!current || !current.moved) return;

      const { latest, origin } = current;
      const unchanged =
        latest.startMinutes === origin.startMinutes &&
        latest.durationMinutes === origin.durationMinutes &&
        latest.dateKey === origin.dateKey &&
        latest.staffProfileId === origin.staffProfileId;

      if (!unchanged) onCommit(latest);
    }

    // Non-passive so `preventDefault` can actually stop the scroll.
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [enabled, pxPerMinute, snapMinutes, snap, minMinutes, maxMinutes, onCommit]);

  /** True while a drag is in flight, so the caller can suppress its click. */
  const isDragging = preview !== null;

  return { begin, preview, isDragging };
}
