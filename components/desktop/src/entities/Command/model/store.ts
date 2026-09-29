import { defineStore } from 'pinia';
import { markRaw, ref } from 'vue';
import type { IWorkspaceCommand } from 'src/shared/lib/types/workspace';
import { parseShortcut, type ShortcutKeys } from 'src/shared/lib/shortcuts';

const namespace = 'commands';

/** Команда в реестре: чей стол и её сочетание после проверки. */
export interface IRegisteredCommand {
  command: IWorkspaceCommand;
  workspace: string;
  /** Сочетание команды; `null` — не задано, неверно или занято другой командой */
  keys: ShortcutKeys | null;
}

/**
 * Реестр команд рабочего стола. Расширения кладут сюда команды своих столов
 * при установке, рядом с маршрутами. Сочетание клавиш у каждой команды своё:
 * второе объявление того же сочетания теряет его (команда остаётся доступной
 * из окна), а в консоли остаётся ошибка — пересечение видно разработчику сразу.
 * Кто первым объявил, определяет порядок расширений в реестре установки.
 */
export const useCommandStore = defineStore(namespace, () => {
  const commands = ref<IRegisteredCommand[]>([]);

  function register(workspace: string, list: IWorkspaceCommand[] = []): void {
    for (const command of list) {
      const existing = commands.value.findIndex((c) => c.command.id === command.id);
      // Повторная установка того же приложения обновляет его команды.
      const others = commands.value.filter((_, i) => i !== existing);
      const keys = parseShortcut(command.shortcut);
      if (command.shortcut && !keys) {
        console.error(
          `[Commands] У команды «${command.id}» неверное сочетание «${command.shortcut}»: ` +
            'нужна ведущая клавиша и буква, например «N T».',
        );
      }
      const taken = keys && others.find((c) => c.keys?.join(' ') === keys.join(' '));
      if (taken) {
        console.error(
          `[Commands] Сочетание «${keys.join(' ')}» команды «${command.id}» уже занято ` +
            `командой «${taken.command.id}» — у «${command.id}» оно снято.`,
        );
      }
      const entry: IRegisteredCommand = {
        command: { ...command, dialog: command.dialog ? markRaw(command.dialog) : undefined },
        workspace,
        keys: taken ? null : keys,
      };
      if (existing === -1) commands.value.push(entry);
      else commands.value[existing] = entry;
    }
  }

  return { commands, register };
});
