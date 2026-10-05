// infrastructure/database/database.module.ts
import { Module } from '@nestjs/common';
import { KyselyModule } from './kysely/kysely.module';
import { GeneratorRepositoriesModule } from './generator-repositories/generator-repositories.module';

@Module({
  imports: [KyselyModule, GeneratorRepositoriesModule],
  exports: [KyselyModule, GeneratorRepositoriesModule],
})
export class DatabaseModule {}
