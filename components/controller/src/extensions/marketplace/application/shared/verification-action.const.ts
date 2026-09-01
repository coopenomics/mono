/**
 * Код действия «выдача имущества на кооперативном участке» в правилах
 * верификации кооператива (`verification_rules`). Требуемые уровни задаёт
 * правило (сидируется миграцией: `passport_onsite`), расширение лишь
 * спрашивает ядро через `VERIFICATION_PORT.checkRequired`.
 */
export const MARKETPLACE_ISSUE_ACTION_CODE = 'marketplace.issue_property';
