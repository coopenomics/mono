export function toDotNotation(obj, prefix = '') {
  return Object.keys(obj).reduce((acc, key) => {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;

    // Ключ с $ — оператор языка отбора хранилища фабрики ($or, $regex…), не преобразовываем
    if (key.startsWith('$')) {
      acc[newKey] = value;
      return acc;
    }

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Объект с операторами отбора — условие на поле, сохраняем как есть
      const hasOperators = Object.keys(value).some((k) => k.startsWith('$'));

      if (hasOperators) {
        // Если содержит операторы, сохраняем как есть с новым ключом
        acc[newKey] = value;
      } else {
        // Иначе рекурсивно преобразуем
        Object.assign(acc, toDotNotation(value, newKey));
      }
    } else {
      acc[newKey] = value;
    }

    return acc;
  }, {});
}
