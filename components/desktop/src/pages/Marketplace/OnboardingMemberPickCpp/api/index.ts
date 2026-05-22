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
 *    генерирует оферту (registry_id=1101), подписывает локальным WIF и
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
 * Подписать оферту ЦПП «Стол заказов» прямо со стола.
 *
 * Flow:
 *  1. Сгенерировать инстанс оферты на backend (registry_id=1101) с уникальным
 *     marketplace_agreement_number и текущей датой.
 *  2. Подписать локальным WIF пайщика (signatureId=1, signer=username).
 *  3. Отправить подписанный документ через `marketplaceSignOnboardingOffer`,
 *     контроллер сам выполнит on-chain `wallet::signagree` от лица coopname.
 *
 * Возвращает свежее состояние онбординга — UI решает что показать
 * (`requires_gate=false, source='agreement_signed'` → редирект на /market).
 */
export async function signOnboardingOffer(): Promise<MarketplaceOnboardingStateView> {
  const session = useSessionStore();
  const system = useSystemStore();
  const username = session.username;
  if (!username) throw new Error('Пайщик не авторизован');
  const coopname = system.info.coopname;
  if (!coopname) throw new Error('Не определён кооператив');

  const now = new Date();
  // Номер соглашения: краткая отметка времени, уникальная в пределах пайщика.
  // Финальный формат может быть переопределён coopname-конвенцией; пока
  // используется компактный timestamp + хеш-суффикс для разрешения коллизий.
  const marketplace_agreement_number = `MA-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
  const pad = (n: number) => String(n).padStart(2, '0');
  const marketplace_agreement_created_at = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const document = new DigitalDocument();
  await document.generate({
    registry_id: Cooperative.Registry.MarketplaceOffer.registry_id,
    coopname,
    username,
    marketplace_agreement_number,
    marketplace_agreement_created_at,
  });
  await document.sign(username);

  if (!document.signedDocument) {
    throw new Error('Не удалось подписать оферту');
  }

  const { [Mutations.Marketplace.MarketplaceSignOnboardingOffer.name]: result } = await client.Mutation(
    Mutations.Marketplace.MarketplaceSignOnboardingOffer.mutation,
    { input: { document: document.signedDocument } },
  );
  return result as MarketplaceOnboardingStateView;
}
