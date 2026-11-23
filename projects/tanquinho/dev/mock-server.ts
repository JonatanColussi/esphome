/**
 * Fake Tanquinho web_server (/, /0.js, /events and REST) to try the phone UI without the ESP.
 * Usage: npm run dev   (or: npx tsx dev/mock-server.ts [port], default 8099)
 * A simulated wash advances 30 s of "time remaining" per real second.
 */
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import path from 'node:path';

type Value = boolean | number | string;

const PORT = Number(process.argv[2] ?? 8099);
const UI_BUNDLE = path.resolve(__dirname, '../dist/ui.js');
const SIMULATED_SECONDS_PER_TICK = 30;
const TICKS_PER_STAGE = 4;
const STAGES = ['Filling', 'Mixing', 'Soaking', 'Washing', 'Draining'];
/** The firmware skips soaking in a quick cycle. */
const QUICK_STAGES = ['Filling', 'Mixing', 'Washing', 'Draining'];
const RELAYS = ['switch/Water Valve', 'switch/Motor', 'switch/Drain Pump', 'switch/Auxiliary'];
const INDEX_HTML =
  '<!DOCTYPE html><html><head><meta charset=UTF-8><link rel=icon href=data:></head>' +
  '<body><esp-app><h1>ESPHome default UI (mock)</h1></esp-app>' +
  '<script type=module src=/0.js></script></body></html>';

const states = new Map<string, Value>([
  ['select/Water Level', 'Medium'],
  ['number/Cycles', 1],
  ['number/Fill Low (min)', 2.5],
  ['number/Fill Medium (min)', 3.5],
  ['number/Fill High (min)', 5],
  ['number/Drain Low (min)', 3],
  ['number/Drain Medium (min)', 4],
  ['number/Drain High (min)', 5.5],
  ['number/Mix Time (min)', 0.5],
  ['number/Soak Time (min)', 5],
  ['number/Wash Time (min)', 15],
  ['text_sensor/Stage', 'Off'],
  ['text_sensor/Time Remaining', '00:00:00'],
  ['text_sensor/Cycle Progress', ''],
  ['binary_sensor/Running', false],
  ...RELAYS.map((relay): [string, Value] => [relay, false]),
]);
const clients = new Set<ServerResponse>();
const wash = { quick: false, remainingSeconds: 0, ticks: 0 };

function eventPayload(key: string): string {
  const separator = key.indexOf('/');
  const domain = key.slice(0, separator);
  const name = key.slice(separator + 1);
  const value = states.get(key) ?? '';
  const base = { domain, id: `${domain}-${name.toLowerCase()}`, name, name_id: key };

  if (typeof value === 'number') {
    return JSON.stringify({ ...base, state: String(value), value: String(value) });
  }

  if (typeof value === 'boolean') {
    return JSON.stringify({ ...base, state: value ? 'ON' : 'OFF', value });
  }

  return JSON.stringify({ ...base, state: value, value });
}

function publish(key: string, value: Value): void {
  states.set(key, value);
  const message = `event: state\ndata: ${eventPayload(key)}\n\n`;

  clients.forEach(client => client.write(message));
}

const pad = (value: number) => String(value).padStart(2, '0');

function hms(seconds: number): string {
  return `${Math.floor(seconds / 3600)}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
}

function minutes(key: string): number {
  const value = states.get(key);

  return typeof value === 'number' ? value : 0;
}

function startWash(quick: boolean): void {
  if (states.get('binary_sensor/Running') === true) {
    return;
  }

  const level = String(states.get('select/Water Level'));
  const factor = quick ? 0.5 : 1;
  const cycles = minutes('number/Cycles');
  const perCycle =
    minutes(`number/Fill ${level} (min)`) +
    minutes(`number/Drain ${level} (min)`) +
    (minutes('number/Mix Time (min)') + minutes('number/Wash Time (min)')) * factor +
    (quick ? 0 : minutes('number/Soak Time (min)'));

  wash.quick = quick;
  wash.remainingSeconds = Math.round(perCycle * 60) * cycles;
  wash.ticks = 0;
  publish('binary_sensor/Running', true);
  publish('text_sensor/Cycle Progress', `1/${cycles}`);
  publish('text_sensor/Stage', 'Filling');
}

/** Same as the firmware's state_off: every relay off. */
function stopAll(): void {
  wash.remainingSeconds = 0;
  RELAYS.forEach(relay => publish(relay, false));
  publish('binary_sensor/Running', false);
  publish('text_sensor/Stage', 'Off');
  publish('text_sensor/Time Remaining', '00:00:00');
  publish('text_sensor/Cycle Progress', '');
}

function tick(): void {
  if (states.get('binary_sensor/Running') !== true) {
    return;
  }

  wash.remainingSeconds = Math.max(0, wash.remainingSeconds - SIMULATED_SECONDS_PER_TICK);
  wash.ticks += 1;
  publish('text_sensor/Time Remaining', hms(wash.remainingSeconds));

  if (wash.ticks % TICKS_PER_STAGE === 0) {
    const stages = wash.quick ? QUICK_STAGES : STAGES;
    const current = stages.indexOf(String(states.get('text_sensor/Stage')));

    publish('text_sensor/Stage', stages[(current + 1) % stages.length]);
  }

  if (wash.remainingSeconds === 0) {
    stopAll();
  }
}

function send(
  response: ServerResponse,
  status: number,
  body = '',
  contentType = 'text/plain',
): void {
  response.writeHead(status, {
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': contentType,
  });
  response.end(body);
}

function streamEvents(response: ServerResponse): void {
  response.writeHead(200, { 'Cache-Control': 'no-cache', 'Content-Type': 'text/event-stream' });
  response.write('event: ping\ndata: {"title":"Tanquinho"}\n\n');
  states.forEach((_value, key) => response.write(`event: state\ndata: ${eventPayload(key)}\n\n`));
  clients.add(response);
  response.on('close', () => clients.delete(response));
}

const BUTTONS: Readonly<Record<string, () => void>> = {
  'Start Full Cycle': () => startWash(false),
  'Start Quick Cycle': () => startWash(true),
  'Stop All': stopAll,
};

/** Unknown button names are a 404, like the firmware. */
function pressButton(name: string): boolean {
  if (!Object.prototype.hasOwnProperty.call(BUTTONS, name)) {
    return false;
  }

  BUTTONS[name]?.();

  return true;
}

function applyCommand(
  domain: string,
  name: string,
  action: string,
  query: URLSearchParams,
): boolean {
  const key = `${domain}/${name}`;

  if (domain === 'button' && action === 'press') {
    return pressButton(name);
  }

  if (!states.has(key)) {
    return false;
  }

  if (domain === 'number' && action === 'set') {
    publish(key, Number(query.get('value')));
  } else if (domain === 'select' && action === 'set') {
    publish(key, query.get('option') ?? '');
  } else if (domain === 'switch' && ['toggle', 'turn_off', 'turn_on'].includes(action)) {
    publish(key, action === 'toggle' ? states.get(key) !== true : action === 'turn_on');
  } else {
    return false;
  }

  return true;
}

function handle(request: IncomingMessage, response: ServerResponse): void {
  const url = new URL(request.url ?? '/', `http://localhost:${PORT}`);

  if (request.method === 'GET' && url.pathname === '/') {
    send(response, 200, INDEX_HTML, 'text/html; charset=utf-8');
  } else if (request.method === 'GET' && url.pathname === '/0.js') {
    send(response, 200, readFileSync(UI_BUNDLE, 'utf8'), 'text/javascript; charset=utf-8');
  } else if (request.method === 'GET' && url.pathname === '/events') {
    streamEvents(response);
  } else if (request.method === 'POST') {
    const [domain = '', name = '', action = ''] = url.pathname.slice(1).split('/');
    const ok = applyCommand(domain, decodeURIComponent(name), action, url.searchParams);

    send(response, ok ? 200 : 404);
  } else {
    send(response, 404);
  }
}

setInterval(tick, 1000);
createServer(handle).listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`Tanquinho mock at http://localhost:${PORT}\n`);
});
