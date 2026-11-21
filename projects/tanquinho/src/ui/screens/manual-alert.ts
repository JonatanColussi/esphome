import { TEXT } from '../../copy';
import type { Actions, View } from '../actions';
import { button, h, setVisible } from '../dom';

/** Yellow warning when a relay was left on in manual mode with no wash running. */
export function createManualAlert(actions: Actions): View {
  const text = h('span');
  const element = h('div', { attrs: { role: 'status' }, className: 'manual-alert' }, [
    text,
    button(TEXT.turnOff, undefined, actions.stopNow),
  ]);

  return {
    element,
    update: model => {
      setVisible(element, model.manualAlert !== null);
      text.textContent = model.manualAlert ?? '';
    },
  };
}
