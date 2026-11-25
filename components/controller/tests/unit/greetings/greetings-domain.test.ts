import {
  ageInYear,
  birthdaysCelebratedOn,
  celebrationDate,
  localDate,
  parseBirthdate,
} from '~/extensions/greetings/domain/birthday';
import { chooseTemplate, isValidPeriod, mailingDateInMonth, mailingsDue } from '~/extensions/greetings/domain/template-choice';
import { buildGreetingLetter, findUnknownVariables, findVariablesNotForKind, greetingValues } from '~/extensions/greetings/domain/greeting-letter';
import { GreetingDeliveryState, GreetingTemplateKind, GreetingTemplateStatus } from '~/extensions/greetings/domain/greetings.enums';
import { deliveryOf } from '~/extensions/greetings/domain/delivery';

/**
 * Доменная часть приложения «Поздравления»: дата рождения, выбор шаблона на
 * дату и построение письма. Предпросмотр и рассылка зовут одни и те же
 * функции, поэтому ошибка здесь — неверное письмо пайщику.
 */
describe('поздравления: дата рождения', () => {
  it('разбирает обе формы записи даты', () => {
    expect(parseBirthdate('1990-06-15')).toEqual({ year: 1990, month: 6, day: 15 });
    expect(parseBirthdate('15.06.1990')).toEqual({ year: 1990, month: 6, day: 15 });
  });

  it('пустую и несуществующую дату не принимает', () => {
    expect(parseBirthdate('')).toBeNull();
    expect(parseBirthdate(null)).toBeNull();
    expect(parseBirthdate('1990-02-30')).toBeNull();
    expect(parseBirthdate('1991-02-29')).toBeNull();
  });

  it('родившихся 29 февраля поздравляет 28-го в невисокосный год', () => {
    expect(birthdaysCelebratedOn({ year: 2027, month: 2, day: 28 })).toEqual([
      { month: 2, day: 28 },
      { month: 2, day: 29 },
    ]);
    expect(birthdaysCelebratedOn({ year: 2028, month: 2, day: 28 })).toEqual([{ month: 2, day: 28 }]);
    expect(celebrationDate({ month: 2, day: 29 }, 2027)).toEqual({ year: 2027, month: 2, day: 28 });
    expect(celebrationDate({ month: 2, day: 29 }, 2028)).toEqual({ year: 2028, month: 2, day: 29 });
  });

  it('сегодняшний день берёт по часовой зоне кооператива', () => {
    // 20:30 UTC 24 ноября — в Новосибирске уже 25-е.
    const now = new Date('2026-11-24T20:30:00Z');
    expect(localDate(now, 'Asia/Novosibirsk')).toMatchObject({ year: 2026, month: 11, day: 25, hour: 3 });
    expect(localDate(now, 'Europe/Moscow')).toMatchObject({ year: 2026, month: 11, day: 24, hour: 23 });
  });

  it('возраст — сколько исполняется в году поздравления', () => {
    expect(ageInYear(1990, 2026)).toBe(36);
  });
});

describe('поздравления: шаблон на дату', () => {
  const BIRTHDAY = GreetingTemplateKind.BIRTHDAY;
  const MAILING = GreetingTemplateKind.MAILING;
  const ACTIVE = GreetingTemplateStatus.ACTIVE;
  const year = { id: 'year', kind: BIRTHDAY, status: ACTIVE, period_start: '2026-01-01', period_end: '2026-12-31' };
  const june = { id: 'june', kind: BIRTHDAY, status: ACTIVE, period_start: '2026-06-01', period_end: '2026-06-30' };
  const draft = { id: 'draft', kind: BIRTHDAY, status: GreetingTemplateStatus.DRAFT, period_start: '2026-06-10', period_end: '2026-06-10' };
  const newYear = { id: 'ny', kind: MAILING, status: ACTIVE, repeat_yearly: true, period_start: '2026-12-31', period_end: '2026-12-31' };
  const notice = { id: 'notice', kind: MAILING, status: ACTIVE, repeat_yearly: false, period_start: '2026-06-15', period_end: '2026-06-15' };
  const leap = { id: 'leap', kind: MAILING, status: ACTIVE, repeat_yearly: true, period_start: '2024-02-29', period_end: '2024-02-29' };

  it('рассылку поздравление не берёт, даже если её дата в периоде', () => {
    expect(chooseTemplate([year, notice], '2026-06-15')?.id).toBe('year');
  });

  it('разовая рассылка — только в свою дату', () => {
    expect(mailingsDue([notice, year], { year: 2026, month: 6, day: 15 }).map((t) => t.id)).toEqual(['notice']);
    expect(mailingsDue([notice], { year: 2027, month: 6, day: 15 })).toEqual([]);
  });

  it('ежегодная рассылка повторяется с года первой даты', () => {
    expect(mailingsDue([newYear], { year: 2027, month: 12, day: 31 }).map((t) => t.id)).toEqual(['ny']);
    expect(mailingsDue([newYear], { year: 2025, month: 12, day: 31 })).toEqual([]);
  });

  it('календарь ставит рассылку на её дату в месяце', () => {
    expect(mailingDateInMonth(notice, 2026, 6)).toBe('2026-06-15');
    expect(mailingDateInMonth(notice, 2027, 6)).toBeNull();
    expect(mailingDateInMonth(newYear, 2030, 12)).toBe('2030-12-31');
    expect(mailingDateInMonth(newYear, 2030, 11)).toBeNull();
    expect(mailingDateInMonth(leap, 2027, 2)).toBe('2027-02-28');
    expect(mailingDateInMonth(year, 2026, 6)).toBeNull();
  });

  it('ежегодная рассылка на 29 февраля в невисокосный год — 28-го', () => {
    expect(mailingsDue([leap], { year: 2027, month: 2, day: 28 }).map((t) => t.id)).toEqual(['leap']);
    expect(mailingsDue([leap], { year: 2028, month: 2, day: 28 })).toEqual([]);
  });

  it('берёт годовой шаблон вне коротких периодов', () => {
    expect(chooseTemplate([year, june], '2026-03-08')?.id).toBe('year');
  });

  it('короткий период уточняет годовой', () => {
    expect(chooseTemplate([year, june], '2026-06-15')?.id).toBe('june');
  });

  it('черновик рассылка не берёт', () => {
    expect(chooseTemplate([year, june, draft], '2026-06-10')?.id).toBe('june');
  });

  it('вне всех периодов шаблона нет', () => {
    expect(chooseTemplate([year], '2027-01-01')).toBeNull();
  });

  it('период проверяется на существование дат и порядок', () => {
    expect(isValidPeriod('2026-01-01', '2026-12-31')).toBe(true);
    expect(isValidPeriod('2026-12-31', '2026-01-01')).toBe(false);
    expect(isValidPeriod('2026-02-30', '2026-03-01')).toBe(false);
    expect(isValidPeriod('2026-1-1', '2026-12-31')).toBe(false);
  });
});

describe('поздравления: письмо', () => {
  const values = greetingValues({
    lastName: 'Иванова',
    firstName: 'Анна',
    middleName: 'Петровна',
    age: 35,
    cooperative: 'ПК «Восход»',
    chairman: 'Петров Пётр Петрович',
  });

  it('подставляет переменные в тему и текст', () => {
    const letter = buildGreetingLetter(
      {
        subject: '{{Обращение}}, с днём рождения!',
        body: 'Уважаемая {{Обращение}}!\n\nПоздравляем вас с {{Летие}}. Вам исполняется {{Возраст}}.\n\n{{Председатель}}, {{Кооператив}}',
      },
      values
    );
    expect(letter.subject).toBe('Анна Петровна, с днём рождения!');
    expect(letter.bodyHtml).toContain('Уважаемая Анна Петровна!');
    expect(letter.bodyHtml).toContain('с 35-летием');
    expect(letter.bodyHtml).toContain('исполняется 35 лет');
    expect(letter.bodyHtml).toContain('Петров Пётр Петрович, ПК «Восход»');
  });

  it('склоняет возраст', () => {
    const age = (n: number) => greetingValues({ lastName: '', firstName: '', middleName: '', age: n, cooperative: '', chairman: '' }).age;
    expect(age(21)).toBe('21 год');
    expect(age(33)).toBe('33 года');
    expect(age(40)).toBe('40 лет');
    expect(age(111)).toBe('111 лет');
  });

  it('без отчества обращается по имени', () => {
    const noMiddle = greetingValues({ lastName: 'Смит', firstName: 'Джон', middleName: '', age: 30, cooperative: '', chairman: '' });
    expect(noMiddle.address).toBe('Джон');
  });

  it('HTML в тексте и в данных пайщика экранирует', () => {
    const hostile = greetingValues({ lastName: '<b>x</b>', firstName: '', middleName: '', age: null, cooperative: '', chairman: '' });
    const letter = buildGreetingLetter({ subject: 'Тема', body: '<script>alert(1)</script> {{Фамилия}}' }, hostile);
    expect(letter.bodyHtml).not.toContain('<script>');
    expect(letter.bodyHtml).not.toContain('<b>');
    expect(letter.bodyHtml).toContain('&lt;b&gt;x&lt;/b&gt;');
  });

  it('Markdown превращает в разметку письма', () => {
    const letter = buildGreetingLetter({ subject: 'Тема', body: '**Дорогой {{Имя}}**' }, values);
    expect(letter.bodyHtml).toContain('<strong>Дорогой Анна</strong>');
  });

  it('возраст в рассылке недоступен, в поздравлении — доступен', () => {
    const text = 'С {{Летие}}! Вам {{Возраст}}, {{Имя}}';
    expect(findVariablesNotForKind(text, GreetingTemplateKind.MAILING)).toEqual(['Летие', 'Возраст']);
    expect(findVariablesNotForKind(text, GreetingTemplateKind.BIRTHDAY)).toEqual([]);
  });

  it('к организации обращается по названию', () => {
    const org = greetingValues({ lastName: '', firstName: '', middleName: '', displayName: 'ООО «Ромашка»', age: null, cooperative: '', chairman: '' });
    expect(org.address).toBe('ООО «Ромашка»');
  });

  it('находит неизвестные переменные без повторов, регистр слова не важен', () => {
    expect(findUnknownVariables('{{имя}} {{Отчетсво}} {{ Отчетсво }} {{Кличка}}')).toEqual(['Отчетсво', 'Кличка']);
  });
});

describe('поздравления: доставка письма', () => {
  const rows = new Map([
    ['e1', { outboxId: 'e1', channel: 'email', state: 'sent' }],
    ['i1', { outboxId: 'i1', channel: 'in_app', state: 'failed' }],
    ['e2', { outboxId: 'e2', channel: 'email', state: 'sending' }],
    ['i2', { outboxId: 'i2', channel: 'in_app', state: 'canceled' }],
  ]);

  it('доставку считает по почте, не по уведомлению в интерфейсе', () => {
    expect(deliveryOf(['i1', 'e1'], rows)).toBe(GreetingDeliveryState.DELIVERED);
    expect(deliveryOf(['e2'], rows)).toBe(GreetingDeliveryState.PENDING);
  });

  it('без почтовой строки берёт уведомление в интерфейсе', () => {
    expect(deliveryOf(['i2'], rows)).toBe(GreetingDeliveryState.FAILED);
  });

  it('без строк очереди доставка неизвестна', () => {
    expect(deliveryOf([], rows)).toBeNull();
    expect(deliveryOf(['net'], rows)).toBeNull();
  });
});
