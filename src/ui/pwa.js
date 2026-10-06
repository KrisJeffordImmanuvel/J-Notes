/* Installable app support: service worker registration, install prompt and update notice. */
import { toast } from './toast.js';
import { renderSettingsIfOpen } from './settings.js';

let installEvent = null;
export const canInstall = () => !!installEvent;

export async function installApp() {
  if (!installEvent) return;
  const ev = installEvent; installEvent = null;
  ev.prompt();
  try { const { outcome } = await ev.userChoice; if (outcome === 'accepted') toast('J Notes is installed — find it with your other apps.'); } catch (e) { }
  renderSettingsIfOpen();
}

export function setupPWA() {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvent = e; renderSettingsIfOpen(); });
  window.addEventListener('appinstalled', () => { installEvent = null; renderSettingsIfOpen(); });

  // Service workers only work over http(s); the single-file build opened from disk skips this.
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol) || import.meta.env.DEV || import.meta.env.MODE === 'single') return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js').catch(e => console.warn('Service worker not registered', e));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) toast('A new version of J Notes is ready.', { label: 'Reload', fn: () => location.reload() }, 15000);
  });
}
