import { Cooperative } from 'cooptypes';
import { Mutations, Queries, type Zeus } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { DigitalDocument } from 'src/shared/lib/document';
import type { IDeclineReturnInput, IRequestReturnInput } from '../model';

export async function fetchReturnBalance() {
  const { [Queries.Edubridge.ReturnBalance.name]: result } = await client.Query(Queries.Edubridge.ReturnBalance.query);
  return result;
}

export async function fetchMyReturnRequests() {
  const { [Queries.Edubridge.MyReturnRequests.name]: result } = await client.Query(Queries.Edubridge.MyReturnRequests.query);
  return result;
}

export async function fetchReturnRequests(status?: Zeus.EduReturnStatus | null) {
  const { [Queries.Edubridge.ReturnRequests.name]: result } = await client.Query(Queries.Edubridge.ReturnRequests.query, {
    variables: { status },
  });
  return result;
}

/**
 * Заявление о возврате членского взноса в паевой взнос (3013): формируется на
 * сумму заявки и подписывается локальным ключом пайщика.
 */
export async function buildReturnStatement(amount: string): Promise<DigitalDocument> {
  const session = useSessionStore();
  const system = useSystemStore();
  const username = session.username;
  if (!username) throw new Error('Пайщик не авторизован');
  const document = new DigitalDocument();
  await document.generate({
    registry_id: Cooperative.Registry.EducationReturnStatement.registry_id,
    coopname: system.info.coopname,
    username,
    amount,
  });
  return document;
}

export async function requestReturn(amount: string, statement: DigitalDocument) {
  const session = useSessionStore();
  const username = session.username;
  if (!username) throw new Error('Пайщик не авторизован');
  await statement.sign(username);
  if (!statement.signedDocument) throw new Error('Не удалось подписать заявление');
  const data: IRequestReturnInput = { amount, document: statement.signedDocument };
  const { [Mutations.Edubridge.RequestReturn.name]: result } = await client.Mutation(Mutations.Edubridge.RequestReturn.mutation, {
    variables: { data },
  });
  return result;
}

export async function approveReturn(id: string) {
  const { [Mutations.Edubridge.ApproveReturn.name]: result } = await client.Mutation(Mutations.Edubridge.ApproveReturn.mutation, {
    variables: { id },
  });
  return result;
}

export async function declineReturn(data: IDeclineReturnInput) {
  const { [Mutations.Edubridge.DeclineReturn.name]: result } = await client.Mutation(Mutations.Edubridge.DeclineReturn.mutation, {
    variables: { data },
  });
  return result;
}
