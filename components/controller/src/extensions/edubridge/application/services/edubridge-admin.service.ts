import { Injectable } from '@nestjs/common';
import { EduAccessCarrier, EduConnectorHealth, type EduAccessTaskStatus } from '../../domain/enums';
import { AccessCarrierRegistry } from '../../infrastructure/connectors/access-carrier.registry';
import { EdubridgeAccessTaskRepository } from '../../infrastructure/repositories/edubridge-access-task.repository';
import { EdubridgeAdminRepository } from '../../infrastructure/repositories/edubridge-admin.repository';
import { EdubridgeConnectorBindingRepository } from '../../infrastructure/repositories/edubridge-connector-binding.repository';
import { EdubridgeCourseRepository } from '../../infrastructure/repositories/edubridge-course.repository';
import { EdubridgeEnrollmentRepository } from '../../infrastructure/repositories/edubridge-enrollment.repository';
import { EdubridgeLearnerRepository } from '../../infrastructure/repositories/edubridge-learner.repository';
import { EdubridgeConfigHolder } from '../config/edubridge-config.holder';
import { EduAccessTaskDTO, EduAdminDTO, EduConnectorBindingDTO, EduMemberCardDTO, EduMemberRowDTO } from '../dto/edu-admin.dto';
import { EdubridgeNamesService } from '../membership/edubridge-names.service';
import { EdubridgeConnectorCredentialsStore } from '../../infrastructure/connectors/connector-credentials.store';
import type { EduConnectorCredentialFieldDTO } from '../dto/edu-admin.dto';
import { EduEnrollmentDTO } from '../dto/edu-enrollment.dto';
import { EduLearnerDTO } from '../dto/edu-learner.dto';
import { EdubridgeAccessOutboxService } from './edubridge-access-outbox.service';
import { EdubridgeLiveFeedService } from './edubridge-live-feed.service';
import { DomainError } from '@coopenomics/extension-kit';

/** Административный контур: реестры, очередь, площадки, администраторы. */
@Injectable()
export class EdubridgeAdminService {
  constructor(
    private readonly admins: EdubridgeAdminRepository,
    private readonly learners: EdubridgeLearnerRepository,
    private readonly enrollments: EdubridgeEnrollmentRepository,
    private readonly courses: EdubridgeCourseRepository,
    private readonly tasks: EdubridgeAccessTaskRepository,
    private readonly bindings: EdubridgeConnectorBindingRepository,
    private readonly connectors: AccessCarrierRegistry,
    private readonly outbox: EdubridgeAccessOutboxService,
    private readonly config: EdubridgeConfigHolder,
    private readonly names: EdubridgeNamesService,
    private readonly credentials: EdubridgeConnectorCredentialsStore,
    private readonly liveFeed: EdubridgeLiveFeedService
  ) {}

  /** Ученики с ФИО; поиск — по ФИО или учётному имени. */
  async members(coopname: string, search?: string): Promise<EduMemberRowDTO[]> {
    const rows = await this.admins.memberRows(coopname);
    const names = await this.names.displayNames(rows.map((r) => r.username));
    return rows
      .map((r) => ({ ...r, display_name: names.get(r.username) ?? '' }))
      .filter((r) => EdubridgeNamesService.matches(search ?? '', r.username, r.display_name));
  }

  /** Сводная карточка: обучающиеся, курсы, оплаты, состояние выдачи. Контакты — по флагу `showContacts`. */
  async memberCard(coopname: string, username: string, showContacts: boolean): Promise<EduMemberCardDTO> {
    const [learners, enrollments] = await Promise.all([this.learners.findByMember(coopname, username), this.enrollments.findByMember(coopname, username)]);
    if (!learners.length && !enrollments.length) throw DomainError.notFound('EDUBRIDGE_MEMBER_NOT_FOUND');
    const tasks = (await Promise.all(enrollments.map((e) => this.tasks.findByEnrollment(coopname, e.id)))).flat();
    const cards: EduEnrollmentDTO[] = [];
    for (const e of enrollments) cards.push(new EduEnrollmentDTO(e, await this.courses.findById(coopname, e.course_id)));
    return {
      username,
      display_name: await this.names.displayName(username),
      learners: learners.map((l) => new EduLearnerDTO(l, { showContact: showContacts })),
      enrollments: cards,
      tasks: tasks.map((t) => new EduAccessTaskDTO(t)),
    };
  }

  async queue(coopname: string, statuses?: EduAccessTaskStatus[]): Promise<EduAccessTaskDTO[]> {
    return (await this.tasks.findQueue(coopname, statuses)).map((t) => new EduAccessTaskDTO(t));
  }

  async retry(coopname: string, taskId: string): Promise<EduAccessTaskDTO> {
    return new EduAccessTaskDTO(await this.outbox.retry(coopname, taskId));
  }

  async connectorsState(coopname: string): Promise<EduConnectorBindingDTO[]> {
    const result: EduConnectorBindingDTO[] = [];
    for (const connector of this.connectors.list()) result.push(await this.stateOf(coopname, connector.carrier));
    return result;
  }

  /** Владелец задаёт ключи площадки здесь, а не в настройках расширения: значения шифруются, наружу не выходят. */
  async setConnectorCredentials(coopname: string, carrier: EduAccessCarrier, values: Array<{ key: string; value: string }>): Promise<EduConnectorBindingDTO> {
    const connector = this.connectors.get(carrier);
    if (!connector) throw DomainError.notFound('EDUBRIDGE_CARRIER_NOT_SUPPORTED');
    const known = new Set(connector.credentialFields.map((f) => f.key));
    const strangers = values.filter((v) => !known.has(v.key)).map((v) => v.key);
    if (strangers.length) throw DomainError.badRequest('EDUBRIDGE_CONNECTOR_UNKNOWN_FIELDS', { fields: strangers.join(', ') });
    await this.credentials.set(coopname, carrier, Object.fromEntries(values.map((v) => [v.key, v.value])));
    // Ключи сменились — прежний результат проверки ничего не значит.
    await this.bindings.setHealth(coopname, carrier, EduConnectorHealth.UNKNOWN, null);
    return this.stateOf(coopname, carrier);
  }

  /**
   * Проверить площадку сейчас: ключи рабочие, площадка отвечает. Курс здесь не
   * участвует — привязку курса сверяет карточка курса. Раньше проверка брала
   * первый курс каталога, и без курсов площадка с верными ключами показывала
   * «У курса не задан идентификатор».
   */
  async checkConnector(coopname: string, carrier: EduAccessCarrier): Promise<EduConnectorBindingDTO> {
    const connector = this.connectors.get(carrier);
    if (!connector) throw DomainError.notFound('EDUBRIDGE_CARRIER_NOT_SUPPORTED');
    if (!(await this.credentials.isConfigured(coopname, carrier, connector.credentialFields))) {
      throw DomainError.badRequest('EDUBRIDGE_CONNECTOR_NOT_CONFIGURED');
    }
    const ping = await connector.ping(coopname);
    await this.bindings.touch(coopname, carrier, { code: ping.ok ? 'ok' : 'retryable', message: ping.message });
    return this.stateOf(coopname, carrier);
  }

  async setConnectorEnabled(coopname: string, carrier: EduAccessCarrier, enabled: boolean): Promise<EduConnectorBindingDTO> {
    const b = await this.bindings.ensure(coopname, carrier);
    b.enabled = enabled;
    await this.bindings.save(b);
    return this.stateOf(coopname, carrier);
  }

  private async stateOf(coopname: string, carrier: EduAccessCarrier): Promise<EduConnectorBindingDTO> {
    const connector = this.connectors.get(carrier);
    const fields = connector?.credentialFields ?? [];
    const [b, configured, flags] = await Promise.all([
      this.bindings.ensure(coopname, carrier),
      this.credentials.isConfigured(coopname, carrier, fields),
      this.credentials.setFlags(coopname, carrier, fields),
    ]);
    const credential_fields: EduConnectorCredentialFieldDTO[] = fields.map((f) => ({ key: f.key, label: f.label, secret: f.secret, note: f.note, is_set: Boolean(flags[f.key]) }));
    return new EduConnectorBindingDTO(b, configured, credential_fields);
  }


  async listAdmins(coopname: string): Promise<EduAdminDTO[]> {
    const admins = await this.admins.listAdmins(coopname);
    const names = await this.names.displayNames(admins.flatMap((a) => [a.username, a.appointed_by]));
    return admins.map((a) => new EduAdminDTO(a, { display_name: names.get(a.username), appointed_by_display_name: names.get(a.appointed_by) }));
  }

  async appoint(coopname: string, username: string, by: string): Promise<EduAdminDTO> {
    const a = await this.admins.appoint(coopname, username.trim(), by);
    await this.liveFeed.refreshStaff(coopname);
    const names = await this.names.displayNames([a.username, a.appointed_by]);
    return new EduAdminDTO(a, { display_name: names.get(a.username), appointed_by_display_name: names.get(a.appointed_by) });
  }

  async dismiss(coopname: string, username: string) {
    const removed = await this.admins.dismiss(coopname, username);
    await this.liveFeed.refreshStaff(coopname);
    return removed;
  }
}
