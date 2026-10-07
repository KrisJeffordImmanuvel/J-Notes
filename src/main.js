/* J Notes — private, local-first notes & diary. */
import './styles/base.css';
import './styles/layout.css';
import './styles/pages.css';
import './styles/overlays.css';
import './styles/responsive.css';
import { boot } from './app.js';
import { installGlobalHandlers } from './ui/actions.js';
import { setupPWA } from './ui/pwa.js';
import { installAccountUI } from './ui/account.js';
import { installSyncTriggers } from './data/sync.js';

installGlobalHandlers();
installAccountUI();
installSyncTriggers();
setupPWA();
boot();
