/**
 * Поставщики ядра в едином поиске: пайщики и документы.
 *
 * Что здесь защищается. Общее окно не должно стать обходом прав: личные данные
 * пайщиков видит только совет, чужие документы пайщику не находятся. Находка
 * ведёт туда, где её откроет именно этот пользователь: совет — в свой стол,
 * пайщик — в стол пайщика.
 *
 * Реестр случаев: test-registry/platform.global-search.yaml
 */

import type { InnerGlobalSearchContext } from '@coopenomics/innercoop';
import { GlobalSearchRegistry } from '~/application/search/global-search.registry';
import { ParticipantsSearchProvider } from '~/application/search/providers/participants-search.provider';
import { DocumentsSearchProvider } from '~/application/search/providers/documents-search.provider';

const CHAIRMAN: InnerGlobalSearchContext = { coopname: 'voskhod', username: 'ant', userRole: 'chairman' };
const MEMBER: InnerGlobalSearchContext = { coopname: 'voskhod', username: 'petr', userRole: 'member' };
const USER: InnerGlobalSearchContext = { coopname: 'voskhod', username: 'ivan', userRole: 'user' };

describe('ParticipantsSearchProvider', () => {
  function setup(results: unknown[]) {
    const repository = { searchPrivateAccounts: jest.fn().mockResolvedValue(results) };
    const registry = new GlobalSearchRegistry();
    const provider = new ParticipantsSearchProvider(registry, repository);
    return { repository, registry, provider };
  }

  it('регистрируется в реестре при запуске модуля', async () => {
    const { registry, provider } = setup([]);
    const register = jest.spyOn(registry, 'register');
    provider.onModuleInit();
    expect(register).toHaveBeenCalledWith(provider);
  });

  it('пайщику вне совета ничего не отдаёт и в базу не ходит', async () => {
    const { repository, provider } = setup([]);
    expect(await provider.search('Иван', USER, 5)).toEqual([]);
    expect(repository.searchPrivateAccounts).not.toHaveBeenCalled();
  });

  it('совету отдаёт пайщиков со ссылкой на страницу пайщика; организацию — по краткому наименованию', async () => {
    const { provider } = setup([
      { type: 'individual', data: { username: 'ivan', last_name: 'Иванов', first_name: 'Иван', middle_name: 'Иванович' } },
      { type: 'organization', data: { username: 'romashka', short_name: 'ООО «Ромашка»', full_name: 'Общество «Ромашка»' } },
      { type: 'individual', data: { username: '', last_name: 'Без аккаунта' } },
    ]);

    const hits = await provider.search('Иван', MEMBER, 5);

    expect(hits).toEqual([
      {
        key: 'ivan',
        title: 'Иванов Иван Иванович',
        subtitle: 'ivan',
        icon: 'person',
        route: { name: 'participant-details', params: { coopname: 'voskhod', username: 'ivan' } },
      },
      expect.objectContaining({ key: 'romashka', title: 'ООО «Ромашка»', icon: 'business' }),
    ]);
  });

  it('отдаёт не больше предела', async () => {
    const people = ['a', 'b', 'c'].map((username) => ({ type: 'individual', data: { username, last_name: username } }));
    const { provider } = setup(people);
    expect(await provider.search('Иван', CHAIRMAN, 2)).toHaveLength(2);
  });
});

describe('DocumentsSearchProvider', () => {
  function setup() {
    const repository = {
      search: jest.fn().mockResolvedValue([
        { hash: 'h1', full_title: 'Заявление о вступлении', username: 'ivan', signer: 'Иванов Иван', coopname: 'voskhod' },
        { hash: 'h2', full_title: 'Протокол совета', username: 'voskhod', signer: '', coopname: 'voskhod' },
      ]),
    };
    const provider = new DocumentsSearchProvider(new GlobalSearchRegistry(), repository as never);
    return { repository, provider };
  }

  it('совет ищет по всему кооперативу и открывает документ в своём столе', async () => {
    const { repository, provider } = setup();

    const hits = await provider.search('заявление', CHAIRMAN, 5);

    expect(repository.search).toHaveBeenCalledWith({ coopname: 'voskhod', query: 'заявление', limit: 5, username: undefined });
    expect(hits[0]).toEqual({
      key: 'h1',
      title: 'Заявление о вступлении',
      subtitle: 'Иванов Иван',
      icon: 'description',
      route: { name: 'document-details', params: { coopname: 'voskhod', hash: 'h1' } },
    });
    // Без подписанта подпись берётся из аккаунта.
    expect(hits[1].subtitle).toBe('voskhod');
  });

  it('пайщик ищет только по своим документам и открывает их в столе пайщика', async () => {
    const { repository, provider } = setup();

    const hits = await provider.search('заявление', USER, 5);

    expect(repository.search).toHaveBeenCalledWith(expect.objectContaining({ username: 'ivan' }));
    expect(hits[0].route).toEqual({ name: 'user-document-details', params: { coopname: 'voskhod', hash: 'h1' } });
  });
});
