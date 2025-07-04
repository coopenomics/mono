import { boot } from 'quasar/wrappers';
import { createEnvObject } from '../shared/config/createEnvObject';

/**
 * Boot файл для инжекции переменных окружения в PWA режиме
 * В SSR режиме переменные инжектируются через middleware,
 * в PWA режиме - через этот boot файл
 */
export default boot(({}) => {
  console.log('DEBUG: Boot env.ts started');
  console.log('DEBUG: window.__ENV__:', window.__ENV__);
  console.log('DEBUG: process.env.SERVER:', process.env.SERVER);
  console.log('DEBUG: process.env.MODE:', process.env.MODE);

  // Проверяем, что переменные еще не инжектированы
  // Также проверяем, что мы не в SSR режиме на сервере
  if (!window.__ENV__ && !process.env.SERVER) {
    console.log('DEBUG: Boot условие сработало, создаем переменные окружения');

    // Создаем объект переменных окружения для клиента
    const envForClient = createEnvObject();

    // Инжектируем переменные в window.__ENV__
    window.__ENV__ = envForClient;

    console.log('Boot: Переменные окружения загружены', envForClient);
  } else {
    console.log('DEBUG: Boot условие НЕ сработало:');
    console.log('  - !window.__ENV__:', !window.__ENV__);
    console.log('  - !process.env.SERVER:', !process.env.SERVER);
  }
});
