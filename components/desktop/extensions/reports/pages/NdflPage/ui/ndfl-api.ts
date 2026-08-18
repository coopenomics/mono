import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

/**
 * Перечисление удержанного НДФЛ — данные стола бухгалтера.
 *
 * Удержания ведёт то расширение, которое выплачивает доход физлицу, но
 * бухгалтерия обращается не к нему: стол отдаёт своё представление, где к
 * платежу уже добавлен расчётный период — тот же, за который подаётся
 * уведомление об исчисленных суммах.
 */

export type IWithheldTaxState =
  Queries.Reports.GetWithheldTaxState.IOutput['getWithheldTaxState'];

export type IWithheldTaxPaymentPage =
  Queries.Reports.GetWithheldTaxPayments.IOutput['getWithheldTaxPayments'];

export type IWithheldTaxPayment = IWithheldTaxPaymentPage['items'][number];

export type IPayWithheldTaxInput = Mutations.Reports.PayWithheldTax.IInput['data'];

export async function getWithheldTaxState(): Promise<IWithheldTaxState> {
  const { [Queries.Reports.GetWithheldTaxState.name]: result } = await client.Query(
    Queries.Reports.GetWithheldTaxState.query,
  );
  return result;
}

export async function getWithheldTaxPayments(
  page: number,
  limit: number,
): Promise<IWithheldTaxPaymentPage> {
  const { [Queries.Reports.GetWithheldTaxPayments.name]: result } = await client.Query(
    Queries.Reports.GetWithheldTaxPayments.query,
    { variables: { page, limit } },
  );
  return result;
}

/** Отправить удержанный налог на оплату; возвращает отправленную сумму. */
export async function payWithheldTax(data: IPayWithheldTaxInput): Promise<string> {
  const { [Mutations.Reports.PayWithheldTax.name]: result } = await client.Mutation(
    Mutations.Reports.PayWithheldTax.mutation,
    { variables: { data } },
  );
  return result;
}
