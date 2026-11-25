/**
 * Словарь приложения «Поздравления». Регистрируется при первом импорте —
 * раньше, чем выполнится любой код приложения, берущий текст через t().
 * Шаблоны пользуются глобальным $t; словарь подключает install.ts.
 */
import { registerMessages } from 'src/shared/i18n';
import ru from './ru.json';

registerMessages('extension:greetings', ru);

export { t, te } from 'src/shared/i18n';
