import { RELAY_COPY, TEXT } from '../../copy';
import { Entity, RELAYS } from '../../domain/entities';
import { MIN_MINUTES, normalizeMinutes } from '../../domain/time';
import type { Actions, View } from '../actions';
import { card } from '../components/card';
import { button, h, setPressed, setVisible } from '../dom';
import type { ViewModel } from '../view-model';

/** The water valve shuts itself after 10 min (water_valve_limit in the firmware). */
const FILL_MAX_MINUTES = 10;
const DEFAULT_MAX_MINUTES = 30;

interface MinutesFieldSpec {
  key: string;
  label: string;
  max: number;
}

interface FieldGroup {
  fields: readonly MinutesFieldSpec[];
  title: string;
}

const FIELD_GROUPS: readonly FieldGroup[] = [
  {
    fields: [
      { key: Entity.fillMinutes.Low, label: TEXT.loadLowLabel, max: FILL_MAX_MINUTES },
      { key: Entity.fillMinutes.Medium, label: TEXT.loadMediumLabel, max: FILL_MAX_MINUTES },
      { key: Entity.fillMinutes.High, label: TEXT.loadHighLabel, max: FILL_MAX_MINUTES },
    ],
    title: TEXT.fillTitle,
  },
  {
    fields: [
      { key: Entity.drainMinutes.Low, label: TEXT.loadLowLabel, max: DEFAULT_MAX_MINUTES },
      { key: Entity.drainMinutes.Medium, label: TEXT.loadMediumLabel, max: DEFAULT_MAX_MINUTES },
      { key: Entity.drainMinutes.High, label: TEXT.loadHighLabel, max: DEFAULT_MAX_MINUTES },
    ],
    title: TEXT.drainTitle,
  },
  {
    fields: [
      { key: Entity.mixMinutes, label: TEXT.mixLabel, max: DEFAULT_MAX_MINUTES },
      { key: Entity.soakMinutes, label: TEXT.soakLabel, max: DEFAULT_MAX_MINUTES },
      { key: Entity.washMinutes, label: TEXT.washLabel, max: DEFAULT_MAX_MINUTES },
    ],
    title: TEXT.otherStagesTitle,
  },
];

function createMinutesField(spec: MinutesFieldSpec, actions: Actions): View {
  const input = h('input', {
    attrs: {
      inputmode: 'decimal',
      max: String(spec.max),
      min: String(MIN_MINUTES),
      step: '0.5',
      type: 'number',
    },
  });

  input.addEventListener('change', () => {
    const minutes = normalizeMinutes(input.value, spec.max);

    if (minutes !== null) {
      actions.setMinutes(spec.key, minutes);
    }
  });

  return {
    element: h('label', { className: 'field' }, [h('span', { text: spec.label }), input]),
    update: (model: ViewModel) => {
      const value = model.minuteSettings[spec.key];

      input.disabled = !model.connected;

      // Do not overwrite what the person is typing.
      if (document.activeElement !== input && value !== undefined) {
        input.value = String(value);
      }
    },
  };
}

export function createSettingsScreen(actions: Actions): View {
  const groups = FIELD_GROUPS.map(group => ({
    fields: group.fields.map(spec => createMinutesField(spec, actions)),
    title: group.title,
  }));
  const relayButtons = RELAYS.map(key =>
    button(RELAY_COPY[key].label, undefined, () => actions.toggleRelay(key)),
  );
  const manualNote = h('p', { className: 'note' });
  const element = h('div', { className: 'settings' }, [
    ...groups.map(group =>
      card(
        group.title,
        group.fields.map(field => field.element),
      ),
    ),
    card(TEXT.manualTitle, [manualNote, h('div', { className: 'relays' }, relayButtons)]),
  ]);

  return {
    element,
    update: model => {
      setVisible(element, model.screen === 'settings');
      groups.forEach(group => group.fields.forEach(field => field.update(model)));
      model.relays.forEach((relay, index) => {
        relayButtons[index].disabled = !model.connected || model.running;
        setPressed(relayButtons[index], relay.on);
      });
      manualNote.textContent = model.manualNote;
    },
  };
}
