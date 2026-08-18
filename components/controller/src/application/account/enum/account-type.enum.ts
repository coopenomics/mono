import { registerEnumType } from '@nestjs/graphql';
import { InnerAccountType } from '@coopenomics/innercoop';

/**
 * Перечень живёт в контракте `@coopenomics/innercoop`: с ним сверяются
 * расширения, а ядро регистрирует его в схеме. Здесь он доступен под привычным
 * ядру именем.
 */
export { InnerAccountType as AccountType };

registerEnumType(InnerAccountType, { name: 'AccountType', description: 'Тип аккаунта пользователя в системе' });
