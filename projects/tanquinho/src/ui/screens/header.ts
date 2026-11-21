import { TEXT } from '../../copy';
import type { Actions, View } from '../actions';
import { button, h, setVisible } from '../dom';

export function createHeader(actions: Actions): View {
  const title = h('span');
  const status = h('span', { className: 'status' });
  const back = button(TEXT.back, 'back', actions.showReady);
  const powerOff = button(TEXT.powerOff, 'power-off', actions.requestPowerOff);
  const element = h('div', { className: 'header' }, [
    h('div', { className: 'top-bar' }, [back, h('h1', {}, [title, status]), powerOff]),
    h('div', { attrs: { role: 'alert' }, className: 'offline-banner', text: TEXT.offlineBanner }),
  ]);

  return {
    element,
    update: model => {
      title.textContent = model.headerTitle;
      status.textContent = model.statusText;
      setVisible(back, model.screen === 'settings');
      powerOff.disabled = !model.connected;
    },
  };
}
