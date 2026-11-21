import { TEXT } from '../../copy';
import type { View } from '../actions';
import { h, setChildren, setVisible } from '../dom';

export function createWashingScreen(): View {
  const icon = h('span', { attrs: { 'aria-hidden': 'true' }, className: 'icon' });
  const stage = h('div', { className: 'stage' });
  const cycle = h('div', { className: 'cycle' });
  const timeline = h('ol', { attrs: { 'aria-label': TEXT.timelineLabel }, className: 'timeline' });
  const finishTime = h('b');
  const remaining = h('span');
  const progress = h('i');
  const element = h('div', { attrs: { 'aria-live': 'polite' }, className: 'card now' }, [
    icon,
    stage,
    cycle,
    timeline,
    h('div', { className: 'finish' }, [
      h('span', { text: TEXT.finishesAt }),
      finishTime,
      remaining,
    ]),
    h('div', { className: 'progress' }, [progress]),
  ]);

  return {
    element,
    update: model => {
      setVisible(element, model.screen === 'washing');
      icon.textContent = model.stage.icon;
      stage.textContent = model.stage.title;
      cycle.textContent = model.cycleText;
      setChildren(
        timeline,
        model.timeline.map(step => h('li', { className: step.state, text: step.label })),
      );
      finishTime.textContent = model.finishTime;
      remaining.textContent = model.remainingText;
      progress.style.width = `${model.progressPercent}%`;
    },
  };
}
