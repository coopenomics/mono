/** Документы ЦПП «Образование» в реестре шаблонов кооператива: состав, вид и порядок. */
import { registerEdubridgeDocuments } from '~/extensions/edubridge/application/onboarding/register-edubridge-documents';
import type { InnerDocumentDeclaration } from '@coopenomics/innercoop';

function portSpy() {
  const registered: InnerDocumentDeclaration[] = [];
  const unregistered: string[] = [];
  return {
    registered,
    unregistered,
    port: {
      registerDocuments: jest.fn(async (d: InnerDocumentDeclaration[]) => { registered.push(...d); }),
      unregisterByExtension: jest.fn(async (name: string) => { unregistered.push(name); }),
    } as any,
  };
}

describe('Документы ЦПП «Образование» в реестре шаблонов кооператива', () => {
  it('объявляет положение, обе оферты, договор участия, бланки и протокол совета', async () => {
    const { port, registered } = portSpy();
    await registerEdubridgeDocuments(port);
    expect(registered.map((d) => d.registry_id).sort((a, b) => a - b)).toEqual([
      3000, 3002, 3004, 3006, 3007, 3008, 3009, 3010, 3011, 3012,
    ]);
    expect(registered.every((d) => d.extension_name === 'edubridge')).toBe(true);
  });

  it('шаблоны-двойники не объявляются — совет утверждает рабочий документ в бланке', async () => {
    const { port, registered } = portSpy();
    await registerEdubridgeDocuments(port);
    const ids = registered.map((d) => d.registry_id);
    expect(ids).not.toContain(3001);
    expect(ids).not.toContain(3003);
    expect(ids).not.toContain(3005);
  });

  it('положение, оферты и договор утверждаются советом под ключами шагов онбординга', async () => {
    const { port, registered } = portSpy();
    await registerEdubridgeDocuments(port);
    const byId = new Map(registered.map((d) => [d.registry_id, d]));
    expect(byId.get(3000)).toMatchObject({ kind: 'provision', approval: 'required', vars_field: 'education_provision' });
    expect(byId.get(3002)).toMatchObject({ kind: 'agreement', vars_field: 'education_parent_offer_template' });
    expect(byId.get(3004)).toMatchObject({ kind: 'agreement', vars_field: 'education_teacher_offer_template' });
    expect(byId.get(3006)).toMatchObject({ kind: 'agreement', vars_field: 'education_contract_template' });
  });

  it('акт ответственного хранения — бланк на утверждение, протокол совета утверждения не требует', async () => {
    const { port, registered } = portSpy();
    await registerEdubridgeDocuments(port);
    const byId = new Map(registered.map((d) => [d.registry_id, d]));
    expect(byId.get(3012)).toMatchObject({ kind: 'form', approval: 'required', bundle: 'education_forms' });
    expect(byId.get(3009)).toMatchObject({ kind: 'service', approval: 'none' });
  });

  it('перед объявлением снимает прежние декларации расширения', async () => {
    const { port, unregistered } = portSpy();
    await registerEdubridgeDocuments(port);
    expect(unregistered).toEqual(['edubridge']);
  });
});
