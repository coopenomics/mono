import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { SupportTicketTypeormEntity } from './support-ticket.typeorm-entity';

export const SupportTicketParticipantEntityName = 'support_ticket_participants';

/**
 * Подключение члена совета к обращению.
 *
 * **Отдельная таблица связи, а не массив имён в обращении.** Массиву нужен был
 * бы либо перебор всех обращений на запрос «где я участвую», либо индекс по
 * элементам массива, которого обычным способом не построить. Здесь оба
 * направления закрыты обычными индексами.
 *
 * Обратной связи `OneToMany` со стороны обращения нет намеренно: она завела бы
 * кольцевой импорт между двумя файлами сущностей ради одного отбора, который
 * репозиторий и так делает подзапросом по индексу этой таблицы.
 */
@Entity(SupportTicketParticipantEntityName)
// «Участники этого обращения» — сборка ответной стороны для страницы списка.
@Index(`idx_${SupportTicketParticipantEntityName}_ticket`, ['ticketId'])
// «Обращения, где участвует этот человек» — отбор очереди по участнику.
@Index(`idx_${SupportTicketParticipantEntityName}_participant`, ['participantUsername'])
// Повторное подключение того же человека база не примет; команда до этого не
// доводит и молча возвращает текущее состояние, но правило живёт и в схеме.
@Index(
  `uq_${SupportTicketParticipantEntityName}_ticket_participant`,
  ['ticketId', 'participantUsername'],
  { unique: true }
)
export class SupportTicketParticipantTypeormEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ticket_id' })
  ticketId!: string;

  @ManyToOne(() => SupportTicketTypeormEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ticket_id' })
  ticket!: SupportTicketTypeormEntity;

  @Column({ name: 'participant_username', type: 'varchar', length: 64 })
  participantUsername!: string;

  @Column({ name: 'added_by_username', type: 'varchar', length: 64 })
  addedByUsername!: string;

  @CreateDateColumn({ name: 'added_at', type: 'timestamptz' })
  addedAt!: Date;
}
