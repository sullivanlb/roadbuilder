import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { i18n } from './i18n';
import { installPlatform } from './platform/platform';
import { createWebPlatform } from './platform/web';
import './styles/tokens.css';
import './styles/base.css';

const app = createApp(App);
installPlatform(app, createWebPlatform());
app.use(createPinia()).use(i18n).mount('#app');
