import type { CommandAction, CommandParams } from './protocol';
import { commandUrl, parseStateEvent } from './protocol';
import type { StateStore } from './store';

export interface ClientEnvironment {
  createEventSource(url: string): EventSource;
  fetch(url: string, init: RequestInit): Promise<Response>;
}

const browserEnvironment: ClientEnvironment = {
  createEventSource: url => new EventSource(url),
  fetch: (url, init) => window.fetch(url, init),
};

/**
 * Talks to the ESP's web_server. State only changes through /events; a command never
 * edits the store itself, so the screen always shows what the device reports.
 */
export class DeviceClient {
  constructor(
    private readonly store: StateStore,
    private readonly onCommandFailed: () => void,
    private readonly environment: ClientEnvironment = browserEnvironment,
  ) {}

  public connect(url = '/events'): void {
    const source = this.environment.createEventSource(url);

    source.addEventListener('open', () => this.store.setConnected(true));
    source.addEventListener('error', () => this.store.setConnected(false));
    source.addEventListener('state', event => {
      const update = parseStateEvent(String(event.data));

      if (update) {
        this.store.apply(update);
      }
    });
  }

  public send(key: string, action: CommandAction, params?: CommandParams): void {
    this.post(commandUrl(key, action, params)).catch(() => this.onCommandFailed());
  }

  private async post(url: string): Promise<void> {
    const response = await this.environment.fetch(url, { method: 'POST' });

    if (!response.ok) {
      throw new Error(`Command failed with HTTP ${response.status}`);
    }
  }
}
