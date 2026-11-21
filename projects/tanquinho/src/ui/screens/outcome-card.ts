import { OUTCOME_COPY, TEXT } from '../../copy';
import type { Actions, View } from '../actions';
import { button, h, setVisible } from '../dom';

export function createOutcomeCard(actions: Actions): View {
  const icon = h('div', { className: 'icon' });
  const title = h('b');
  const message = h('p');
  const element = h('div', { attrs: { role: 'status' }, className: 'card outcome' }, [
    icon,
    title,
    message,
    button(TEXT.ok, undefined, actions.dismissOutcome),
  ]);

  return {
    element,
    update: model => {
      setVisible(element, model.outcome !== null && model.screen === 'ready');

      if (!model.outcome) {
        return;
      }

      const copy = OUTCOME_COPY[model.outcome];

      element.className = `card outcome ${model.outcome}`;
      icon.textContent = copy.icon;
      title.textContent = copy.title;
      message.textContent = copy.message;
    },
  };
}
