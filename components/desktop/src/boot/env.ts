import { boot } from 'quasar/wrappers';
import { createEnvObject } from '../shared/config/createEnvObject';

/**
 * Boot файл для инжекции переменных окружения в PWA режиме
 * В SSR режиме переменные инжектируются через middleware,
 * в PWA режиме - через этот boot файл
 */
export default boot(({  }) => {
  // Проверяем, что мы в браузере и переменные еще не инжектированы
  // Также проверяем, что мы не в SSR режиме на сервере
  if (typeof window !== 'undefined' && !window.__ENV__ && !process.env.SERVER) {
    // Создаем объект переменных окружения для клиента
    const envForClient = createEnvObject();

    // Инжектируем переменные в window.__ENV__
    window.__ENV__ = envForClient;

    console.log('Boot: Переменные окружения загружены', envForClient);
  }
});
