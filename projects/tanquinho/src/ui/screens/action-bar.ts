import { TEXT } from '../../copy';
import type { Actions, View } from '../actions';
import { button, h, setVisible } from '../dom';

/** Sticky main action: start on the ready screen, stop while washing. */
export function createActionBar(actions: Actions): View {
  const startSubtitle = h('small');
  const start = h(
    'button',
    { attrs: { type: 'button' }, className: 'start', onClick: actions.start },
    [h('span', { text: TEXT.start }), startSubtitle],
  );
  const stop = button(TEXT.stopWash, 'stop', actions.requestStop);
  const element = h('div', { className: 'action-bar' }, [start, stop]);

  return {
    element,
    update: model => {
      setVisible(element, model.screen !== 'settings');
      setVisible(start, model.screen === 'ready');
      setVisible(stop, model.screen === 'washing');
      start.disabled = !model.connected;
      startSubtitle.textContent = model.startSubtitle;
    },
  };
}
