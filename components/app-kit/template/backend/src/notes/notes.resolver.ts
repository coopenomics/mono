import { UseGuards } from '@nestjs/common';
import {
  Args,
  Int,
  Mutation,
  Query,
  ResolveReference,
  Resolver,
} from '@nestjs/graphql';
import {
  ExtensionAccessGuard,
  type ExtensionIdentity,
} from '@coopenomics/extension-sdk';
import { CurrentIdentity } from '../core/current-identity.decorator';
import { Note } from './note.entity';
import { NotesService } from './notes.service';

/**
 * Локальные Query / Mutation расширения.
 *
 *  - `exampleAppNotes` — публичная выдача последних заметок;
 *    в реальном пакете её можно тоже закрыть guard'ом — здесь оставлено
 *    открытой, чтобы показать оба варианта (open и protected).
 *  - `exampleAppAddNote` — защищена `ExtensionJwtAuthGuard`. Username
 *    автора берётся из JWT в реальном пакете; в этом примере он передаётся
 *    аргументом — чтобы пример был запускаемым без сценария на gateway.
 *
 *  - `__resolveReference` — обязателен для @key entity: gateway вызывает
 *    его, когда другой subgraph упоминает Note по id.
 */
@Resolver(() => Note)
export class NotesResolver {
  constructor(private readonly notes: NotesService) {}

  @Query(() => [Note], { name: 'exampleAppNotes' })
  list(
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Note[] {
    return this.notes.list(limit);
  }

  @Mutation(() => Note, { name: 'exampleAppAddNote' })
  @UseGuards(ExtensionAccessGuard)
  add(
    // Автор — пайщик, которого опознало ядро, а не аргумент запроса: иначе
    // заметку можно записать от чужого имени.
    @CurrentIdentity() identity: ExtensionIdentity,
    @Args('body') body: string,
  ): Note {
    return this.notes.add(identity.username, body);
  }

  @ResolveReference()
  resolveReference(ref: { __typename: string; id: string }): Note | undefined {
    return this.notes.findById(ref.id);
  }
}
