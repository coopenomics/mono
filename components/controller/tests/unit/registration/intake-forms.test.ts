/**
 * Анкеты вступления (C28-71): реестр, сборка для заявителя и проверка ответов.
 *
 * Покрывают:
 *   (a) регистрация анкеты строит JSON Schema с разобранным описанием поля;
 *   (b) анкета без полей или без подписи поля отклоняется на регистрации;
 *   (c) конфликт id между расширениями → ConflictException, повтор от того же — перезапись;
 *   (d) анкета с пустым applicable_account_types приходит только через программу;
 *   (e) остановка расширения снимает его анкеты, чужие остаются;
 *   (f) проверка ответов: нет ответа, ответ не проходит схему, лишняя анкета,
 *       корректный ответ (значения очищены, со снимком заголовка и схемы);
 *   (g) проверка значений по схеме: числа, флажки, перечисления, вложенный объект.
 */

import { BadRequestException, ConflictException } from '@nestjs/common';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import { AccountType } from '~/application/account/enum/account-type.enum';
import { AgreementRegistryService } from '~/domain/registration/services/agreement-registry.service';
import { AgreementConfigurationService } from '~/domain/registration/services/agreement-configuration.service';
import { checkIntakeAnswers } from '~/domain/registration/utils/intake-answers.utils';
import { normalizeIntakeSchema, validateIntakeValues } from '~/domain/registration/utils/intake-schema.utils';
import type { IntakeFormRegistrationSpec } from '~/domain/registration/dto/intake-form-registration-spec.dto';

function makeLoggerStub() {
  return { setContext: jest.fn(), debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
}

const describeField = (d: Record<string, unknown>) => JSON.stringify(d);

// Расширение описывает анкету Zod-схемой, а через порт отдаёт данные — JSON Schema.
// Типы zod у конвертера и у контроллера расходятся по версиям — сужаем сигнатуру.
const convert = zodToJsonSchema as unknown as (schema: unknown, options: { $refStrategy: 'none' }) => any;
const toSchema = (zod: unknown) => convert(zod, { $refStrategy: 'none' });

const LetterSchema = toSchema(
  z.object({
    cover_letter: z
      .string()
      .min(20)
      .describe(describeField({ label: 'Сопроводительное письмо', note: 'О себе', maxRows: 12 })),
    city: z.string().optional().describe(describeField({ label: 'Город' })),
  })
);

function makeForm(partial: Partial<IntakeFormRegistrationSpec> = {}): IntakeFormRegistrationSpec {
  return {
    id: 'letter',
    extension_name: 'capital',
    title: 'Письмо',
    schema: LetterSchema,
    applicable_account_types: [],
    order: 1,
    ...partial,
  };
}

function makeProgram(registry: AgreementRegistryService, intake_form_ids: string[]) {
  registry.registerProgram({
    key: 'GENERATION',
    title: 'Генерация',
    description: '',
    applicable_account_types: [AccountType.individual] as any,
    agreement_ids: [],
    intake_form_ids,
    order: 1,
    extension_name: 'capital',
  });
}

describe('анкеты вступления: реестр', () => {
  let registry: AgreementRegistryService;

  beforeEach(() => {
    registry = new AgreementRegistryService(makeLoggerStub());
  });

  it('строит JSON Schema с разобранным описанием полей', () => {
    registry.registerIntakeForm(makeForm());

    const form = registry.getIntakeForm('letter');
    const properties = form?.json_schema.properties as any;

    expect(form?.json_schema.type).toBe('object');
    expect(properties.cover_letter.description).toEqual({
      label: 'Сопроводительное письмо',
      note: 'О себе',
      maxRows: 12,
    });
    expect(properties.cover_letter.minLength).toBe(20);
    expect(form?.json_schema.required).toEqual(['cover_letter']);
    expect((form?.json_schema as any).$schema).toBeUndefined();
  });

  it('отклоняет анкету без полей', () => {
    expect(() => registry.registerIntakeForm(makeForm({ schema: toSchema(z.object({})) }))).toThrow(
      BadRequestException
    );
    expect(() => registry.registerIntakeForm(makeForm({ schema: toSchema(z.string()) }))).toThrow(
      BadRequestException
    );
    expect(registry.getIntakeForm('letter')).toBeNull();
  });

  it('отклоняет анкету, у поля которой нет подписи', () => {
    const schema = toSchema(z.object({ cover_letter: z.string() }));
    expect(() => registry.registerIntakeForm(makeForm({ schema }))).toThrow(/нет подписи/);
  });

  it('отклоняет поле, ответ на которое ядро проверить не умеет', () => {
    const schema = toSchema(
      z.object({ links: z.array(z.string()).describe(describeField({ label: 'Ссылки' })) })
    );
    expect(() => registry.registerIntakeForm(makeForm({ schema }))).toThrow(/не поддерживается/);
  });

  it('чужой id → ConflictException, повтор от владельца — перезапись', () => {
    registry.registerIntakeForm(makeForm());
    expect(() => registry.registerIntakeForm(makeForm({ extension_name: 'market' }))).toThrow(ConflictException);

    registry.registerIntakeForm(makeForm({ title: 'Письмо совету' }));
    expect(registry.getIntakeForm('letter')?.title).toBe('Письмо совету');
    expect(registry.listIntakeForms()).toHaveLength(1);
  });

  it('чужую анкету снять нельзя', () => {
    registry.registerIntakeForm(makeForm());
    registry.unregisterIntakeForm('letter', 'market');
    expect(registry.getIntakeForm('letter')).not.toBeNull();

    registry.unregisterIntakeForm('letter', 'capital');
    expect(registry.getIntakeForm('letter')).toBeNull();
  });

  it('анкета с пустым списком типов приходит только через программу', () => {
    registry.registerIntakeForm(makeForm());
    registry.registerIntakeForm(
      makeForm({ id: 'common', applicable_account_types: [AccountType.organization] as any, order: 2 })
    );
    makeProgram(registry, ['letter', 'missing']);

    expect(registry.listIntakeFormsForAccountType(AccountType.individual)).toEqual([]);
    expect(registry.listIntakeFormsForAccountType(AccountType.organization).map((f) => f.id)).toEqual(['common']);
    expect(registry.listIntakeFormsForProgram('GENERATION').map((f) => f.id)).toEqual(['letter']);
    expect(registry.listIntakeFormsForProgram('UNKNOWN')).toEqual([]);
  });

  it('остановка расширения снимает только его анкеты', () => {
    registry.registerIntakeForm(makeForm());
    registry.registerIntakeForm(makeForm({ id: 'other', extension_name: 'market' }));

    registry.onExtensionTerminate({ appName: 'capital' } as any);

    expect(registry.listIntakeForms().map((f) => f.id)).toEqual(['other']);
  });
});

describe('анкеты вступления: сборка для заявителя', () => {
  it('программа несёт свои анкеты, общие идут отдельно и не дублируются', () => {
    const registry = new AgreementRegistryService(makeLoggerStub());
    const config = new AgreementConfigurationService({ getDefaultAdditionalAgreements: () => [] } as any, registry);

    registry.registerIntakeForm(makeForm());
    registry.registerIntakeForm(
      makeForm({ id: 'common', applicable_account_types: [AccountType.individual] as any, order: 0 })
    );
    makeProgram(registry, ['letter', 'common']);

    const [program] = config.getAvailablePrograms('voskhod', AccountType.individual);
    expect(program.intake_forms.map((f) => f.id)).toEqual(['letter', 'common']);
    expect((program.intake_forms[0] as any).extension_name).toBeUndefined();

    expect(config.getIntakeFormsForAccountType(AccountType.individual).map((f) => f.id)).toEqual(['common']);
    expect(config.getRequiredIntakeForms(AccountType.individual, 'GENERATION').map((f) => f.id)).toEqual([
      'common',
      'letter',
    ]);
    expect(config.getRequiredIntakeForms(AccountType.individual).map((f) => f.id)).toEqual(['common']);
    // Анкеты программы идут с ней независимо от типа аккаунта — обе перечислены в её intake_form_ids.
    expect(config.getRequiredIntakeForms(AccountType.organization, 'GENERATION').map((f) => f.id)).toEqual([
      'common',
      'letter',
    ]);
    expect(config.getRequiredIntakeForms(AccountType.organization).map((f) => f.id)).toEqual([]);
  });
});

describe('анкеты вступления: проверка ответов', () => {
  const registry = new AgreementRegistryService(makeLoggerStub());
  registry.registerIntakeForm(makeForm());
  const required = registry.listIntakeForms();
  const letter = 'Занимаюсь разработкой, хочу участвовать в проектах кооператива.';

  it('нет анкет — нет замечаний', () => {
    expect(checkIntakeAnswers([], undefined)).toEqual({ answers: {}, problems: [] });
  });

  it('нет ответа на обязательную анкету', () => {
    const { problems, answers } = checkIntakeAnswers(required, undefined);
    expect(problems).toEqual(['Письмо: не заполнена']);
    expect(answers).toEqual({});
  });

  it('короткий текст — замечание с подписью поля и сообщением схемы', () => {
    const { problems } = checkIntakeAnswers(required, [{ form_id: 'letter', values: { cover_letter: '  мало  ' } }]);
    expect(problems).toEqual(['Письмо — Сопроводительное письмо: не короче 20 символов']);
  });

  it('пустой ответ — замечание об обязательном поле', () => {
    const { problems } = checkIntakeAnswers(required, [{ form_id: 'letter', values: {} }]);
    expect(problems).toEqual(['Письмо — Сопроводительное письмо: заполните поле']);
  });

  it('анкета, которой заявителю не положено, — замечание', () => {
    const { problems, answers } = checkIntakeAnswers(required, [
      { form_id: 'letter', values: { cover_letter: letter } },
      { form_id: 'stranger', values: {} },
    ]);
    expect(problems).toEqual(['Для этой заявки не предусмотрены анкеты: stranger']);
    expect(answers).toEqual({});
  });

  it('корректный ответ хранится обрезанным, со снимком заголовка и схемы', () => {
    const now = new Date('2026-09-17T10:00:00.000Z');
    const { problems, answers } = checkIntakeAnswers(
      required,
      [{ form_id: 'letter', values: { cover_letter: `  ${letter}  `, extra: 'лишнее' } }],
      now
    );

    expect(problems).toEqual([]);
    expect(answers.letter.values).toEqual({ cover_letter: letter });
    expect(answers.letter.title).toBe('Письмо');
    expect(answers.letter.extension_name).toBe('capital');
    expect(answers.letter.submitted_at).toBe('2026-09-17T10:00:00.000Z');
    expect((answers.letter.json_schema.properties as any).cover_letter.description.label).toBe(
      'Сопроводительное письмо'
    );
  });
});

describe('анкеты вступления: проверка значений по схеме', () => {
  const schema = normalizeIntakeSchema(
    'profile',
    toSchema(
      z.object({
        hours: z.number().int().min(1).max(40).describe(describeField({ label: 'Часов в неделю' })),
        remote: z.boolean().optional().describe(describeField({ label: 'Удалённо' })),
        level: z.enum(['junior', 'senior']).describe(describeField({ label: 'Уровень' })),
        contacts: z
          .object({ telegram: z.string().max(5).describe(describeField({ label: 'Телеграм' })) })
          .describe(describeField({ label: 'Контакты' })),
      })
    )
  );

  it('корректные значения проходят, строки обрезаются, неизвестное отбрасывается', () => {
    const { data, issues } = validateIntakeValues(schema, {
      hours: 20,
      remote: false,
      level: 'senior',
      contacts: { telegram: ' @ant ', phone: '123' },
      junk: 1,
    });
    expect(issues).toEqual([]);
    expect(data).toEqual({ hours: 20, remote: false, level: 'senior', contacts: { telegram: '@ant' } });
  });

  it('замечания называют поле по пути и говорят по-русски', () => {
    const { issues } = validateIntakeValues(schema, {
      hours: 50.5,
      remote: 'да',
      level: 'guru',
      contacts: { telegram: 'слишком длинно' },
    });
    expect(issues).toEqual([
      { path: ['hours'], message: 'нужно целое число' },
      { path: ['remote'], message: 'нужно «да» или «нет»' },
      { path: ['level'], message: 'выберите значение из списка' },
      { path: ['contacts', 'telegram'], message: 'не длиннее 5 символов' },
    ]);
  });

  it('границы числа и обязательность', () => {
    expect(validateIntakeValues(schema, { hours: 0, level: 'junior', contacts: { telegram: 'a' } }).issues).toEqual([
      { path: ['hours'], message: 'не меньше 1' },
    ]);
    expect(validateIntakeValues(schema, { hours: 41, level: 'junior', contacts: { telegram: 'a' } }).issues).toEqual([
      { path: ['hours'], message: 'не больше 40' },
    ]);
    expect(validateIntakeValues(schema, null).issues.map((i) => i.path[0])).toEqual(['hours', 'level', 'contacts']);
    expect(validateIntakeValues(schema, { hours: 'много', level: 'junior', contacts: { telegram: 'a' } }).issues).toEqual(
      [{ path: ['hours'], message: 'нужно число' }]
    );
  });
});
