import type { EntityValue } from '../domain/entities';

export type CommandAction = 'press' | 'set' | 'toggle' | 'turn_off' | 'turn_on';
export type CommandParams = Readonly<Record<string, number | string>>;

export interface StateUpdate {
  key: string;
  value: EntityValue;
}

/** Shape of the JSON in an ESPHome web_server `state` event. */
interface StateEventPayload {
  domain?: string;
  name_id?: string;
  state?: string;
  value?: unknown;
}

const BOOLEAN_DOMAINS = new Set(['binary_sensor', 'switch']);

/** ESPHome REST route: POST /<domain>/<url-encoded name>/<action>?<params>. */
export function commandUrl(key: string, action: CommandAction, params: CommandParams = {}): string {
  const separator = key.indexOf('/');
  const domain = key.slice(0, separator);
  const name = key.slice(separator + 1);
  const path = `/${domain}/${encodeURIComponent(name)}/${action}`;
  const query = Object.entries(params)
    .map(([param, value]) => `${encodeURIComponent(param)}=${encodeURIComponent(String(value))}`)
    .join('&');

  return query ? `${path}?${query}` : path;
}

function isPayload(value: unknown): value is StateEventPayload {
  return typeof value === 'object' && value !== null;
}

export function parseStateEvent(data: string): StateUpdate | null {
  let payload: unknown;

  try {
    payload = JSON.parse(data);
  } catch {
    return null;
  }

  if (!isPayload(payload) || typeof payload.name_id !== 'string') {
    return null;
  }

  const key = payload.name_id;
  const domain = payload.domain ?? key.split('/')[0];

  if (domain === 'number') {
    return { key, value: Number.parseFloat(String(payload.value)) };
  }

  if (BOOLEAN_DOMAINS.has(domain)) {
    return { key, value: payload.value === true };
  }

  return { key, value: payload.state ?? '' };
}
