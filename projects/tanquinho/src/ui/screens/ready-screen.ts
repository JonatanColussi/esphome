import { LOAD_COPY, TEXT, timesLabel } from '../../copy';
import { WATER_LEVELS } from '../../domain/entities';
import type { Actions, View } from '../actions';
import { card } from '../components/card';
import { createChoice } from '../components/choice';
import { h, setPressed, setVisible } from '../dom';

const CYCLE_OPTIONS = [1, 2, 3, 4, 5] as const;

/** Choose first, confirm later: load, wash type and number of washes. */
export function createReadyScreen(actions: Actions): View {
  const loadChoices = WATER_LEVELS.map(level => ({
    choice: createChoice({
      icon: LOAD_COPY[level].icon,
      onSelect: () => actions.selectWaterLevel(level),
      subtitle: LOAD_COPY[level].subtitle,
      title: LOAD_COPY[level].title,
    }),
    level,
  }));
  const normal = createChoice({
    onSelect: () => actions.selectWashType('normal'),
    subtitle: '',
    title: TEXT.washTypeNormal,
  });
  const quick = createChoice({
    onSelect: () => actions.selectWashType('quick'),
    subtitle: '',
    title: TEXT.washTypeQuick,
  });
  const cycleChoices = CYCLE_OPTIONS.map(count =>
    createChoice({
      ariaLabel: timesLabel(count),
      onSelect: () => actions.selectCycles(count),
      title: String(count),
    }),
  );

  const element = h('div', { className: 'ready' }, [
    card(TEXT.loadQuestion, [
      h(
        'div',
        { className: 'choices choices--3' },
        loadChoices.map(({ choice }) => choice.button),
      ),
    ]),
    card(TEXT.washTypeQuestion, [
      h('div', { className: 'choices choices--2' }, [normal.button, quick.button]),
    ]),
    card(TEXT.cyclesQuestion, [
      h(
        'div',
        { className: 'choices choices--5' },
        cycleChoices.map(choice => choice.button),
      ),
    ]),
  ]);

  return {
    element,
    update: model => {
      setVisible(element, model.screen === 'ready');
      loadChoices.forEach(({ choice, level }) => {
        choice.setState({ disabled: !model.connected, pressed: level === model.waterLevel });
      });
      setPressed(normal.button, model.washType === 'normal');
      setPressed(quick.button, model.washType === 'quick');
      normal.setSubtitle(model.normalSubtitle);
      quick.setSubtitle(model.quickSubtitle);
      cycleChoices.forEach((choice, index) => {
        choice.setState({ disabled: !model.connected, pressed: index + 1 === model.cycles });
      });
    },
  };
}
