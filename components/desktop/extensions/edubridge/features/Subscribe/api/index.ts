import { Cooperative } from 'cooptypes';
import { Mutations } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { DigitalDocument } from 'src/shared/lib/document';
import type { IQuote } from '../../../entities/Learner';

export type ISubscribeInput = Mutations.Edubridge.Subscribe.IInput['data'];

/**
 * Заявление о конвертации (3011) — генерируется на фронте из котировки (тот же
 * sub_hash и сумма, что проверит контракт) и подписывается локальным ключом.
 */
export async function buildConvertStatement(quote: IQuote, courseTitle: string, period: string): Promise<DigitalDocument> {
  const session = useSessionStore();
  const system = useSystemStore();
  const username = session.username;
  if (!username) throw new Error('Пайщик не авторизован');
  const document = new DigitalDocument();
  await document.generate({
    registry_id: Cooperative.Registry.EducationConvertStatement.registry_id,
    coopname: system.info.coopname,
    username,
    sub_hash: quote.sub_hash,
    amount: quote.amount,
    course_title: courseTitle,
    period,
  });
  return document;
}

export async function subscribe(input: Omit<ISubscribeInput, 'document'>, statement: DigitalDocument) {
  const session = useSessionStore();
  const username = session.username;
  if (!username) throw new Error('Пайщик не авторизован');
  await statement.sign(username);
  if (!statement.signedDocument) throw new Error('Не удалось подписать заявление');
  const { [Mutations.Edubridge.Subscribe.name]: result } = await client.Mutation(Mutations.Edubridge.Subscribe.mutation, {
    variables: { data: { ...input, document: statement.signedDocument } },
  });
  return result;
}
