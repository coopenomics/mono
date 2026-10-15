/**
 * Вебхук LiveKit принимается только с подписью сервера LiveKit: JWT в
 * `Authorization`, выпущенный ключом, которым секретарь входит в комнаты.
 */
import { createHash } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { AccessToken } from 'livekit-server-sdk';
import { LiveKitWebhookController } from '~/extensions/chatcoop/application/controllers/livekit-webhook.controller';

const KEY = 'lk-key';
const SECRET = 'lk-secret-lk-secret-lk-secret-32b';

function build(livekit: { api_key?: string; api_secret?: string } | null = { api_key: KEY, api_secret: SECRET }) {
  const integrations = { get: jest.fn().mockReturnValue(livekit) };
  // Установленного расширения нет — прошедшее проверку событие просто игнорируется.
  const extensions = { findByName: jest.fn().mockResolvedValue(null) };
  const controller = new LiveKitWebhookController({} as any, extensions as any, {} as any, {} as any, integrations as any);
  return { controller, extensions };
}

async function signed(raw: string, secret = SECRET): Promise<string> {
  const token = new AccessToken(KEY, secret, { ttl: '5m' });
  token.sha256 = createHash('sha256').update(raw, 'utf8').digest('base64');
  return token.toJwt();
}

function request(raw: string, authorization?: string) {
  return { rawBody: raw, headers: authorization ? { authorization } : {}, get: () => authorization };
}

describe('LiveKit webhook: подпись', () => {
  const raw = '{"event": "room_started","room":{"name":"r1"}}';
  const body = JSON.parse(raw);

  it('подписанное LiveKit событие принимается', async () => {
    const { controller, extensions } = build();
    await expect(controller.handleWebhook(request(raw, await signed(raw)), body)).resolves.toEqual({ status: 'ignored' });
    expect(extensions.findByName).toHaveBeenCalled();
  });

  it('без подписи — 401', async () => {
    const { controller, extensions } = build();
    await expect(controller.handleWebhook(request(raw), body)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(extensions.findByName).not.toHaveBeenCalled();
  });

  it('подпись чужим секретом — 401', async () => {
    const { controller } = build();
    const token = await signed(raw, 'other-secret-other-secret-other-32');
    await expect(controller.handleWebhook(request(raw, token), body)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('ключи LiveKit не настроены — событие не принимается', async () => {
    const { controller } = build(null);
    await expect(controller.handleWebhook(request(raw, await signed(raw)), body)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
