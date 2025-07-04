import { boot } from 'quasar/wrappers';
// import { createEnvObject } from '../shared/config/createEnvObject';

/**
 * Boot файл для инжекции переменных окружения в PWA режиме
 * В SSR режиме переменные инжектируются через middleware,
 * в PWA режиме - через этот boot файл
 */
export default boot(({}) => {
  // console.log('DEBUG: Boot env.ts started');
  // // Проверяем, что переменные еще не инжектированы
  // // Также проверяем, что мы не в SSR режиме на сервере
  // if (process.env.CLIENT) {
  //   console.log(
  //     'DEBUG: Boot условие сработало, создаем переменные окружения для PWA',
  //   );
  //   // Создаем объект переменных окружения для клиента
  //   const envForClient = createEnvObject();
  //   // Инжектируем переменные в window.__ENV__
  //   window.__ENV__ = envForClient;
  //   console.log('Boot: Переменные окружения загружены', envForClient);
  // } else {
  //   console.log('DEBUG: Boot условие НЕ сработало:');
  // }
});
