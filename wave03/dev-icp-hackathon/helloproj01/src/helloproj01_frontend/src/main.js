import { createPinia } from 'pinia';
import { createApp } from 'vue';
import './index.scss';
import './assets/password-list.scss';
import './assets/password-form.scss';
import App from './App.vue';
import vuetify from './plugins/vuetify' // プラグインの設定を別ファイルで管理

const app = createApp(App);

app.use(createPinia());
app.use(vuetify);

app.mount('#app');