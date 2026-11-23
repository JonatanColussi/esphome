import { TEXT } from '../../copy';
import type { Actions, View } from '../actions';
import { button, h, setVisible } from '../dom';

export function createFooter(actions: Actions): View {
  const element = h('div', { className: 'footer' }, [
    button(TEXT.settings, undefined, actions.openSettings),
    button(TEXT.advanced, undefined, actions.openAdvanced),
  ]);

  return {
    element,
    update: model => setVisible(element, model.screen === 'ready'),
  };
}
