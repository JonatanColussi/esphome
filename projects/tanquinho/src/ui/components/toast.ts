import { h } from '../dom';

const TOAST_DURATION_MS = 3500;

export interface Toast {
  element: HTMLElement;
  show(message: string): void;
}

export function createToast(): Toast {
  const element = h('div', { attrs: { id: 'tq-toast', role: 'status' } });
  let hideTimer: number | undefined;

  return {
    element,
    show: message => {
      element.textContent = message;
      element.style.display = 'block';
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        element.style.display = 'none';
      }, TOAST_DURATION_MS);
    },
  };
}
