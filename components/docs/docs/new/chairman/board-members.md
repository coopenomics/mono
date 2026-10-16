---
tags:
  - Председатель
  - Разработчик
---

# Члены совета

Страница ведёт состав совета кооператива. Состав совета утверждает общее собрание пайщиков, председатель вносит его на платформу.

![Члены совета](/assets/new/chairman/board-members/01-page.png)

Строка члена совета показывает позицию, учётное имя и ФИО. У председателя совета своя позиция. Кнопка «Добавить члена» в шапке ищет пайщика по имени и добавляет его в совет, кнопка «удалить» в строке выводит из совета. Голосование в повестке совета считает большинство от числа членов совета на этой странице.

## Разработчикам

{{ dev_schema_source() }}

### Системная информация (в т.ч. состав совета)

{{ get_sdk_doc("Queries", "System", "GetSystemInfo") }} | {{ get_graphql_doc("query.getSystemInfo") }}

{{ get_typedoc_desc("Queries.System.GetSystemInfo") }}

{{ get_typedoc_input("Queries.System.GetSystemInfo") }}

Результат:

{{ get_typedoc_definition("Queries.System.GetSystemInfo", "IOutput") }}

В ответе поле `board_members` (тип `BoardMember`) отражает текущий состав совета, отображаемый в интерфейсе.

### Изменение состава совета (как в UI рабочего стола)

Транзакция в контракт `soviet`, действие `updateboard`; типы параметров — `cooptypes` → `SovietContract.Actions.Boards.UpdateBoard` (см. также `src/features/Cooperative/UpdateBoard` на десктопе).

{{ dev_blockchain_note() }}

