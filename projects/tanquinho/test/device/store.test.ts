import { StateStore } from '../../src/device/store';

describe('StateStore', () => {
  it('stores updates, marks itself connected and notifies listeners', () => {
    const store = new StateStore();
    const listener = jest.fn();

    store.subscribe(listener);
    store.apply({ key: 'switch/Motor', value: true });

    expect(store.states['switch/Motor']).toBe(true);
    expect(store.isConnected).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies only when the connection state changes', () => {
    const store = new StateStore();
    const listener = jest.fn();

    store.subscribe(listener);
    store.setConnected(false);
    store.setConnected(true);
    store.setConnected(true);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after unsubscribe', () => {
    const store = new StateStore();
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.apply({ key: 'switch/Motor', value: true });

    expect(listener).not.toHaveBeenCalled();
  });
});
