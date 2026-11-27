import { Injectable } from '@nestjs/common';
import { Note } from './note.entity';

/**
 * In-memory storage заметок. В рабочем приложении на этом месте стоит TypeORM /
 * Postgres / любой источник; на уровне SDK ничего про БД не навязывается.
 *
 * State per-process — на старте subgraph'а пустая Map. Перезапуск контейнера
 * orchestrator'ом обнулит её. Это умышленно: пример без зависимостей на БД,
 * чтобы запускаться одной командой `node dist/main.js`.
 */
@Injectable()
export class NotesService {
  private readonly notes = new Map<string, Note>();
  private seq = 0;

  add(authorUsername: string, body: string): Note {
    const id = String(++this.seq);
    const note: Note = {
      id,
      authorUsername,
      body,
      createdAt: new Date().toISOString(),
    };
    this.notes.set(id, note);
    return note;
  }

  list(limit?: number): Note[] {
    const all = Array.from(this.notes.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    return typeof limit === 'number' && limit > 0 ? all.slice(0, limit) : all;
  }

  listByAuthor(authorUsername: string): Note[] {
    return Array.from(this.notes.values()).filter(
      (n) => n.authorUsername === authorUsername,
    );
  }

  countByAuthor(authorUsername: string): number {
    return this.listByAuthor(authorUsername).length;
  }

  findById(id: string): Note | undefined {
    return this.notes.get(id);
  }
}
