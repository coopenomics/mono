import type { MarketplaceStorageCellProps } from './marketplace-storage-cell.types';

/**
 * Ячейка хранения склада КУ. Существует независимо от содержимого: пустая
 * ячейка заводится заранее и живёт до тех пор, пока её не выведут из оборота —
 * в отличие от прежней полки-строки, которая существовала лишь пока на ней
 * что-то лежало.
 */
export class MarketplaceStorageCellDomainEntity {
  public readonly id: string;
  public readonly coopname: string;
  public readonly braname: string;
  public readonly section: string;
  public readonly level: number;
  public readonly code: string;
  public readonly label: string | null;
  public readonly is_active: boolean;
  public readonly created_at: Date;
  public readonly updated_at: Date;

  constructor(props: MarketplaceStorageCellProps) {
    if (!props.section.trim()) {
      throw new Error('MarketplaceStorageCellDomainEntity: секция не может быть пустой.');
    }
    if (!Number.isInteger(props.level) || props.level < 1) {
      throw new Error(
        `MarketplaceStorageCellDomainEntity: ярус должен быть целым числом от 1 (получено: ${props.level}).`
      );
    }
    if (!props.code.trim()) {
      throw new Error('MarketplaceStorageCellDomainEntity: адрес ячейки не может быть пустым.');
    }
    this.id = props.id;
    this.coopname = props.coopname;
    this.braname = props.braname;
    this.section = props.section;
    this.level = props.level;
    this.code = props.code;
    this.label = props.label ?? null;
    this.is_active = props.is_active;
    this.created_at = props.created_at;
    this.updated_at = props.updated_at;
  }
}
