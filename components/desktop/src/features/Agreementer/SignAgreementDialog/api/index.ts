import { useSendAgreement, type ISendAgreementInput } from 'src/shared/composables/agreements';

/**
 * Подача подписанного соглашения через GraphQL-мутацию `sendAgreement`.
 *
 * Раньше тут был прямой `transact` от имени пайщика → `soviet::sndagreement`.
 * После Эпика 2 (компонент 48) программные соглашения (program_id > 0) пишет
 * `wallet::signagree`, требующий авторизации `coopname@active` — пайщик
 * подписать такую транзакцию из браузера не может. Контроллер на стороне
 * сервера читает `coagreement.program_id` и сам выбирает правильный action
 * (см. `controller/.../agreement.interactor.ts`), используя WIF кооператива
 * из vault. Подписи пайщика на самом документе при этом сохраняются и
 * проверяются контрактом через `verify_document_or_fail`.
 */
async function sendAgreement(data: ISendAgreementInput) {
  const { sendAgreement: send } = useSendAgreement();
  return await send(data);
}

export const api = {
  sendAgreement,
};
