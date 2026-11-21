import type { ClientEnvironment } from '../../src/device/client';
import { DeviceClient } from '../../src/device/client';
import { StateStore } from '../../src/device/store';

class FakeEventSource extends EventTarget {
  public emit(type: string, data?: string): void {
    const event = new Event(type) as Event & { data?: string };

    event.data = data;
    this.dispatchEvent(event);
  }
}

const flushPromises = () =>
  new Promise<void>(resolve => {
    setTimeout(resolve, 0);
  });

function setup(response: Promise<Response>) {
  const source = new FakeEventSource();
  const fetch = jest.fn(() => response);
  const environment: ClientEnvironment = {
    createEventSource: () => source as unknown as EventSource,
    fetch,
  };
  const store = new StateStore();
  const onCommandFailed = jest.fn();
  const client = new DeviceClient(store, onCommandFailed, environment);

  return { client, fetch, onCommandFailed, source, store };
}

describe('DeviceClient', () => {
  it('feeds state events into the store and tracks the connection', () => {
    const { client, source, store } = setup(Promise.resolve(new Response()));

    client.connect();
    source.emit('open');
    expect(store.isConnected).toBe(true);

    source.emit('state', '{"name_id":"switch/Motor","domain":"switch","value":true}');
    expect(store.states['switch/Motor']).toBe(true);

    source.emit('error');
    expect(store.isConnected).toBe(false);
  });

  it('posts commands to the REST url', async () => {
    const { client, fetch, onCommandFailed } = setup(Promise.resolve(new Response()));

    client.send('button/Stop All', 'press');
    await flushPromises();

    expect(fetch).toHaveBeenCalledWith('/button/Stop%20All/press', { method: 'POST' });
    expect(onCommandFailed).not.toHaveBeenCalled();
  });

  it('reports failed commands without changing state', async () => {
    const { client, onCommandFailed, store } = setup(
      Promise.resolve(new Response(null, { status: 500 })),
    );

    client.send('switch/Motor', 'toggle');
    await flushPromises();

    expect(onCommandFailed).toHaveBeenCalledTimes(1);
    expect(store.states['switch/Motor']).toBeUndefined();
  });

  it('reports network errors', async () => {
    const { client, onCommandFailed } = setup(Promise.reject(new Error('offline')));

    client.send('switch/Motor', 'toggle');
    await flushPromises();

    expect(onCommandFailed).toHaveBeenCalledTimes(1);
  });
});
