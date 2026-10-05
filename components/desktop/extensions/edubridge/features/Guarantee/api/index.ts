import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { useSessionStore } from 'src/entities/Session';
import { DigitalDocument } from 'src/shared/lib/document';
import { t } from '../../../i18n';

export type IGuaranteeState = Queries.Edubridge.MyGuarantees.IOutput[typeof Queries.Edubridge.MyGuarantees.name][number];
export type IGuaranteeStatementInput = Mutations.Edubridge.GuaranteeStatement.IInput['data'];

/** Гарантийные условия по подпискам участника и поданные заявления. */
export async function fetchMyGuarantees(): Promise<IGuaranteeState[]> {
  const { [Queries.Edubridge.MyGuarantees.name]: result } = await client.Query(Queries.Edubridge.MyGuarantees.query);
  return result;
}

/**
 * Заявление об аннулировании подписки по гарантийным условиям: сервер
 * формирует документ (стоимость и срок гарантии считает он), участник
 * подписывает его своим ключом, подписанное заявление уходит на рассмотрение совета.
 */
export async function submitGuaranteeClaim(data: IGuaranteeStatementInput) {
  const session = useSessionStore();
  const username = session.username;
  if (!username) throw new Error(t('edubridge.error.notAuthorized'));
  const { [Mutations.Edubridge.GuaranteeStatement.name]: document } = await client.Mutation(Mutations.Edubridge.GuaranteeStatement.mutation, {
    variables: { data },
  });
  const signed = await new DigitalDocument(document).sign(username);
  const { [Mutations.Edubridge.SubmitGuaranteeClaim.name]: result } = await client.Mutation(Mutations.Edubridge.SubmitGuaranteeClaim.mutation, {
    variables: { data: { ...data, document: signed } },
  });
  return result;
}
