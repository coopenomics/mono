import { Cooperative } from 'cooptypes';
import type { Mutations } from '@coopenomics/sdk';
import { DigitalDocument } from 'src/shared/lib/document';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { api } from '../api';

export type IAuthorizeDecisionInput = Mutations.Decisions.AuthorizeDecision.IInput['data']

export function useAuthorizeAndExecDecision() {
  const { info } = useSystemStore()

  async function authorizeAndExecDecision(
    username: string,
    registry_id: number,
    decision_id: number,
    meta?: object,
  ) {
    const session = useSessionStore();

    const document = await new DigitalDocument().generate<Cooperative.Registry.DecisionOfParticipantApplication.Action>({
      registry_id: registry_id,
      coopname: info.coopname,
      username,
      lang: 'ru',
      decision_id,
      ...meta,
    });

    if (!document) {
      throw new Error('Ошибка при генерации документа решения');
    }

    const rawDocument = new DigitalDocument(document)
    const signedDocument = await rawDocument.sign<any>(username)

    // Утверждение + исполнение проводит контроллер ключом кооператива.
    // meta передаём объектом — бэкенд сам сериализует при сборке chain-action.
    return await api.authorizeDecision({
      coopname: info.coopname,
      chairman: session.username,
      decision_id,
      document: signedDocument,
    });
  }
  return { authorizeAndExecDecision };
}
