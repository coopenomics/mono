import { boot } from 'quasar/wrappers';
import { useInitAppProcess } from 'src/processes/init-app';

export default boot(async ({ router }) => {
  await useInitAppProcess(router);
});
