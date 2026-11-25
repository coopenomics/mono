import config from '~/config/config';
import { renderOutboxContent } from '~/application/notification-center/template.util';
import { NotificationInnercoopAdapter } from '~/infrastructure/innercoop/notification-innercoop.adapter';
import { NotificationChannel } from '~/domain/notification/interfaces/notify-input.domain.interface';
import { NotificationOutboxStatus, type NotificationOutboxDomainInterface } from '~/domain/notification/interfaces/notification-outbox.domain.interface';

/**
 * Журнал уведомлений председателя показывает, что получил пайщик: тему и
 * текст, отрисованные из данных строки очереди тем же шаблоном каталога, что
 * при отправке. Порт уведомлений отвечает расширению о доставке его писем и
 * строк другого кооператива не отдаёт.
 */

const row = (fields: Partial<NotificationOutboxDomainInterface>): NotificationOutboxDomainInterface =>
  ({
    id: 'outbox-1',
    coopname: config.coopname,
    workflowId: 'informatsionnaya-rassylka',
    channel: NotificationChannel.EMAIL,
    recipientSubscriberId: 'sub-anna',
    recipientEmail: 'anna@example.com',
    recipientUsername: 'anna',
    payload: { subject: 'Анна Петровна, с праздником!', bodyHtml: '<p>Поздравляем</p>', coopShortName: 'ПК «Восход»', occasion: 'x' },
    status: NotificationOutboxStatus.SENT,
    ...fields,
  }) as NotificationOutboxDomainInterface;

describe('центр уведомлений: текст уведомления в журнале', () => {
  it('письмо рассылки — тема и HTML из данных строки', () => {
    expect(renderOutboxContent(row({}))).toEqual({ subject: 'Анна Петровна, с праздником!', body: '<p>Поздравляем</p>' });
  });

  it('уведомление в интерфейсе — по шаблону своего канала', () => {
    const content = renderOutboxContent(row({ channel: NotificationChannel.IN_APP }));
    expect(content?.subject).toBe('Анна Петровна, с праздником!');
    expect(content?.body).toContain('ПК «Восход»');
  });

  it('сценария нет в каталоге — текста нет', () => {
    expect(renderOutboxContent(row({ workflowId: 'net-takogo-scenariya' }))).toBeNull();
  });
});

describe('порт уведомлений: доставка писем расширения', () => {
  const rows = [
    row({ id: 'a', status: NotificationOutboxStatus.SENT }),
    row({ id: 'b', channel: NotificationChannel.IN_APP, status: NotificationOutboxStatus.PENDING }),
    row({ id: 'c', coopname: 'chuzhoy', status: NotificationOutboxStatus.SENT }),
  ];
  const findByIds = jest.fn(async (ids: string[]) => rows.filter((item) => ids.includes(item.id)));
  const adapter = new NotificationInnercoopAdapter({} as never, {} as never, { findByIds } as never);

  it('отдаёт состояние и канал своих строк, чужой кооператив отсекает', async () => {
    expect(await adapter.getDeliveries(['a', 'b', 'c', 'a', ''])).toEqual([
      { outboxId: 'a', channel: 'email', state: 'sent' },
      { outboxId: 'b', channel: 'in_app', state: 'pending' },
    ]);
    expect(findByIds).toHaveBeenCalledWith(['a', 'b', 'c']);
  });

  it('пустой список не обращается к очереди', async () => {
    findByIds.mockClear();
    expect(await adapter.getDeliveries([])).toEqual([]);
    expect(findByIds).not.toHaveBeenCalled();
  });
});
