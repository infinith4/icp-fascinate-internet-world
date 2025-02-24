import { createPinia } from 'pinia';
import { createApp } from 'vue';
import './index.scss';
import './assets/password-list.scss';
import './assets/password-form.scss';
import App from './App.vue';

createApp(App).use(createPinia()).mount('#app');
