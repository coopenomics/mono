/**
 * TODO(удалить после 01.09.2026): временный shim для очистки persisted-localStorage
 * у пайщиков, начавших регистрацию до удаления поля «КПП банка». К этой дате старые
 * незавершённые черновики истекут — утилиту и её вызовы (CreateUser/AddUser model)
 * можно убрать.
 *
 * Защитная очистка устаревшего реквизита «КПП банка» из `bank_account.details`.
 *
 * КПП банка убран из реквизитов счёта (КПП — реквизит юрлица, не банка; см. commit
 * 93b94326 «убрать обязательное поле КПП банка»). Но у пайщиков, начавших регистрацию
 * ДО обновления фронта, значение осело в persisted-localStorage стора регистратора
 * (`useRegistratorStore`, `persist: true`). При отправке мутации RegisterAccount /
 * AddParticipant лишнее поле `kpp` внутри `BankAccountDetailsInput` валит серверную
 * GraphQL-валидацию (GRAPHQL_VALIDATION_FAILED — поле не определено типом).
 *
 * Срезаем `kpp` на входе в мутацию. КПП организации (`details.kpp` на уровне самой
 * организации) НЕ трогаем — это легитимный реквизит юрлица.
 */
export function stripLegacyBankKpp<T>(data: T): T {
  const bankAccount = (data as { bank_account?: { details?: Record<string, unknown> } })?.bank_account;
  const details = bankAccount?.details;
  if (!details || !('kpp' in details)) return data;

  const cleanedDetails = { ...details };
  delete cleanedDetails.kpp;

  return {
    ...data,
    bank_account: {
      ...bankAccount,
      details: cleanedDetails,
    },
  } as T;
}
