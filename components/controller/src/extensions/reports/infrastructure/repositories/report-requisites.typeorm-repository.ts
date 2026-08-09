import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportRequisitesEntity } from '../entities/report-requisites.entity';
import type {
  ReportRequisitesRecord,
  ReportRequisitesRepository,
  UpsertReportRequisitesInput,
} from '../../domain/repositories/report-requisites.repository';

@Injectable()
export class ReportRequisitesTypeormRepository implements ReportRequisitesRepository {
  constructor(
    @InjectRepository(ReportRequisitesEntity)
    private readonly repository: Repository<ReportRequisitesEntity>
  ) {}

  async getByCoopname(coopname: string): Promise<ReportRequisitesRecord | null> {
    const entity = await this.repository.findOne({ where: { coopname } });
    return entity ? this.toRecord(entity) : null;
  }

  async upsert(input: UpsertReportRequisitesInput): Promise<ReportRequisitesRecord> {
    // Настоящий UPSERT через ON CONFLICT — атомарно, без гонки между
    // двумя параллельными редактированиями одного coopname.
    // Раньше был read-modify-write: findOne → update или save;
    // два одновременных вызова могли потерять одну правку (last-writer-wins,
    // но без гарантии успеха второго UPDATE).
    //
    // undefined-поля во входе означают "не трогать" — собираем объект только
    // из явно переданных, PostgreSQL ON CONFLICT UPDATE обновит только их.
    const row: Partial<ReportRequisitesEntity> = {
      coopname: input.coopname,
      updated_by: input.updated_by,
    };
    if (input.okved !== undefined) row.okved = input.okved;
    if (input.okfs !== undefined) row.okfs = input.okfs;
    if (input.okopf !== undefined) row.okopf = input.okopf;
    if (input.oktmo !== undefined) row.oktmo = input.oktmo;
    if (input.okpo !== undefined) row.okpo = input.okpo;
    if (input.sfr_reg_number !== undefined) row.sfr_reg_number = input.sfr_reg_number;
    if (input.pfr_reg_number !== undefined) row.pfr_reg_number = input.pfr_reg_number;
    if (input.chairman_position !== undefined) row.chairman_position = input.chairman_position;
    if (input.signer_snils !== undefined) row.signer_snils = input.signer_snils;
    if (input.signer_rep_doc !== undefined) row.signer_rep_doc = input.signer_rep_doc;
    if (input.signer_type !== undefined) row.signer_type = input.signer_type;
    if (input.phone_override !== undefined) row.phone_override = input.phone_override;
    if (input.address_override !== undefined) row.address_override = input.address_override;

    await this.repository.upsert(row as ReportRequisitesEntity, {
      conflictPaths: ['coopname'],
      skipUpdateIfNoValuesChanged: false,
    });
    const reloaded = await this.repository.findOne({ where: { coopname: input.coopname } });
    if (!reloaded) {
      throw new Error('report_requisites upsert: запись не найдена после upsert');
    }
    return this.toRecord(reloaded);
  }

  private toRecord(entity: ReportRequisitesEntity): ReportRequisitesRecord {
    return {
      coopname: entity.coopname,
      okved: entity.okved ?? null,
      okfs: entity.okfs ?? null,
      okopf: entity.okopf ?? null,
      oktmo: entity.oktmo ?? null,
      okpo: entity.okpo ?? null,
      sfr_reg_number: entity.sfr_reg_number ?? null,
      pfr_reg_number: entity.pfr_reg_number ?? null,
      chairman_position: entity.chairman_position ?? null,
      signer_snils: entity.signer_snils ?? null,
      signer_rep_doc: entity.signer_rep_doc ?? null,
      signer_type: entity.signer_type ?? null,
      phone_override: entity.phone_override ?? null,
      address_override: entity.address_override ?? null,
      updated_by: entity.updated_by,
      updated_at: entity.updated_at,
    };
  }
}
