import { h } from '../dom';

export function card(title: string, children: readonly Node[]): HTMLDivElement {
  return h('div', { className: 'card' }, [h('h2', { text: title }), ...children]);
}
