"use client";

import { useEffect, useState } from "react";

/**
 * Types example searches into an empty search box, one after another.
 *
 * A blank box asks "what can I even search for here?"; watching "Маникюр с
 * гел лак" appear answers it without a line of help text. It stops the moment
 * the field has focus or a value, and under "reduce motion" it shows each
 * phrase whole instead of typing it.
 */
export function useTypingPlaceholder(phrases: string[], active: boolean) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (!active || phrases.length === 0) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let phrase = 0;
    let length = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    function tick() {
      const current = phrases[phrase % phrases.length];

      if (reduce) {
        setText(current);
        phrase += 1;
        timer = setTimeout(tick, 2600);
        return;
      }

      if (!deleting) {
        length += 1;
        setText(current.slice(0, length));
        if (length >= current.length) {
          deleting = true;
          timer = setTimeout(tick, 1700);
          return;
        }
        timer = setTimeout(tick, 55 + Math.random() * 45);
        return;
      }

      length -= 1;
      setText(current.slice(0, Math.max(length, 0)));
      if (length <= 0) {
        deleting = false;
        phrase += 1;
        timer = setTimeout(tick, 350);
        return;
      }
      timer = setTimeout(tick, 28);
    }

    timer = setTimeout(tick, 900);
    return () => clearTimeout(timer);
  }, [active, phrases]);

  return active ? text : "";
}
