import { Injectable } from '@nestjs/common';
import { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import { PublishProjectFreeDecisionInputDTO } from '../dto/publish-project-free-decision-input.dto';
import type { CreateProjectFreeDecisionInputDTO } from '../dto/create-project-free-decision.dto';
import { CreatedProjectFreeDecisionDTO } from '../dto/created-project-free-decision.dto';
import { v4 } from 'uuid';
import type { FreeDecisionGenerateDocumentInputDTO } from '../../document/documents-dto/free-decision-document.dto';
import { FreeDecisionInteractor } from '~/application/free-decision/interactors/free-decision.interactor';
import type { ProjectFreeDecisionGenerateDocumentInputDTO } from '~/application/document/documents-dto/project-free-decision-document.dto';
import type { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { AgendaService } from '~/application/agenda/services/agenda.service';
import type { AgendaWithDocumentsDTO } from '~/application/agenda/dto/agenda-with-documents.dto';

// Повестка собирается join'ом таблицы decisions из блокчейна (доступна сразу)
// с проиндексированными парсером действием newsubmitted и документом-заявлением.
// Решение появляется на чейне мгновенно, но индексация парсером action'а занимает
// ~2 c — поэтому опрашиваем повестку короткими тиками, пока вопрос не соберётся,
// и возвращаем его фронту немедленно (без ожидания общего поллинга страницы).
const PUBLISH_FETCH_DELAY_MS = 400;
const PUBLISH_FETCH_ATTEMPTS = 13; // ~5 c суммарно — запас над типичными ~2 c

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

@Injectable()
export class FreeDecisionService {
  constructor(
    private readonly freeDecisionInteractor: FreeDecisionInteractor,
    private readonly agendaService: AgendaService
  ) {}

  public async generateProjectOfFreeDecision(
    data: ProjectFreeDecisionGenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.freeDecisionInteractor.generateProjectOfFreeDecisionDocument(data, options);
    //TODO чтобы избавиться от unknown необходимо строго типизировать ответ фабрики документов
    return document as unknown as GeneratedDocumentDTO;
  }

  public async generateFreeDecision(
    data: FreeDecisionGenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.freeDecisionInteractor.generateFreeDecisionDocument(data, options);
    //TODO чтобы избавиться от unknown необходимо строго типизировать ответ фабрики документов
    return document as unknown as GeneratedDocumentDTO;
  }

  public async publishProjectOfFreeDecision(
    data: PublishProjectFreeDecisionInputDTO
  ): Promise<AgendaWithDocumentsDTO | null> {
    await this.freeDecisionInteractor.publishProjectOfFreeDecision(data);

    // decision.hash в блокчейне == «общий хэш» подписанного заявления (hash =
    // doc_hash + meta_hash), НЕ doc_hash (хэш только содержимого) — их легко
    // перепутать, и матч по doc_hash молча никогда не сработает.
    const hash = data.document.hash;

    let item: AgendaWithDocumentsDTO | null = null;
    for (let attempt = 0; attempt < PUBLISH_FETCH_ATTEMPTS; attempt++) {
      item = await this.agendaService.getAgendaItemByHash(hash);
      if (item) break;
      await sleep(PUBLISH_FETCH_DELAY_MS);
    }

    // null допустим: если парсер не успел проиндексировать — фронт покажет вопрос
    // на ближайшем тике поллинга (деградация, не ошибка).
    return item;
  }

  public async createProjectOfFreeDecision(data: CreateProjectFreeDecisionInputDTO): Promise<CreatedProjectFreeDecisionDTO> {
    const id = v4();
    const project = await this.freeDecisionInteractor.createProjectOfFreeDecision({ ...data, id });
    return new CreatedProjectFreeDecisionDTO(project);
  }
}
