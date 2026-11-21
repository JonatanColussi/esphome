export type ClickHandler = (this: void) => void;

export interface ElementOptions {
  attrs?: Readonly<Record<string, string>>;
  className?: string;
  onClick?: ClickHandler;
  text?: string;
}

export function button(
  text: string,
  className: string | undefined,
  onClick: () => void,
): HTMLButtonElement {
  return h('button', { attrs: { type: 'button' }, className, onClick, text });
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
  children: readonly Node[] = [],
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  if (options.className) {
    element.className = options.className;
  }

  if (options.text !== undefined) {
    element.textContent = options.text;
  }

  Object.entries(options.attrs ?? {}).forEach(([name, value]) => element.setAttribute(name, value));

  if (options.onClick) {
    element.addEventListener('click', options.onClick);
  }

  element.append(...children);

  return element;
}

/** Replaces the children; `replaceChildren` is missing on older phones. */
export function setChildren(element: HTMLElement, children: readonly Node[]): void {
  element.textContent = '';
  element.append(...children);
}

export function setPressed(element: HTMLElement, pressed: boolean): void {
  element.setAttribute('aria-pressed', String(pressed));
}

export function setVisible(element: HTMLElement, visible: boolean): void {
  element.style.display = visible ? '' : 'none';
}
