import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Протокол общего собрания вслепую не подписывается (решение владельца 24.11.2026).
 *
 * Секретарь и председатель собрания нажимают «Подписать» / «Утвердить», видят
 * текст протокола и подписывают только подтверждением в окне. «Назад» закрывает
 * окно без подписи. Для секретаря стол заранее собирает протокол, председателю
 * показывает тот же документ с подписью секретаря.
 */
const mutation = vi.fn();
const signDocument = vi.fn(async () => ({ signed: true }));
const loadMeet = vi.fn(async () => undefined);
const fail = vi.fn();

const decision1 = { rawDocument: { html: '<p>протокол</p>' }, document: { doc_hash: 'H', signatures: [{ id: 1 }] } };
const meetStore = {
  currentMeet: { hash: 'MEET', processing: { meet: { secretary: 'sec', presider: 'pres', decision1 } } } as any,
  loadMeet,
};

vi.mock('src/shared/api/client', () => ({ client: { Mutation: (...args: unknown[]) => mutation(...args) } }));
vi.mock('src/shared/lib/document', () => ({ signDocument: (...args: unknown[]) => (signDocument as any)(...args) }));
vi.mock('src/shared/api', () => ({ FailAlert: (...args: unknown[]) => fail(...args), SuccessAlert: vi.fn() }));
vi.mock('src/shared/i18n', () => ({ t: (key: string) => key }));
vi.mock('src/entities/Meet', () => ({ useMeetStore: () => meetStore }));
vi.mock('src/entities/Session', () => ({ useSessionStore: () => ({ username: 'sec' }) }));
vi.mock('src/entities/System/model', () => ({ useSystemStore: () => ({ info: { coopname: 'voskhod' } }) }));

const { useCloseMeet } = await import('src/features/Meet/CloseMeetWithDecision/model');
const { Mutations } = await import('@coopenomics/sdk');

beforeEach(() => {
  mutation.mockReset();
  signDocument.mockClear();
  loadMeet.mockClear();
  fail.mockClear();
  mutation.mockImplementation(async (m: unknown) =>
    m === Mutations.Meet.GenerateAnnualGeneralMeetDecisionDocument.mutation
      ? { [Mutations.Meet.GenerateAnnualGeneralMeetDecisionDocument.name]: { html: '<p>новый протокол</p>' } }
      : { [Mutations.Meet.SignBySecretaryOnAnnualGeneralMeet.name]: {}, [Mutations.Meet.SignByPresiderOnAnnualGeneralMeet.name]: {} },
  );
});

describe('meet.protocol.ui — протокол перед подписью', () => {
  it('секретарь: кнопка собирает протокол и показывает его, подписи нет', async () => {
    const flow = useCloseMeet();
    await flow.openSecretaryProtocol();
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(mutation.mock.calls[0][0]).toBe(Mutations.Meet.GenerateAnnualGeneralMeetDecisionDocument.mutation);
    expect(signDocument).not.toHaveBeenCalled();
    expect(flow.protocolPreviewOpen.value).toBe(true);
    expect((flow.protocolPreview.value?.aggregate as any).rawDocument.html).toBe('<p>новый протокол</p>');
  });

  it('секретарь: подтверждение подписывает показанный протокол', async () => {
    const flow = useCloseMeet();
    await flow.openSecretaryProtocol();
    await flow.confirmProtocol();
    expect(signDocument).toHaveBeenCalledWith({ html: '<p>новый протокол</p>' }, 'sec');
    expect(mutation.mock.calls[1][0]).toBe(Mutations.Meet.SignBySecretaryOnAnnualGeneralMeet.mutation);
    expect(flow.protocolPreviewOpen.value).toBe(false);
    expect(loadMeet).toHaveBeenCalled();
  });

  it('«Назад» закрывает окно без подписи', async () => {
    const flow = useCloseMeet();
    await flow.openSecretaryProtocol();
    flow.protocolPreviewOpen.value = false;
    await flow.confirmProtocol();
    expect(signDocument).not.toHaveBeenCalled();
    expect(mutation).toHaveBeenCalledTimes(1);
  });

  it('председатель: видит протокол с подписью секретаря, подпись — вторая', async () => {
    const flow = useCloseMeet();
    flow.openPresiderProtocol();
    expect(mutation).not.toHaveBeenCalled();
    expect(flow.protocolPreview.value?.aggregate).toEqual(decision1);
    await flow.confirmProtocol();
    expect(signDocument).toHaveBeenCalledWith(decision1.rawDocument, 'sec', 2, [decision1.document]);
    expect(mutation.mock.calls[0][0]).toBe(Mutations.Meet.SignByPresiderOnAnnualGeneralMeet.mutation);
  });
});
