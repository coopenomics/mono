import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RobotDecisionTypeormEntity } from '../entities/robot-decision-typeorm.entity';
import { RobotKeyTypeormEntity } from '../entities/robot-key-typeorm.entity';

/** Таблицы робота решений совета на общем подключении контроллера. */
@Module({
  imports: [TypeOrmModule.forFeature([RobotDecisionTypeormEntity, RobotKeyTypeormEntity])],
  exports: [TypeOrmModule],
})
export class SovietRobotDatabaseModule {}
