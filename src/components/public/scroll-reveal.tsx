"use client";

import { useEffect } from "react";

const SELECTOR = "[data-reveal], [data-reveal-stagger]";

/**
 * Reveals marked sections as they scroll into view: `data-reveal` (fade and rise, or
 * `data-reveal="image"` for an image wipe) and `data-reveal-stagger` (children one after
 * another). Styles live in globals.css. Nothing is hidden until this has run, elements already
 * on screen are shown at once, and visitors who prefer reduced motion see no animation.
 * Pages added later (client navigation) are picked up by the MutationObserver.
 */
export function ScrollReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    const reveal = (el: Element) => el.setAttribute("data-revealed", "");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          reveal(entry.target);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    const prepare = (el: Element) => {
      if (el.hasAttribute("data-revealed") || el.hasAttribute("data-reveal-watching")) return;
      el.setAttribute("data-reveal-watching", "");
      if (el.hasAttribute("data-reveal-stagger")) {
        Array.from(el.children).forEach((child, i) => (child as HTMLElement).style.setProperty("--i", String(i)));
      }
      // Already (partly) visible: show immediately, no flash.
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) reveal(el);
      else observer.observe(el);
    };

    document.querySelectorAll(SELECTOR).forEach(prepare);
    document.documentElement.classList.add("reveal-ready");

    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches(SELECTOR)) prepare(node);
          node.querySelectorAll(SELECTOR).forEach(prepare);
        });
      }
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutations.disconnect();
      document.documentElement.classList.remove("reveal-ready");
    };
  }, []);

  return null;
}
