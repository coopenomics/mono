import { boot } from 'quasar/wrappers';
import { Lang } from 'quasar';
import axios from 'axios';
import quasarRu from 'quasar/lang/ru';
import { setLibraryTranslator } from '@coopenomics/i18n';
import { i18n, currentLocale, t } from 'src/shared/i18n';

// Языковые пакеты Quasar (подписи календаря, таблиц, диалогов) по языку
// интерфейса. Язык сейчас один; второй добавляется строкой здесь и словарями.
const QUASAR_LANGS = { ru: quasarRu } as const;

/**
 * Подключает переводчик к приложению. Стоит в списке boot раньше `init`:
 * `init` устанавливает расширения, а их маршруты и рабочие столы берут
 * заголовки из словарей.
 */
export default boot(({ app, ssrContext }) => {
  app.use(i18n);
  // Библиотеки (@coopenomics/auth, @coopenomics/sdk) переводят свои тексты
  // переводчиком приложения — на языке интерфейса.
  setLibraryTranslator((key, params) => t(key as never, params as never));

  const locale = currentLocale() as keyof typeof QUASAR_LANGS;
  Lang.set(QUASAR_LANGS[locale] ?? quasarRu, ssrContext ?? undefined);

  // Бэкенд переводит ошибки и уведомления на язык запроса.
  axios.defaults.headers.common['Accept-Language'] = locale;
});
