"use client";

import { useSyncExternalStore } from "react";

/**
 * The current time as a shared, ticking store.
 *
 * Reading the clock during render is impure (the React Compiler lint refuses
 * `Date.now()` there), and setting it from an effect body is refused too. A
 * store is the honest shape: the clock is external state that changes on its
 * own. The server has no "now" worth rendering, so it snapshots `null` and the
 * client fills it in after hydration - no mismatch.
 */
const TICK_MS = 30_000;

const listeners = new Set<() => void>();
let current = 0;
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === null) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      for (const notify of listeners) notify();
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot() {
  if (current === 0) current = Date.now();
  return current;
}

function getServerSnapshot() {
  return null;
}

export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
