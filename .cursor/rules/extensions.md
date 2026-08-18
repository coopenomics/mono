# Архитектура расширений в MonoCoop

## Основные принципы
1. Расширения построены на модулях NestJS с использованием шаблона "Порты и адаптеры"
2. Каждое расширение наследуется от `BaseExtensionModule` и реализует интерфейс `OnModuleInit`
3. Расширения могут взаимодействовать с блокчейном через соответствующие порты
4. Конфигурации расширений хранятся в БД и описываются с помощью Zod-схем
5. Расширения регистрируются в глобальном реестре `AppRegistry`

## Структура расширения
Минимальная структура расширения включает:
- `XXX-extension.module.ts` - основной модуль расширения
- `package.json` - информация о пакете
- `README.md` - документация
- `INSTALL.md` - инструкции по установке
- `CHANGELOG.md` - история изменений

## Создание нового расширения
1. Создайте директорию для расширения в `components/controller/src/extensions/`
2. Создайте основной класс расширения, наследующийся от `BaseExtensionModule` (импорт из `@coopenomics/extension-kit`)
3. Определите Zod-схему для конфигурации
4. Реализуйте метод `initialize()`
5. Зарегистрируйте расширение в `extensions.registry.ts`
6. Добавьте расширение в список дефолтных приложений в `extension-domain.service.ts`

## Пример структуры модуля расширения
```typescript
// XXX-extension.module.ts
export class XXXExtension extends BaseExtensionModule {
  constructor(...) {
    super();
  }

  name = 'xxx';
  extension!: ExtensionDomainEntity<IConfig>;
  public configSchemas = Schema;

  async initialize() {
    // Инициализация расширения
    // Настройка cron-задач
  }
}

@Module({
  providers: [XXXExtension],
})
export class XXXExtensionModule {
  constructor(private readonly xxxExtension: XXXExtension) {}

  async initialize() {
    await this.xxxExtension.initialize();
  }
}
```

## Управление отображением конфигурации
Zod-схемы используются для автоматического отображения формы настроек в интерфейсе пользователя. 
Через интерфейс `DeserializedDescriptionOfExtension` из `components/controller/src/types/shared/extension.types.ts` 
можно управлять отображением полей формы:

```typescript
export const Schema = z.object({
  // Базовое поле с меткой
  simpleField: z.string().describe(
    describeField({
      label: 'Название поля',
      note: 'Подсказка под полем'
    })
  ),
  
  // Скрытое поле для служебного использования
  hiddenField: z.string().describe(
    describeField({
      label: 'Скрытое поле',
      visible: false
    })
  ),
  
  // Поле с проверкой значения
  validatedField: z.number().describe(
    describeField({
      label: 'Поле с валидацией',
      rules: ['val >= 5', 'val <= 100'],
    })
  ),
  
  // Форматированное поле с префиксом и суффиксом
  formattedField: z.number().describe(
    describeField({
      label: 'Форматированное поле',
      prepend: '$',
      append: 'USD',
    })
  ),
  
  // Многострочное текстовое поле
  multilineField: z.string().describe(
    describeField({
      label: 'Многострочное поле',
      maxRows: 5,
      minLength: 10,
      maxLength: 1000
    })
  ),
});
```

Доступные поля для управления отображением:
- `label` - название поля (обязательное)
- `note` - пояснение или подсказка
- `visible` - видимость поля (по умолчанию true)
- `rules` - правила валидации в виде строковых выражений
- `mask` - маска для ввода
- `fillMask` - автозаполнение маски
- `minLength` / `maxLength` - ограничения длины для текстовых полей
- `maxRows` - количество строк для многострочного ввода
- `append` / `prepend` - текст до/после значения поля

## Взаимодействие с блокчейном
Для взаимодействия с блокчейном:
1. Определите порт в доменном слое (например, `SovietBlockchainPort`)
2. Инжектируйте порт в конструкторе расширения через DI
3. Используйте методы порта для взаимодействия с блокчейном

```typescript
@Inject(SOVIET_BLOCKCHAIN_PORT) private readonly sovietBlockchainPort: SovietBlockchainPort
// ...
const decisions = await this.sovietBlockchainPort.getDecisions(coopname);
```

## Настройка планировщика задач
Расширения могут использовать cron-задачи для периодического выполнения операций:

```typescript
import cron from 'node-cron';

// Регистрация cron-задачи (каждые N минут)
const cronExpression = `*/${this.plugin.config.checkInterval} * * * *`;
cron.schedule(cronExpression, () => {
  this.logger.info('Запуск запланированной задачи');
  this.runTask();
});
```

## Работа с конфигурацией
1. Определите Zod-схему для конфигурации
2. Используйте `describeField` для добавления UI-метаданных к полям
3. Получайте и обновляйте конфигурацию через репозиторий `extensionRepository`

```typescript
export const Schema = z.object({
  checkInterval: z.number().describe(
    describeField({
      label: 'Интервал проверки (в минутах)',
      note: 'Минимум: 5 минут',
      rules: ['val >= 5'],
    })
  ),
});

// Обновление конфигурации
this.plugin.config.lastCheckDate = new Date().toISOString();
await this.extensionRepository.update(this.plugin);
```

## Логирование действий
Расширения должны логировать свои действия:
1. Используйте `WinstonLoggerService` для системного логирования
2. Используйте `LogExtensionDomainRepository` для хранения логов в БД

```typescript
// Системное логирование
this.logger.info(`Выполнение операции для ${id}`);

// Сохранение лога в БД
await this.logExtensionRepository.push(this.name, {
  type: 'operation',
  timestamp: new Date().toISOString(),
  data: { ... },
});
```

## Регистрация расширения
После создания расширения, добавьте его в `extensions.registry.ts`:

```typescript
export const AppRegistry: INamedExtension = {
  myExtension: {
    is_builtin: false,
    is_internal: true,
    is_available: true,
    is_desktop: false,
    title: 'Моё расширение',
    description: 'Описание функциональности.',
    image: 'https://example.com/image.png',
    class: MyExtensionModule,
    schema: MyExtensionSchema,
    tags: ['тег1', 'тег2'],
    readme: getReadmeContent('./myExtension'),
    instructions: getInstructionsContent('./myExtension'),
  },
};
```

## Дефолтные настройки
Добавьте расширение в список дефолтных приложений в `extension-domain.service.ts`:

```typescript
getDefaultApps(): Partial<ExtensionDomainEntity>[] {
  return [
    // ...
    {
      name: 'myExtension',
      enabled: true,
      config: {
        // Дефолтные значения конфигурации
        parameter1: 'value1',
        parameter2: 42,
      },
    },
    // ...
  ];
}
``` 
 