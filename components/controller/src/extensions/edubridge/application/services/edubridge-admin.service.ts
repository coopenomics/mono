import { Injectable, NotFoundException } from '@nestjs/common';
import { EduAccessCarrier, type EduAccessTaskStatus } from '../../domain/enums';
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
import { EduEnrollmentDTO } from '../dto/edu-enrollment.dto';
import { EduLearnerDTO } from '../dto/edu-learner.dto';
import { EdubridgeAccessOutboxService } from './edubridge-access-outbox.service';

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
    private readonly names: EdubridgeNamesService
  ) {}

  /** Реестр пайщиков с ФИО; поиск — по ФИО или учётному имени. */
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
    if (!learners.length && !enrollments.length) throw new NotFoundException('Пайщик в приложении не найден');
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
    const cfg = this.config.get().connectors;
    const configured: Record<string, boolean> = {
      [EduAccessCarrier.SKILLSPACE]: Boolean(cfg.skillspace_api_key),
      [EduAccessCarrier.GETCOURSE]: Boolean(cfg.getcourse_account && cfg.getcourse_api_key),
      [EduAccessCarrier.ONSITE]: true,
    };
    const result: EduConnectorBindingDTO[] = [];
    for (const connector of this.connectors.list()) {
      const b = await this.bindings.ensure(coopname, connector.carrier);
      result.push(new EduConnectorBindingDTO(b, configured[connector.carrier] ?? false));
    }
    return result;
  }

  /** Проверить площадку сейчас: доступность аккаунта/курса-пробы. */
  async checkConnector(coopname: string, carrier: EduAccessCarrier): Promise<EduConnectorBindingDTO> {
    const connector = this.connectors.get(carrier);
    if (!connector) throw new NotFoundException('Носитель не поддерживается');
    const probe = (await this.courses.findPage(coopname, {}, { page: 1, limit: 1, sortOrder: 'ASC' } as never)).items.find((c) => c.carrier === carrier);
    const check = await connector.check(coopname, probe?.external_ref ?? '');
    await this.bindings.touch(coopname, carrier, check.unavailable ? { code: 'retryable', message: check.message } : { code: 'ok', message: check.message });
    return this.stateOf(coopname, carrier);
  }

  async setConnectorEnabled(coopname: string, carrier: EduAccessCarrier, enabled: boolean): Promise<EduConnectorBindingDTO> {
    const b = await this.bindings.ensure(coopname, carrier);
    b.enabled = enabled;
    await this.bindings.save(b);
    return this.stateOf(coopname, carrier);
  }

  private async stateOf(coopname: string, carrier: EduAccessCarrier): Promise<EduConnectorBindingDTO> {
    const found = (await this.connectorsState(coopname)).find((x) => x.carrier === carrier);
    if (!found) throw new NotFoundException('Носитель не поддерживается');
    return found;
  }

  async listAdmins(coopname: string): Promise<EduAdminDTO[]> {
    const admins = await this.admins.listAdmins(coopname);
    const names = await this.names.displayNames(admins.flatMap((a) => [a.username, a.appointed_by]));
    return admins.map((a) => new EduAdminDTO(a, { display_name: names.get(a.username), appointed_by_display_name: names.get(a.appointed_by) }));
  }

  async appoint(coopname: string, username: string, by: string): Promise<EduAdminDTO> {
    const a = await this.admins.appoint(coopname, username.trim(), by);
    const names = await this.names.displayNames([a.username, a.appointed_by]);
    return new EduAdminDTO(a, { display_name: names.get(a.username), appointed_by_display_name: names.get(a.appointed_by) });
  }

  dismiss(coopname: string, username: string) {
    return this.admins.dismiss(coopname, username);
  }
}
