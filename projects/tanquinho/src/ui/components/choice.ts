import type { Callback } from '../dom';
import { h, setPressed } from '../dom';

export interface Choice {
  button: HTMLButtonElement;
  setState(state: ChoiceState): void;
  setSubtitle(text: string): void;
}

export interface ChoiceOptions {
  ariaLabel?: string;
  icon?: string;
  onSelect: Callback;
  subtitle?: string;
  title: string;
}

export interface ChoiceState {
  disabled: boolean;
  pressed: boolean;
}

/** A large selectable option; `aria-pressed` marks the current choice. */
export function createChoice(options: ChoiceOptions): Choice {
  const subtitle = options.subtitle === undefined ? null : h('small', { text: options.subtitle });
  const icon = options.icon
    ? h('span', { attrs: { 'aria-hidden': 'true' }, text: options.icon })
    : null;
  const children = [icon, h('b', { text: options.title }), subtitle].filter(
    (node): node is HTMLElement => node !== null,
  );
  const attributes: Record<string, string> = { 'aria-pressed': 'false', type: 'button' };

  if (options.ariaLabel) {
    attributes['aria-label'] = options.ariaLabel;
  }

  const element = h(
    'button',
    { attrs: attributes, className: 'choice', onClick: options.onSelect },
    children,
  );

  return {
    button: element,
    setState: state => {
      element.disabled = state.disabled;
      setPressed(element, state.pressed);
    },
    setSubtitle: text => {
      if (subtitle) {
        subtitle.textContent = text;
      }
    },
  };
}
