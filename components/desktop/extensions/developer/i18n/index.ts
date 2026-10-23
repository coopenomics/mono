/**
 * Словарь расширения «developer». Регистрируется при первом импорте —
 * раньше, чем выполнится любой код расширения, берущий текст через t().
 * Шаблоны пользуются глобальным $t; словарь подключает install.ts.
 */
import { registerMessages } from 'src/shared/i18n';
import ru from './ru.json';

registerMessages('extension:developer', ru);

export { t } from 'src/shared/i18n';
