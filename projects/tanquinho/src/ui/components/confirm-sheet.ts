import { TEXT } from '../../copy';
import type { ClickHandler } from '../dom';
import { button, h } from '../dom';

export interface ConfirmOptions {
  confirmLabel: string;
  message: string;
  onConfirm: ClickHandler;
  title: string;
}

export interface ConfirmSheet {
  element: HTMLElement;
  open(options: ConfirmOptions): void;
}

/** Bottom sheet that asks before anything that stops the machine. */
export function createConfirmSheet(): ConfirmSheet {
  const title = h('h3');
  const message = h('p');
  let pendingAction: (() => void) | null = null;

  const close = () => {
    element.classList.remove('open');
    pendingAction = null;
  };

  const confirmButton = button('', 'confirm', () => {
    const action = pendingAction;

    close();
    action?.();
  });

  const element = h('div', { attrs: { 'aria-modal': 'true', id: 'tq-sheet', role: 'dialog' } }, [
    h('div', { className: 'box' }, [
      title,
      message,
      confirmButton,
      button(TEXT.cancel, undefined, close),
    ]),
  ]);

  element.addEventListener('click', event => {
    if (event.target === element) {
      close();
    }
  });

  return {
    element,
    open: options => {
      title.textContent = options.title;
      message.textContent = options.message;
      confirmButton.textContent = options.confirmLabel;
      pendingAction = options.onConfirm;
      element.classList.add('open');
      confirmButton.focus();
    },
  };
}
