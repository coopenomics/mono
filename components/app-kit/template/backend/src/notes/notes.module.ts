import { Module } from '@nestjs/common';
import { NotesService } from './notes.service';
import { NotesResolver } from './notes.resolver';

@Module({
  // Поле на пайщике ядра (Cooperator.exampleAppNotesCount) снято 25.11.2026:
  // ядро не объявляет своих сущностей с @key, шлюз такую схему не соберёт.
  // Вернуть, когда ядро отдаст Account как расширяемую сущность.
  providers: [NotesService, NotesResolver],
})
export class NotesModule {}
