import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
// Импорт composable выполняет side-effect: применяет тему на <html>
// до первого рендера — чтобы не было вспышки белым при загрузке в тёмном режиме.
import '@/composables/useTheme';
import './style.css';

createApp(App).use(router).mount('#app');
