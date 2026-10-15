import { Cooperative } from 'cooptypes';
import { Mutations } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { DigitalDocument } from 'src/shared/lib/document';
import type { IQuote } from '../../../entities/Learner';
import { t } from '../../../i18n';

export type ISubscribeInput = Mutations.Edubridge.Subscribe.IInput['data'];

/**
 * Заявление о конвертации (3011) — генерируется на фронте из котировки (тот же
 * sub_hash и сумма, что проверит контракт) и подписывается локальным ключом.
 */
export async function buildConvertStatement(quote: IQuote, courseTitle: string, period: string): Promise<DigitalDocument> {
  const session = useSessionStore();
  const system = useSystemStore();
  const username = session.username;
  if (!username) throw new Error(t('edubridge.error.notAuthorized'));
  const document = new DigitalDocument();
  await document.generate({
    registry_id: Cooperative.Registry.EducationConvertStatement.registry_id,
    coopname: system.info.coopname,
    username,
    sub_hash: quote.sub_hash,
    // В заявлении названы обе части: зачёт остатка кошелька программы и
    // конвертация недостающей суммы с паевого.
    amount: quote.to_convert,
    from_program: quote.from_program,
    total: quote.amount,
    course_title: courseTitle,
    period,
  });
  return document;
}

export async function subscribe(input: Omit<ISubscribeInput, 'document'>, statement: DigitalDocument) {
  const session = useSessionStore();
  const username = session.username;
  if (!username) throw new Error(t('edubridge.error.notAuthorized'));
  await statement.sign(username);
  if (!statement.signedDocument) throw new Error(t('edubridge.error.statementSignFailed'));
  const { [Mutations.Edubridge.Subscribe.name]: result } = await client.Mutation(Mutations.Edubridge.Subscribe.mutation, {
    variables: { data: { ...input, document: statement.signedDocument } },
  });
  return result;
}
