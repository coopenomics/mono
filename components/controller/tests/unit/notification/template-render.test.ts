import { Workflows } from '@coopenomics/notifications';
import { renderTemplate, resolveTemplate } from '~/application/notification-center/template.util';
import type { ChannelMessage } from '~/domain/notification/interfaces/channel.ports';
import { NotificationChannel } from '~/domain/notification/interfaces/notify-input.domain.interface';

const message = (payload: Record<string, unknown>): ChannelMessage =>
  ({
    coopname: 'voskhod',
    workflowId: 'test',
    payload,
    recipient: { subscriberId: 'voskhod:test', email: 'member@example.org', username: 'member' },
  } as unknown as ChannelMessage);

describe('Рендер шаблонов уведомлений', () => {
  it('подставляет значения по точечному пути', () => {
    expect(renderTemplate('Собрание №{{payload.meetId}} в {{coopname}}', message({ meetId: 2 }))).toBe(
      'Собрание №2 в voskhod'
    );
  });

  it('нерезолвленный путь даёт пустую строку, а не текст плейсхолдера', () => {
    expect(renderTemplate('было:{{payload.nothing}}', message({}))).toBe('было:');
  });

  it('вычисляет условие, когда значение есть', () => {
    const rendered = renderTemplate(
      'Голосуйте{% if payload.details %}. {{payload.details}}{% endif %}',
      message({ details: 'повестка обновлена' })
    );
    expect(rendered).toBe('Голосуйте. повестка обновлена');
  });

  it('вычисляет условие, когда значения нет, и не оставляет тег в тексте', () => {
    const rendered = renderTemplate('Голосуйте{% if payload.details %}. {{payload.details}}{% endif %}', message({}));
    expect(rendered).toBe('Голосуйте');
    expect(rendered).not.toContain('{%');
  });

  it('разворачивает цикл по списку', () => {
    const rendered = renderTemplate(
      '{% for advance in payload.advances %}[{{advance.description}}]{% endfor %}',
      message({ advances: [{ description: 'такси' }, { description: 'бумага' }] })
    );
    expect(rendered).toBe('[такси][бумага]');
  });

  it('не экранирует HTML тела письма', () => {
    const rendered = renderTemplate('<a href="{{payload.meetUrl}}">ссылка</a>', message({ meetUrl: 'https://x/y?a=1&b=2' }));
    expect(rendered).toBe('<a href="https://x/y?a=1&b=2">ссылка</a>');
  });

  it('сломанный шаблон не роняет отправку, а деградирует до подстановок', () => {
    const rendered = renderTemplate('Собрание №{{payload.meetId}}{% if %}', message({ meetId: 7 }));
    expect(rendered).toContain('7');
  });

  describe('шаблоны каталога не оставляют Liquid-теги в готовом тексте', () => {
    const meetPayload = {
      coopShortName: 'ПК «ВОСХОД»',
      meetId: 2,
      meetDate: '07.09.2026',
      meetTime: '10:00',
      meetEndDate: '09.09.2026',
      meetEndTime: '22:00',
      timezone: 'МСК',
      timeDescription: 'через 3 дня',
      meetUrl: 'https://example.org/meet',
    };

    const workflowIds = Object.keys(Workflows.workflowsById);

    it.each(workflowIds)('%s', (workflowId) => {
      for (const channel of [NotificationChannel.EMAIL, NotificationChannel.IN_APP, NotificationChannel.PUSH]) {
        const template = resolveTemplate(workflowId, channel);
        if (!template) continue;
        for (const text of [template.subject, template.body]) {
          const rendered = renderTemplate(text, message(meetPayload));
          expect(rendered).not.toContain('{%');
          expect(rendered).not.toContain('{{');
        }
      }
    });
  });
});
