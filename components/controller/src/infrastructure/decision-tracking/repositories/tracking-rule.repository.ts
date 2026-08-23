import { Injectable } from '@nestjs/common';
import type { TrackingRule } from '@coopenomics/innercoop';

/**
 * Абстрактный репозиторий для правил отслеживания решений
 * Интерфейс для работы с правилами отслеживания независимо от реализации
 */
@Injectable()
export abstract class TrackingRuleRepository {
  abstract save(rule: TrackingRule): Promise<TrackingRule>;
  abstract findById(id: string): Promise<TrackingRule | null>;
  abstract findByHash(hash: string): Promise<TrackingRule | null>;
  abstract findAllActive(): Promise<TrackingRule[]>;
  abstract update(rule: TrackingRule): Promise<TrackingRule>;
  abstract delete(id: string): Promise<void>;
}
