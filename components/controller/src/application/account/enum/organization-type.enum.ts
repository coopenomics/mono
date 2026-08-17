import { registerEnumType } from '@nestjs/graphql';
import { InnerOrganizationType } from '@coopenomics/innercoop';

/**
 * Перечень живёт в контракте `@coopenomics/innercoop`. Здесь он доступен под
 * привычным ядру именем и регистрируется в схеме.
 */
export { InnerOrganizationType as OrganizationType };

registerEnumType(InnerOrganizationType, { name: 'OrganizationType', description: 'Тип юридического лица' });
