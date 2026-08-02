# BMAD v6 Helper Utilities

This document contains reusable utilities for BMAD workflows. Skills and commands can reference specific sections to avoid repetition.

## Config Loading

### Load Global Config
```
Path: ~/.claude/config/bmad/config.yaml
Purpose: Get user settings, enabled modules, defaults

Using Read tool:
1. Read ~/.claude/config/bmad/config.yaml
2. Parse YAML to extract:
   - user_name
   - communication_language
   - default_output_folder
   - modules_enabled
3. Store in memory for workflow
```

### Load Project Config
```
Path: {project-root}/bmad/config.yaml
Purpose: Get project-specific settings

Using Read tool:
1. Read bmad/config.yaml
2. Parse YAML to extract:
   - project_name
   - project_type
   - project_level
   - output_folder
3. Merge with global config (project overrides global)
```

### Combined Config Load
```
Execute in order:
1. Load global config (defaults)
2. Load project config (overrides)
3. Return merged config object
```

## Status File Operations

### Load Workflow Status
```
Path: {output_folder}/bmm-workflow-status.yaml (from project config)
Purpose: Check completed workflows, current phase

Using Read tool:
1. Read docs/bmm-workflow-status.yaml (or path from config)
2. Parse YAML to extract:
   - project metadata
   - workflow_status array
3. Determine current phase:
   - Find last completed workflow (status = file path)
   - Identify next required/recommended workflow
```

### Update Workflow Status
```
Purpose: Mark workflow as complete

Using Edit tool:
1. Load current status file
2. Find workflow by name
3. Update status field: "{file-path}"
4. Update last_updated: current timestamp
5. Save changes
```

### Load Sprint Status
```
Path: {output_folder}/sprint-status.yaml
Purpose: Check epic/story progress

Using Read tool:
1. Read docs/sprint-status.yaml
2. Parse YAML to extract:
   - sprint_number
   - epics array
   - stories within epics
   - metrics
```

### Update Sprint Status
```
Purpose: Add/update epics and stories

Using Edit tool:
1. Load current sprint status
2. Modify epics/stories array
3. Recalculate metrics
4. Update last_updated timestamp
5. Save changes
```

## Template Operations

### Load Template
```
Purpose: Load document template for workflow

Using Read tool:
1. Read template from: ~/.claude/config/bmad/templates/{workflow-name}.md
2. Store template content
3. Extract variable placeholders: {{variable_name}}
```

**Blago:** шаблоны PRD/бриф/техспека/архитектура — `~/.claude/config/blago/templates/{имя}.md` — см. **blago-cli** → **Blago Document Templates** в этом же файле.

### Apply Variables to Template
```
Purpose: Substitute {{variables}} with actual values

Process:
1. For each variable in template:
   - {{project_name}} → from config
   - {{date}} → current date (YYYY-MM-DD)
   - {{timestamp}} → current ISO timestamp
   - {{user_name}} → from global config
   - {{custom_var}} → from user input
2. Replace all {{variable}} with values
3. Return completed document
```

### Save Output Document
```
Purpose: Write completed document to output folder

Using Write tool:
1. Determine output path:
   - {output_folder}/{workflow-name}-{project-name}-{date}.md
   - Example: docs/prd-myapp-2025-01-11.md
2. Write content to path
3. Return file path for status update
```

## Variable Substitution

### Standard Variables
```
{{project_name}}           → config: project_name
{{project_type}}           → config: project_type
{{project_level}}          → config: project_level
{{user_name}}              → config: user_name
{{date}}                   → current date (YYYY-MM-DD)
{{timestamp}}              → current timestamp (ISO 8601)
{{output_folder}}          → config: output_folder
```

### Conditional Variables
```
{{PRD_STATUS}}             → "required" if level >= 2, else "recommended"
{{TECH_SPEC_STATUS}}       → "required" if level <= 1, else "optional"
{{ARCHITECTURE_STATUS}}    → "required" if level >= 2, else "optional"
```

### Level-Based Logic
```
Level 0 (1 story):         PRD optional, tech-spec required, no architecture
Level 1 (1-10 stories):    PRD recommended, tech-spec required, no architecture
Level 2 (5-15 stories):    PRD required, tech-spec optional, architecture required
Level 3 (12-40 stories):   PRD required, tech-spec optional, architecture required
Level 4 (40+ stories):     PRD required, tech-spec optional, architecture required
```

## Workflow Recommendations

### Determine Next Workflow
```
Input: workflow_status array
Output: recommended next workflow

Logic:
1. If no product-brief and project new → Recommend: /product-brief
2. If product-brief complete, no PRD/tech-spec → Recommend based on level:
   - Level 0-1: /tech-spec
   - Level 2+: /prd
3. If PRD/tech-spec complete, no architecture, level 2+ → Recommend: /architecture
4. If architecture complete (or not required) → Recommend: /sprint-planning
5. If sprint active → Recommend: /create-story or /dev-story
```

### Status Display Format
```
✓ = Completed (green)
⚠ = Required but not started (yellow)
→ = Current phase indicator
- = Optional/not required

Example:
✓ Phase 1: Analysis
  ✓ product-brief (docs/product-brief-myapp-2025-01-11.md)
  - research (optional)

→ Phase 2: Planning [CURRENT]
  ⚠ prd (required - NOT STARTED)
  - tech-spec (optional)

Phase 3: Solutioning
  - architecture (required)
```

## Path Resolution

### Resolve Project Root
```
Method: Use environment or detect
- Claude Code provides working directory
- Use `{project-root}` as placeholder
- Replace at runtime with actual path
```

### Resolve Config Paths
```
~/.claude/config/bmad/config.yaml           → Global config
{project-root}/bmad/config.yaml             → Project config
{project-root}/{output_folder}              → Output directory (usually docs/)
```

### Resolve Template Paths
```
~/.claude/config/bmad/templates/{name}.md   → Template files
```

## Error Handling

### File Not Found
```
If config file missing:
  - Use defaults
  - Prompt user to run /workflow-init

If status file missing:
  - Inform user project not initialized
  - Offer to run /workflow-init

If template missing:
  - Use inline template
  - Log warning
```

### Invalid YAML
```
If YAML parse error:
  - Show error message
  - Provide file path
  - Suggest manual fix or reinit
```

## Token Optimization Tips

### Reference vs. Embed
```
✓ Good: "Follow helper instructions in utils/helpers.md#Load-Global-Config"
✗ Bad: Embed full instructions in every command

✓ Good: "Use standard variables from helpers.md#Standard-Variables"
✗ Bad: List all variables in every template
```

### Lazy Loading
```
✓ Good: Load config only when needed
✗ Bad: Load all files upfront

✓ Good: Read status file when checking progress
✗ Bad: Keep status in memory throughout chat
```

### Reuse Patterns
```
✓ Good: "Execute Step 1-3 from helpers.md#Combined-Config-Load"
✗ Bad: Repeat config loading steps in every workflow
```

## Quick Reference Commands

### For Skills/Commands
```
To load config: See helpers.md#Combined-Config-Load
To check status: See helpers.md#Load-Workflow-Status
To update status: See helpers.md#Update-Workflow-Status
To use template: See helpers.md#Load-Template + helpers.md#Apply-Variables-to-Template
To save output: See helpers.md#Save-Output-Document
To recommend next: See helpers.md#Determine-Next-Workflow
```

---

## blago-cli

Справка для ролей (analyst, pm, architect, …): отдельного скилла `cli` нет — весь минимальный флоу здесь. Slash-команды: **`~/.claude/commands/blago/commands/`** (зеркально **`~/.cursor/commands/blago/commands/`**). Скиллы blago (не BMAD): **`~/.claude/skills/blago/`** · **`~/.cursor/skills/blago/`**. Скиллы BMAD: **`…/skills/blago/bmad/`**.

**Где что лежит после `blago init` / `blago skills install`:**

| Что | Путь |
|-----|------|
| Этот файл | `~/.claude/config/blago/helpers.md` — в скиллах ссылка **`helpers.md`** = этот абсолютный путь |
| Глобальный конфиг | `~/.claude/config/blago/config.yaml` |
| Шаблоны документов | `~/.claude/config/blago/templates/*.md` — в скиллах ссылка **`templates/{имя}.md`** = этот каталог |
| Скиллы агента (blago) | `~/.claude/skills/blago/…` · `~/.cursor/skills/blago/…` |
| Скиллы BMAD | `~/.claude/skills/blago/bmad/…` · `~/.cursor/skills/blago/bmad/…` |

Синхронизируются типы: **project**, **issue**, **story**. Тип **result** через CLI не синхронизируется.

### Blago Orchestration And Agent Limits

**Отправка в Capital (`blago add`, `blago push`):** только **оператор** (позже — отдельный оркестратор). Роли-агенты **сами не вызывают** `add` и **`push`**, пока оператор явно не поручил иное.

**Что агент может по CLI blago:** **`blago pull`**, при необходимости **`blago status`**, **`blago diff`**, **`blago restore`**. Для **новых** issue/story — **`blago create issue`** / **`blago create req`** (**`helpers.md#Blago-Create-Only`**); путь к файлу брать из **вывода** команды.

**Что агент делает в копии:** правит существующие `.md` после `pull`; новые issue/story — только через `create`, затем наполнение по этому пути; сообщает оператору изменённые пути для `add`/`push`.

**Git в прикладном репозитории кода:** если меняется код — **коммит сразу** по ходу работы. **Первая строка** (subject):

1. **Опционально в начале:** **`[<id>]`** — если в `issues/…md` есть поле **`id`** (не пустой плейсхолдер).
2. **Текст:** краткое описание изменения.
3. **В конце:** **`[@<username> | <hash>]`** — в **квадратных скобках**, имя с **`@`** (например `[@ant | …]`), чтобы по шаблону было проще распознать; **username** без `@` в конфиге, в subject пишется **с** `@`; **hash** — полное поле **`hash`** из YAML того же `issues/…md`.

```text
[CAPITAL-12] краткое описание изменения [@ant | <полный-hash-issue>]
краткое описание [@ant | <полный-hash-issue>]
```

Один смысловой шаг — **отдельный коммит**. Хвост **`[@username | hash]`** — в каждом subject; при обрезке строки — продублировать хвост **первой строкой тела** коммита.

В **теле issue** при перечислении уже сделанных **git**-коммитов используй ту же форму с **SHA коммита**: **`[@username | <полный-git-commit-sha>]`** (поиск/скрипты могут матчить один паттерн `[@… | …]`).

### Blago Create Only

Новые **issue** и **story** заводить **только** через CLI — **не** создавать с нуля файлы в `issues/` или `requirements/` вручную (иначе **hash**, pending-create, пути и frontmatter разъедутся с индексом).

`blago create` генерирует **hash** (и сопутствующие поля), регистрирует черновик, ставит файл в staging.

**Команды:**

```bash
blago create issue <basePath> "<title>"
blago create req <basePath> "<title>"
```

`basePath` — каталог проекта/компонента или путь к `project.md` / `component.md`.

**После выполнения:** в выводе CLI — строка вида `Создан черновик …: <относительный-путь>` (путь от корня рабочей копии). **Использовать этот путь** для Read/Edit: наполнять тело, не дублируя файл.

Редактировать **уже существующие** `.md` после `pull` — нормально (**`helpers.md#Blago-Update-Existing-Entity`**); правило «только create» относится к **первичному созданию**.

### Blago Expected Role Paths

Правило создания новых сущностей: **`helpers.md#Blago-Create-Only`** (только `blago create issue` / `blago create req`).

**Аналитик (например «исследуй X, сделай Y» под компонент):**

1. При необходимости `blago pull`.
2. **Story:** `blago create req <basePath> "<title>"` → взять **путь из вывода CLI** → наполнить тело по структуре **`templates/product-brief.md`** (шаблон только как образец текста, не как новый файл).
3. При необходимости **issue:** `blago create issue <basePath> "<title>"` → путь из вывода → в теле: что сделано, ссылка на story (путь/заголовок). Если оператор просил только документ — достаточно story.
4. **`add` / `push`** делает оператор.

**Разработчик («сделай Y»):**

1. `blago pull`; работать с указанным **issue** (или story + issue).
2. Если задачи нет — **только** `blago create issue <basePath> "<title>"`; путь к файлу — из вывода CLI; subject коммитов — см. правило Git выше (**hash** из YAML этого issue).
3. Правки кода в рабочем репозитории → коммиты по тому же правилу subject.
4. Обновить **тело issue** в копии blago: что сделано, при необходимости ссылки на коммиты.
5. **`add` / `push`** делает оператор.

### Blago Global Config

```
Path: ~/.claude/config/blago/config.yaml
```

1. Прочитать YAML.
2. Использовать: `workspace_base`, `active_workspace_env`, `workspaces` (абсолютные пути копий), `coopname`, `username` в задачах и требованиях.

### Blago Workspace And Copy Root

База для команд `blago`: каталог активной копии = `workspaces[active_workspace_env]` из глобального конфига, **если** там есть `.blago/config.json`; иначе — текущий cwd. Корень копии: поиск `.blago/config.json` вверх от этой базы.

### Blago Sync Pull Add Push

| Действие | Команда | Кто |
|----------|---------|-----|
| Забрать с сервера | `blago pull` | Агент при необходимости; оператор |
| Статус / расхождения | `blago status`, `blago diff` | Агент / оператор |
| Пометить `.md` к отправке | `blago add <пути…>` | **Оператор** (агент не вызывает сам) |
| Отправить на сервер | `blago push` | **Оператор / оркестратор** (агент не вызывает сам) |
| Убрать из staging | `blago remove …` | Оператор |
| Перезаписать с сервера | `blago restore <путь>` | Агент / оператор |

У оператора после локальных правок в копии: **`add` → `push`**. `add` берёт только изменённые относительно `.blago/index.json` и новые без записи в индексе.

### Blago Conflict And Restore

Если `push` падает из‑за другой версии на сервере (`updated_at`):

1. `blago pull`
2. Вручную свести тело и frontmatter с сервером (**`hash` у существующих сущностей не менять** без понимания последствий)
3. Оператор: `blago add …` → `blago push`

Откат одного файла к серверу: `blago restore <path>`.

### Blago Create Issue

См. **`helpers.md#Blago-Create-Only`**.

```bash
blago create issue <basePath> "<title>"
```

Опции: `--set-self`, `--creators`, `--submaster` — `blago create issue --help`.

Дальше: правка **указанного в выводе** файла; **`add` / `push`** — оператор. Справка по полям: раздел **issue** ниже.

### Blago Create Requirement Document

См. **`helpers.md#Blago-Create-Only`**.

```bash
blago create req <basePath> "<title>"
```

Опции: `--format markdown|mermaid|drawio|bpmn`, `--set-self` — `blago create req --help`.

Дальше: наполнение **того же** файла (путь из вывода). **`add` / `push`** — оператор. Справка по полям: раздел **story** ниже.

### Blago Document Templates

```
Path: ~/.claude/config/blago/templates/{имя}.md
```

Копируются из пакета при **`blago init`** и **`blago skills install`**. Перед заполнением — **прочитать** нужный файл.

| Файл | Когда использовать |
|------|-------------------|
| `product-brief.md` | Продуктовый бриф (роль analyst) |
| `prd.md` | PRD (роль pm) |
| `tech-spec.md` | Техспека (pm / малые проекты) |
| `architecture.md` | Архитектура (роль architect) |

**Процесс (вместе с create):**
1) `blago create req <basePath> "<title>"` — зафиксировать **путь** из вывода CLI;
2) прочитать нужный **`templates/*.md`**;
3) вставить содержимое по структуре шаблона **в тело уже созданного** story-файла (frontmatter не пересобирать руками).
Отправка в Capital — **`add` / `push`** оператором.

### Blago Update Existing Entity

1. `blago pull`
2. Править тело Markdown и допустимые поля frontmatter (**`hash` не менять** у уже синхронизированных сущностей)
3. Оператор: `blago add <файл>` → `blago push`

---

### blago-cli — форматы файлов (reference)

Все файлы — Markdown с YAML frontmatter между `---` в начале файла. Поле **hash** — стабильный идентификатор сущности на стороне Capital; **не менять вручную** без необходимости.

### project (каталог `<capital_id>-<slug>/project.md` или `…/components/<capital_id>-<slug>/component.md`)

Порядок: **type**, **id**, **title**; у компонента сразу подряд **parent_title** и **parent_hash**; далее **coopname**, **status**; **hash**; даты.

- **type:** project
- **id** — числовой ID проекта/компонента в Capital (информация; не менять для push)
- **title** — название
- у компонента: **parent_title** (текст родителя с бэкенда) и **parent_hash** подряд после **title**
- **coopname**, **status**
- **hash** — перед датами
- **created_at**, **updated_at** — ISO-8601
- Тело: описание проекта (Markdown)

### issue (`issues/<issue_id>-<slug>.md` — уникальность по человекочитаемому id задачи)

Порядок: **type**, **id**, **title** (название задачи), затем **project_title** / **component_title**; далее **status**, **priority**, **estimate**, **creators**, **fact_hours**, **labels**, **cycle_id**, **submaster**; внизу **hash** и **project_hash** перед датами.

- **type:** issue
- **id** — человекочитаемый ID задачи (PREFIX-N) или запасной идентификатор
- **title** — название задачи (выше контекста проекта)
- **project_title** — корневой проект
- **component_title** — компонент, если есть
- **status**, **priority**, **estimate** (число), **creators** (массив строк)
- **fact_hours** — фактические часы по исполнителям (массив `{ username, hours }`). На **pull** подтягивается с сервера. На **push**: если у username в файле часов больше, чем на сервере — добавляется дельта через `capitalAddWorklog` (урезание не поддерживается). Username должен быть в **creators**. Ключ можно не указывать — тогда факт при push не трогается.
- **labels** (массив строк)
- опционально: **cycle_id**, **submaster**
- **hash**, **project_hash** — перед **created_at** / **updated_at**
- Поля **created_by** и **sort_order** в файле не выводятся; при push **sort_order** на сервер уходит как 0, если в YAML нет
- Тело: описание задачи

Пример **fact_hours**:

```yaml
creators:
  - ant
  - petr
fact_hours:
  - username: ant
    hours: 5
  - username: petr
    hours: 3
```

### story (`requirements/<2chars_id>-<slug>.md` или `issues/<issue_id>-<issueSlug>-requirements/<2chars_id>-<slug>.md` — первые 2 буквенно-цифровых символа из `_id`)

Порядок: **type**, при наличии **id** (`_id` с бэкенда), затем остальное.

- **type:** story
- **id** — внутренний `_id` записи требования в Capital (строка), если есть
- **title**, **hash**, **content_format** (например MARKDOWN), **status**, **created_by**, **sort_order**
- **project_hash** и/или **issue_hash**
- Тело: текст требования

После правок оператор помечает файлы (**`blago add`**) и отправляет (**`blago push`**). Просмотр отличий: `blago diff`; статус: `blago status`.

---

## blago-cli — сообщения коммитов в репозитории кода (FR-012)

**Subject (первая строка):**

- Опционально **`[<id>]`** в начале — если в `issues/…md` задан **`id`**.
- Краткое описание.
- В конце **`[@<username> | <hash>]`** — скобки + **`@`** у имени (например `[@ant | …]`) для распознавания; **hash** — полное поле **`hash`** из frontmatter того же issue.

```text
[CAPITAL-42] правка API оплат [@ant | 0a1b2c3d4e5f6789…]
фикс валидации [@ant | 0a1b2c3d4e5f6789…]
```

Контекст — со второй строки тела; при обрезке subject — хвост `[@username | hash]` продублировать в теле.

**Ссылки на коммиты в задаче:** в списке коммитов в `.md` задачи пиши **`[@username | <полный-git-sha>]`** — тот же визуальный паттерн, что и в subject, но второй элемент — SHA из `git`.
