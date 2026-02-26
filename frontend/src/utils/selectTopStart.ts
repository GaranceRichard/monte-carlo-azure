import type { SyntheticEvent } from "react";

function scrollToTop(selectEl: HTMLSelectElement) {
  selectEl.scrollTop = 0;
  window.requestAnimationFrame(() => {
    selectEl.scrollTop = 0;
  });
}

export function keepSelectDropdownAtTop(event: SyntheticEvent<HTMLSelectElement>) {
  scrollToTop(event.currentTarget);
}

