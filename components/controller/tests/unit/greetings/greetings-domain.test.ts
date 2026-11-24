import {
  ageInYear,
  birthdaysCelebratedOn,
  celebrationDate,
  localDate,
  parseBirthdate,
} from '~/extensions/greetings/domain/birthday';
import { chooseTemplate, isValidPeriod } from '~/extensions/greetings/domain/template-choice';
import { buildGreetingLetter, findUnknownVariables, greetingValues } from '~/extensions/greetings/domain/greeting-letter';
import { GreetingTemplateStatus } from '~/extensions/greetings/domain/greetings.enums';

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
  const year = { id: 'year', status: GreetingTemplateStatus.ACTIVE, period_start: '2026-01-01', period_end: '2026-12-31' };
  const june = { id: 'june', status: GreetingTemplateStatus.ACTIVE, period_start: '2026-06-01', period_end: '2026-06-30' };
  const draft = { id: 'draft', status: GreetingTemplateStatus.DRAFT, period_start: '2026-06-10', period_end: '2026-06-10' };

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

  it('находит неизвестные переменные без повторов, регистр слова не важен', () => {
    expect(findUnknownVariables('{{имя}} {{Отчетсво}} {{ Отчетсво }} {{Кличка}}')).toEqual(['Отчетсво', 'Кличка']);
  });
});
