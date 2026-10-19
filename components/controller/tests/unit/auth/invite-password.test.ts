/**
 * Приглашение ведёт на установку пароля: страница берёт почту приглашённого
 * по токену из письма (`inviteRecipient`), ставит новый ключ (`resetKey`) и
 * задаёт пароль. Токен на чтение почты не расходуется, а смена ключа гасит
 * именно тот токен, по которому пришли: до 19.10.2026 приглашение оставалось
 * живым до истечения срока и по старой ссылке ключ можно было сменить снова.
 */
import { AuthInteractor } from '~/application/auth/interactors/auth.interactor';
import { tokenTypes } from '~/types/token.types';

function make(tokenDoc: { userId: string, type: string } | null, user: Record<string, unknown> | null) {
  const tokenApplicationService = {
    verifyToken: jest.fn(async () => {
      if (!tokenDoc) throw new Error('token not found');
      return tokenDoc;
    }),
    deleteTokens: jest.fn(async () => 1),
  } as any;
  const userDomainService = {
    findUserById: jest.fn(async () => user),
    findUserByLegacyMongoId: jest.fn(async () => null),
    updateUserById: jest.fn(async () => user),
  } as any;
  const blockchainPort = { changeKey: jest.fn(async () => undefined) } as any;
  const keyRevocation = { markRecovered: jest.fn(async () => undefined) } as any;
  const interactor = new AuthInteractor(
    {} as any, {} as any, {} as any,
    tokenApplicationService, blockchainPort, userDomainService,
    {} as any, {} as any, keyRevocation,
  );
  return { interactor, tokenApplicationService, blockchainPort };
}

const USER = { id: 'u1', username: 'ivanovivan12', email: 'ivan@example.com' };

describe('AuthInteractor — приглашение с паролем', () => {
  it('по токену приглашения отдаётся почта приглашённого, токен не расходуется', async () => {
    const { interactor, tokenApplicationService } = make({ userId: 'u1', type: tokenTypes.INVITE }, USER);
    await expect(interactor.inviteRecipient('t')).resolves.toEqual({ email: 'ivan@example.com' });
    expect(tokenApplicationService.verifyToken).toHaveBeenCalledWith({ token: 't', types: [tokenTypes.INVITE] });
    expect(tokenApplicationService.deleteTokens).not.toHaveBeenCalled();
  });

  it('чужой, истёкший или использованный токен — отказ с кодом', async () => {
    const { interactor } = make(null, USER);
    await expect(interactor.inviteRecipient('bogus')).rejects.toMatchObject({ code: 'AUTH_INVITE_TOKEN_INVALID' });
  });

  it('пользователь токена удалён — отказ тем же кодом, почта не раскрывается', async () => {
    const { interactor } = make({ userId: 'u1', type: tokenTypes.INVITE }, null);
    await expect(interactor.inviteRecipient('t')).rejects.toMatchObject({ code: 'AUTH_INVITE_TOKEN_INVALID' });
  });

  it('смена ключа по приглашению гасит токен приглашения', async () => {
    const { interactor, tokenApplicationService, blockchainPort } = make({ userId: 'u1', type: tokenTypes.INVITE }, USER);
    await interactor.resetKey({ token: 't', public_key: 'PUB_K1_x' });
    expect(blockchainPort.changeKey).toHaveBeenCalledWith(expect.objectContaining({ username: 'ivanovivan12', public_key: 'PUB_K1_x' }));
    expect(tokenApplicationService.deleteTokens).toHaveBeenCalledWith({ userId: 'u1', type: tokenTypes.INVITE });
  });

  it('смена ключа по ссылке сброса гасит токен сброса', async () => {
    const { interactor, tokenApplicationService } = make({ userId: 'u1', type: tokenTypes.RESET_KEY }, USER);
    await interactor.resetKey({ token: 't', public_key: 'PUB_K1_x' });
    expect(tokenApplicationService.deleteTokens).toHaveBeenCalledWith({ userId: 'u1', type: tokenTypes.RESET_KEY });
  });
});
