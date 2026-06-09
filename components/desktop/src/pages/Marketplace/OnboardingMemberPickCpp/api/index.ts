import { Mutations, Queries } from '@coopenomics/sdk';
import { Cooperative } from 'cooptypes';
import { DigitalDocument } from 'src/shared/lib/document';
import { client } from 'src/shared/api/client';
import { useSessionStore } from 'src/entities/Session/model';
import { useSystemStore } from 'src/entities/System/model';

/**
 * Эпик 1 / Story 1.4 + фоллоуап: L3 онбординг пайщика на стол заказов.
 *
 *  - `fetchOnboardingState`: GET state (Story 1.4), сервер берёт username из JWT.
 *  - `signOnboardingOffer`: фоллоуап, MUT `marketplaceSignOnboardingOffer` —
 *    генерирует оферту (registry_id=1102), подписывает локальным WIF и
 *    отправляет в контроллер, который пишет on-chain `wallet::signagree`.
 */

export type MarketplaceOnboardingStateView =
  Queries.Marketplace.MarketplaceOnboardingState.IOutput['marketplaceOnboardingState'];

export async function fetchOnboardingState(): Promise<MarketplaceOnboardingStateView> {
  const { [Queries.Marketplace.MarketplaceOnboardingState.name]: result } = await client.Query(
    Queries.Marketplace.MarketplaceOnboardingState.query,
    {},
  );
  return result;
}

/**
 * Сгенерировать инстанс оферты ЦПП «Стол заказов» (registry_id=1102) БЕЗ подписи —
 * для предварительного ознакомления (как `generateStatementWithoutSignature` в
 * SignUp). Возвращает `DigitalDocument` с готовым `.data.html` для показа в
 * диалоге. Тот же инстанс затем передаётся в `signOnboardingOffer`, чтобы
 * подписанный документ совпадал с прочитанным (один marketplace_agreement_number).
 */
export async function buildOnboardingOfferDocument(): Promise<DigitalDocument> {
  const session = useSessionStore();
  const system = useSystemStore();
  const username = session.username;
  if (!username) throw new Error('Пайщик не авторизован');
  const coopname = system.info.coopname;
  if (!coopname) throw new Error('Не определён кооператив');

  // Номер соглашения — по канону Благороста (capital
  // `UdataDocumentParametersService.generateDocumentNumber`): 16 hex-символов в
  // верхнем регистре, без префиксов и таймстампов. На фронте берём из Web Crypto
  // 8 случайных байт → ровно 16 hex.
  const rnd = new Uint8Array(8);
  crypto.getRandomValues(rnd);
  const marketplace_agreement_number = Array.from(rnd)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  // Дата — DD.MM.YYYY (как `generateDate` в capital), без времени.
  const marketplace_agreement_created_at = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;

  const document = new DigitalDocument();
  await document.generate({
    registry_id: Cooperative.Registry.MarketplaceOffer.registry_id,
    coopname,
    username,
    marketplace_agreement_number,
    marketplace_agreement_created_at,
  });
  return document;
}

/**
 * Подписать оферту ЦПП «Стол заказов» прямо со стола.
 *
 * Flow:
 *  1. Взять заранее сгенерированный для ознакомления инстанс оферты (`prepared`)
 *     либо сгенерировать новый (registry_id=1102).
 *  2. Подписать локальным WIF пайщика (signatureId=1, signer=username).
 *  3. Отправить подписанный документ через `marketplaceSignOnboardingOffer`,
 *     контроллер сам выполнит on-chain `wallet::signagree` от лица coopname.
 *
 * Возвращает свежее состояние онбординга — UI решает что показать
 * (`requires_gate=false, source='agreement_signed'` → редирект на /market).
 */
export async function signOnboardingOffer(
  prepared?: DigitalDocument,
): Promise<MarketplaceOnboardingStateView> {
  const session = useSessionStore();
  const username = session.username;
  if (!username) throw new Error('Пайщик не авторизован');

  const document = prepared ?? (await buildOnboardingOfferDocument());
  await document.sign(username);

  if (!document.signedDocument) {
    throw new Error('Не удалось подписать оферту');
  }

  const { [Mutations.Marketplace.MarketplaceSignOnboardingOffer.name]: result } = await client.Mutation(
    Mutations.Marketplace.MarketplaceSignOnboardingOffer.mutation,
    { variables: { input: { document: document.signedDocument } } },
  );
  return result as MarketplaceOnboardingStateView;
}
