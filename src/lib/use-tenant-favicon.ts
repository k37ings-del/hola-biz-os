import { useEffect } from "react";

/**
 * Swap the browser tab favicon to the tenant logo while a public/customer-facing
 * page is mounted. Restores the previous favicon on unmount so admin areas
 * keep the HolaWeb mark.
 */
export function useTenantFavicon(url?: string | null) {
  useEffect(() => {
    if (!url || typeof document === "undefined") return;

    const head = document.head;
    const previous = Array.from(head.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
    const prevSnapshots = previous.map((el) => ({ el, href: el.href, type: el.type, sizes: el.sizes?.value }));

    // Hide existing icons (don't remove — restore them on unmount).
    previous.forEach((el) => el.setAttribute("data-tenant-hidden", "1"));
    previous.forEach((el) => el.parentNode?.removeChild(el));

    const link = document.createElement("link");
    link.rel = "icon";
    link.href = url;
    link.setAttribute("data-tenant-favicon", "1");
    head.appendChild(link);

    return () => {
      link.parentNode?.removeChild(link);
      prevSnapshots.forEach(({ el }) => {
        el.removeAttribute("data-tenant-hidden");
        head.appendChild(el);
      });
    };
  }, [url]);
}
