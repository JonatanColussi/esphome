import { TEXT } from './copy';
import { DeviceClient } from './device/client';
import { StateStore } from './device/store';
import { createApp } from './ui/app';
import { createToast } from './ui/components/toast';
import { button, h } from './ui/dom';
import { createLocalPreferences } from './ui/preferences';
import { createFrameScheduler } from './ui/scheduler';
import { SIMPLE_MODE_CLASS, STYLES } from './ui/styles';

/** ESPHome's default interface, loaded only when the person taps the Advanced button. */
const ADVANCED_UI_URL = 'https://oi.esphome.io/v2/www.js';
/** The finish time moves with the clock even without new events. */
const CLOCK_REFRESH_MS = 30_000;

const META_TAGS: Readonly<Record<string, string>> = {
  'apple-mobile-web-app-capable': 'yes',
  'apple-mobile-web-app-title': TEXT.documentTitle,
  'theme-color': '#1565d8',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
};

function addMetaTags(): void {
  Object.entries(META_TAGS).forEach(([name, content]) => {
    if (!document.querySelector(`meta[name="${name}"]`)) {
      document.head.append(h('meta', { attrs: { content, name } }));
    }
  });
}

function createAdvancedLoader(): () => void {
  let loaded = false;

  return () => {
    if (!loaded) {
      loaded = true;
      document.body.append(h('script', { attrs: { src: ADVANCED_UI_URL } }));
    }

    document.body.classList.remove(SIMPLE_MODE_CLASS);
  };
}

function main(): void {
  addMetaTags();
  document.title = TEXT.documentTitle;
  document.head.append(h('style', { text: STYLES }));

  const store = new StateStore();
  const toast = createToast();
  const client = new DeviceClient(store, () => toast.show(TEXT.commandFailed));
  const app = createApp({
    commands: client,
    now: () => Date.now(),
    openAdvanced: createAdvancedLoader(),
    preferences: createLocalPreferences(),
    scrollToTop: () => window.scrollTo(0, 0),
    store,
    vibrate: pattern => {
      navigator.vibrate?.(pattern);
    },
  });
  const backToSimple = button(TEXT.backToSimple, undefined, () =>
    document.body.classList.add(SIMPLE_MODE_CLASS),
  );

  backToSimple.id = 'tq-simple';
  document.body.classList.add(SIMPLE_MODE_CLASS);
  document.body.prepend(app.element);
  document.body.append(...app.overlays, toast.element, backToSimple);

  const scheduleRender = createFrameScheduler(app.render);

  store.subscribe(scheduleRender);
  client.connect();
  window.setInterval(scheduleRender, CLOCK_REFRESH_MS);
  app.render();
}

main();
