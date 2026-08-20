import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportTicketTypeormEntity } from '../entities/support-ticket.typeorm-entity';
import { SupportTicketMessageTypeormEntity } from '../entities/support-ticket-message.typeorm-entity';
import { SupportTicketAttachmentTypeormEntity } from '../entities/support-ticket-attachment.typeorm-entity';

const SUPPORT_ENTITIES = [
  SupportTicketTypeormEntity,
  SupportTicketMessageTypeormEntity,
  SupportTicketAttachmentTypeormEntity,
];

@Module({
  imports: [TypeOrmModule.forFeature(SUPPORT_ENTITIES)],
  exports: [TypeOrmModule],
})
export class SupportDatabaseModule {}
