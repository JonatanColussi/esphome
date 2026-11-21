import { commandUrl, parseStateEvent } from '../../src/device/protocol';

describe('commandUrl', () => {
  it('encodes the entity name and query parameters', () => {
    expect(commandUrl('button/Stop All', 'press')).toBe('/button/Stop%20All/press');
    expect(commandUrl('select/Water Level', 'set', { option: 'Medium' })).toBe(
      '/select/Water%20Level/set?option=Medium',
    );
    expect(commandUrl('number/Fill High (min)', 'set', { value: 5.5 })).toBe(
      '/number/Fill%20High%20(min)/set?value=5.5',
    );
  });
});

describe('parseStateEvent', () => {
  it('turns number values into floats', () => {
    expect(
      parseStateEvent('{"name_id":"number/Cycles","domain":"number","value":"3","state":"3"}'),
    ).toEqual({ key: 'number/Cycles', value: 3 });
  });

  it('turns switch and binary_sensor values into booleans', () => {
    expect(
      parseStateEvent('{"name_id":"switch/Motor","domain":"switch","value":true,"state":"ON"}'),
    ).toEqual({ key: 'switch/Motor', value: true });
    expect(
      parseStateEvent(
        '{"name_id":"binary_sensor/Running","domain":"binary_sensor","value":false,"state":"OFF"}',
      ),
    ).toEqual({ key: 'binary_sensor/Running', value: false });
  });

  it('uses state for selects and text sensors', () => {
    expect(
      parseStateEvent(
        '{"name_id":"select/Water Level","domain":"select","value":"High","state":"High"}',
      ),
    ).toEqual({ key: 'select/Water Level', value: 'High' });
    expect(
      parseStateEvent(
        '{"name_id":"text_sensor/Cycle Progress","domain":"text_sensor","value":"","state":""}',
      ),
    ).toEqual({ key: 'text_sensor/Cycle Progress', value: '' });
  });

  it('ignores pings and invalid JSON', () => {
    expect(parseStateEvent('{"title":"Tanquinho"}')).toBeNull();
    expect(parseStateEvent('not json')).toBeNull();
  });
});
