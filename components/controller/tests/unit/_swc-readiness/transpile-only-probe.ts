/**
 * Standalone-проба: ts-node --transpileOnly + barrel-import metadata.
 * Запуск:
 *   pnpm exec ts-node --transpileOnly -r tsconfig-paths/register \
 *     tests/unit/_swc-readiness/transpile-only-probe.ts
 *
 * Печатает PASS/FAIL по каждому инварианту. Если FAIL — SWC-style ускорение
 * через transpileOnly ломает emitDecoratorMetadata и его нельзя включать в dev.
 */
import 'reflect-metadata';
import { ServiceA } from './barrel';
import { ServiceB } from './consumer';
import { SmokeDto, NestedPayload } from './dto';

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
    console.log(`PASS ${name}`);
  } else {
    failed++;
    console.error(`FAIL ${name}${detail ? ' — ' + detail : ''}`);
  }
}

const paramTypes = Reflect.getMetadata('design:paramtypes', ServiceB);
check(
  'ServiceB design:paramtypes === [ServiceA]',
  Array.isArray(paramTypes) && paramTypes.length === 1 && paramTypes[0] === ServiceA,
  `got: ${JSON.stringify(paramTypes?.map((t: { name: string }) => t?.name))}`,
);

const nestedType = Reflect.getMetadata('design:type', SmokeDto.prototype, 'nested');
check(
  'SmokeDto.nested design:type === NestedPayload',
  nestedType === NestedPayload,
  `got: ${nestedType?.name}`,
);

// Примечание: design:type для НЕдекорированных полей TS не записывает —
// это by design, не SWC-проблема. Поле `marker?: ServiceA` в SmokeDto без
// @-decorator → metadata = undefined; нечего проверять в этом инварианте.

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
