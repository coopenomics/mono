import { PrivateKey, KeyType } from '@wharfkit/antelope';
import canonicalize from 'canonicalize';
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { CardcoopLinkWebhookController } from '~/extensions/cardcoop/application/link-webhook.controller';

jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({ coopname: 'voskhod' }),
}));

/**
 * Приём уведомлений о связках (story 7.2).
 *
 * Это команда выпустить свидетельство о членстве, поэтому проверка подписи и
 * принадлежности кооперативу здесь не формальность: принять чужое или
 * неподписанное значит засвидетельствовать членство по чужому указанию.
 */
const key = PrivateKey.generate(KeyType.K1);
const publicKey = key.toPublic().toString();

const sign = (payload: unknown) => key.signMessage(Buffer.from(canonicalize(payload) as string, 'utf8')).toString();

const logger = { setContext: () => undefined, info: () => undefined, warn: jest.fn(), error: jest.fn(), log: () => undefined };

const notification = {
  event: 'link.created',
  card_id: 'card-1',
  coopname: 'voskhod',
  external_subject: 'uuid-1',
  origin: 'coop_flow',
  occurred_at: '2026-08-30T10:00:00.000Z',
  event_id: 'evt-1',
};

const build = (overrides: { webhookKey?: string; issue?: jest.Mock; chainAccount?: unknown } = {}) => {
  const issue = overrides.issue ?? jest.fn(async () => undefined);
  const controller = new CardcoopLinkWebhookController(
    { config: { api_url: 'https://card.coop', webhook_key: overrides.webhookKey ?? publicKey } } as any,
    { issue } as any,
    { findBySubject: async () => ({ username: 'ant', email: '', role: 'user' }) } as any,
    {
      getChainAccount: async () =>
        overrides.chainAccount === undefined ? { registered_at: '2026-01-15T08:00:00.000Z' } : overrides.chainAccount,
    } as any,
    logger as any
  );
  return { controller, issue };
};

/** Выпуск идёт в фоне — даём микрозадачам отработать. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('Уведомление о связке карты с кооперативом', () => {
  beforeEach(() => jest.clearAllMocks());

  it('подписанное уведомление ведёт к выпуску подтверждения с датой приёма из цепи', async () => {
    const { controller, issue } = build();

    await controller.handleLinkCreated(notification, sign(notification));
    await settle();

    expect(issue).toHaveBeenCalledWith('https://card.coop', 'ant', 'card-1', '2026-01-15');
  });

  it('уведомление без подписи отвергается', async () => {
    const { controller, issue } = build();

    await expect(controller.handleLinkCreated(notification, undefined)).rejects.toThrow(ForbiddenException);
    expect(issue).not.toHaveBeenCalled();
  });

  it('подпись чужим ключом не проходит', async () => {
    const stranger = PrivateKey.generate(KeyType.K1);
    const { controller, issue } = build();

    const foreign = stranger.signMessage(Buffer.from(canonicalize(notification) as string, 'utf8')).toString();

    await expect(controller.handleLinkCreated(notification, foreign)).rejects.toThrow(ForbiddenException);
    expect(issue).not.toHaveBeenCalled();
  });

  it('подменённое тело не сходится с подписью — подпись накрывает содержимое, а не факт отправки', async () => {
    const signature = sign(notification);
    const { controller, issue } = build();

    await expect(
      controller.handleLinkCreated({ ...notification, card_id: 'card-подменённая' }, signature)
    ).rejects.toThrow(ForbiddenException);
    expect(issue).not.toHaveBeenCalled();
  });

  it('без заданного ключа приём закрыт — проверять нечем, и принимать нельзя', async () => {
    const { controller } = build({ webhookKey: '' });

    await expect(controller.handleLinkCreated(notification, sign(notification))).rejects.toThrow(
      ServiceUnavailableException
    );
  });

  it('уведомление о чужом кооперативе отвергается', async () => {
    const foreign = { ...notification, coopname: 'other' };
    const { controller, issue } = build();

    await expect(controller.handleLinkCreated(foreign, sign(foreign))).rejects.toThrow(ForbiddenException);
    expect(issue).not.toHaveBeenCalled();
  });

  it('событие другого рода принимается молча и ничего не выпускает', async () => {
    const other = { ...notification, event: 'link.removed' };
    const { controller, issue } = build();

    await expect(controller.handleLinkCreated(other, sign(other))).resolves.toEqual({ accepted: true });
    await settle();
    expect(issue).not.toHaveBeenCalled();
  });

  it('пайщик, не принятый в цепи, не получает свидетельства, но сеть об этом не узнаёт', async () => {
    const { controller, issue } = build({ chainAccount: null });

    await expect(controller.handleLinkCreated(notification, sign(notification))).resolves.toEqual({ accepted: true });
    await settle();

    expect(issue).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('не принят в кооператив в цепи'));
  });
});
