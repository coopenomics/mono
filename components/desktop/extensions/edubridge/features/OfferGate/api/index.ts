import { Cooperative } from 'cooptypes';
import { Mutations, Queries, Zeus } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { DigitalDocument } from 'src/shared/lib/document';

export type IEduOnboardingState = Queries.Edubridge.OnboardingState.IOutput['edubridgeOnboardingState'];
export type EduOfferKind = Mutations.Edubridge.SignOffer.IInput['input']['kind'];

const REGISTRY_BY_KIND: Record<EduOfferKind, number> = {
  [Zeus.EduOfferKind.PARENT]: Cooperative.Registry.EducationParentOffer.registry_id,
  [Zeus.EduOfferKind.TEACHER]: Cooperative.Registry.EducationTeacherOffer.registry_id,
};

export async function fetchOnboardingState(): Promise<IEduOnboardingState> {
  const { [Queries.Edubridge.OnboardingState.name]: result } = await client.Query(Queries.Edubridge.OnboardingState.query);
  return result;
}

/**
 * Экземпляр оферты без подписи — для ознакомления. Номер и дата задаются здесь
 * же (канон Благороста: 16 hex, DD.MM.YYYY), и тот же экземпляр потом уходит
 * на подпись — подписанное совпадает с прочитанным.
 */
export async function buildOfferDocument(kind: EduOfferKind): Promise<DigitalDocument> {
  const session = useSessionStore();
  const system = useSystemStore();
  const username = session.username;
  if (!username) throw new Error('Пайщик не авторизован');
  const coopname = system.info.coopname;
  if (!coopname) throw new Error('Не определён кооператив');

  const rnd = new Uint8Array(8);
  crypto.getRandomValues(rnd);
  const agreement_number = Array.from(rnd).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const agreement_created_at = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;

  const document = new DigitalDocument();
  await document.generate({
    registry_id: REGISTRY_BY_KIND[kind],
    coopname,
    username,
    agreement_number,
    agreement_created_at,
  });
  return document;
}

/** Подписать оферту локальным ключом и отправить; ядро выполнит wallet::signagree. */
export async function signOffer(kind: EduOfferKind, prepared?: DigitalDocument): Promise<IEduOnboardingState> {
  const session = useSessionStore();
  const username = session.username;
  if (!username) throw new Error('Пайщик не авторизован');
  const document = prepared ?? (await buildOfferDocument(kind));
  await document.sign(username);
  if (!document.signedDocument) throw new Error('Не удалось подписать оферту');
  const { [Mutations.Edubridge.SignOffer.name]: result } = await client.Mutation(Mutations.Edubridge.SignOffer.mutation, {
    variables: { input: { kind, document: document.signedDocument } },
  });
  return result;
}
