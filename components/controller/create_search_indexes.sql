-- Создаем индексы для оптимизации поиска по названиям категорий и типов товаров

-- Функциональный индекс для поиска категорий (регистронезависимый)
CREATE INDEX IF NOT EXISTS idx_categories_name_lower
ON categories USING btree (lower(category_name));

-- Функциональный индекс для поиска типов товаров (регистронезависимый)
CREATE INDEX IF NOT EXISTS idx_types_name_lower
ON types USING btree (lower(type_name));

-- GIN индекс для полнотекстового поиска категорий (опционально)
CREATE INDEX IF NOT EXISTS idx_categories_name_gin
ON categories USING gin (to_tsvector('russian', category_name));

-- GIN индекс для полнотекстового поиска типов товаров (опционально)
CREATE INDEX IF NOT EXISTS idx_types_name_gin
ON types USING gin (to_tsvector('russian', type_name));

-- Индекс для связи типов с категориями (для оптимизации joins)
CREATE INDEX IF NOT EXISTS idx_types_category_id
ON types USING btree (description_category_id);

-- Индекс для поиска активных записей
CREATE INDEX IF NOT EXISTS idx_categories_disabled
ON categories USING btree (disabled);

CREATE INDEX IF NOT EXISTS idx_types_disabled
ON types USING btree (disabled);

-- Составной индекс для поиска активных категорий с именем
CREATE INDEX IF NOT EXISTS idx_categories_name_disabled
ON categories USING btree (lower(category_name), disabled);

-- Составной индекс для поиска активных типов с именем
CREATE INDEX IF NOT EXISTS idx_types_name_disabled
ON types USING btree (lower(type_name), disabled);
