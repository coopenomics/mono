import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateEntity } from '../entities/candidate.entity';
import type { CandidateRepository } from '~/domain/account/repository/candidate.repository';
import type { CandidateDomainInterface } from '~/domain/account/interfaces/candidate-domain.interface';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import { DocumentType, ProgramKey, CandidateStatus } from '~/domain/registration/enum';

@Injectable()
export class TypeOrmCandidateRepository implements CandidateRepository {
  constructor(
    @InjectRepository(CandidateEntity)
    private readonly candidateRepository: Repository<CandidateEntity>
  ) {}

  async findByUsername(username: string): Promise<CandidateDomainInterface | null> {
    const candidate = await this.candidateRepository.findOneBy({ username });
    if (!candidate) return null;

    return this.mapToDomainEntity(candidate);
  }

  async findByRegistrationHash(hash: string): Promise<CandidateDomainInterface | null> {
    // registration_hash в БД хранится lowercase (sha256().digest('hex')), а из
    // цепи checksum256 приходит в UPPERCASE (напр. в declinereg.registration_hash).
    // Нормализуем входящий хэш, иначе exact-match findOneBy не находит кандидата.
    const candidate = await this.candidateRepository.findOneBy({ registration_hash: hash.toLowerCase() });
    if (!candidate) return null;

    return this.mapToDomainEntity(candidate);
  }

  async create(data: CandidateDomainInterface): Promise<CandidateDomainInterface> {
    const candidate = new CandidateEntity();
    candidate.username = data.username;
    candidate.coopname = data.coopname;
    candidate.braname = data.braname || '';
    candidate.status = data.status;
    candidate.type = data.type;
    candidate.created_at = data.created_at;
    candidate.registration_hash = data.registration_hash;
    candidate.referer = data.referer;
    candidate.public_key = data.public_key;
    candidate.meta = data.meta;
    candidate.program_key = data.program_key;
    candidate.program_agreements = data.program_agreements ?? {};

    const createdEntity = await this.candidateRepository.save(candidate);
    return this.mapToDomainEntity(createdEntity);
  }

  async update(username: string, data: Partial<CandidateDomainInterface>): Promise<CandidateDomainInterface | null> {
    const candidate = await this.candidateRepository.findOneBy({ username });
    if (!candidate) return null;

    if (data.status) candidate.status = data.status;
    if (data.registered_at) candidate.registered_at = data.registered_at;
    if (data.type) candidate.type = data.type;
    if (data.braname) candidate.braname = data.braname;
    if (data.registration_hash) candidate.registration_hash = data.registration_hash;
    if (data.program_key !== undefined) candidate.program_key = data.program_key;

    if (data.documents) {
      if (data.documents.statement) candidate.statement = data.documents.statement;
      if (data.documents.wallet_agreement) candidate.wallet_agreement = data.documents.wallet_agreement;
      if (data.documents.signature_agreement) candidate.signature_agreement = data.documents.signature_agreement;
      if (data.documents.privacy_agreement) candidate.privacy_agreement = data.documents.privacy_agreement;
      if (data.documents.user_agreement) candidate.user_agreement = data.documents.user_agreement;
      if (data.documents.blagorost_offer)
        candidate.blagorost_offer = data.documents.blagorost_offer;
      if (data.documents.generator_offer) candidate.generator_offer = data.documents.generator_offer;
    }

    if (data.program_agreements) {
      candidate.program_agreements = {
        ...(candidate.program_agreements ?? {}),
        ...data.program_agreements,
      };
    }

    const updatedEntity = await this.candidateRepository.save(candidate);
    return this.mapToDomainEntity(updatedEntity);
  }

  async saveDocument(
    username: string,
    documentType: DocumentType,
    document: ISignedDocumentDomainInterface
  ): Promise<void> {
    const candidate = await this.candidateRepository.findOneBy({ username });
    if (!candidate) {
      throw new Error(`Кандидат с username ${username} не найден`);
    }

    switch (documentType) {
      case DocumentType.STATEMENT:
        candidate.statement = document;
        break;
      case DocumentType.WALLET_AGREEMENT:
        candidate.wallet_agreement = document;
        break;
      case DocumentType.SIGNATURE_AGREEMENT:
        candidate.signature_agreement = document;
        break;
      case DocumentType.PRIVACY_AGREEMENT:
        candidate.privacy_agreement = document;
        break;
      case DocumentType.USER_AGREEMENT:
        candidate.user_agreement = document;
        break;
      case DocumentType.BLAGOROST_OFFER:
        candidate.blagorost_offer = document;
        break;
      case DocumentType.GENERATOR_OFFER:
        candidate.generator_offer = document;
        break;
    }

    await this.candidateRepository.save(candidate);
  }

  async saveProgramAgreement(
    username: string,
    agreementId: string,
    document: ISignedDocumentDomainInterface
  ): Promise<void> {
    const candidate = await this.candidateRepository.findOneBy({ username });
    if (!candidate) {
      throw new Error(`Кандидат с username ${username} не найден`);
    }

    candidate.program_agreements = {
      ...(candidate.program_agreements ?? {}),
      [agreementId]: document,
    };

    await this.candidateRepository.save(candidate);
  }

  async findAllPaginated(options: {
    page: number;
    limit: number;
    sortOrder: 'ASC' | 'DESC';
    referer?: string;
  }): Promise<{ items: CandidateDomainInterface[]; totalCount: number }> {
    const skip = (options.page - 1) * options.limit;

    const [items, totalCount] = await this.candidateRepository.findAndCount({
      where: options.referer ? { referer: options.referer } : {},
      order: {
        registered_at: {
          direction: options.sortOrder,
          nulls: options.sortOrder === 'DESC' ? 'LAST' : 'FIRST',
        },
        created_at: options.sortOrder,
      },
      take: options.limit,
      skip,
    });

    return {
      items: items.map((item) => this.mapToDomainEntity(item)),
      totalCount,
    };
  }

  private mapToDomainEntity(entity: CandidateEntity): CandidateDomainInterface {
    return {
      username: entity.username,
      coopname: entity.coopname,
      braname: entity.braname,
      status: entity.status as CandidateStatus,
      type: entity.type,
      created_at: entity.created_at,
      registered_at: entity.registered_at,
      documents: {
        statement: entity.statement,
        wallet_agreement: entity.wallet_agreement,
        signature_agreement: entity.signature_agreement,
        privacy_agreement: entity.privacy_agreement,
        user_agreement: entity.user_agreement,
        blagorost_offer: entity.blagorost_offer,
        generator_offer: entity.generator_offer,
      },
      registration_hash: entity.registration_hash,
      referer: entity.referer,
      public_key: entity.public_key,
      meta: entity.meta,
      program_key: entity.program_key as ProgramKey | undefined,
      program_agreements: entity.program_agreements ?? {},
    };
  }
}
