import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EduEnrollmentStatus } from '../../domain/enums';
import type { EdubridgeLearnerEntity } from '../../infrastructure/entities';
import { EdubridgeEnrollmentRepository } from '../../infrastructure/repositories/edubridge-enrollment.repository';
import { EdubridgeLearnerRepository } from '../../infrastructure/repositories/edubridge-learner.repository';
import type { EduLearnerInputDTO, EduUpdateLearnerInputDTO } from '../dto/edu-learner.dto';
import { EDUBRIDGE_LEARNER_RECIPIENT_CHANGED_EVENT, type IEduLearnerRecipientChangedPayload } from '../events/edubridge.events';
import { DomainError } from '@coopenomics/extension-kit';

@Injectable()
export class EdubridgeLearnerService {
  constructor(
    private readonly learners: EdubridgeLearnerRepository,
    private readonly enrollments: EdubridgeEnrollmentRepository,
    private readonly events: EventEmitter2
  ) {}

  listMine(coopname: string, member: string): Promise<EdubridgeLearnerEntity[]> {
    return this.learners.findByMember(coopname, member);
  }

  async getOwned(coopname: string, member: string, id: string): Promise<EdubridgeLearnerEntity> {
    const learner = await this.learners.findById(coopname, id);
    if (!learner) throw DomainError.notFound('EDUBRIDGE_LEARNER_NOT_FOUND');
    if (learner.member_username !== member) throw DomainError.forbidden('EDUBRIDGE_LEARNER_FOREIGN');
    return learner;
  }

  async add(coopname: string, member: string, input: EduLearnerInputDTO): Promise<EdubridgeLearnerEntity> {
    const existing = await this.learners.findByMember(coopname, member);
    const value = input.recipient_value.trim();
    if (existing.some((l) => l.recipient_type === input.recipient_type && l.recipient_value.toLowerCase() === value.toLowerCase())) {
      throw DomainError.badRequest('EDUBRIDGE_LEARNER_CONTACT_DUPLICATE');
    }
    if (input.is_self && existing.some((l) => l.is_self)) {
      throw DomainError.badRequest('EDUBRIDGE_LEARNER_SELF_ALREADY_ADDED');
    }
    const entity = this.learners.create({
      coopname,
      member_username: member,
      display_name: input.display_name.trim(),
      recipient_type: input.recipient_type,
      recipient_value: value,
      is_self: Boolean(input.is_self),
    });
    return this.learners.save(entity);
  }

  /**
   * Правка контакта не требует повторной оплаты: при активной подписке доступ
   * переоформляется — событие подхватывает очередь выдачи (отзыв старого,
   * выдача нового).
   */
  async update(coopname: string, member: string, input: EduUpdateLearnerInputDTO): Promise<EdubridgeLearnerEntity> {
    const learner = await this.getOwned(coopname, member, input.id);
    const prevType = learner.recipient_type;
    const prevValue = learner.recipient_value;
    learner.display_name = input.display_name.trim();
    learner.recipient_type = input.recipient_type;
    learner.recipient_value = input.recipient_value.trim();
    if (input.is_self !== undefined) learner.is_self = input.is_self;
    const saved = await this.learners.save(learner);

    if (prevType !== saved.recipient_type || prevValue !== saved.recipient_value) {
      const payload: IEduLearnerRecipientChangedPayload = {
        coopname,
        learner_id: saved.id,
        previous_recipient_type: prevType,
        previous_recipient_value: prevValue,
        trigger: `recipient:${saved.updated_at?.toISOString?.() ?? Date.now()}`,
      };
      this.events.emit(EDUBRIDGE_LEARNER_RECIPIENT_CHANGED_EVENT, payload);
    }
    return saved;
  }

  async remove(coopname: string, member: string, id: string): Promise<boolean> {
    const learner = await this.getOwned(coopname, member, id);
    const active = (await this.enrollments.findByLearner(coopname, id)).filter(
      (e) => e.status === EduEnrollmentStatus.ACTIVE || e.status === EduEnrollmentStatus.PENDING
    );
    if (active.length) throw DomainError.badRequest('EDUBRIDGE_LEARNER_HAS_ACTIVE_SUBSCRIPTIONS');
    await this.learners.remove(learner);
    return true;
  }
}
