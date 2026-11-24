/**
 * Словарь расширения «greetings». Регистрируется при первом импорте;
 * модуль расширения импортирует этот файл, поэтому словарь готов раньше,
 * чем расширение бросит первый отказ или построит первое письмо.
 */
import { registerMessages } from '@coopenomics/i18n/server';
import ru from './ru.json';

registerMessages('ru', ru, 'extension:greetings');

export { t, te, currentLocale } from '@coopenomics/i18n/server';
