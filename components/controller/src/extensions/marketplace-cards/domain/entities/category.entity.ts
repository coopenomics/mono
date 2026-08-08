/**
 * Категория товаров — дерево категорий
 */
export interface CategoryEntity {
  id: string;
  coopname: string;
  parent_id?: string;
  name: string;
  description?: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
