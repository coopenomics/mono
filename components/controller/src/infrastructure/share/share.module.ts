import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShareTokenEntity } from './share-token.entity';
import { ShareService } from './share.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ShareTokenEntity])],
  providers: [ShareService],
  exports: [ShareService],
})
export class ShareModule {}
