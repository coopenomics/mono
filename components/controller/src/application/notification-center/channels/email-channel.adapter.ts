import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import config from '~/config/config';
import { NotificationChannel } from '~/domain/notification/interfaces/notify-input.domain.interface';
import type {
  ChannelDeliveryResult,
  ChannelMessage,
  EmailChannelPort,
} from '~/domain/notification/interfaces/channel.ports';
import { renderTemplate, resolveTemplate } from '../template.util';

/**
 * Канал «Почта» — реализация {@link EmailChannelPort}.
 *
 * Два транспорта:
 *  - **relay** (`EMAIL_RELAY_URL` задан): письмо уходит POST'ом на HTTP→SMTP
 *    релей (`@coopenomics/email-relay`). Нужен там, где хостинг кооператива
 *    режет исходящий SMTP — релей стоит на сервере с открытыми портами.
 *  - **smtp** (релей не задан, но `SMTP_HOST` есть): прямой nodemailer.
 *
 * Если не задан ни релей, ни `SMTP_HOST` — канал `disabled`: возвращает провал
 * с пояснением и **не** лезет на дефолтный SMTP (NFR11). Тело письма рендерится
 * из шаблона типа уведомления (каталог `@coopenomics/notifications`).
 */
@Injectable()
export class EmailChannelAdapter implements EmailChannelPort {
  private readonly logger = new Logger(EmailChannelAdapter.name);
  private readonly transporter: Transporter | null;
  private readonly relayUrl: string;
  private readonly relayToken: string;

  constructor() {
    this.relayUrl = config.email.relay.url;
    this.relayToken = config.email.relay.token;

    if (this.relayUrl) {
      this.transporter = null;
      this.logger.log(`email-канал в режиме relay → ${this.relayUrl}`);
      return;
    }

    const smtp = config.email.smtp;
    if (!smtp.host) {
      this.transporter = null;
      this.logger.warn('SMTP_HOST и EMAIL_RELAY_URL не заданы — email-канал отключён, письма не отправляются');
      return;
    }
    this.transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: smtp.auth.user ? { user: smtp.auth.user, pass: smtp.auth.pass } : undefined,
    });
  }

  async send(message: ChannelMessage): Promise<ChannelDeliveryResult> {
    if (!message.recipient.email) {
      return { delivered: false, error: 'recipient has no email' };
    }

    const template = resolveTemplate(message.workflowId, NotificationChannel.EMAIL);
    if (!template) {
      return { delivered: false, error: `no email template for workflow '${message.workflowId}'` };
    }

    const subject = renderTemplate(template.subject, message);
    const html = renderTemplate(template.body, message);

    if (this.relayUrl) {
      return this.sendViaRelay(message.recipient.email, subject, html);
    }
    return this.sendViaSmtp(message.recipient.email, subject, html);
  }

  private async sendViaSmtp(to: string, subject: string, html: string): Promise<ChannelDeliveryResult> {
    if (!this.transporter) {
      return { delivered: false, error: 'email channel disabled (SMTP not configured)' };
    }
    try {
      const info = await this.transporter.sendMail({ from: config.email.from, to, subject, html });
      return { delivered: true, providerResponse: info.messageId };
    } catch (error: any) {
      this.logger.error(`Ошибка отправки письма на ${to}: ${error.message}`);
      return { delivered: false, error: error.message };
    }
  }

  private async sendViaRelay(to: string, subject: string, html: string): Promise<ChannelDeliveryResult> {
    try {
      const response = await fetch(this.relayUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.relayToken ? { authorization: `Bearer ${this.relayToken}` } : {}),
        },
        body: JSON.stringify({ from: config.email.from, to, subject, html }),
      });
      const payload = (await response.json().catch(() => ({}))) as { messageId?: string; error?: string };
      if (!response.ok) {
        const reason = payload.error || `HTTP ${response.status}`;
        this.logger.error(`Релей отклонил письмо на ${to}: ${reason}`);
        return { delivered: false, error: reason };
      }
      return { delivered: true, providerResponse: payload.messageId };
    } catch (error: any) {
      this.logger.error(`Ошибка обращения к email-релею для ${to}: ${error.message}`);
      return { delivered: false, error: error.message };
    }
  }
}
