/* eslint-disable */

import { AllTypesProps, ReturnTypes, Ops } from './const';


export const HOST="Specify host"


export const HEADERS = {}
import { createClient, type Sink } from 'graphql-ws'; // keep

export const apiSubscription = (options: chainOptions) => {
  const client = createClient({
    url: String(options[0]),
    connectionParams: Object.fromEntries(new Headers(options[1]?.headers).entries()),
  });

  const ws = new Proxy(
    {
      close: () => client.dispose(),
    } as WebSocket,
    {
      get(target, key) {
        if (key === 'close') return target.close;
        throw new Error(`Unimplemented property '${String(key)}', only 'close()' is available.`);
      },
    },
  );

  return (query: string) => {
    let onMessage: ((event: any) => void) | undefined;
    let onError: Sink['error'] | undefined;
    let onClose: Sink['complete'] | undefined;

    client.subscribe(
      { query },
      {
        next({ data }) {
          onMessage && onMessage(data);
        },
        error(error) {
          onError && onError(error);
        },
        complete() {
          onClose && onClose();
        },
      },
    );

    return {
      ws,
      on(listener: typeof onMessage) {
        onMessage = listener;
      },
      error(listener: typeof onError) {
        onError = listener;
      },
      open(listener: (socket: unknown) => void) {
        client.on('opened', listener);
      },
      off(listener: typeof onClose) {
        onClose = listener;
      },
    };
  };
};
const handleFetchResponse = (response: Response): Promise<GraphQLResponse> => {
  if (!response.ok) {
    return new Promise((_, reject) => {
      response
        .text()
        .then((text) => {
          try {
            reject(JSON.parse(text));
          } catch (err) {
            reject(text);
          }
        })
        .catch(reject);
    });
  }
  return response.json() as Promise<GraphQLResponse>;
};

export const apiFetch =
  (options: fetchOptions) =>
  (query: string, variables: Record<string, unknown> = {}) => {
    const fetchOptions = options[1] || {};
    if (fetchOptions.method && fetchOptions.method === 'GET') {
      return fetch(`${options[0]}?query=${encodeURIComponent(query)}`, fetchOptions)
        .then(handleFetchResponse)
        .then((response: GraphQLResponse) => {
          if (response.errors) {
            throw new GraphQLError(response);
          }
          return response.data;
        });
    }
    return fetch(`${options[0]}`, {
      body: JSON.stringify({ query, variables }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      ...fetchOptions,
    })
      .then(handleFetchResponse)
      .then((response: GraphQLResponse) => {
        if (response.errors) {
          throw new GraphQLError(response);
        }
        return response.data;
      });
  };

export const InternalsBuildQuery = ({
  ops,
  props,
  returns,
  options,
  scalars,
}: {
  props: AllTypesPropsType;
  returns: ReturnTypesType;
  ops: Operations;
  options?: OperationOptions;
  scalars?: ScalarDefinition;
}) => {
  const ibb = (
    k: string,
    o: InputValueType | VType,
    p = '',
    root = true,
    vars: Array<{ name: string; graphQLType: string }> = [],
  ): string => {
    const keyForPath = purifyGraphQLKey(k);
    const newPath = [p, keyForPath].join(SEPARATOR);
    if (!o) {
      return '';
    }
    if (typeof o === 'boolean' || typeof o === 'number') {
      return k;
    }
    if (typeof o === 'string') {
      return `${k} ${o}`;
    }
    if (Array.isArray(o)) {
      const args = InternalArgsBuilt({
        props,
        returns,
        ops,
        scalars,
        vars,
      })(o[0], newPath);
      return `${ibb(args ? `${k}(${args})` : k, o[1], p, false, vars)}`;
    }
    if (k === '__alias') {
      return Object.entries(o)
        .map(([alias, objectUnderAlias]) => {
          if (typeof objectUnderAlias !== 'object' || Array.isArray(objectUnderAlias)) {
            throw new Error(
              'Invalid alias it should be __alias:{ YOUR_ALIAS_NAME: { OPERATION_NAME: { ...selectors }}}',
            );
          }
          const operationName = Object.keys(objectUnderAlias)[0];
          const operation = objectUnderAlias[operationName];
          return ibb(`${alias}:${operationName}`, operation, p, false, vars);
        })
        .join('\n');
    }
    const hasOperationName = root && options?.operationName ? ' ' + options.operationName : '';
    const keyForDirectives = o.__directives ?? '';
    const query = `{${Object.entries(o)
      .filter(([k]) => k !== '__directives')
      .map((e) => ibb(...e, [p, `field<>${keyForPath}`].join(SEPARATOR), false, vars))
      .join('\n')}}`;
    if (!root) {
      return `${k} ${keyForDirectives}${hasOperationName} ${query}`;
    }
    const varsString = vars.map((v) => `${v.name}: ${v.graphQLType}`).join(', ');
    return `${k} ${keyForDirectives}${hasOperationName}${varsString ? `(${varsString})` : ''} ${query}`;
  };
  return ibb;
};

type UnionOverrideKeys<T, U> = Omit<T, keyof U> & U;

export const Thunder =
  <SCLR extends ScalarDefinition>(fn: FetchFunction, thunderGraphQLOptions?: ThunderGraphQLOptions<SCLR>) =>
  <O extends keyof typeof Ops, OVERRIDESCLR extends SCLR, R extends keyof ValueTypes = GenericOperation<O>>(
    operation: O,
    graphqlOptions?: ThunderGraphQLOptions<OVERRIDESCLR>,
  ) =>
  <Z extends ValueTypes[R]>(
    o: Z & {
      [P in keyof Z]: P extends keyof ValueTypes[R] ? Z[P] : never;
    },
    ops?: OperationOptions & { variables?: Record<string, unknown> },
  ) => {
    const options = {
      ...thunderGraphQLOptions,
      ...graphqlOptions,
    };
    return fn(
      Zeus(operation, o, {
        operationOptions: ops,
        scalars: options?.scalars,
      }),
      ops?.variables,
    ).then((data) => {
      if (options?.scalars) {
        return decodeScalarsInResponse({
          response: data,
          initialOp: operation,
          initialZeusQuery: o as VType,
          returns: ReturnTypes,
          scalars: options.scalars,
          ops: Ops,
        });
      }
      return data;
    }) as Promise<InputType<GraphQLTypes[R], Z, UnionOverrideKeys<SCLR, OVERRIDESCLR>>>;
  };

export const Chain = (...options: chainOptions) => Thunder(apiFetch(options));

export const SubscriptionThunder =
  <SCLR extends ScalarDefinition>(fn: SubscriptionFunction, thunderGraphQLOptions?: ThunderGraphQLOptions<SCLR>) =>
  <O extends keyof typeof Ops, OVERRIDESCLR extends SCLR, R extends keyof ValueTypes = GenericOperation<O>>(
    operation: O,
    graphqlOptions?: ThunderGraphQLOptions<OVERRIDESCLR>,
  ) =>
  <Z extends ValueTypes[R]>(
    o: Z & {
      [P in keyof Z]: P extends keyof ValueTypes[R] ? Z[P] : never;
    },
    ops?: OperationOptions & { variables?: ExtractVariables<Z> },
  ) => {
    const options = {
      ...thunderGraphQLOptions,
      ...graphqlOptions,
    };
    type CombinedSCLR = UnionOverrideKeys<SCLR, OVERRIDESCLR>;
    const returnedFunction = fn(
      Zeus(operation, o, {
        operationOptions: ops,
        scalars: options?.scalars,
      }),
    ) as SubscriptionToGraphQL<Z, GraphQLTypes[R], CombinedSCLR>;
    if (returnedFunction?.on && options?.scalars) {
      const wrapped = returnedFunction.on;
      returnedFunction.on = (fnToCall: (args: InputType<GraphQLTypes[R], Z, CombinedSCLR>) => void) =>
        wrapped((data: InputType<GraphQLTypes[R], Z, CombinedSCLR>) => {
          if (options?.scalars) {
            return fnToCall(
              decodeScalarsInResponse({
                response: data,
                initialOp: operation,
                initialZeusQuery: o as VType,
                returns: ReturnTypes,
                scalars: options.scalars,
                ops: Ops,
              }),
            );
          }
          return fnToCall(data);
        });
    }
    return returnedFunction;
  };

export const Subscription = (...options: chainOptions) => SubscriptionThunder(apiSubscription(options));
export const Zeus = <
  Z extends ValueTypes[R],
  O extends keyof typeof Ops,
  R extends keyof ValueTypes = GenericOperation<O>,
>(
  operation: O,
  o: Z,
  ops?: {
    operationOptions?: OperationOptions;
    scalars?: ScalarDefinition;
  },
) =>
  InternalsBuildQuery({
    props: AllTypesProps,
    returns: ReturnTypes,
    ops: Ops,
    options: ops?.operationOptions,
    scalars: ops?.scalars,
  })(operation, o as VType);

export const ZeusSelect = <T>() => ((t: unknown) => t) as SelectionFunction<T>;

export const Selector = <T extends keyof ValueTypes>(key: T) => key && ZeusSelect<ValueTypes[T]>();

export const TypeFromSelector = <T extends keyof ValueTypes>(key: T) => key && ZeusSelect<ValueTypes[T]>();
export const Gql = Chain(HOST, {
  headers: {
    'Content-Type': 'application/json',
    ...HEADERS,
  },
});

export const ZeusScalars = ZeusSelect<ScalarCoders>();

type BaseSymbol = number | string | undefined | boolean | null;

type ScalarsSelector<T> = {
  [X in Required<{
    [P in keyof T]: T[P] extends BaseSymbol | Array<BaseSymbol> ? P : never;
  }>[keyof T]]: true;
};

export const fields = <T extends keyof ModelTypes>(k: T) => {
  const t = ReturnTypes[k];
  const fnType = k in AllTypesProps ? AllTypesProps[k as keyof typeof AllTypesProps] : undefined;
  const hasFnTypes = typeof fnType === 'object' ? fnType : undefined;
  const o = Object.fromEntries(
    Object.entries(t)
      .filter(([k, value]) => {
        const isFunctionType = hasFnTypes && k in hasFnTypes && !!hasFnTypes[k as keyof typeof hasFnTypes];
        if (isFunctionType) return false;
        const isReturnType = ReturnTypes[value as string];
        if (!isReturnType) return true;
        if (typeof isReturnType !== 'string') return false;
        if (isReturnType.startsWith('scalar.')) {
          return true;
        }
        return false;
      })
      .map(([key]) => [key, true as const]),
  );
  return o as ScalarsSelector<ModelTypes[T]>;
};

export const decodeScalarsInResponse = <O extends Operations>({
  response,
  scalars,
  returns,
  ops,
  initialZeusQuery,
  initialOp,
}: {
  ops: O;
  response: any;
  returns: ReturnTypesType;
  scalars?: Record<string, ScalarResolver | undefined>;
  initialOp: keyof O;
  initialZeusQuery: InputValueType | VType;
}) => {
  if (!scalars) {
    return response;
  }
  const builder = PrepareScalarPaths({
    ops,
    returns,
  });

  const scalarPaths = builder(initialOp as string, ops[initialOp], initialZeusQuery);
  if (scalarPaths) {
    const r = traverseResponse({ scalarPaths, resolvers: scalars })(initialOp as string, response, [ops[initialOp]]);
    return r;
  }
  return response;
};

export const traverseResponse = ({
  resolvers,
  scalarPaths,
}: {
  scalarPaths: { [x: string]: `scalar.${string}` };
  resolvers: {
    [x: string]: ScalarResolver | undefined;
  };
}) => {
  const ibb = (k: string, o: InputValueType | VType, p: string[] = []): unknown => {
    if (Array.isArray(o)) {
      return o.map((eachO) => ibb(k, eachO, p));
    }
    if (o == null) {
      return o;
    }
    const scalarPathString = p.join(SEPARATOR);
    const currentScalarString = scalarPaths[scalarPathString];
    if (currentScalarString) {
      const currentDecoder = resolvers[currentScalarString.split('.')[1]]?.decode;
      if (currentDecoder) {
        return currentDecoder(o);
      }
    }
    if (typeof o === 'boolean' || typeof o === 'number' || typeof o === 'string' || !o) {
      return o;
    }
    const entries = Object.entries(o).map(([k, v]) => [k, ibb(k, v, [...p, purifyGraphQLKey(k)])] as const);
    const objectFromEntries = entries.reduce<Record<string, unknown>>((a, [k, v]) => {
      a[k] = v;
      return a;
    }, {});
    return objectFromEntries;
  };
  return ibb;
};

export type AllTypesPropsType = {
  [x: string]:
    | undefined
    | `scalar.${string}`
    | 'enum'
    | {
        [x: string]:
          | undefined
          | string
          | {
              [x: string]: string | undefined;
            };
      };
};

export type ReturnTypesType = {
  [x: string]:
    | {
        [x: string]: string | undefined;
      }
    | `scalar.${string}`
    | undefined;
};
export type InputValueType = {
  [x: string]: undefined | boolean | string | number | [any, undefined | boolean | InputValueType] | InputValueType;
};
export type VType =
  | undefined
  | boolean
  | string
  | number
  | [any, undefined | boolean | InputValueType]
  | InputValueType;

export type PlainType = boolean | number | string | null | undefined;
export type ZeusArgsType =
  | PlainType
  | {
      [x: string]: ZeusArgsType;
    }
  | Array<ZeusArgsType>;

export type Operations = Record<string, string>;

export type VariableDefinition = {
  [x: string]: unknown;
};

export const SEPARATOR = '|';

export type fetchOptions = Parameters<typeof fetch>;
type websocketOptions = typeof WebSocket extends new (...args: infer R) => WebSocket ? R : never;
export type chainOptions = [fetchOptions[0], fetchOptions[1] & { websocket?: websocketOptions }] | [fetchOptions[0]];
export type FetchFunction = (query: string, variables?: Record<string, unknown>) => Promise<any>;
export type SubscriptionFunction = (query: string) => any;
type NotUndefined<T> = T extends undefined ? never : T;
export type ResolverType<F> = NotUndefined<F extends [infer ARGS, any] ? ARGS : undefined>;

export type OperationOptions = {
  operationName?: string;
};

export type ScalarCoder = Record<string, (s: unknown) => string>;

export interface GraphQLResponse {
  data?: Record<string, any>;
  errors?: Array<{
    message: string;
  }>;
}
export class GraphQLError extends Error {
  constructor(public response: GraphQLResponse) {
    super('');
    console.error(response);
  }
  toString() {
    return 'GraphQL Response Error';
  }
}
export type GenericOperation<O> = O extends keyof typeof Ops ? typeof Ops[O] : never;
export type ThunderGraphQLOptions<SCLR extends ScalarDefinition> = {
  scalars?: SCLR | ScalarCoders;
};

const ExtractScalar = (mappedParts: string[], returns: ReturnTypesType): `scalar.${string}` | undefined => {
  if (mappedParts.length === 0) {
    return;
  }
  const oKey = mappedParts[0];
  const returnP1 = returns[oKey];
  if (typeof returnP1 === 'object') {
    const returnP2 = returnP1[mappedParts[1]];
    if (returnP2) {
      return ExtractScalar([returnP2, ...mappedParts.slice(2)], returns);
    }
    return undefined;
  }
  return returnP1 as `scalar.${string}` | undefined;
};

export const PrepareScalarPaths = ({ ops, returns }: { returns: ReturnTypesType; ops: Operations }) => {
  const ibb = (
    k: string,
    originalKey: string,
    o: InputValueType | VType,
    p: string[] = [],
    pOriginals: string[] = [],
    root = true,
  ): { [x: string]: `scalar.${string}` } | undefined => {
    if (!o) {
      return;
    }
    if (typeof o === 'boolean' || typeof o === 'number' || typeof o === 'string') {
      const extractionArray = [...pOriginals, originalKey];
      const isScalar = ExtractScalar(extractionArray, returns);
      if (isScalar?.startsWith('scalar')) {
        const partOfTree = {
          [[...p, k].join(SEPARATOR)]: isScalar,
        };
        return partOfTree;
      }
      return {};
    }
    if (Array.isArray(o)) {
      return ibb(k, k, o[1], p, pOriginals, false);
    }
    if (k === '__alias') {
      return Object.entries(o)
        .map(([alias, objectUnderAlias]) => {
          if (typeof objectUnderAlias !== 'object' || Array.isArray(objectUnderAlias)) {
            throw new Error(
              'Invalid alias it should be __alias:{ YOUR_ALIAS_NAME: { OPERATION_NAME: { ...selectors }}}',
            );
          }
          const operationName = Object.keys(objectUnderAlias)[0];
          const operation = objectUnderAlias[operationName];
          return ibb(alias, operationName, operation, p, pOriginals, false);
        })
        .reduce((a, b) => ({
          ...a,
          ...b,
        }));
    }
    const keyName = root ? ops[k] : k;
    return Object.entries(o)
      .filter(([k]) => k !== '__directives')
      .map(([k, v]) => {
        // Inline fragments shouldn't be added to the path as they aren't a field
        const isInlineFragment = originalKey.match(/^...\s*on/) != null;
        return ibb(
          k,
          k,
          v,
          isInlineFragment ? p : [...p, purifyGraphQLKey(keyName || k)],
          isInlineFragment ? pOriginals : [...pOriginals, purifyGraphQLKey(originalKey)],
          false,
        );
      })
      .reduce((a, b) => ({
        ...a,
        ...b,
      }));
  };
  return ibb;
};

export const purifyGraphQLKey = (k: string) => k.replace(/\([^)]*\)/g, '').replace(/^[^:]*\:/g, '');

const mapPart = (p: string) => {
  const [isArg, isField] = p.split('<>');
  if (isField) {
    return {
      v: isField,
      __type: 'field',
    } as const;
  }
  return {
    v: isArg,
    __type: 'arg',
  } as const;
};

type Part = ReturnType<typeof mapPart>;

export const ResolveFromPath = (props: AllTypesPropsType, returns: ReturnTypesType, ops: Operations) => {
  const ResolvePropsType = (mappedParts: Part[]) => {
    const oKey = ops[mappedParts[0].v];
    const propsP1 = oKey ? props[oKey] : props[mappedParts[0].v];
    if (propsP1 === 'enum' && mappedParts.length === 1) {
      return 'enum';
    }
    if (typeof propsP1 === 'string' && propsP1.startsWith('scalar.') && mappedParts.length === 1) {
      return propsP1;
    }
    if (typeof propsP1 === 'object') {
      if (mappedParts.length < 2) {
        return 'not';
      }
      const propsP2 = propsP1[mappedParts[1].v];
      if (typeof propsP2 === 'string') {
        return rpp(
          `${propsP2}${SEPARATOR}${mappedParts
            .slice(2)
            .map((mp) => mp.v)
            .join(SEPARATOR)}`,
        );
      }
      if (typeof propsP2 === 'object') {
        if (mappedParts.length < 3) {
          return 'not';
        }
        const propsP3 = propsP2[mappedParts[2].v];
        if (propsP3 && mappedParts[2].__type === 'arg') {
          return rpp(
            `${propsP3}${SEPARATOR}${mappedParts
              .slice(3)
              .map((mp) => mp.v)
              .join(SEPARATOR)}`,
          );
        }
      }
    }
  };
  const ResolveReturnType = (mappedParts: Part[]) => {
    if (mappedParts.length === 0) {
      return 'not';
    }
    const oKey = ops[mappedParts[0].v];
    const returnP1 = oKey ? returns[oKey] : returns[mappedParts[0].v];
    if (typeof returnP1 === 'object') {
      if (mappedParts.length < 2) return 'not';
      const returnP2 = returnP1[mappedParts[1].v];
      if (returnP2) {
        return rpp(
          `${returnP2}${SEPARATOR}${mappedParts
            .slice(2)
            .map((mp) => mp.v)
            .join(SEPARATOR)}`,
        );
      }
    }
  };
  const rpp = (path: string): 'enum' | 'not' | `scalar.${string}` => {
    const parts = path.split(SEPARATOR).filter((l) => l.length > 0);
    const mappedParts = parts.map(mapPart);
    const propsP1 = ResolvePropsType(mappedParts);
    if (propsP1) {
      return propsP1;
    }
    const returnP1 = ResolveReturnType(mappedParts);
    if (returnP1) {
      return returnP1;
    }
    return 'not';
  };
  return rpp;
};

export const InternalArgsBuilt = ({
  props,
  ops,
  returns,
  scalars,
  vars,
}: {
  props: AllTypesPropsType;
  returns: ReturnTypesType;
  ops: Operations;
  scalars?: ScalarDefinition;
  vars: Array<{ name: string; graphQLType: string }>;
}) => {
  const arb = (a: ZeusArgsType, p = '', root = true): string => {
    if (typeof a === 'string') {
      if (a.startsWith(START_VAR_NAME)) {
        const [varName, graphQLType] = a.replace(START_VAR_NAME, '$').split(GRAPHQL_TYPE_SEPARATOR);
        const v = vars.find((v) => v.name === varName);
        if (!v) {
          vars.push({
            name: varName,
            graphQLType,
          });
        } else {
          if (v.graphQLType !== graphQLType) {
            throw new Error(
              `Invalid variable exists with two different GraphQL Types, "${v.graphQLType}" and ${graphQLType}`,
            );
          }
        }
        return varName;
      }
    }
    const checkType = ResolveFromPath(props, returns, ops)(p);
    if (checkType.startsWith('scalar.')) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [_, ...splittedScalar] = checkType.split('.');
      const scalarKey = splittedScalar.join('.');
      return (scalars?.[scalarKey]?.encode?.(a) as string) || JSON.stringify(a);
    }
    if (Array.isArray(a)) {
      return `[${a.map((arr) => arb(arr, p, false)).join(', ')}]`;
    }
    if (typeof a === 'string') {
      if (checkType === 'enum') {
        return a;
      }
      return `${JSON.stringify(a)}`;
    }
    if (typeof a === 'object') {
      if (a === null) {
        return `null`;
      }
      const returnedObjectString = Object.entries(a)
        .filter(([, v]) => typeof v !== 'undefined')
        .map(([k, v]) => `${k}: ${arb(v, [p, k].join(SEPARATOR), false)}`)
        .join(',\n');
      if (!root) {
        return `{${returnedObjectString}}`;
      }
      return returnedObjectString;
    }
    return `${a}`;
  };
  return arb;
};

export const resolverFor = <X, T extends keyof ResolverInputTypes, Z extends keyof ResolverInputTypes[T]>(
  type: T,
  field: Z,
  fn: (
    args: Required<ResolverInputTypes[T]>[Z] extends [infer Input, any] ? Input : any,
    source: any,
  ) => Z extends keyof ModelTypes[T] ? ModelTypes[T][Z] | Promise<ModelTypes[T][Z]> | X : never,
) => fn as (args?: any, source?: any) => ReturnType<typeof fn>;

export type UnwrapPromise<T> = T extends Promise<infer R> ? R : T;
export type ZeusState<T extends (...args: any[]) => Promise<any>> = NonNullable<UnwrapPromise<ReturnType<T>>>;
export type ZeusHook<
  T extends (...args: any[]) => Record<string, (...args: any[]) => Promise<any>>,
  N extends keyof ReturnType<T>,
> = ZeusState<ReturnType<T>[N]>;

export type WithTypeNameValue<T> = T & {
  __typename?: boolean;
  __directives?: string;
};
export type AliasType<T> = WithTypeNameValue<T> & {
  __alias?: Record<string, WithTypeNameValue<T>>;
};
type DeepAnify<T> = {
  [P in keyof T]?: any;
};
type IsPayLoad<T> = T extends [any, infer PayLoad] ? PayLoad : T;
export type ScalarDefinition = Record<string, ScalarResolver>;

type IsScalar<S, SCLR extends ScalarDefinition> = S extends 'scalar' & { name: infer T }
  ? T extends keyof SCLR
    ? SCLR[T]['decode'] extends (s: unknown) => unknown
      ? ReturnType<SCLR[T]['decode']>
      : unknown
    : unknown
  : S;
type IsArray<T, U, SCLR extends ScalarDefinition> = T extends Array<infer R>
  ? InputType<R, U, SCLR>[]
  : InputType<T, U, SCLR>;
type FlattenArray<T> = T extends Array<infer R> ? R : T;
type BaseZeusResolver = boolean | 1 | string | Variable<any, string>;

type IsInterfaced<SRC extends DeepAnify<DST>, DST, SCLR extends ScalarDefinition> = FlattenArray<SRC> extends
  | ZEUS_INTERFACES
  | ZEUS_UNIONS
  ? {
      [P in keyof SRC]: SRC[P] extends '__union' & infer R
        ? P extends keyof DST
          ? IsArray<R, '__typename' extends keyof DST ? DST[P] & { __typename: true } : DST[P], SCLR>
          : IsArray<R, '__typename' extends keyof DST ? { __typename: true } : Record<string, never>, SCLR>
        : never;
    }[keyof SRC] & {
      [P in keyof Omit<
        Pick<
          SRC,
          {
            [P in keyof DST]: SRC[P] extends '__union' & infer R ? never : P;
          }[keyof DST]
        >,
        '__typename'
      >]: IsPayLoad<DST[P]> extends BaseZeusResolver ? IsScalar<SRC[P], SCLR> : IsArray<SRC[P], DST[P], SCLR>;
    }
  : {
      [P in keyof Pick<SRC, keyof DST>]: IsPayLoad<DST[P]> extends BaseZeusResolver
        ? IsScalar<SRC[P], SCLR>
        : IsArray<SRC[P], DST[P], SCLR>;
    };

export type MapType<SRC, DST, SCLR extends ScalarDefinition> = SRC extends DeepAnify<DST>
  ? IsInterfaced<SRC, DST, SCLR>
  : never;
// eslint-disable-next-line @typescript-eslint/ban-types
export type InputType<SRC, DST, SCLR extends ScalarDefinition = {}> = IsPayLoad<DST> extends { __alias: infer R }
  ? {
      [P in keyof R]: MapType<SRC, R[P], SCLR>[keyof MapType<SRC, R[P], SCLR>];
    } & MapType<SRC, Omit<IsPayLoad<DST>, '__alias'>, SCLR>
  : MapType<SRC, IsPayLoad<DST>, SCLR>;
export type SubscriptionToGraphQL<Z, T, SCLR extends ScalarDefinition> = {
  ws: WebSocket;
  on: (fn: (args: InputType<T, Z, SCLR>) => void) => void;
  off: (fn: (e: { data?: InputType<T, Z, SCLR>; code?: number; reason?: string; message?: string }) => void) => void;
  error: (fn: (e: { data?: InputType<T, Z, SCLR>; errors?: string[] }) => void) => void;
  open: () => void;
};

// eslint-disable-next-line @typescript-eslint/ban-types
export type FromSelector<SELECTOR, NAME extends keyof GraphQLTypes, SCLR extends ScalarDefinition = {}> = InputType<
  GraphQLTypes[NAME],
  SELECTOR,
  SCLR
>;

export type ScalarResolver = {
  encode?: (s: unknown) => string;
  decode?: (s: unknown) => unknown;
};

export type SelectionFunction<V> = <Z extends V>(
  t: Z & {
    [P in keyof Z]: P extends keyof V ? Z[P] : never;
  },
) => Z;

type BuiltInVariableTypes = {
  ['String']: string;
  ['Int']: number;
  ['Float']: number;
  ['ID']: unknown;
  ['Boolean']: boolean;
};
type AllVariableTypes = keyof BuiltInVariableTypes | keyof ZEUS_VARIABLES;
type VariableRequired<T extends string> = `${T}!` | T | `[${T}]` | `[${T}]!` | `[${T}!]` | `[${T}!]!`;
type VR<T extends string> = VariableRequired<VariableRequired<T>>;

export type GraphQLVariableType = VR<AllVariableTypes>;

type ExtractVariableTypeString<T extends string> = T extends VR<infer R1>
  ? R1 extends VR<infer R2>
    ? R2 extends VR<infer R3>
      ? R3 extends VR<infer R4>
        ? R4 extends VR<infer R5>
          ? R5
          : R4
        : R3
      : R2
    : R1
  : T;

type DecomposeType<T, Type> = T extends `[${infer R}]`
  ? Array<DecomposeType<R, Type>> | undefined
  : T extends `${infer R}!`
  ? NonNullable<DecomposeType<R, Type>>
  : Type | undefined;

type ExtractTypeFromGraphQLType<T extends string> = T extends keyof ZEUS_VARIABLES
  ? ZEUS_VARIABLES[T]
  : T extends keyof BuiltInVariableTypes
  ? BuiltInVariableTypes[T]
  : any;

export type GetVariableType<T extends string> = DecomposeType<
  T,
  ExtractTypeFromGraphQLType<ExtractVariableTypeString<T>>
>;

type UndefinedKeys<T> = {
  [K in keyof T]-?: T[K] extends NonNullable<T[K]> ? never : K;
}[keyof T];

type WithNullableKeys<T> = Pick<T, UndefinedKeys<T>>;
type WithNonNullableKeys<T> = Omit<T, UndefinedKeys<T>>;

type OptionalKeys<T> = {
  [P in keyof T]?: T[P];
};

export type WithOptionalNullables<T> = OptionalKeys<WithNullableKeys<T>> & WithNonNullableKeys<T>;

export type Variable<T extends GraphQLVariableType, Name extends string> = {
  ' __zeus_name': Name;
  ' __zeus_type': T;
};

export type ExtractVariablesDeep<Query> = Query extends Variable<infer VType, infer VName>
  ? { [key in VName]: GetVariableType<VType> }
  : Query extends string | number | boolean | Array<string | number | boolean>
  ? // eslint-disable-next-line @typescript-eslint/ban-types
    {}
  : UnionToIntersection<{ [K in keyof Query]: WithOptionalNullables<ExtractVariablesDeep<Query[K]>> }[keyof Query]>;

export type ExtractVariables<Query> = Query extends Variable<infer VType, infer VName>
  ? { [key in VName]: GetVariableType<VType> }
  : Query extends [infer Inputs, infer Outputs]
  ? ExtractVariablesDeep<Inputs> & ExtractVariables<Outputs>
  : Query extends string | number | boolean | Array<string | number | boolean>
  ? // eslint-disable-next-line @typescript-eslint/ban-types
    {}
  : UnionToIntersection<{ [K in keyof Query]: WithOptionalNullables<ExtractVariables<Query[K]>> }[keyof Query]>;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

export const START_VAR_NAME = `$ZEUS_VAR`;
export const GRAPHQL_TYPE_SEPARATOR = `__$GRAPHQL__`;

export const $ = <Type extends GraphQLVariableType, Name extends string>(name: Name, graphqlType: Type) => {
  return (START_VAR_NAME + name + GRAPHQL_TYPE_SEPARATOR + graphqlType) as unknown as Variable<Type, Name>;
};
type ZEUS_INTERFACES = never
export type ScalarCoders = {
	DateTime?: ScalarResolver;
	JSON?: ScalarResolver;
	JSONObject?: ScalarResolver;
}
type ZEUS_UNIONS = GraphQLTypes["PaymentMethodData"] | GraphQLTypes["PrivateAccountSearchData"] | GraphQLTypes["UserCertificateUnion"]

export type ValueTypes = {
    ["AcceptChildOrderInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** Подписанное заявление на имущественный паевый взнос */
	document: ValueTypes["AssetContributionStatementSignedDocumentInput"] | Variable<any, string>,
	/** Идентификатор заявки */
	exchange_id: string | Variable<any, string>,
	/** Имя аккаунта пользователя */
	username: string | Variable<any, string>
};
	["Account"]: AliasType<{
	/** объект аккаунта в блокчейне содержит системную информацию, такую как публичные ключи доступа, доступные вычислительные ресурсы, информация об установленном смарт-контракте, и т.д. и т.п. Это системный уровень обслуживания, где у каждого пайщика есть аккаунт, но не каждый аккаунт может быть пайщиком в каком-либо кооперативе. Все смарт-контракты устанавливаются и исполняются на этом уровне. */
	blockchain_account?:ValueTypes["BlockchainAccount"],
	/** объект пайщика кооператива в таблице блокчейне, который определяет членство пайщика в конкретном кооперативе. Поскольку MONO обслуживает только один кооператив, то в participant_account обычно содержится информация, которая описывает членство пайщика в этом кооперативе. Этот объект обезличен, публичен, и хранится в блокчейне. */
	participant_account?:ValueTypes["ParticipantAccount"],
	/** объект приватных данных пайщика кооператива. */
	private_account?:ValueTypes["PrivateAccount"],
	/** объект аккаунта в системе учёта провайдера, т.е. MONO. Здесь хранится приватная информация о пайщике кооператива, которая содержит его приватные данные. Эти данные не публикуются в блокчейне и не выходят за пределы базы данных провайдера. Они используются для заполнения шаблонов документов при нажатии соответствующих кнопок на платформе.  */
	provider_account?:ValueTypes["MonoAccount"],
	/** объект пользователя кооперативной экономики содержит в блокчейне информацию о типе аккаунта пайщика, а также, обезличенные публичные данные (хэши) для верификации пайщиков между кооперативами. Этот уровень предназначен для хранения информации пайщика, которая необходима всем кооперативам, но не относится к какому-либо из них конкретно. */
	user_account?:ValueTypes["UserAccount"],
	/** Имя аккаунта кооператива */
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["AccountRamDelta"]: AliasType<{
	account?:boolean | `@${string}`,
	delta?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["AccountResourceInfo"]: AliasType<{
	/** Доступные ресурсы */
	available?:boolean | `@${string}`,
	/** Текущее использование ресурсов */
	current_used?:boolean | `@${string}`,
	/** Время последнего обновления использования ресурсов */
	last_usage_update_time?:boolean | `@${string}`,
	/** Максимальное количество ресурсов */
	max?:boolean | `@${string}`,
	/** Использовано ресурсов */
	used?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Тип аккаунта пользователя в системе */
["AccountType"]:AccountType;
	["AccountsPaginationResult"]: AliasType<{
	/** Текущая страница */
	currentPage?:boolean | `@${string}`,
	/** Элементы текущей страницы */
	items?:ValueTypes["Account"],
	/** Общее количество элементов */
	totalCount?:boolean | `@${string}`,
	/** Общее количество страниц */
	totalPages?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Комплексный объект акта, содержащий полную информацию о сгенерированном и опубликованном документе с его агрегатом */
["ActDetailAggregate"]: AliasType<{
	action?:ValueTypes["ExtendedBlockchainAction"],
	documentAggregate?:ValueTypes["DocumentAggregate"],
		__typename?: boolean | `@${string}`
}>;
	["ActionAuthorization"]: AliasType<{
	actor?:boolean | `@${string}`,
	permission?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ActionReceipt"]: AliasType<{
	abi_sequence?:boolean | `@${string}`,
	act_digest?:boolean | `@${string}`,
	auth_sequence?:ValueTypes["AuthSequence"],
	code_sequence?:boolean | `@${string}`,
	global_sequence?:boolean | `@${string}`,
	receiver?:boolean | `@${string}`,
	recv_sequence?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["AddParticipantInput"]: {
	/** Дата создания аккаунта в строковом формате даты EOSIO по UTC (2024-12-28T06:58:52.500) */
	created_at: string | Variable<any, string>,
	/** Электронная почта */
	email: string | Variable<any, string>,
	/** Данные индивидуального предпринимателя */
	entrepreneur_data?: ValueTypes["CreateEntrepreneurDataInput"] | undefined | null | Variable<any, string>,
	/** Данные физического лица */
	individual_data?: ValueTypes["CreateIndividualDataInput"] | undefined | null | Variable<any, string>,
	/** Вступительный взнос, который был внесён пайщиком */
	initial: string | Variable<any, string>,
	/** Минимальный паевый взнос, который был внесён пайщиком */
	minimum: string | Variable<any, string>,
	/** Данные организации */
	organization_data?: ValueTypes["CreateOrganizationDataInput"] | undefined | null | Variable<any, string>,
	/** Имя аккаунта реферера */
	referer?: string | undefined | null | Variable<any, string>,
	/** Флаг распределения вступительного взноса в невозвратный фонд вступительных взносов кооператива */
	spread_initial: boolean | Variable<any, string>,
	/** Тип аккаунта */
	type: ValueTypes["AccountType"] | Variable<any, string>
};
	["AddTrustedAccountInput"]: {
	/** Имя аккаунта кооперативного участка */
	braname: string | Variable<any, string>,
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** Имя аккаунта доверонного лица, который уполномачивается председателем кооперативного участка на совершение действий */
	trusted: string | Variable<any, string>
};
	/** Пункт повестки общего собрания (для ввода) */
["AgendaGeneralMeetPointInput"]: {
	/** Контекст или дополнительная информация по пункту повестки */
	context: string | Variable<any, string>,
	/** Предлагаемое решение по пункту повестки */
	decision: string | Variable<any, string>,
	/** Заголовок пункта повестки */
	title: string | Variable<any, string>
};
	/** Вопрос повестки общего собрания */
["AgendaGeneralMeetQuestion"]: {
	/** Контекст или дополнительная информация по вопросу */
	context?: string | undefined | null | Variable<any, string>,
	/** Предлагаемое решение по вопросу повестки */
	decision: string | Variable<any, string>,
	/** Номер вопроса в повестке */
	number: string | Variable<any, string>,
	/** Заголовок вопроса повестки */
	title: string | Variable<any, string>
};
	/** Данные собрания для повестки */
["AgendaMeet"]: {
	/** Дата и время окончания собрания */
	close_at_datetime: string | Variable<any, string>,
	/** Дата и время начала собрания */
	open_at_datetime: string | Variable<any, string>,
	/** Тип собрания (очередное или внеочередное) */
	type: string | Variable<any, string>
};
	/** Пункт повестки собрания */
["AgendaMeetPoint"]: AliasType<{
	/** Контекст или дополнительная информация по пункту повестки */
	context?:boolean | `@${string}`,
	/** Предлагаемое решение по пункту повестки */
	decision?:boolean | `@${string}`,
	/** Заголовок пункта повестки */
	title?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["AgendaWithDocuments"]: AliasType<{
	/** Действие, которое привело к появлению вопроса на голосовании */
	action?:ValueTypes["BlockchainAction"],
	/** Пакет документов, включающий разные подсекции */
	documents?:ValueTypes["DocumentPackageAggregate"],
	/** Запись в таблице блокчейна о вопросе на голосовании */
	table?:ValueTypes["BlockchainDecision"],
		__typename?: boolean | `@${string}`
}>;
	["AgreementInput"]: {
	protocol_day_month_year: string | Variable<any, string>,
	protocol_number: string | Variable<any, string>
};
	["AgreementVar"]: AliasType<{
	protocol_day_month_year?:boolean | `@${string}`,
	protocol_number?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["AnnualGeneralMeetingAgendaGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at?: string | undefined | null | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null | Variable<any, string>,
	/** Флаг повторного собрания */
	is_repeated: boolean | Variable<any, string>,
	/** Язык документа */
	lang?: string | undefined | null | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null | Variable<any, string>,
	meet: ValueTypes["AgendaMeet"] | Variable<any, string>,
	questions: Array<ValueTypes["AgendaGeneralMeetQuestion"]> | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null | Variable<any, string>,
	/** Название документа */
	title?: string | undefined | null | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null | Variable<any, string>
};
	["AnnualGeneralMeetingAgendaSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string | Variable<any, string>,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string | Variable<any, string>,
	/** Метаинформация для создания протокола решения */
	meta: ValueTypes["AnnualGeneralMeetingAgendaSignedMetaDocumentInput"] | Variable<any, string>,
	/** Хэш мета-данных */
	meta_hash: string | Variable<any, string>,
	/** Вектор подписей */
	signatures: Array<ValueTypes["SignatureInfoInput"]> | Variable<any, string>,
	/** Версия стандарта документа */
	version: string | Variable<any, string>
};
	["AnnualGeneralMeetingAgendaSignedMetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at: string | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator: string | Variable<any, string>,
	/** Флаг повторного собрания */
	is_repeated: boolean | Variable<any, string>,
	/** Язык документа */
	lang: string | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links: Array<string> | Variable<any, string>,
	meet: ValueTypes["AgendaMeet"] | Variable<any, string>,
	questions: Array<ValueTypes["AgendaGeneralMeetQuestion"]> | Variable<any, string>,
	/** ID документа в реестре */
	registry_id: number | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone: string | Variable<any, string>,
	/** Название документа */
	title: string | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version: string | Variable<any, string>
};
	["AnnualGeneralMeetingDecisionGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at?: string | undefined | null | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null | Variable<any, string>,
	/** Язык документа */
	lang?: string | undefined | null | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null | Variable<any, string>,
	/** Хеш собрания */
	meet_hash: string | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null | Variable<any, string>,
	/** Название документа */
	title?: string | undefined | null | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null | Variable<any, string>
};
	["AnnualGeneralMeetingDecisionSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string | Variable<any, string>,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string | Variable<any, string>,
	/** Метаинформация */
	meta: ValueTypes["AnnualGeneralMeetingDecisionSignedMetaDocumentInput"] | Variable<any, string>,
	/** Хэш мета-данных */
	meta_hash: string | Variable<any, string>,
	/** Вектор подписей */
	signatures: Array<ValueTypes["SignatureInfoInput"]> | Variable<any, string>,
	/** Версия стандарта документа */
	version: string | Variable<any, string>
};
	["AnnualGeneralMeetingDecisionSignedMetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at: string | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator: string | Variable<any, string>,
	/** Язык документа */
	lang: string | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links: Array<string> | Variable<any, string>,
	/** Хеш собрания */
	meet_hash: string | Variable<any, string>,
	/** ID документа в реестре */
	registry_id: number | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone: string | Variable<any, string>,
	/** Название документа */
	title: string | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version: string | Variable<any, string>
};
	["AnnualGeneralMeetingNotificationGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at?: string | undefined | null | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null | Variable<any, string>,
	/** Язык документа */
	lang?: string | undefined | null | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null | Variable<any, string>,
	/** Хеш собрания */
	meet_hash: string | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null | Variable<any, string>,
	/** Название документа */
	title?: string | undefined | null | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null | Variable<any, string>
};
	["AnnualGeneralMeetingNotificationSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string | Variable<any, string>,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string | Variable<any, string>,
	/** Метаинформация */
	meta: ValueTypes["AnnualGeneralMeetingNotificationSignedMetaDocumentInput"] | Variable<any, string>,
	/** Хэш мета-данных */
	meta_hash: string | Variable<any, string>,
	/** Вектор подписей */
	signatures: Array<ValueTypes["SignatureInfoInput"]> | Variable<any, string>,
	/** Версия стандарта документа */
	version: string | Variable<any, string>
};
	["AnnualGeneralMeetingNotificationSignedMetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at: string | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator: string | Variable<any, string>,
	/** Язык документа */
	lang: string | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links: Array<string> | Variable<any, string>,
	/** Хеш собрания */
	meet_hash: string | Variable<any, string>,
	/** ID документа в реестре */
	registry_id: number | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone: string | Variable<any, string>,
	/** Название документа */
	title: string | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version: string | Variable<any, string>
};
	["AnnualGeneralMeetingSovietDecisionGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at?: string | undefined | null | Variable<any, string>,
	/** ID решения совета */
	decision_id: number | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null | Variable<any, string>,
	/** Флаг повторного собрания */
	is_repeated: boolean | Variable<any, string>,
	/** Язык документа */
	lang?: string | undefined | null | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null | Variable<any, string>,
	/** Хеш собрания */
	meet_hash: string | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null | Variable<any, string>,
	/** Название документа */
	title?: string | undefined | null | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null | Variable<any, string>
};
	["AnnualGeneralMeetingVotingBallotGenerateDocumentInput"]: {
	/** Ответы голосования */
	answers: Array<ValueTypes["AnswerInput"]> | Variable<any, string>,
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at?: string | undefined | null | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null | Variable<any, string>,
	/** Язык документа */
	lang?: string | undefined | null | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null | Variable<any, string>,
	/** Хеш собрания */
	meet_hash: string | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null | Variable<any, string>,
	/** Название документа */
	title?: string | undefined | null | Variable<any, string>,
	/** Имя пользователя голосующего */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null | Variable<any, string>
};
	["AnnualGeneralMeetingVotingBallotSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string | Variable<any, string>,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string | Variable<any, string>,
	/** Метаинформация для создания протокола решения */
	meta: ValueTypes["AnnualGeneralMeetingVotingBallotSignedMetaDocumentInput"] | Variable<any, string>,
	/** Хэш мета-данных */
	meta_hash: string | Variable<any, string>,
	/** Вектор подписей */
	signatures: Array<ValueTypes["SignatureInfoInput"]> | Variable<any, string>,
	/** Версия стандарта документа */
	version: string | Variable<any, string>
};
	["AnnualGeneralMeetingVotingBallotSignedMetaDocumentInput"]: {
	/** Ответы голосования */
	answers: Array<ValueTypes["AnswerInput"]> | Variable<any, string>,
	/** Номер блока, на котором был создан документ */
	block_num: number | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at: string | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator: string | Variable<any, string>,
	/** Язык документа */
	lang: string | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links: Array<string> | Variable<any, string>,
	/** Хеш собрания */
	meet_hash: string | Variable<any, string>,
	/** ID документа в реестре */
	registry_id: number | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone: string | Variable<any, string>,
	/** Название документа */
	title: string | Variable<any, string>,
	/** Имя пользователя голосующего */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version: string | Variable<any, string>
};
	["AnswerInput"]: {
	/** ID вопроса */
	id: string | Variable<any, string>,
	/** Номер вопроса */
	number: string | Variable<any, string>,
	/** Голос (за/против/воздержался) */
	vote: string | Variable<any, string>
};
	["AssetContributionActGenerateDocumentInput"]: {
	/** Идентификатор акта */
	act_id: string | Variable<any, string>,
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null | Variable<any, string>,
	/** Имя аккаунта кооперативного участка */
	braname?: string | undefined | null | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at?: string | undefined | null | Variable<any, string>,
	/** Идентификатор решения */
	decision_id: number | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null | Variable<any, string>,
	/** Язык документа */
	lang?: string | undefined | null | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null | Variable<any, string>,
	/** Имя аккаунта получателя на кооперативном участке */
	receiver: string | Variable<any, string>,
	/** Идентификатор заявки */
	request_id: number | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null | Variable<any, string>,
	/** Название документа */
	title?: string | undefined | null | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null | Variable<any, string>
};
	["AssetContributionActSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string | Variable<any, string>,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string | Variable<any, string>,
	/** Метаинформация для создания проекта свободного решения */
	meta: ValueTypes["AssetContributionActSignedMetaDocumentInput"] | Variable<any, string>,
	/** Хэш мета-данных */
	meta_hash: string | Variable<any, string>,
	/** Вектор подписей */
	signatures: Array<ValueTypes["SignatureInfoInput"]> | Variable<any, string>,
	/** Версия стандарта документа */
	version: string | Variable<any, string>
};
	["AssetContributionActSignedMetaDocumentInput"]: {
	/** Идентификатор акта */
	act_id: string | Variable<any, string>,
	/** Номер блока, на котором был создан документ */
	block_num: number | Variable<any, string>,
	/** Имя аккаунта кооперативного участка */
	braname?: string | undefined | null | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at: string | Variable<any, string>,
	/** Идентификатор решения */
	decision_id: number | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator: string | Variable<any, string>,
	/** Язык документа */
	lang: string | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links: Array<string> | Variable<any, string>,
	/** Имя аккаунта получателя на кооперативном участке */
	receiver: string | Variable<any, string>,
	/** ID документа в реестре */
	registry_id: number | Variable<any, string>,
	/** Идентификатор заявки */
	request_id: number | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone: string | Variable<any, string>,
	/** Название документа */
	title: string | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version: string | Variable<any, string>
};
	["AssetContributionDecisionGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at?: string | undefined | null | Variable<any, string>,
	/** Идентификатор решения */
	decision_id: number | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null | Variable<any, string>,
	/** Язык документа */
	lang?: string | undefined | null | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null | Variable<any, string>,
	/** Идентификатор заявки */
	request_id: number | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null | Variable<any, string>,
	/** Название документа */
	title?: string | undefined | null | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null | Variable<any, string>
};
	["AssetContributionStatementGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at?: string | undefined | null | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null | Variable<any, string>,
	/** Язык документа */
	lang?: string | undefined | null | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null | Variable<any, string>,
	/** Запрос на внесение имущественного паевого взноса */
	request: ValueTypes["CommonRequestInput"] | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null | Variable<any, string>,
	/** Название документа */
	title?: string | undefined | null | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null | Variable<any, string>
};
	["AssetContributionStatementSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string | Variable<any, string>,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string | Variable<any, string>,
	/** Метаинформация для создания проекта свободного решения */
	meta: ValueTypes["AssetContributionStatementSignedMetaDocumentInput"] | Variable<any, string>,
	/** Хэш мета-данных */
	meta_hash: string | Variable<any, string>,
	/** Вектор подписей */
	signatures: Array<ValueTypes["SignatureInfoInput"]> | Variable<any, string>,
	/** Версия стандарта документа */
	version: string | Variable<any, string>
};
	["AssetContributionStatementSignedMetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at: string | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator: string | Variable<any, string>,
	/** Язык документа */
	lang: string | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links: Array<string> | Variable<any, string>,
	/** ID документа в реестре */
	registry_id: number | Variable<any, string>,
	/** Запрос на внесение имущественного паевого взноса */
	request: ValueTypes["CommonRequestInput"] | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone: string | Variable<any, string>,
	/** Название документа */
	title: string | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version: string | Variable<any, string>
};
	["AuthSequence"]: AliasType<{
	account?:boolean | `@${string}`,
	sequence?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["Authority"]: AliasType<{
	/** Уровни разрешений */
	accounts?:ValueTypes["PermissionLevelWeight"],
	/** Ключи */
	keys?:ValueTypes["KeyWeight"],
	/** Порог */
	threshold?:boolean | `@${string}`,
	/** Вес ожидания */
	waits?:ValueTypes["WaitWeight"],
		__typename?: boolean | `@${string}`
}>;
	["BankAccount"]: AliasType<{
	/** Номер банковского счета */
	account_number?:boolean | `@${string}`,
	/** Название банка */
	bank_name?:boolean | `@${string}`,
	/** Номер карты */
	card_number?:boolean | `@${string}`,
	/** Валюта счета */
	currency?:boolean | `@${string}`,
	/** Детали счета */
	details?:ValueTypes["BankAccountDetails"],
		__typename?: boolean | `@${string}`
}>;
	["BankAccountDetails"]: AliasType<{
	/** БИК банка */
	bik?:boolean | `@${string}`,
	/** Корреспондентский счет */
	corr?:boolean | `@${string}`,
	/** КПП банка */
	kpp?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["BankAccountDetailsInput"]: {
	/** БИК банка */
	bik: string | Variable<any, string>,
	/** Корреспондентский счет */
	corr: string | Variable<any, string>,
	/** КПП банка */
	kpp: string | Variable<any, string>
};
	["BankAccountInput"]: {
	/** Номер банковского счета */
	account_number: string | Variable<any, string>,
	/** Название банка */
	bank_name: string | Variable<any, string>,
	/** Номер карты */
	card_number?: string | undefined | null | Variable<any, string>,
	/** Валюта счета */
	currency: string | Variable<any, string>,
	/** Детали счета */
	details: ValueTypes["BankAccountDetailsInput"] | Variable<any, string>
};
	["BankPaymentMethod"]: AliasType<{
	/** Дата создания */
	created_at?:boolean | `@${string}`,
	/** Данные метода оплаты */
	data?:ValueTypes["BankAccount"],
	/** Флаг основного метода платежа, который отображается в документах */
	is_default?:boolean | `@${string}`,
	/** Идентификатор метода оплаты */
	method_id?:boolean | `@${string}`,
	/** Тип метода оплаты */
	method_type?:boolean | `@${string}`,
	/** Дата обновления */
	updated_at?:boolean | `@${string}`,
	/** Имя пользователя, к которому привязан метод оплаты */
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["BlockchainAccount"]: AliasType<{
	/** Имя аккаунта */
	account_name?:boolean | `@${string}`,
	/** Баланс */
	core_liquid_balance?:boolean | `@${string}`,
	/** Ограничения CPU */
	cpu_limit?:ValueTypes["AccountResourceInfo"],
	/** Вес CPU */
	cpu_weight?:boolean | `@${string}`,
	/** Дата создания */
	created?:boolean | `@${string}`,
	/** Номер последнего блока */
	head_block_num?:boolean | `@${string}`,
	/** Время последнего блока */
	head_block_time?:boolean | `@${string}`,
	/** Время последнего обновления кода */
	last_code_update?:boolean | `@${string}`,
	/** Ограничения сети */
	net_limit?:ValueTypes["AccountResourceInfo"],
	/** Вес сети */
	net_weight?:boolean | `@${string}`,
	/** Разрешения */
	permissions?:ValueTypes["Permission"],
	/** Флаг привилегий */
	privileged?:boolean | `@${string}`,
	/** Квота RAM */
	ram_quota?:boolean | `@${string}`,
	/** Использование RAM */
	ram_usage?:boolean | `@${string}`,
	/** Запрос на возврат */
	refund_request?:ValueTypes["RefundRequest"],
	/** Информация о REX */
	rex_info?:boolean | `@${string}`,
	/** Делегированные ресурсы */
	self_delegated_bandwidth?:ValueTypes["ResourceDelegationDTO"],
	/** Общий обзор ресурсов */
	total_resources?:ValueTypes["ResourceOverview"],
	/** Информация о голосовании */
	voter_info?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Объект действия в блокчейне */
["BlockchainAction"]: AliasType<{
	account?:boolean | `@${string}`,
	account_ram_deltas?:ValueTypes["AccountRamDelta"],
	action_ordinal?:boolean | `@${string}`,
	authorization?:ValueTypes["ActionAuthorization"],
	block_id?:boolean | `@${string}`,
	block_num?:boolean | `@${string}`,
	chain_id?:boolean | `@${string}`,
	console?:boolean | `@${string}`,
	context_free?:boolean | `@${string}`,
	creator_action_ordinal?:boolean | `@${string}`,
	/** Данные действия в формате JSON */
	data?:boolean | `@${string}`,
	elapsed?:boolean | `@${string}`,
	global_sequence?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	receipt?:ValueTypes["ActionReceipt"],
	receiver?:boolean | `@${string}`,
	transaction_id?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Запись в таблице блокчейна о процессе принятия решения советом кооператива */
["BlockchainDecision"]: AliasType<{
	approved?:boolean | `@${string}`,
	authorization?:ValueTypes["SignedBlockchainDocument"],
	authorized?:boolean | `@${string}`,
	authorized_by?:boolean | `@${string}`,
	batch_id?:boolean | `@${string}`,
	callback_contract?:boolean | `@${string}`,
	confirm_callback?:boolean | `@${string}`,
	coopname?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	decline_callback?:boolean | `@${string}`,
	expired_at?:boolean | `@${string}`,
	hash?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	meta?:boolean | `@${string}`,
	statement?:ValueTypes["SignedBlockchainDocument"],
	type?:boolean | `@${string}`,
	username?:boolean | `@${string}`,
	/** Сертификат пользователя, создавшего решение */
	username_certificate?:ValueTypes["UserCertificateUnion"],
	validated?:boolean | `@${string}`,
	votes_against?:boolean | `@${string}`,
	/** Сертификаты пользователей, голосовавших "против" */
	votes_against_certificates?:ValueTypes["UserCertificateUnion"],
	votes_for?:boolean | `@${string}`,
	/** Сертификаты пользователей, голосовавших "за" */
	votes_for_certificates?:ValueTypes["UserCertificateUnion"],
		__typename?: boolean | `@${string}`
}>;
	/** Информация о состоянии блокчейна */
["BlockchainInfoDTO"]: AliasType<{
	/** Лимит CPU для блока */
	block_cpu_limit?:boolean | `@${string}`,
	/** Лимит сети для блока */
	block_net_limit?:boolean | `@${string}`,
	/** Идентификатор цепочки (chain ID) */
	chain_id?:boolean | `@${string}`,
	/** Идентификатор головного блока в форк базе данных */
	fork_db_head_block_id?:boolean | `@${string}`,
	/** Номер головного блока в форк базе данных */
	fork_db_head_block_num?:boolean | `@${string}`,
	/** Идентификатор головного блока */
	head_block_id?:boolean | `@${string}`,
	/** Номер головного блока */
	head_block_num?:boolean | `@${string}`,
	/** Прозводитель головного блока */
	head_block_producer?:boolean | `@${string}`,
	/** Время головного блока */
	head_block_time?:boolean | `@${string}`,
	/** Идентификатор последнего необратимого блока */
	last_irreversible_block_id?:boolean | `@${string}`,
	/** Номер последнего необратимого блока */
	last_irreversible_block_num?:boolean | `@${string}`,
	/** Время последнего необратимого блока */
	last_irreversible_block_time?:boolean | `@${string}`,
	/** Версия сервера */
	server_version?:boolean | `@${string}`,
	/** Строковое представление версии сервера */
	server_version_string?:boolean | `@${string}`,
	/** Виртуальный лимит CPU для блока */
	virtual_block_cpu_limit?:boolean | `@${string}`,
	/** Виртуальный лимит сети для блока */
	virtual_block_net_limit?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["Branch"]: AliasType<{
	/** Банковский счёт */
	bank_account?:ValueTypes["BankPaymentMethod"],
	/** Уникальное имя кооперативного участка */
	braname?:boolean | `@${string}`,
	/** Город */
	city?:boolean | `@${string}`,
	/** Имя аккаунта кооператива */
	coopname?:boolean | `@${string}`,
	/** Страна */
	country?:boolean | `@${string}`,
	/** Детали организации */
	details?:ValueTypes["OrganizationDetails"],
	/** Email */
	email?:boolean | `@${string}`,
	/** Фактический адрес */
	fact_address?:boolean | `@${string}`,
	/** Полный адрес */
	full_address?:boolean | `@${string}`,
	/** Полное название организации */
	full_name?:boolean | `@${string}`,
	/** Телефон */
	phone?:boolean | `@${string}`,
	/** Представитель организации */
	represented_by?:ValueTypes["RepresentedBy"],
	/** Краткое название организации */
	short_name?:boolean | `@${string}`,
	/** Доверенные аккаунты */
	trusted?:ValueTypes["Individual"],
	/** Председатель кооперативного участка */
	trustee?:ValueTypes["Individual"],
	/** Тип организации */
	type?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["CancelRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** Идентификатор заявки */
	exchange_id: string | Variable<any, string>,
	/** Имя аккаунта пользователя */
	username: string | Variable<any, string>
};
	["CommonRequestInput"]: {
	currency: string | Variable<any, string>,
	hash: string | Variable<any, string>,
	program_id: number | Variable<any, string>,
	title: string | Variable<any, string>,
	total_cost: string | Variable<any, string>,
	type: string | Variable<any, string>,
	unit_cost: string | Variable<any, string>,
	unit_of_measurement: string | Variable<any, string>,
	units: number | Variable<any, string>
};
	["CompleteRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** Идентификатор обмена */
	exchange_id: string | Variable<any, string>,
	/** Имя аккаунта пользователя */
	username: string | Variable<any, string>
};
	/** Подтвердить получение имущества Уполномоченным лицом от Заказчика по новации и акту приёмки-передачи */
["ConfirmReceiveOnRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** Подписанный акт приёмки-передачи имущества Уполномоченным лицом из Кооператива при возврате Заказчику по новации */
	document: ValueTypes["ReturnByAssetActSignedDocumentInput"] | Variable<any, string>,
	/** Идентификатор обмена */
	exchange_id: string | Variable<any, string>,
	/** Имя аккаунта пользователя */
	username: string | Variable<any, string>
};
	/** Подтвердить поставку имущества Поставщиком по заявке Заказчика и акту приёма-передачи */
["ConfirmSupplyOnRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** Подписанный акт приёма-передачи имущества от Поставщика в Кооператив */
	document: ValueTypes["AssetContributionActSignedDocumentInput"] | Variable<any, string>,
	/** Идентификатор обмена */
	exchange_id: string | Variable<any, string>,
	/** Имя аккаунта пользователя */
	username: string | Variable<any, string>
};
	["ContactsDTO"]: AliasType<{
	chairman?:ValueTypes["PublicChairman"],
	details?:ValueTypes["OrganizationDetails"],
	email?:boolean | `@${string}`,
	full_address?:boolean | `@${string}`,
	full_name?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["CooperativeOperatorAccount"]: AliasType<{
	/** Количество активных участников */
	active_participants_count?:boolean | `@${string}`,
	/** Объявление кооператива */
	announce?:boolean | `@${string}`,
	/** Тип кооператива */
	coop_type?:boolean | `@${string}`,
	/** Дата создания */
	created_at?:boolean | `@${string}`,
	/** Описание кооператива */
	description?:boolean | `@${string}`,
	/** Документ кооператива */
	document?:ValueTypes["SignedBlockchainDocument"],
	/** Начальный взнос */
	initial?:boolean | `@${string}`,
	/** Разветвленный ли кооператив */
	is_branched?:boolean | `@${string}`,
	/** Является ли это кооперативом */
	is_cooperative?:boolean | `@${string}`,
	/** Включен ли кооператив */
	is_enrolled?:boolean | `@${string}`,
	/** Метаинформация */
	meta?:boolean | `@${string}`,
	/** Минимальный взнос */
	minimum?:boolean | `@${string}`,
	/** Начальный взнос организации */
	org_initial?:boolean | `@${string}`,
	/** Минимальный взнос организации */
	org_minimum?:boolean | `@${string}`,
	/** Регистрационный взнос организации */
	org_registration?:boolean | `@${string}`,
	/** Родительское имя аккаунта кооператива */
	parent_username?:boolean | `@${string}`,
	/** Реферал кооператива */
	referer?:boolean | `@${string}`,
	/** Дата регистрации */
	registered_at?:boolean | `@${string}`,
	/** Регистрационный взнос */
	registration?:boolean | `@${string}`,
	/** Регистратор кооператива */
	registrator?:boolean | `@${string}`,
	/** Статус кооператива */
	status?:boolean | `@${string}`,
	/** Список хранилищ */
	storages?:boolean | `@${string}`,
	/** Тип учетной записи */
	type?:boolean | `@${string}`,
	/** Имя аккаунта кооператива */
	username?:boolean | `@${string}`,
	/** Дата регистрации */
	verifications?:ValueTypes["Verification"],
		__typename?: boolean | `@${string}`
}>;
	/** Страна регистрации пользователя */
["Country"]:Country;
	["CreateAnnualGeneralMeetInput"]: {
	/** Повестка собрания */
	agenda: Array<ValueTypes["AgendaGeneralMeetPointInput"]> | Variable<any, string>,
	/** Время закрытия собрания */
	close_at: ValueTypes["DateTime"] | Variable<any, string>,
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** Имя аккаунта инициатора */
	initiator: string | Variable<any, string>,
	/** Время открытия собрания */
	open_at: ValueTypes["DateTime"] | Variable<any, string>,
	/** Имя аккаунта председателя */
	presider: string | Variable<any, string>,
	/** Предложение повестки собрания */
	proposal: ValueTypes["AnnualGeneralMeetingAgendaSignedDocumentInput"] | Variable<any, string>,
	/** Имя аккаунта секретаря */
	secretary: string | Variable<any, string>
};
	["CreateBankAccountInput"]: {
	/** Данные для банковского перевода */
	data: ValueTypes["BankAccountInput"] | Variable<any, string>,
	/** Флаг основного метода платежа, который отображается в документах */
	is_default: boolean | Variable<any, string>,
	/** Имя аккаунта пользователя */
	username: string | Variable<any, string>
};
	["CreateBranchInput"]: {
	/** Документ, на основании которого действует Уполномоченный (решение совета №СС-.. от ..) */
	based_on: string | Variable<any, string>,
	/** Имя аккаунта кооперативного участка */
	braname: string | Variable<any, string>,
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** Электронная почта */
	email: string | Variable<any, string>,
	/** Фактический адрес */
	fact_address: string | Variable<any, string>,
	/** Полное имя организации кооперативного участка */
	full_name: string | Variable<any, string>,
	/** Телефон */
	phone: string | Variable<any, string>,
	/** Краткое имя организации кооперативного участка */
	short_name: string | Variable<any, string>,
	/** Имя аккаунта уполномоченного (председателя) кооперативного участка */
	trustee: string | Variable<any, string>
};
	["CreateChildOrderInput"]: {
	/** Имя кооператива */
	coopname: string | Variable<any, string>,
	/** Дополнительные данные, специфичные для заявки */
	data: string | Variable<any, string>,
	/** Подписанное заявление на возврат паевого взноса имуществом от Заказчика */
	document: ValueTypes["ReturnByAssetStatementSignedDocumentInput"] | Variable<any, string>,
	/** Метаданные о заявке */
	meta: string | Variable<any, string>,
	/** Идентификатор родительской заявки */
	parent_id: number | Variable<any, string>,
	/** Время жизни продукта, заявляемое поставщиком (в секундах) */
	product_lifecycle_secs: number | Variable<any, string>,
	/** Идентификатор программы */
	program_id: number | Variable<any, string>,
	/** Цена за единицу (штуку) товара или результата услуги в формате "10.0000 RUB" */
	unit_cost: string | Variable<any, string>,
	/** Количество частей (штук) товара или услуги */
	units: number | Variable<any, string>,
	/** Имя пользователя, инициирующего или обновляющего заявку */
	username: string | Variable<any, string>
};
	["CreateDepositPaymentInput"]: {
	/** Сумма взноса */
	quantity: number | Variable<any, string>,
	/** Символ валюты */
	symbol: string | Variable<any, string>,
	/** Имя аккаунта пользователя */
	username: string | Variable<any, string>
};
	["CreateEntrepreneurDataInput"]: {
	/** Банковский счет */
	bank_account: ValueTypes["BankAccountInput"] | Variable<any, string>,
	/** Дата рождения */
	birthdate: string | Variable<any, string>,
	/** Город */
	city: string | Variable<any, string>,
	/** Страна */
	country: ValueTypes["Country"] | Variable<any, string>,
	/** Детали индивидуального предпринимателя */
	details: ValueTypes["EntrepreneurDetailsInput"] | Variable<any, string>,
	/** Имя */
	first_name: string | Variable<any, string>,
	/** Полный адрес */
	full_address: string | Variable<any, string>,
	/** Фамилия */
	last_name: string | Variable<any, string>,
	/** Отчество */
	middle_name: string | Variable<any, string>,
	/** Телефон */
	phone: string | Variable<any, string>
};
	["CreateIndividualDataInput"]: {
	/** Дата рождения */
	birthdate: string | Variable<any, string>,
	/** Имя */
	first_name: string | Variable<any, string>,
	/** Полный адрес */
	full_address: string | Variable<any, string>,
	/** Фамилия */
	last_name: string | Variable<any, string>,
	/** Отчество */
	middle_name: string | Variable<any, string>,
	/** Данные паспорта */
	passport?: ValueTypes["PassportInput"] | undefined | null | Variable<any, string>,
	/** Телефон */
	phone: string | Variable<any, string>
};
	["CreateInitialPaymentInput"]: {
	/** Имя аккаунта пользователя */
	username: string | Variable<any, string>
};
	["CreateOrganizationDataInput"]: {
	/** Банковский счет организации */
	bank_account: ValueTypes["BankAccountInput"] | Variable<any, string>,
	/** Город */
	city: string | Variable<any, string>,
	/** Страна */
	country: string | Variable<any, string>,
	/** Детали организации */
	details: ValueTypes["OrganizationDetailsInput"] | Variable<any, string>,
	/** Фактический адрес */
	fact_address: string | Variable<any, string>,
	/** Полный адрес */
	full_address: string | Variable<any, string>,
	/** Полное наименование организации */
	full_name: string | Variable<any, string>,
	/** Телефон */
	phone: string | Variable<any, string>,
	/** Представитель организации */
	represented_by: ValueTypes["RepresentedByInput"] | Variable<any, string>,
	/** Краткое наименование организации */
	short_name: string | Variable<any, string>,
	/** Тип организации */
	type: ValueTypes["OrganizationType"] | Variable<any, string>
};
	["CreateParentOfferInput"]: {
	/** Имя кооператива */
	coopname: string | Variable<any, string>,
	/** Дополнительные данные, специфичные для заявки */
	data: string | Variable<any, string>,
	/** Метаданные о заявке */
	meta: string | Variable<any, string>,
	/** Идентификатор родительской заявки */
	parent_id: number | Variable<any, string>,
	/** Время жизни продукта, заявляемое поставщиком (в секундах) */
	product_lifecycle_secs: number | Variable<any, string>,
	/** Идентификатор программы */
	program_id: number | Variable<any, string>,
	/** Цена за единицу (штуку) товара или услуги в формате "10.0000 RUB" */
	unit_cost: string | Variable<any, string>,
	/** Количество частей (штук) товара или услуги */
	units: number | Variable<any, string>,
	/** Имя пользователя, инициирующего или обновляющего заявку */
	username: string | Variable<any, string>
};
	["CreateProjectFreeDecisionInput"]: {
	/** Проект решения, которое предлагается принять */
	decision: string | Variable<any, string>,
	/** Вопрос, который выносится на повестку */
	question: string | Variable<any, string>
};
	["CreateWithdrawInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** ID метода платежа */
	method_id: string | Variable<any, string>,
	/** Хеш платежа для связи с withdraw */
	payment_hash: string | Variable<any, string>,
	/** Количество средств */
	quantity: number | Variable<any, string>,
	/** Подписанное заявление на возврат средств */
	statement: ValueTypes["ReturnByMoneySignedDocumentInput"] | Variable<any, string>,
	/** Символ валюты */
	symbol: string | Variable<any, string>,
	/** Имя пользователя */
	username: string | Variable<any, string>
};
	["CreateWithdrawResponse"]: AliasType<{
	/** Хеш созданной заявки на вывод */
	withdraw_hash?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["CreatedProjectFreeDecision"]: AliasType<{
	/** Проект решения, которое предлагается принять */
	decision?:boolean | `@${string}`,
	/** Идентификатор проекта свободного решения */
	id?:boolean | `@${string}`,
	/** Вопрос, который выносится на повестку */
	question?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format. */
["DateTime"]:unknown;
	/** Комплексный объект решения совета, включающий в себя информацию о голосовавших членах совета, расширенное действие, которое привело к появлению решения, и агрегат документа самого решения. */
["DecisionDetailAggregate"]: AliasType<{
	action?:ValueTypes["ExtendedBlockchainAction"],
	documentAggregate?:ValueTypes["DocumentAggregate"],
	votes_against?:ValueTypes["ExtendedBlockchainAction"],
	votes_for?:ValueTypes["ExtendedBlockchainAction"],
		__typename?: boolean | `@${string}`
}>;
	["DeclineRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** Идентификатор обмена */
	exchange_id: number | Variable<any, string>,
	/** Причина отказа */
	meta: string | Variable<any, string>,
	/** Имя аккаунта пользователя */
	username: string | Variable<any, string>
};
	["DeleteBranchInput"]: {
	/** Имя аккаунта кооперативного участка */
	braname: string | Variable<any, string>,
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>
};
	["DeletePaymentMethodInput"]: {
	/** Идентификатор метода оплаты */
	method_id: string | Variable<any, string>,
	/** Имя пользователя, чей метод оплаты нужно удалить */
	username: string | Variable<any, string>
};
	["DeleteTrustedAccountInput"]: {
	/** Имя аккаунта кооперативного участка */
	braname: string | Variable<any, string>,
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** Имя аккаунта доверонного лица, у которого отзывается право подписи за председателя кооперативного участка */
	trusted: string | Variable<any, string>
};
	["DeliverOnRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** Идентификатор обмена */
	exchange_id: number | Variable<any, string>,
	/** Имя аккаунта пользователя */
	username: string | Variable<any, string>
};
	["Desktop"]: AliasType<{
	/** Имя шаблона рабочих столов */
	authorizedHome?:boolean | `@${string}`,
	/** Имя аккаунта кооператива */
	coopname?:boolean | `@${string}`,
	/** Имя шаблона рабочих столов */
	layout?:boolean | `@${string}`,
	/** Имя шаблона рабочих столов */
	nonAuthorizedHome?:boolean | `@${string}`,
	/** Состав приложений рабочего стола */
	workspaces?:ValueTypes["DesktopWorkspace"],
		__typename?: boolean | `@${string}`
}>;
	["DesktopWorkspace"]: AliasType<{
	/** Имя приложения */
	name?:boolean | `@${string}`,
	/** Отображаемое название приложения */
	title?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["DisputeOnRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** Документ с аргументами спора */
	document: ValueTypes["JSONObject"] | Variable<any, string>,
	/** Идентификатор обмена */
	exchange_id: number | Variable<any, string>,
	/** Имя аккаунта пользователя */
	username: string | Variable<any, string>
};
	["DocumentAggregate"]: AliasType<{
	document?:ValueTypes["SignedDigitalDocument"],
	hash?:boolean | `@${string}`,
	rawDocument?:ValueTypes["GeneratedDocument"],
		__typename?: boolean | `@${string}`
}>;
	/** Комплексный объект папки цифрового документа с агрегатами, который включает в себя заявление, решение, акты и связанные документы */
["DocumentPackageAggregate"]: AliasType<{
	/** Массив объект(ов) актов с агрегатами, относящихся к заявлению */
	acts?:ValueTypes["ActDetailAggregate"],
	/** Объект цифрового документа решения с агрегатом */
	decision?:ValueTypes["DecisionDetailAggregate"],
	/** Массив связанных документов с агрегатами, извлечённых из мета-данных */
	links?:ValueTypes["DocumentAggregate"],
	/** Объект цифрового документа заявления с агрегатом */
	statement?:ValueTypes["StatementDetailAggregate"],
		__typename?: boolean | `@${string}`
}>;
	["DocumentsAggregatePaginationResult"]: AliasType<{
	/** Текущая страница */
	currentPage?:boolean | `@${string}`,
	/** Элементы текущей страницы */
	items?:ValueTypes["DocumentPackageAggregate"],
	/** Общее количество элементов */
	totalCount?:boolean | `@${string}`,
	/** Общее количество страниц */
	totalPages?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["EditBranchInput"]: {
	/** Документ, на основании которого действует Уполномоченный (решение совета №СС-.. от ..) */
	based_on: string | Variable<any, string>,
	/** Имя аккаунта кооперативного участка */
	braname: string | Variable<any, string>,
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** Электронная почта */
	email: string | Variable<any, string>,
	/** Фактический адрес */
	fact_address: string | Variable<any, string>,
	/** Полное имя организации кооперативного участка */
	full_name: string | Variable<any, string>,
	/** Телефон */
	phone: string | Variable<any, string>,
	/** Краткое имя организации кооперативного участка */
	short_name: string | Variable<any, string>,
	/** Имя аккаунта уполномоченного (председателя) кооперативного участка */
	trustee: string | Variable<any, string>
};
	["Entrepreneur"]: AliasType<{
	/** Дата рождения */
	birthdate?:boolean | `@${string}`,
	/** Город */
	city?:boolean | `@${string}`,
	/** Страна */
	country?:boolean | `@${string}`,
	/** Детали ИП (ИНН, ОГРН) */
	details?:ValueTypes["EntrepreneurDetails"],
	/** Email */
	email?:boolean | `@${string}`,
	/** Имя */
	first_name?:boolean | `@${string}`,
	/** Юридический адрес */
	full_address?:boolean | `@${string}`,
	/** Фамилия */
	last_name?:boolean | `@${string}`,
	/** Отчество */
	middle_name?:boolean | `@${string}`,
	/** Телефон */
	phone?:boolean | `@${string}`,
	/** Имя аккаунта */
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["EntrepreneurCertificate"]: AliasType<{
	/** Имя */
	first_name?:boolean | `@${string}`,
	/** ИНН */
	inn?:boolean | `@${string}`,
	/** Фамилия */
	last_name?:boolean | `@${string}`,
	/** Отчество */
	middle_name?:boolean | `@${string}`,
	/** Тип аккаунта */
	type?:boolean | `@${string}`,
	/** Имя аккаунта */
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["EntrepreneurDetails"]: AliasType<{
	/** ИНН */
	inn?:boolean | `@${string}`,
	/** ОГРН */
	ogrn?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["EntrepreneurDetailsInput"]: {
	/** ИНН */
	inn: string | Variable<any, string>,
	/** ОГРН */
	ogrn: string | Variable<any, string>
};
	/** Расширенное действие блокчейна с сертификатом пользователя, совершившего его. */
["ExtendedBlockchainAction"]: AliasType<{
	account?:boolean | `@${string}`,
	account_ram_deltas?:ValueTypes["AccountRamDelta"],
	action_ordinal?:boolean | `@${string}`,
	/** Сертификат пользователя (сокращенная информация) */
	actor_certificate?:ValueTypes["UserCertificateUnion"],
	authorization?:ValueTypes["ActionAuthorization"],
	block_id?:boolean | `@${string}`,
	block_num?:boolean | `@${string}`,
	chain_id?:boolean | `@${string}`,
	console?:boolean | `@${string}`,
	context_free?:boolean | `@${string}`,
	creator_action_ordinal?:boolean | `@${string}`,
	/** Данные действия в формате JSON */
	data?:boolean | `@${string}`,
	elapsed?:boolean | `@${string}`,
	global_sequence?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	receipt?:ValueTypes["ActionReceipt"],
	receiver?:boolean | `@${string}`,
	transaction_id?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Расширенный статус собрания на основе дат и состояния */
["ExtendedMeetStatus"]:ExtendedMeetStatus;
	["Extension"]: AliasType<{
	/** Настройки конфигурации для расширения */
	config?:boolean | `@${string}`,
	/** Дата создания расширения */
	created_at?:boolean | `@${string}`,
	/** Описание расширения */
	description?:boolean | `@${string}`,
	/** Показывает, включено ли расширение */
	enabled?:boolean | `@${string}`,
	/** Внешняя ссылка на iframe-интерфейс расширения */
	external_url?:boolean | `@${string}`,
	/** Изображение для расширения */
	image?:boolean | `@${string}`,
	/** Поле инструкция для установки (INSTALL) */
	instructions?:boolean | `@${string}`,
	/** Показывает, доступно ли расширение */
	is_available?:boolean | `@${string}`,
	/** Показывает, встроенное ли это расширение */
	is_builtin?:boolean | `@${string}`,
	/** Показывает, рабочий стол ли это */
	is_desktop?:boolean | `@${string}`,
	/** Показывает, установлено ли расширение */
	is_installed?:boolean | `@${string}`,
	/** Показывает, внутреннее ли это расширение */
	is_internal?:boolean | `@${string}`,
	/** Уникальное имя расширения */
	name?:boolean | `@${string}`,
	/** Поле подробного текстового описания (README) */
	readme?:boolean | `@${string}`,
	/** Схема настроек конфигурации для расширения */
	schema?:boolean | `@${string}`,
	/** Массив тегов для расширения */
	tags?:boolean | `@${string}`,
	/** Заголовок расширения */
	title?:boolean | `@${string}`,
	/** Дата последнего обновления расширения */
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ExtensionInput"]: {
	/** Объект конфигурации расширения */
	config: ValueTypes["JSON"] | Variable<any, string>,
	/** Дата установки расширения */
	created_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** Флаг того, включено ли расширение сейчас */
	enabled: boolean | Variable<any, string>,
	/** Уникальное имя расширения (является идентификатором) */
	name: string | Variable<any, string>,
	/** Дата обновления расширения */
	updated_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>
};
	["FreeDecisionGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at?: string | undefined | null | Variable<any, string>,
	/** Идентификатор протокола решения собрания совета */
	decision_id: number | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null | Variable<any, string>,
	/** Язык документа */
	lang?: string | undefined | null | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null | Variable<any, string>,
	/** Идентификатор проекта решения */
	project_id: string | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null | Variable<any, string>,
	/** Название документа */
	title?: string | undefined | null | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null | Variable<any, string>
};
	["GatewayPayment"]: AliasType<{
	/** Данные из блокчейна */
	blockchain_data?:boolean | `@${string}`,
	/** Можно ли изменить статус */
	can_change_status?:boolean | `@${string}`,
	/** Название кооператива */
	coopname?:boolean | `@${string}`,
	/** Дата создания */
	created_at?:boolean | `@${string}`,
	/** Направление платежа */
	direction?:boolean | `@${string}`,
	/** Человекочитаемое направление платежа */
	direction_label?:boolean | `@${string}`,
	/** Дата истечения */
	expired_at?:boolean | `@${string}`,
	/** Форматированная сумма */
	formatted_amount?:boolean | `@${string}`,
	/** Хеш платежа */
	hash?:boolean | `@${string}`,
	/** Уникальный идентификатор платежа */
	id?:boolean | `@${string}`,
	/** Хеш входящего платежа (устарело) */
	income_hash?:boolean | `@${string}`,
	/** Завершен ли платеж окончательно */
	is_final?:boolean | `@${string}`,
	/** Дополнительная информация */
	memo?:boolean | `@${string}`,
	/** Сообщение */
	message?:boolean | `@${string}`,
	/** Хеш исходящего платежа (устарело) */
	outcome_hash?:boolean | `@${string}`,
	/** Детали платежа */
	payment_details?:ValueTypes["PaymentDetails"],
	/** ID платежного метода */
	payment_method_id?:boolean | `@${string}`,
	/** Провайдер платежа */
	provider?:boolean | `@${string}`,
	/** Количество/сумма */
	quantity?:boolean | `@${string}`,
	/** Подписанный документ заявления */
	statement?:boolean | `@${string}`,
	/** Статус платежа */
	status?:boolean | `@${string}`,
	/** Человекочитаемый статус */
	status_label?:boolean | `@${string}`,
	/** Символ валюты */
	symbol?:boolean | `@${string}`,
	/** Тип платежа */
	type?:boolean | `@${string}`,
	/** Человекочитаемый тип платежа */
	type_label?:boolean | `@${string}`,
	/** Дата обновления */
	updated_at?:boolean | `@${string}`,
	/** Имя пользователя */
	username?:boolean | `@${string}`,
	/** Сертификат пользователя, создавшего платеж */
	username_certificate?:ValueTypes["UserCertificateUnion"],
		__typename?: boolean | `@${string}`
}>;
	["GenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at?: string | undefined | null | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null | Variable<any, string>,
	/** Язык документа */
	lang?: string | undefined | null | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null | Variable<any, string>,
	/** Название документа */
	title?: string | undefined | null | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null | Variable<any, string>
};
	["GenerateDocumentOptionsInput"]: {
	/** Язык документа */
	lang?: string | undefined | null | Variable<any, string>,
	/** Пропустить сохранение */
	skip_save?: boolean | undefined | null | Variable<any, string>
};
	["GeneratedDocument"]: AliasType<{
	/** Бинарное содержимое документа (base64) */
	binary?:boolean | `@${string}`,
	/** Полное название документа */
	full_title?:boolean | `@${string}`,
	/** Хэш документа */
	hash?:boolean | `@${string}`,
	/** HTML содержимое документа */
	html?:boolean | `@${string}`,
	/** Метаданные документа */
	meta?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["GetAccountInput"]: {
	/** Имя аккаунта пользователя */
	username: string | Variable<any, string>
};
	["GetAccountsInput"]: {
	role?: string | undefined | null | Variable<any, string>
};
	["GetBranchesInput"]: {
	/** Фильтр по имени аккаунта кооперативного участка */
	braname?: string | undefined | null | Variable<any, string>,
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>
};
	["GetDocumentsInput"]: {
	filter: ValueTypes["JSON"] | Variable<any, string>,
	limit?: number | undefined | null | Variable<any, string>,
	page?: number | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	username: string | Variable<any, string>
};
	["GetExtensionsInput"]: {
	/** Фильтр включенных расширений */
	enabled?: boolean | undefined | null | Variable<any, string>,
	/** Фильтр активности */
	is_available?: boolean | undefined | null | Variable<any, string>,
	/** Фильтр рабочих столов */
	is_desktop?: boolean | undefined | null | Variable<any, string>,
	/** Фильтр установленных расширений */
	is_installed?: boolean | undefined | null | Variable<any, string>,
	/** Фильтр по имени */
	name?: string | undefined | null | Variable<any, string>
};
	["GetMeetInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** Хеш собрания */
	hash: string | Variable<any, string>
};
	["GetMeetsInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>
};
	["GetPaymentMethodsInput"]: {
	/** Количество элементов на странице */
	limit: number | Variable<any, string>,
	/** Номер страницы */
	page: number | Variable<any, string>,
	/** Ключ сортировки (например, "name") */
	sortBy?: string | undefined | null | Variable<any, string>,
	/** Направление сортировки ("ASC" или "DESC") */
	sortOrder: string | Variable<any, string>,
	/** Имя пользователя для фильтрации методов оплаты */
	username?: string | undefined | null | Variable<any, string>
};
	["Individual"]: AliasType<{
	/** Дата рождения */
	birthdate?:boolean | `@${string}`,
	/** Email */
	email?:boolean | `@${string}`,
	/** Имя */
	first_name?:boolean | `@${string}`,
	/** Полный адрес */
	full_address?:boolean | `@${string}`,
	/** Фамилия */
	last_name?:boolean | `@${string}`,
	/** Отчество */
	middle_name?:boolean | `@${string}`,
	/** Данные паспорта */
	passport?:ValueTypes["Passport"],
	/** Телефон */
	phone?:boolean | `@${string}`,
	/** Имя аккаунта */
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["IndividualCertificate"]: AliasType<{
	/** Имя */
	first_name?:boolean | `@${string}`,
	/** Фамилия */
	last_name?:boolean | `@${string}`,
	/** Отчество */
	middle_name?:boolean | `@${string}`,
	/** Тип аккаунта */
	type?:boolean | `@${string}`,
	/** Имя аккаунта */
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["Init"]: {
	/** Объект организации кооператива, которая обслуживает данный экземпляр программного обеспечения MONO */
	organization_data: ValueTypes["CreateOrganizationDataInput"] | Variable<any, string>,
	/** Переменные кооператива, используемые для заполнения шаблонов документов */
	vars: ValueTypes["VarsInput"] | Variable<any, string>
};
	["Install"]: {
	soviet: Array<ValueTypes["SovietMemberInput"]> | Variable<any, string>,
	wif: string | Variable<any, string>
};
	/** The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
["JSON"]:unknown;
	/** The `JSONObject` scalar type represents JSON objects as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
["JSONObject"]:unknown;
	["KeyWeight"]: AliasType<{
	/** Ключ */
	key?:boolean | `@${string}`,
	/** Вес */
	weight?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["LoginInput"]: {
	/** Электронная почта */
	email: string | Variable<any, string>,
	/** Метка времени в строковом формате ISO */
	now: string | Variable<any, string>,
	/** Цифровая подпись метки времени */
	signature: string | Variable<any, string>
};
	["LogoutInput"]: {
	/** Токен обновления */
	access_token: string | Variable<any, string>,
	/** Токен доступа */
	refresh_token: string | Variable<any, string>
};
	/** Данные о собрании кооператива */
["Meet"]: AliasType<{
	/** Документ с решением совета о проведении собрания */
	authorization?:ValueTypes["DocumentAggregate"],
	/** Дата закрытия собрания */
	close_at?:boolean | `@${string}`,
	/** Имя аккаунта кооператива */
	coopname?:boolean | `@${string}`,
	/** Дата создания собрания */
	created_at?:boolean | `@${string}`,
	/** Текущий процент кворума */
	current_quorum_percent?:boolean | `@${string}`,
	/** Цикл собрания */
	cycle?:boolean | `@${string}`,
	/** Документ с решением секретаря */
	decision1?:ValueTypes["DocumentAggregate"],
	/** Документ с решением председателя */
	decision2?:ValueTypes["DocumentAggregate"],
	/** Хеш собрания */
	hash?:boolean | `@${string}`,
	/** Уникальный идентификатор собрания */
	id?:boolean | `@${string}`,
	/** Инициатор собрания */
	initiator?:boolean | `@${string}`,
	/** Сертификат инициатора собрания */
	initiator_certificate?:ValueTypes["UserCertificateUnion"],
	/** Уровень собрания */
	level?:boolean | `@${string}`,
	/** Список пользователей, которые подписали уведомление */
	notified_users?:boolean | `@${string}`,
	/** Дата открытия собрания */
	open_at?:boolean | `@${string}`,
	/** Председатель собрания */
	presider?:boolean | `@${string}`,
	/** Сертификат председателя собрания */
	presider_certificate?:ValueTypes["UserCertificateUnion"],
	/** Документ с повесткой собрания */
	proposal?:ValueTypes["DocumentAggregate"],
	/** Флаг достижения кворума */
	quorum_passed?:boolean | `@${string}`,
	/** Процент необходимого кворума */
	quorum_percent?:boolean | `@${string}`,
	/** Секретарь собрания */
	secretary?:boolean | `@${string}`,
	/** Сертификат секретаря собрания */
	secretary_certificate?:ValueTypes["UserCertificateUnion"],
	/** Количество подписанных бюллетеней */
	signed_ballots?:boolean | `@${string}`,
	/** Статус собрания */
	status?:boolean | `@${string}`,
	/** Тип собрания */
	type?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Агрегат данных о собрании, содержащий информацию о разных этапах */
["MeetAggregate"]: AliasType<{
	/** Хеш собрания */
	hash?:boolean | `@${string}`,
	/** Данные собрания на этапе предварительной обработки */
	pre?:ValueTypes["MeetPreProcessing"],
	/** Данные собрания после обработки */
	processed?:ValueTypes["MeetProcessed"],
	/** Данные собрания на этапе обработки */
	processing?:ValueTypes["MeetProcessing"],
		__typename?: boolean | `@${string}`
}>;
	/** Предварительные данные собрания перед обработкой */
["MeetPreProcessing"]: AliasType<{
	/** Повестка собрания */
	agenda?:ValueTypes["AgendaMeetPoint"],
	/** Дата закрытия собрания */
	close_at?:boolean | `@${string}`,
	/** Имя аккаунта кооператива */
	coopname?:boolean | `@${string}`,
	/** Хеш собрания */
	hash?:boolean | `@${string}`,
	/** Инициатор собрания */
	initiator?:boolean | `@${string}`,
	/** Сертификат инициатора собрания */
	initiator_certificate?:ValueTypes["UserCertificateUnion"],
	/** Дата открытия собрания */
	open_at?:boolean | `@${string}`,
	/** Председатель собрания */
	presider?:boolean | `@${string}`,
	/** Сертификат председателя собрания */
	presider_certificate?:ValueTypes["UserCertificateUnion"],
	/** Документ с предложением повестки собрания */
	proposal?:ValueTypes["DocumentAggregate"],
	/** Секретарь собрания */
	secretary?:boolean | `@${string}`,
	/** Сертификат секретаря собрания */
	secretary_certificate?:ValueTypes["UserCertificateUnion"],
		__typename?: boolean | `@${string}`
}>;
	/** Данные о собрании после обработки */
["MeetProcessed"]: AliasType<{
	/** Имя кооператива */
	coopname?:boolean | `@${string}`,
	/** Документ решения из блокчейна */
	decision?:ValueTypes["SignedDigitalDocument"],
	/** Агрегат документа решения */
	decisionAggregate?:ValueTypes["DocumentAggregate"],
	/** Хеш собрания */
	hash?:boolean | `@${string}`,
	/** Председатель собрания */
	presider?:boolean | `@${string}`,
	/** Сертификат председателя собрания */
	presider_certificate?:ValueTypes["UserCertificateUnion"],
	/** Пройден ли кворум */
	quorum_passed?:boolean | `@${string}`,
	/** Процент кворума */
	quorum_percent?:boolean | `@${string}`,
	/** Результаты голосования по вопросам */
	results?:ValueTypes["MeetQuestionResult"],
	/** Секретарь собрания */
	secretary?:boolean | `@${string}`,
	/** Сертификат секретаря собрания */
	secretary_certificate?:ValueTypes["UserCertificateUnion"],
	/** Количество подписанных бюллетеней */
	signed_ballots?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Данные о собрании в процессе обработки */
["MeetProcessing"]: AliasType<{
	/** Расширенный статус собрания на основе дат и состояния */
	extendedStatus?:boolean | `@${string}`,
	/** Хеш собрания */
	hash?:boolean | `@${string}`,
	/** Флаг указывающий, голосовал ли текущий пользователь */
	isVoted?:boolean | `@${string}`,
	/** Основная информация о собрании */
	meet?:ValueTypes["Meet"],
	/** Список вопросов повестки собрания */
	questions?:ValueTypes["Question"],
		__typename?: boolean | `@${string}`
}>;
	/** Результат голосования по вопросу */
["MeetQuestionResult"]: AliasType<{
	/** Принят ли вопрос */
	accepted?:boolean | `@${string}`,
	/** Контекст вопроса */
	context?:boolean | `@${string}`,
	/** Принятое решение */
	decision?:boolean | `@${string}`,
	/** Порядковый номер вопроса */
	number?:boolean | `@${string}`,
	/** Идентификатор вопроса */
	question_id?:boolean | `@${string}`,
	/** Заголовок вопроса */
	title?:boolean | `@${string}`,
	/** Количество воздержавшихся */
	votes_abstained?:boolean | `@${string}`,
	/** Количество голосов против */
	votes_against?:boolean | `@${string}`,
	/** Количество голосов за */
	votes_for?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["MetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at: string | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator: string | Variable<any, string>,
	/** Язык документа */
	lang: string | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links: Array<string> | Variable<any, string>,
	/** ID документа в реестре */
	registry_id: number | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone: string | Variable<any, string>,
	/** Название документа */
	title: string | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version: string | Variable<any, string>
};
	["ModerateRequestInput"]: {
	/** Размер комиссии за отмену в формате "10.0000 RUB" */
	cancellation_fee: string | Variable<any, string>,
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** Идентификатор обмена */
	exchange_id: number | Variable<any, string>,
	/** Имя аккаунта пользователя */
	username: string | Variable<any, string>
};
	["MonoAccount"]: AliasType<{
	/** Электронная почта пользователя */
	email?:boolean | `@${string}`,
	/** Есть ли у пользователя аккаунт */
	has_account?:boolean | `@${string}`,
	/** ID начального заказа */
	initial_order?:boolean | `@${string}`,
	/** Подтверждена ли электронная почта */
	is_email_verified?:boolean | `@${string}`,
	/** Зарегистрирован ли пользователь */
	is_registered?:boolean | `@${string}`,
	/** Сообщение */
	message?:boolean | `@${string}`,
	/** Публичный ключ пользователя */
	public_key?:boolean | `@${string}`,
	/** Реферер пользователя */
	referer?:boolean | `@${string}`,
	/** Роль пользователя */
	role?:boolean | `@${string}`,
	/** Статус пользователя */
	status?:boolean | `@${string}`,
	/** Хэш подписчика для уведомлений */
	subscriber_hash?:boolean | `@${string}`,
	/** Идентификатор подписчика для уведомлений */
	subscriber_id?:boolean | `@${string}`,
	/** Тип пользователя */
	type?:boolean | `@${string}`,
	/** Имя пользователя */
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["Mutation"]: AliasType<{
acceptChildOrder?: [{	data: ValueTypes["AcceptChildOrderInput"] | Variable<any, string>},ValueTypes["Transaction"]],
addParticipant?: [{	data: ValueTypes["AddParticipantInput"] | Variable<any, string>},ValueTypes["Account"]],
addTrustedAccount?: [{	data: ValueTypes["AddTrustedAccountInput"] | Variable<any, string>},ValueTypes["Branch"]],
cancelRequest?: [{	data: ValueTypes["CancelRequestInput"] | Variable<any, string>},ValueTypes["Transaction"]],
completeRequest?: [{	data: ValueTypes["CompleteRequestInput"] | Variable<any, string>},ValueTypes["Transaction"]],
confirmReceiveOnRequest?: [{	data: ValueTypes["ConfirmReceiveOnRequestInput"] | Variable<any, string>},ValueTypes["Transaction"]],
confirmSupplyOnRequest?: [{	data: ValueTypes["ConfirmSupplyOnRequestInput"] | Variable<any, string>},ValueTypes["Transaction"]],
createAnnualGeneralMeet?: [{	data: ValueTypes["CreateAnnualGeneralMeetInput"] | Variable<any, string>},ValueTypes["MeetAggregate"]],
createBankAccount?: [{	data: ValueTypes["CreateBankAccountInput"] | Variable<any, string>},ValueTypes["PaymentMethod"]],
createBranch?: [{	data: ValueTypes["CreateBranchInput"] | Variable<any, string>},ValueTypes["Branch"]],
createChildOrder?: [{	data: ValueTypes["CreateChildOrderInput"] | Variable<any, string>},ValueTypes["Transaction"]],
createDepositPayment?: [{	data: ValueTypes["CreateDepositPaymentInput"] | Variable<any, string>},ValueTypes["GatewayPayment"]],
createInitialPayment?: [{	data: ValueTypes["CreateInitialPaymentInput"] | Variable<any, string>},ValueTypes["GatewayPayment"]],
createParentOffer?: [{	data: ValueTypes["CreateParentOfferInput"] | Variable<any, string>},ValueTypes["Transaction"]],
createProjectOfFreeDecision?: [{	data: ValueTypes["CreateProjectFreeDecisionInput"] | Variable<any, string>},ValueTypes["CreatedProjectFreeDecision"]],
createWithdraw?: [{	input: ValueTypes["CreateWithdrawInput"] | Variable<any, string>},ValueTypes["CreateWithdrawResponse"]],
declineRequest?: [{	data: ValueTypes["DeclineRequestInput"] | Variable<any, string>},ValueTypes["Transaction"]],
deleteBranch?: [{	data: ValueTypes["DeleteBranchInput"] | Variable<any, string>},boolean | `@${string}`],
deletePaymentMethod?: [{	data: ValueTypes["DeletePaymentMethodInput"] | Variable<any, string>},boolean | `@${string}`],
deleteTrustedAccount?: [{	data: ValueTypes["DeleteTrustedAccountInput"] | Variable<any, string>},ValueTypes["Branch"]],
deliverOnRequest?: [{	data: ValueTypes["DeliverOnRequestInput"] | Variable<any, string>},ValueTypes["Transaction"]],
disputeOnRequest?: [{	data: ValueTypes["DisputeOnRequestInput"] | Variable<any, string>},ValueTypes["Transaction"]],
editBranch?: [{	data: ValueTypes["EditBranchInput"] | Variable<any, string>},ValueTypes["Branch"]],
generateAnnualGeneralMeetAgendaDocument?: [{	data: ValueTypes["AnnualGeneralMeetingAgendaGenerateDocumentInput"] | Variable<any, string>,	options?: ValueTypes["GenerateDocumentOptionsInput"] | undefined | null | Variable<any, string>},ValueTypes["GeneratedDocument"]],
generateAnnualGeneralMeetDecisionDocument?: [{	data: ValueTypes["AnnualGeneralMeetingDecisionGenerateDocumentInput"] | Variable<any, string>,	options?: ValueTypes["GenerateDocumentOptionsInput"] | undefined | null | Variable<any, string>},ValueTypes["GeneratedDocument"]],
generateAnnualGeneralMeetNotificationDocument?: [{	data: ValueTypes["AnnualGeneralMeetingNotificationGenerateDocumentInput"] | Variable<any, string>,	options?: ValueTypes["GenerateDocumentOptionsInput"] | undefined | null | Variable<any, string>},ValueTypes["GeneratedDocument"]],
generateAssetContributionAct?: [{	data: ValueTypes["AssetContributionActGenerateDocumentInput"] | Variable<any, string>,	options?: ValueTypes["GenerateDocumentOptionsInput"] | undefined | null | Variable<any, string>},ValueTypes["GeneratedDocument"]],
generateAssetContributionDecision?: [{	data: ValueTypes["AssetContributionDecisionGenerateDocumentInput"] | Variable<any, string>,	options?: ValueTypes["GenerateDocumentOptionsInput"] | undefined | null | Variable<any, string>},ValueTypes["GeneratedDocument"]],
generateAssetContributionStatement?: [{	data: ValueTypes["AssetContributionStatementGenerateDocumentInput"] | Variable<any, string>,	options?: ValueTypes["GenerateDocumentOptionsInput"] | undefined | null | Variable<any, string>},ValueTypes["GeneratedDocument"]],
generateBallotForAnnualGeneralMeetDocument?: [{	data: ValueTypes["AnnualGeneralMeetingVotingBallotGenerateDocumentInput"] | Variable<any, string>,	options?: ValueTypes["GenerateDocumentOptionsInput"] | undefined | null | Variable<any, string>},ValueTypes["GeneratedDocument"]],
generateFreeDecision?: [{	data: ValueTypes["FreeDecisionGenerateDocumentInput"] | Variable<any, string>,	options?: ValueTypes["GenerateDocumentOptionsInput"] | undefined | null | Variable<any, string>},ValueTypes["GeneratedDocument"]],
generateParticipantApplication?: [{	data: ValueTypes["ParticipantApplicationGenerateDocumentInput"] | Variable<any, string>,	options?: ValueTypes["GenerateDocumentOptionsInput"] | undefined | null | Variable<any, string>},ValueTypes["GeneratedDocument"]],
generateParticipantApplicationDecision?: [{	data: ValueTypes["ParticipantApplicationDecisionGenerateDocumentInput"] | Variable<any, string>,	options?: ValueTypes["GenerateDocumentOptionsInput"] | undefined | null | Variable<any, string>},ValueTypes["GeneratedDocument"]],
generatePrivacyAgreement?: [{	data: ValueTypes["GenerateDocumentInput"] | Variable<any, string>,	options?: ValueTypes["GenerateDocumentOptionsInput"] | undefined | null | Variable<any, string>},ValueTypes["GeneratedDocument"]],
generateProjectOfFreeDecision?: [{	data: ValueTypes["ProjectFreeDecisionGenerateDocumentInput"] | Variable<any, string>,	options?: ValueTypes["GenerateDocumentOptionsInput"] | undefined | null | Variable<any, string>},ValueTypes["GeneratedDocument"]],
generateReturnByAssetAct?: [{	data: ValueTypes["ReturnByAssetActGenerateDocumentInput"] | Variable<any, string>,	options?: ValueTypes["GenerateDocumentOptionsInput"] | undefined | null | Variable<any, string>},ValueTypes["GeneratedDocument"]],
generateReturnByAssetDecision?: [{	data: ValueTypes["ReturnByAssetDecisionGenerateDocumentInput"] | Variable<any, string>,	options?: ValueTypes["GenerateDocumentOptionsInput"] | undefined | null | Variable<any, string>},ValueTypes["GeneratedDocument"]],
generateReturnByAssetStatement?: [{	data: ValueTypes["ReturnByAssetStatementGenerateDocumentInput"] | Variable<any, string>,	options?: ValueTypes["GenerateDocumentOptionsInput"] | undefined | null | Variable<any, string>},ValueTypes["GeneratedDocument"]],
generateReturnByMoneyDecisionDocument?: [{	data: ValueTypes["ReturnByMoneyDecisionGenerateDocumentInput"] | Variable<any, string>,	options?: ValueTypes["GenerateDocumentOptionsInput"] | undefined | null | Variable<any, string>},ValueTypes["GeneratedDocument"]],
generateReturnByMoneyStatementDocument?: [{	data: ValueTypes["ReturnByMoneyGenerateDocumentInput"] | Variable<any, string>,	options?: ValueTypes["GenerateDocumentOptionsInput"] | undefined | null | Variable<any, string>},ValueTypes["GeneratedDocument"]],
generateSelectBranchDocument?: [{	data: ValueTypes["SelectBranchGenerateDocumentInput"] | Variable<any, string>,	options?: ValueTypes["GenerateDocumentOptionsInput"] | undefined | null | Variable<any, string>},ValueTypes["GeneratedDocument"]],
generateSignatureAgreement?: [{	data: ValueTypes["GenerateDocumentInput"] | Variable<any, string>,	options?: ValueTypes["GenerateDocumentOptionsInput"] | undefined | null | Variable<any, string>},ValueTypes["GeneratedDocument"]],
generateSovietDecisionOnAnnualMeetDocument?: [{	data: ValueTypes["AnnualGeneralMeetingSovietDecisionGenerateDocumentInput"] | Variable<any, string>,	options?: ValueTypes["GenerateDocumentOptionsInput"] | undefined | null | Variable<any, string>},ValueTypes["GeneratedDocument"]],
generateUserAgreement?: [{	data: ValueTypes["GenerateDocumentInput"] | Variable<any, string>,	options?: ValueTypes["GenerateDocumentOptionsInput"] | undefined | null | Variable<any, string>},ValueTypes["GeneratedDocument"]],
generateWalletAgreement?: [{	data: ValueTypes["GenerateDocumentInput"] | Variable<any, string>,	options?: ValueTypes["GenerateDocumentOptionsInput"] | undefined | null | Variable<any, string>},ValueTypes["GeneratedDocument"]],
initSystem?: [{	data: ValueTypes["Init"] | Variable<any, string>},ValueTypes["SystemInfo"]],
installExtension?: [{	data: ValueTypes["ExtensionInput"] | Variable<any, string>},ValueTypes["Extension"]],
installSystem?: [{	data: ValueTypes["Install"] | Variable<any, string>},ValueTypes["SystemInfo"]],
login?: [{	data: ValueTypes["LoginInput"] | Variable<any, string>},ValueTypes["RegisteredAccount"]],
logout?: [{	data: ValueTypes["LogoutInput"] | Variable<any, string>},boolean | `@${string}`],
moderateRequest?: [{	data: ValueTypes["ModerateRequestInput"] | Variable<any, string>},ValueTypes["Transaction"]],
notifyOnAnnualGeneralMeet?: [{	data: ValueTypes["NotifyOnAnnualGeneralMeetInput"] | Variable<any, string>},ValueTypes["MeetAggregate"]],
prohibitRequest?: [{	data: ValueTypes["ProhibitRequestInput"] | Variable<any, string>},ValueTypes["Transaction"]],
publishProjectOfFreeDecision?: [{	data: ValueTypes["PublishProjectFreeDecisionInput"] | Variable<any, string>},boolean | `@${string}`],
publishRequest?: [{	data: ValueTypes["PublishRequestInput"] | Variable<any, string>},ValueTypes["Transaction"]],
receiveOnRequest?: [{	data: ValueTypes["ReceiveOnRequestInput"] | Variable<any, string>},ValueTypes["Transaction"]],
refresh?: [{	data: ValueTypes["RefreshInput"] | Variable<any, string>},ValueTypes["RegisteredAccount"]],
registerAccount?: [{	data: ValueTypes["RegisterAccountInput"] | Variable<any, string>},ValueTypes["RegisteredAccount"]],
registerParticipant?: [{	data: ValueTypes["RegisterParticipantInput"] | Variable<any, string>},ValueTypes["Account"]],
resetKey?: [{	data: ValueTypes["ResetKeyInput"] | Variable<any, string>},boolean | `@${string}`],
restartAnnualGeneralMeet?: [{	data: ValueTypes["RestartAnnualGeneralMeetInput"] | Variable<any, string>},ValueTypes["MeetAggregate"]],
selectBranch?: [{	data: ValueTypes["SelectBranchInput"] | Variable<any, string>},boolean | `@${string}`],
setPaymentStatus?: [{	data: ValueTypes["SetPaymentStatusInput"] | Variable<any, string>},ValueTypes["GatewayPayment"]],
setWif?: [{	data: ValueTypes["SetWifInput"] | Variable<any, string>},boolean | `@${string}`],
signByPresiderOnAnnualGeneralMeet?: [{	data: ValueTypes["SignByPresiderOnAnnualGeneralMeetInput"] | Variable<any, string>},ValueTypes["MeetAggregate"]],
signBySecretaryOnAnnualGeneralMeet?: [{	data: ValueTypes["SignBySecretaryOnAnnualGeneralMeetInput"] | Variable<any, string>},ValueTypes["MeetAggregate"]],
startResetKey?: [{	data: ValueTypes["StartResetKeyInput"] | Variable<any, string>},boolean | `@${string}`],
supplyOnRequest?: [{	data: ValueTypes["SupplyOnRequestInput"] | Variable<any, string>},ValueTypes["Transaction"]],
uninstallExtension?: [{	data: ValueTypes["UninstallExtensionInput"] | Variable<any, string>},boolean | `@${string}`],
unpublishRequest?: [{	data: ValueTypes["UnpublishRequestInput"] | Variable<any, string>},ValueTypes["Transaction"]],
updateAccount?: [{	data: ValueTypes["UpdateAccountInput"] | Variable<any, string>},ValueTypes["Account"]],
updateBankAccount?: [{	data: ValueTypes["UpdateBankAccountInput"] | Variable<any, string>},ValueTypes["PaymentMethod"]],
updateExtension?: [{	data: ValueTypes["ExtensionInput"] | Variable<any, string>},ValueTypes["Extension"]],
updateRequest?: [{	data: ValueTypes["UpdateRequestInput"] | Variable<any, string>},ValueTypes["Transaction"]],
updateSystem?: [{	data: ValueTypes["Update"] | Variable<any, string>},ValueTypes["SystemInfo"]],
voteOnAnnualGeneralMeet?: [{	data: ValueTypes["VoteOnAnnualGeneralMeetInput"] | Variable<any, string>},ValueTypes["MeetAggregate"]],
		__typename?: boolean | `@${string}`
}>;
	["NotifyOnAnnualGeneralMeetInput"]: {
	coopname: string | Variable<any, string>,
	meet_hash: string | Variable<any, string>,
	notification: ValueTypes["AnnualGeneralMeetingNotificationSignedDocumentInput"] | Variable<any, string>,
	username: string | Variable<any, string>
};
	["Organization"]: AliasType<{
	/** Город */
	city?:boolean | `@${string}`,
	/** Страна */
	country?:boolean | `@${string}`,
	/** Детали организации */
	details?:ValueTypes["OrganizationDetails"],
	/** Email */
	email?:boolean | `@${string}`,
	/** Фактический адрес */
	fact_address?:boolean | `@${string}`,
	/** Юридический адрес */
	full_address?:boolean | `@${string}`,
	/** Полное название */
	full_name?:boolean | `@${string}`,
	/** Телефон */
	phone?:boolean | `@${string}`,
	/** Представитель организации */
	represented_by?:ValueTypes["RepresentedBy"],
	/** Краткое название */
	short_name?:boolean | `@${string}`,
	/** Тип организации */
	type?:boolean | `@${string}`,
	/** Имя аккаунта организации */
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["OrganizationCertificate"]: AliasType<{
	/** ИНН */
	inn?:boolean | `@${string}`,
	/** ОГРН */
	ogrn?:boolean | `@${string}`,
	/** Данные представителя */
	represented_by?:ValueTypes["RepresentedByCertificate"],
	/** Короткое название организации */
	short_name?:boolean | `@${string}`,
	/** Тип аккаунта */
	type?:boolean | `@${string}`,
	/** Имя аккаунта */
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["OrganizationDetails"]: AliasType<{
	/** ИНН */
	inn?:boolean | `@${string}`,
	/** КПП */
	kpp?:boolean | `@${string}`,
	/** ОГРН */
	ogrn?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["OrganizationDetailsInput"]: {
	inn: string | Variable<any, string>,
	kpp: string | Variable<any, string>,
	ogrn: string | Variable<any, string>
};
	/** Тип юридического лица */
["OrganizationType"]:OrganizationType;
	["PaginatedGatewayPaymentsPaginationResult"]: AliasType<{
	/** Текущая страница */
	currentPage?:boolean | `@${string}`,
	/** Элементы текущей страницы */
	items?:ValueTypes["GatewayPayment"],
	/** Общее количество элементов */
	totalCount?:boolean | `@${string}`,
	/** Общее количество страниц */
	totalPages?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["PaginationInput"]: {
	/** Количество элементов на странице */
	limit: number | Variable<any, string>,
	/** Номер страницы */
	page: number | Variable<any, string>,
	/** Ключ сортировки (например, "name") */
	sortBy?: string | undefined | null | Variable<any, string>,
	/** Направление сортировки ("ASC" или "DESC") */
	sortOrder: string | Variable<any, string>
};
	["ParticipantAccount"]: AliasType<{
	/** Имя кооперативного участка */
	braname?:boolean | `@${string}`,
	/** Время создания записи о члене */
	created_at?:boolean | `@${string}`,
	/** LEGACY Флаг, имеет ли член право голоса */
	has_vote?:boolean | `@${string}`,
	/** Сумма вступительного взноса */
	initial_amount?:boolean | `@${string}`,
	/** LEGACY Флаг, внесен ли регистрационный взнос */
	is_initial?:boolean | `@${string}`,
	/** LEGACY Флаг, внесен ли минимальный паевый взнос */
	is_minimum?:boolean | `@${string}`,
	/** Время последнего минимального платежа */
	last_min_pay?:boolean | `@${string}`,
	/** Время последнего обновления информации о члене */
	last_update?:boolean | `@${string}`,
	/** Сумма минимального паевого взноса */
	minimum_amount?:boolean | `@${string}`,
	/** Статус члена кооператива (accepted | blocked) */
	status?:boolean | `@${string}`,
	/** Тип участника (individual | entrepreneur | organization) */
	type?:boolean | `@${string}`,
	/** Уникальное имя члена кооператива */
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ParticipantApplicationDecisionGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at?: string | undefined | null | Variable<any, string>,
	/** Идентификатор протокола решения собрания совета */
	decision_id: number | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null | Variable<any, string>,
	/** Язык документа */
	lang?: string | undefined | null | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null | Variable<any, string>,
	/** Название документа */
	title?: string | undefined | null | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null | Variable<any, string>
};
	["ParticipantApplicationGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null | Variable<any, string>,
	/** Имя аккаунта кооперативного участка */
	braname: string | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at?: string | undefined | null | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null | Variable<any, string>,
	/** Язык документа */
	lang?: string | undefined | null | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null | Variable<any, string>,
	/** Изображение собственноручной подписи (base-64) */
	signature?: string | undefined | null | Variable<any, string>,
	/** Флаг пропуска сохранения документа (используется для предварительной генерации и демонстрации пользователю) */
	skip_save: boolean | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null | Variable<any, string>,
	/** Название документа */
	title?: string | undefined | null | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null | Variable<any, string>
};
	["ParticipantApplicationSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string | Variable<any, string>,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string | Variable<any, string>,
	meta: ValueTypes["ParticipantApplicationSignedMetaDocumentInput"] | Variable<any, string>,
	/** Хэш мета-данных */
	meta_hash: string | Variable<any, string>,
	/** Вектор подписей */
	signatures: Array<ValueTypes["SignatureInfoInput"]> | Variable<any, string>,
	/** Версия стандарта документа */
	version: string | Variable<any, string>
};
	["ParticipantApplicationSignedMetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number | Variable<any, string>,
	/** Имя аккаунта кооперативного участка */
	braname: string | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at: string | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator: string | Variable<any, string>,
	/** Язык документа */
	lang: string | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links: Array<string> | Variable<any, string>,
	/** ID документа в реестре */
	registry_id: number | Variable<any, string>,
	/** Изображение собственноручной подписи (base-64) */
	signature?: string | undefined | null | Variable<any, string>,
	/** Флаг пропуска сохранения документа (используется для предварительной генерации и демонстрации пользователю) */
	skip_save: boolean | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone: string | Variable<any, string>,
	/** Название документа */
	title: string | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version: string | Variable<any, string>
};
	["Passport"]: AliasType<{
	/** Код подразделения */
	code?:boolean | `@${string}`,
	/** Дата выдачи */
	issued_at?:boolean | `@${string}`,
	/** Кем выдан */
	issued_by?:boolean | `@${string}`,
	/** Номер паспорта */
	number?:boolean | `@${string}`,
	/** Серия паспорта */
	series?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["PassportInput"]: {
	code: string | Variable<any, string>,
	issued_at: string | Variable<any, string>,
	issued_by: string | Variable<any, string>,
	number: number | Variable<any, string>,
	series: number | Variable<any, string>
};
	["PaymentDetails"]: AliasType<{
	/** Сумма платежа с учетом комиссии */
	amount_plus_fee?:boolean | `@${string}`,
	/** Сумма платежа без учета комиссии */
	amount_without_fee?:boolean | `@${string}`,
	/** Данные платежа (QR-код, токен, реквизиты и т.д.) */
	data?:boolean | `@${string}`,
	/** Фактический процент комиссии */
	fact_fee_percent?:boolean | `@${string}`,
	/** Размер комиссии в абсолютных значениях */
	fee_amount?:boolean | `@${string}`,
	/** Процент комиссии */
	fee_percent?:boolean | `@${string}`,
	/** Допустимый процент отклонения */
	tolerance_percent?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Направление платежа */
["PaymentDirection"]:PaymentDirection;
	["PaymentFiltersInput"]: {
	/** Название кооператива */
	coopname?: string | undefined | null | Variable<any, string>,
	/** Направление платежа */
	direction?: ValueTypes["PaymentDirection"] | undefined | null | Variable<any, string>,
	/** Хэш платежа */
	hash?: string | undefined | null | Variable<any, string>,
	/** Провайдер платежа */
	provider?: string | undefined | null | Variable<any, string>,
	/** Статус платежа */
	status?: ValueTypes["PaymentStatus"] | undefined | null | Variable<any, string>,
	/** Тип платежа */
	type?: ValueTypes["PaymentType"] | undefined | null | Variable<any, string>,
	/** Имя пользователя */
	username?: string | undefined | null | Variable<any, string>
};
	["PaymentMethod"]: AliasType<{
	/** Дата создания */
	created_at?:boolean | `@${string}`,
	/** Данные метода оплаты */
	data?:ValueTypes["PaymentMethodData"],
	/** Флаг основного метода платежа, который отображается в документах */
	is_default?:boolean | `@${string}`,
	/** Идентификатор метода оплаты */
	method_id?:boolean | `@${string}`,
	/** Тип метода оплаты (например, sbp, bank_transfer) */
	method_type?:boolean | `@${string}`,
	/** Дата обновления */
	updated_at?:boolean | `@${string}`,
	/** Имя пользователя, к которому привязан метод оплаты */
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["PaymentMethodData"]: AliasType<{		["...on BankAccount"]?: ValueTypes["BankAccount"],
		["...on SbpAccount"]?: ValueTypes["SbpAccount"]
		__typename?: boolean | `@${string}`
}>;
	["PaymentMethodPaginationResult"]: AliasType<{
	/** Текущая страница */
	currentPage?:boolean | `@${string}`,
	/** Элементы текущей страницы */
	items?:ValueTypes["PaymentMethod"],
	/** Общее количество элементов */
	totalCount?:boolean | `@${string}`,
	/** Общее количество страниц */
	totalPages?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Статус платежа */
["PaymentStatus"]:PaymentStatus;
	/** Тип платежа по назначению */
["PaymentType"]:PaymentType;
	["Permission"]: AliasType<{
	/** Родительское разрешение */
	parent?:boolean | `@${string}`,
	/** Имя разрешения */
	perm_name?:boolean | `@${string}`,
	/** Требуемые разрешения */
	required_auth?:ValueTypes["Authority"],
		__typename?: boolean | `@${string}`
}>;
	["PermissionLevel"]: AliasType<{
	/** Актор */
	actor?:boolean | `@${string}`,
	/** Разрешение */
	permission?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["PermissionLevelWeight"]: AliasType<{
	/** Уровень разрешения */
	permission?:ValueTypes["PermissionLevel"],
	/** Вес */
	weight?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["PrivateAccount"]: AliasType<{
	entrepreneur_data?:ValueTypes["Entrepreneur"],
	individual_data?:ValueTypes["Individual"],
	organization_data?:ValueTypes["Organization"],
	/** Тип аккаунта */
	type?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["PrivateAccountSearchData"]: AliasType<{		["...on Entrepreneur"]?: ValueTypes["Entrepreneur"],
		["...on Individual"]?: ValueTypes["Individual"],
		["...on Organization"]?: ValueTypes["Organization"]
		__typename?: boolean | `@${string}`
}>;
	["PrivateAccountSearchResult"]: AliasType<{
	/** Данные найденного аккаунта */
	data?:ValueTypes["PrivateAccountSearchData"],
	/** Поля, в которых найдены совпадения */
	highlightedFields?:boolean | `@${string}`,
	/** Оценка релевантности результата */
	score?:boolean | `@${string}`,
	/** Тип аккаунта */
	type?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ProhibitRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** Идентификатор обмена */
	exchange_id: number | Variable<any, string>,
	/** Дополнительная информация о отклоненной модерации */
	meta: string | Variable<any, string>,
	/** Имя аккаунта пользователя */
	username: string | Variable<any, string>
};
	["ProjectFreeDecisionGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at?: string | undefined | null | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null | Variable<any, string>,
	/** Язык документа */
	lang?: string | undefined | null | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null | Variable<any, string>,
	/** Идентификатор проекта решения */
	project_id: string | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null | Variable<any, string>,
	/** Название документа */
	title?: string | undefined | null | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null | Variable<any, string>
};
	["ProjectFreeDecisionSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string | Variable<any, string>,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string | Variable<any, string>,
	/** Метаинформация для создания проекта свободного решения */
	meta: ValueTypes["ProjectFreeDecisionSignedMetaDocumentInput"] | Variable<any, string>,
	/** Хэш мета-данных */
	meta_hash: string | Variable<any, string>,
	/** Вектор подписей */
	signatures: Array<ValueTypes["SignatureInfoInput"]> | Variable<any, string>,
	/** Версия стандарта документа */
	version: string | Variable<any, string>
};
	["ProjectFreeDecisionSignedMetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at: string | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator: string | Variable<any, string>,
	/** Язык документа */
	lang: string | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links: Array<string> | Variable<any, string>,
	/** Идентификатор проекта решения */
	project_id: string | Variable<any, string>,
	/** ID документа в реестре */
	registry_id: number | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone: string | Variable<any, string>,
	/** Название документа */
	title: string | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version: string | Variable<any, string>
};
	["PublicChairman"]: AliasType<{
	first_name?:boolean | `@${string}`,
	last_name?:boolean | `@${string}`,
	middle_name?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["PublishProjectFreeDecisionInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** Подписанный электронный документ (generateProjectOfFreeDecision) */
	document: ValueTypes["ProjectFreeDecisionSignedDocumentInput"] | Variable<any, string>,
	/** Строка мета-информации */
	meta: string | Variable<any, string>,
	/** Имя аккаунта пользователя */
	username: string | Variable<any, string>
};
	["PublishRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** Идентификатор заявки */
	exchange_id: number | Variable<any, string>,
	/** Имя аккаунта пользователя */
	username: string | Variable<any, string>
};
	["Query"]: AliasType<{
getAccount?: [{	data: ValueTypes["GetAccountInput"] | Variable<any, string>},ValueTypes["Account"]],
getAccounts?: [{	data?: ValueTypes["GetAccountsInput"] | undefined | null | Variable<any, string>,	options?: ValueTypes["PaginationInput"] | undefined | null | Variable<any, string>},ValueTypes["AccountsPaginationResult"]],
	/** Получить список вопросов совета кооператива для голосования */
	getAgenda?:ValueTypes["AgendaWithDocuments"],
getBranches?: [{	data: ValueTypes["GetBranchesInput"] | Variable<any, string>},ValueTypes["Branch"]],
	/** Получить состав приложений рабочего стола */
	getDesktop?:ValueTypes["Desktop"],
getDocuments?: [{	data: ValueTypes["GetDocumentsInput"] | Variable<any, string>},ValueTypes["DocumentsAggregatePaginationResult"]],
getExtensions?: [{	data?: ValueTypes["GetExtensionsInput"] | undefined | null | Variable<any, string>},ValueTypes["Extension"]],
getMeet?: [{	data: ValueTypes["GetMeetInput"] | Variable<any, string>},ValueTypes["MeetAggregate"]],
getMeets?: [{	data: ValueTypes["GetMeetsInput"] | Variable<any, string>},ValueTypes["MeetAggregate"]],
getPaymentMethods?: [{	data?: ValueTypes["GetPaymentMethodsInput"] | undefined | null | Variable<any, string>},ValueTypes["PaymentMethodPaginationResult"]],
getPayments?: [{	data?: ValueTypes["PaymentFiltersInput"] | undefined | null | Variable<any, string>,	options?: ValueTypes["PaginationInput"] | undefined | null | Variable<any, string>},ValueTypes["PaginatedGatewayPaymentsPaginationResult"]],
	/** Получить сводную публичную информацию о системе */
	getSystemInfo?:ValueTypes["SystemInfo"],
searchPrivateAccounts?: [{	data: ValueTypes["SearchPrivateAccountsInput"] | Variable<any, string>},ValueTypes["PrivateAccountSearchResult"]],
		__typename?: boolean | `@${string}`
}>;
	/** Вопрос повестки собрания с результатами голосования */
["Question"]: AliasType<{
	/** Контекст или дополнительная информация по вопросу */
	context?:boolean | `@${string}`,
	/** Имя аккаунта кооператива */
	coopname?:boolean | `@${string}`,
	/** Количество голосов "Воздержался" */
	counter_votes_abstained?:boolean | `@${string}`,
	/** Количество голосов "Против" */
	counter_votes_against?:boolean | `@${string}`,
	/** Количество голосов "За" */
	counter_votes_for?:boolean | `@${string}`,
	/** Предлагаемое решение по вопросу */
	decision?:boolean | `@${string}`,
	/** Уникальный идентификатор вопроса */
	id?:boolean | `@${string}`,
	/** Идентификатор собрания, к которому относится вопрос */
	meet_id?:boolean | `@${string}`,
	/** Порядковый номер вопроса в повестке */
	number?:boolean | `@${string}`,
	/** Заголовок вопроса */
	title?:boolean | `@${string}`,
	/** Список участников, проголосовавших "Воздержался" */
	voters_abstained?:boolean | `@${string}`,
	/** Список участников, проголосовавших "Против" */
	voters_against?:boolean | `@${string}`,
	/** Список участников, проголосовавших "За" */
	voters_for?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ReceiveOnRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** Подписанный Заказчиком акт приёмки-передачи имущества из Кооператива по новации */
	document: ValueTypes["ReturnByAssetActSignedDocumentInput"] | Variable<any, string>,
	/** Идентификатор заявки */
	exchange_id: number | Variable<any, string>,
	/** Имя аккаунта пользователя */
	username: string | Variable<any, string>
};
	["RefreshInput"]: {
	/** Токен доступа */
	access_token: string | Variable<any, string>,
	/** Токен обновления */
	refresh_token: string | Variable<any, string>
};
	["RefundRequest"]: AliasType<{
	/** Сумма CPU */
	cpu_amount?:boolean | `@${string}`,
	/** Сумма сети */
	net_amount?:boolean | `@${string}`,
	/** Владелец */
	owner?:boolean | `@${string}`,
	/** Время запроса */
	request_time?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["RegisterAccountInput"]: {
	/** Электронная почта */
	email: string | Variable<any, string>,
	/** Данные индивидуального предпринимателя */
	entrepreneur_data?: ValueTypes["CreateEntrepreneurDataInput"] | undefined | null | Variable<any, string>,
	/** Данные физического лица */
	individual_data?: ValueTypes["CreateIndividualDataInput"] | undefined | null | Variable<any, string>,
	/** Данные организации */
	organization_data?: ValueTypes["CreateOrganizationDataInput"] | undefined | null | Variable<any, string>,
	/** Публичный ключ */
	public_key: string | Variable<any, string>,
	/** Имя аккаунта реферера */
	referer?: string | undefined | null | Variable<any, string>,
	/** Тип аккаунта */
	type: ValueTypes["AccountType"] | Variable<any, string>,
	/** Имя пользователя */
	username: string | Variable<any, string>
};
	["RegisterParticipantInput"]: {
	/** Имя кооперативного участка */
	braname?: string | undefined | null | Variable<any, string>,
	/** Подписанный документ политики конфиденциальности от пайщика */
	privacy_agreement: ValueTypes["SignedDigitalDocumentInput"] | Variable<any, string>,
	/** Подписанный документ положения о цифровой подписи от пайщика */
	signature_agreement: ValueTypes["SignedDigitalDocumentInput"] | Variable<any, string>,
	/** Подписанный документ заявления на вступление в кооператив от пайщика */
	statement: ValueTypes["ParticipantApplicationSignedDocumentInput"] | Variable<any, string>,
	/** Подписанный документ пользовательского соглашения от пайщика */
	user_agreement: ValueTypes["SignedDigitalDocumentInput"] | Variable<any, string>,
	/** Имя аккаунта пайщика */
	username: string | Variable<any, string>,
	/** Подписанный документ положения целевой потребительской программы "Цифровой Кошелёк" от пайщика */
	wallet_agreement: ValueTypes["SignedDigitalDocumentInput"] | Variable<any, string>
};
	["RegisteredAccount"]: AliasType<{
	/** Информация об зарегистрированном аккаунте */
	account?:ValueTypes["Account"],
	/** Токены доступа и обновления */
	tokens?:ValueTypes["Tokens"],
		__typename?: boolean | `@${string}`
}>;
	["RepresentedBy"]: AliasType<{
	/** На основании чего действует */
	based_on?:boolean | `@${string}`,
	/** Имя */
	first_name?:boolean | `@${string}`,
	/** Фамилия */
	last_name?:boolean | `@${string}`,
	/** Отчество */
	middle_name?:boolean | `@${string}`,
	/** Должность */
	position?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["RepresentedByCertificate"]: AliasType<{
	/** Имя */
	first_name?:boolean | `@${string}`,
	/** Фамилия */
	last_name?:boolean | `@${string}`,
	/** Отчество */
	middle_name?:boolean | `@${string}`,
	/** Должность */
	position?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["RepresentedByInput"]: {
	based_on: string | Variable<any, string>,
	first_name: string | Variable<any, string>,
	last_name: string | Variable<any, string>,
	middle_name: string | Variable<any, string>,
	position: string | Variable<any, string>
};
	["ResetKeyInput"]: {
	/** Публичный ключ для замены */
	public_key: string | Variable<any, string>,
	/** Токен авторизации для замены ключа, полученный по email */
	token: string | Variable<any, string>
};
	["ResourceDelegationDTO"]: AliasType<{
	/** Вес CPU */
	cpu_weight?:boolean | `@${string}`,
	/** Отправитель */
	from?:boolean | `@${string}`,
	/** Вес сети */
	net_weight?:boolean | `@${string}`,
	/** Получатель */
	to?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ResourceOverview"]: AliasType<{
	/** Вес CPU */
	cpu_weight?:boolean | `@${string}`,
	/** Вес сети */
	net_weight?:boolean | `@${string}`,
	/** Владелец */
	owner?:boolean | `@${string}`,
	/** Используемая RAM */
	ram_bytes?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** DTO для перезапуска ежегодного общего собрания кооператива */
["RestartAnnualGeneralMeetInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** Хеш собрания, которое необходимо перезапустить */
	hash: string | Variable<any, string>,
	/** Новая дата закрытия собрания */
	new_close_at: ValueTypes["DateTime"] | Variable<any, string>,
	/** Новая дата открытия собрания */
	new_open_at: ValueTypes["DateTime"] | Variable<any, string>,
	/** Новое предложение повестки ежегодного общего собрания */
	newproposal: ValueTypes["AnnualGeneralMeetingAgendaSignedDocumentInput"] | Variable<any, string>
};
	["ReturnByAssetActGenerateDocumentInput"]: {
	/** Идентификатор акта */
	act_id: string | Variable<any, string>,
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null | Variable<any, string>,
	/** Имя аккаунта кооперативного участка */
	braname?: string | undefined | null | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at?: string | undefined | null | Variable<any, string>,
	/** Идентификатор решения */
	decision_id: number | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null | Variable<any, string>,
	/** Язык документа */
	lang?: string | undefined | null | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null | Variable<any, string>,
	/** Идентификатор заявки */
	request_id: number | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null | Variable<any, string>,
	/** Название документа */
	title?: string | undefined | null | Variable<any, string>,
	/** Имя аккаунта получателя на кооперативном участке */
	transmitter: string | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null | Variable<any, string>
};
	["ReturnByAssetActSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string | Variable<any, string>,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string | Variable<any, string>,
	/** Метаинформация для создания проекта свободного решения */
	meta: ValueTypes["ReturnByAssetActSignedMetaDocumentInput"] | Variable<any, string>,
	/** Хэш мета-данных */
	meta_hash: string | Variable<any, string>,
	/** Вектор подписей */
	signatures: Array<ValueTypes["SignatureInfoInput"]> | Variable<any, string>,
	/** Версия стандарта документа */
	version: string | Variable<any, string>
};
	["ReturnByAssetActSignedMetaDocumentInput"]: {
	/** Идентификатор акта */
	act_id: string | Variable<any, string>,
	/** Номер блока, на котором был создан документ */
	block_num: number | Variable<any, string>,
	/** Имя аккаунта кооперативного участка */
	braname?: string | undefined | null | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at: string | Variable<any, string>,
	/** Идентификатор решения */
	decision_id: number | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator: string | Variable<any, string>,
	/** Язык документа */
	lang: string | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links: Array<string> | Variable<any, string>,
	/** ID документа в реестре */
	registry_id: number | Variable<any, string>,
	/** Идентификатор заявки */
	request_id: number | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone: string | Variable<any, string>,
	/** Название документа */
	title: string | Variable<any, string>,
	/** Имя аккаунта получателя на кооперативном участке */
	transmitter: string | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version: string | Variable<any, string>
};
	["ReturnByAssetDecisionGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at?: string | undefined | null | Variable<any, string>,
	/** Идентификатор решения */
	decision_id: number | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null | Variable<any, string>,
	/** Язык документа */
	lang?: string | undefined | null | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null | Variable<any, string>,
	/** Идентификатор заявки */
	request_id: number | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null | Variable<any, string>,
	/** Название документа */
	title?: string | undefined | null | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null | Variable<any, string>
};
	["ReturnByAssetStatementGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at?: string | undefined | null | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null | Variable<any, string>,
	/** Язык документа */
	lang?: string | undefined | null | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null | Variable<any, string>,
	/** Запрос на внесение имущественного паевого взноса */
	request: ValueTypes["CommonRequestInput"] | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null | Variable<any, string>,
	/** Название документа */
	title?: string | undefined | null | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null | Variable<any, string>
};
	["ReturnByAssetStatementSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string | Variable<any, string>,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string | Variable<any, string>,
	/** Метаинформация для создания проекта свободного решения */
	meta: ValueTypes["ReturnByAssetStatementSignedMetaDocumentInput"] | Variable<any, string>,
	/** Хэш мета-данных */
	meta_hash: string | Variable<any, string>,
	/** Вектор подписей */
	signatures: Array<ValueTypes["SignatureInfoInput"]> | Variable<any, string>,
	/** Версия стандарта документа */
	version: string | Variable<any, string>
};
	["ReturnByAssetStatementSignedMetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at: string | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator: string | Variable<any, string>,
	/** Язык документа */
	lang: string | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links: Array<string> | Variable<any, string>,
	/** ID документа в реестре */
	registry_id: number | Variable<any, string>,
	/** Запрос на внесение имущественного паевого взноса */
	request: ValueTypes["CommonRequestInput"] | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone: string | Variable<any, string>,
	/** Название документа */
	title: string | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version: string | Variable<any, string>
};
	["ReturnByMoneyDecisionGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at?: string | undefined | null | Variable<any, string>,
	/** Валюта */
	currency: string | Variable<any, string>,
	/** ID решения совета */
	decision_id: number | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null | Variable<any, string>,
	/** Язык документа */
	lang?: string | undefined | null | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null | Variable<any, string>,
	/** Хэш платежа */
	payment_hash: string | Variable<any, string>,
	/** Количество средств к возврату */
	quantity: string | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null | Variable<any, string>,
	/** Название документа */
	title?: string | undefined | null | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null | Variable<any, string>
};
	["ReturnByMoneyGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at?: string | undefined | null | Variable<any, string>,
	/** Валюта */
	currency: string | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null | Variable<any, string>,
	/** Язык документа */
	lang?: string | undefined | null | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null | Variable<any, string>,
	/** ID платежного метода */
	method_id: string | Variable<any, string>,
	/** Хеш платежа для связи с withdraw */
	payment_hash: string | Variable<any, string>,
	/** Количество средств к возврату */
	quantity: string | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null | Variable<any, string>,
	/** Название документа */
	title?: string | undefined | null | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null | Variable<any, string>
};
	["ReturnByMoneySignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string | Variable<any, string>,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string | Variable<any, string>,
	/** Метаинформация для документа заявления на возврат паевого взноса денежными средствами */
	meta: ValueTypes["ReturnByMoneySignedMetaDocumentInput"] | Variable<any, string>,
	/** Хэш мета-данных */
	meta_hash: string | Variable<any, string>,
	/** Вектор подписей */
	signatures: Array<ValueTypes["SignatureInfoInput"]> | Variable<any, string>,
	/** Версия стандарта документа */
	version: string | Variable<any, string>
};
	["ReturnByMoneySignedMetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at: string | Variable<any, string>,
	/** Валюта */
	currency: string | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator: string | Variable<any, string>,
	/** Язык документа */
	lang: string | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links: Array<string> | Variable<any, string>,
	/** ID платежного метода */
	method_id: string | Variable<any, string>,
	/** Хеш платежа для связи с withdraw */
	payment_hash: string | Variable<any, string>,
	/** Количество средств к возврату */
	quantity: string | Variable<any, string>,
	/** ID документа в реестре */
	registry_id: number | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone: string | Variable<any, string>,
	/** Название документа */
	title: string | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version: string | Variable<any, string>
};
	["SbpAccount"]: AliasType<{
	/** Мобильный телефон получателя */
	phone?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["SearchPrivateAccountsInput"]: {
	/** Поисковый запрос для поиска приватных аккаунтов */
	query: string | Variable<any, string>
};
	["SelectBranchGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null | Variable<any, string>,
	/** Идентификатор имени аккаунта кооперативного участка */
	braname: string | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at?: string | undefined | null | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null | Variable<any, string>,
	/** Язык документа */
	lang?: string | undefined | null | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null | Variable<any, string>,
	/** Название документа */
	title?: string | undefined | null | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null | Variable<any, string>
};
	["SelectBranchInput"]: {
	/** Имя аккаунта кооперативного участка */
	braname: string | Variable<any, string>,
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** Подписанный электронный документ (generateSelectBranchDocument) */
	document: ValueTypes["SelectBranchSignedDocumentInput"] | Variable<any, string>,
	/** Имя аккаунта пользователя */
	username: string | Variable<any, string>
};
	["SelectBranchSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string | Variable<any, string>,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string | Variable<any, string>,
	/** Метаинформация для документа выбора кооперативного участка */
	meta: ValueTypes["SelectBranchSignedMetaDocumentInput"] | Variable<any, string>,
	/** Хэш мета-данных */
	meta_hash: string | Variable<any, string>,
	/** Вектор подписей */
	signatures: Array<ValueTypes["SignatureInfoInput"]> | Variable<any, string>,
	/** Версия стандарта документа */
	version: string | Variable<any, string>
};
	["SelectBranchSignedMetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number | Variable<any, string>,
	/** Идентификатор имени аккаунта кооперативного участка */
	braname: string | Variable<any, string>,
	/** Название кооператива, связанное с документом */
	coopname: string | Variable<any, string>,
	/** Дата и время создания документа */
	created_at: string | Variable<any, string>,
	/** Имя генератора, использованного для создания документа */
	generator: string | Variable<any, string>,
	/** Язык документа */
	lang: string | Variable<any, string>,
	/** Ссылки, связанные с документом */
	links: Array<string> | Variable<any, string>,
	/** ID документа в реестре */
	registry_id: number | Variable<any, string>,
	/** Часовой пояс, в котором был создан документ */
	timezone: string | Variable<any, string>,
	/** Название документа */
	title: string | Variable<any, string>,
	/** Имя пользователя, создавшего документ */
	username: string | Variable<any, string>,
	/** Версия генератора, использованного для создания документа */
	version: string | Variable<any, string>
};
	["SetPaymentStatusInput"]: {
	/** Идентификатор платежа, для которого устанавливается статус */
	id: string | Variable<any, string>,
	/** Новый статус платежа */
	status: ValueTypes["PaymentStatus"] | Variable<any, string>
};
	["SetWifInput"]: {
	/** Тип разрешения ключа */
	permission: string | Variable<any, string>,
	/** Имя пользователя, чей ключ */
	username: string | Variable<any, string>,
	/** Приватный ключ */
	wif: string | Variable<any, string>
};
	/** Входные данные для подписи решения председателем */
["SignByPresiderOnAnnualGeneralMeetInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** Хеш собрания */
	hash: string | Variable<any, string>,
	/** Подписанный документ с решением председателя */
	presider_decision: ValueTypes["AnnualGeneralMeetingDecisionSignedDocumentInput"] | Variable<any, string>,
	/** Имя аккаунта пользователя */
	username: string | Variable<any, string>
};
	/** Входные данные для подписи решения секретарём */
["SignBySecretaryOnAnnualGeneralMeetInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** Хеш собрания */
	hash: string | Variable<any, string>,
	/** Подписанный документ с решением секретаря */
	secretary_decision: ValueTypes["AnnualGeneralMeetingDecisionSignedDocumentInput"] | Variable<any, string>,
	/** Имя аккаунта пользователя */
	username: string | Variable<any, string>
};
	["SignatureInfo"]: AliasType<{
	id?:boolean | `@${string}`,
	is_valid?:boolean | `@${string}`,
	meta?:boolean | `@${string}`,
	public_key?:boolean | `@${string}`,
	signature?:boolean | `@${string}`,
	signed_at?:boolean | `@${string}`,
	signed_hash?:boolean | `@${string}`,
	signer?:boolean | `@${string}`,
	/** Сертификат подписанта (сокращенная информация) */
	signer_certificate?:ValueTypes["UserCertificateUnion"],
		__typename?: boolean | `@${string}`
}>;
	["SignatureInfoInput"]: {
	/** Идентификатор номера подписи */
	id: number | Variable<any, string>,
	/** Мета-данные подписи */
	meta: string | Variable<any, string>,
	/** Публичный ключ */
	public_key: string | Variable<any, string>,
	/** Подпись хэша */
	signature: string | Variable<any, string>,
	/** Время подписания */
	signed_at: string | Variable<any, string>,
	/** Подписанный хэш */
	signed_hash: string | Variable<any, string>,
	/** Аккаунт подписавшего */
	signer: string | Variable<any, string>
};
	["SignedBlockchainDocument"]: AliasType<{
	/** Хэш содержимого документа */
	doc_hash?:boolean | `@${string}`,
	/** Общий хэш (doc_hash + meta_hash) */
	hash?:boolean | `@${string}`,
	/** Метаинформация документа (в формате JSON-строки) */
	meta?:boolean | `@${string}`,
	/** Хэш мета-данных */
	meta_hash?:boolean | `@${string}`,
	/** Вектор подписей */
	signatures?:ValueTypes["SignatureInfo"],
	/** Версия стандарта документа */
	version?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["SignedDigitalDocument"]: AliasType<{
	doc_hash?:boolean | `@${string}`,
	hash?:boolean | `@${string}`,
	meta?:boolean | `@${string}`,
	meta_hash?:boolean | `@${string}`,
	signatures?:ValueTypes["SignatureInfo"],
	version?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["SignedDigitalDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string | Variable<any, string>,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string | Variable<any, string>,
	/** Метаинформация документа */
	meta: ValueTypes["MetaDocumentInput"] | Variable<any, string>,
	/** Хэш мета-данных */
	meta_hash: string | Variable<any, string>,
	/** Вектор подписей */
	signatures: Array<ValueTypes["SignatureInfoInput"]> | Variable<any, string>,
	/** Версия стандарта документа */
	version: string | Variable<any, string>
};
	["SovietMemberInput"]: {
	individual_data: ValueTypes["CreateIndividualDataInput"] | Variable<any, string>,
	role: string | Variable<any, string>
};
	["StartResetKeyInput"]: {
	/** Электронная почта */
	email: string | Variable<any, string>
};
	/** Комплексный объект цифрового документа заявления (или другого ведущего документа для цепочки принятия решений совета) с агрегатом документа */
["StatementDetailAggregate"]: AliasType<{
	action?:ValueTypes["ExtendedBlockchainAction"],
	documentAggregate?:ValueTypes["DocumentAggregate"],
		__typename?: boolean | `@${string}`
}>;
	["SupplyOnRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** Подписанный Поставщиком акт приёма-передачи имущества в кооператив */
	document: ValueTypes["AssetContributionActSignedDocumentInput"] | Variable<any, string>,
	/** Идентификатор обмена */
	exchange_id: number | Variable<any, string>,
	/** Имя аккаунта пользователя */
	username: string | Variable<any, string>
};
	["SystemInfo"]: AliasType<{
	/** Объект системного аккаунта кооператива в блокчейне */
	blockchain_account?:ValueTypes["BlockchainAccount"],
	/** Набор данных с информацией о состоянии блокчейна */
	blockchain_info?:ValueTypes["BlockchainInfoDTO"],
	/** Контакты кооператива */
	contacts?:ValueTypes["ContactsDTO"],
	/** Объект аккаунта кооператива у оператора */
	cooperator_account?:ValueTypes["CooperativeOperatorAccount"],
	/** Имя аккаунта кооператива */
	coopname?:boolean | `@${string}`,
	/** Статус контроллера кооператива */
	system_status?:boolean | `@${string}`,
	/** Переменные кооператива */
	vars?:ValueTypes["Vars"],
		__typename?: boolean | `@${string}`
}>;
	/** Состояние контроллера кооператива */
["SystemStatus"]:SystemStatus;
	["Token"]: AliasType<{
	/** Дата истечения токена доступа */
	expires?:boolean | `@${string}`,
	/** Токен доступа */
	token?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["Tokens"]: AliasType<{
	/** Токен доступа */
	access?:ValueTypes["Token"],
	/** Токен обновления */
	refresh?:ValueTypes["Token"],
		__typename?: boolean | `@${string}`
}>;
	["Transaction"]: AliasType<{
	/** Блокчейн, который использовался */
	chain?:boolean | `@${string}`,
	/** Запрос на подписание транзакции */
	request?:boolean | `@${string}`,
	/** Разрешенный запрос на подписание транзакции */
	resolved?:boolean | `@${string}`,
	/** Ответ от API после отправки транзакции (если был выполнен бродкаст) */
	response?:boolean | `@${string}`,
	/** Возвращаемые значения после выполнения транзакции */
	returns?:boolean | `@${string}`,
	/** Ревизии транзакции, измененные плагинами в ESR формате */
	revisions?:boolean | `@${string}`,
	/** Подписи транзакции */
	signatures?:boolean | `@${string}`,
	/** Авторизованный подписант */
	signer?:boolean | `@${string}`,
	/** Итоговая транзакция */
	transaction?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UninstallExtensionInput"]: {
	/** Фильтр по имени */
	name: string | Variable<any, string>
};
	["UnpublishRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** Идентификатор обмена */
	exchange_id: number | Variable<any, string>,
	/** Имя аккаунта пользователя */
	username: string | Variable<any, string>
};
	["Update"]: {
	/** Собственные данные кооператива, обслуживающего экземпляр платформы */
	organization_data?: ValueTypes["UpdateOrganizationDataInput"] | undefined | null | Variable<any, string>,
	/** Переменные кооператива, используемые для заполнения шаблонов документов */
	vars?: ValueTypes["VarsInput"] | undefined | null | Variable<any, string>
};
	["UpdateAccountInput"]: {
	/** Данные индивидуального предпринимателя */
	entrepreneur_data?: ValueTypes["UpdateEntrepreneurDataInput"] | undefined | null | Variable<any, string>,
	/** Данные физического лица */
	individual_data?: ValueTypes["UpdateIndividualDataInput"] | undefined | null | Variable<any, string>,
	/** Данные организации */
	organization_data?: ValueTypes["UpdateOrganizationDataInput"] | undefined | null | Variable<any, string>,
	/** Публичный ключ */
	public_key?: string | undefined | null | Variable<any, string>,
	/** Имя аккаунта реферера */
	referer?: string | undefined | null | Variable<any, string>,
	/** Имя пользователя */
	username: string | Variable<any, string>
};
	["UpdateBankAccountInput"]: {
	/** Данные банковского счёта */
	data: ValueTypes["BankAccountInput"] | Variable<any, string>,
	/** Флаг основного метода платежа, который отображается в документах */
	is_default: boolean | Variable<any, string>,
	/** Идентификатор платежного метода */
	method_id: string | Variable<any, string>,
	/** Имя аккаунта пользователя */
	username: string | Variable<any, string>
};
	["UpdateEntrepreneurDataInput"]: {
	/** Дата рождения */
	birthdate: string | Variable<any, string>,
	/** Город */
	city: string | Variable<any, string>,
	/** Страна */
	country: ValueTypes["Country"] | Variable<any, string>,
	/** Детали индивидуального предпринимателя */
	details: ValueTypes["EntrepreneurDetailsInput"] | Variable<any, string>,
	/** Электронная почта */
	email: string | Variable<any, string>,
	/** Имя */
	first_name: string | Variable<any, string>,
	/** Полный адрес */
	full_address: string | Variable<any, string>,
	/** Фамилия */
	last_name: string | Variable<any, string>,
	/** Отчество */
	middle_name: string | Variable<any, string>,
	/** Телефон */
	phone: string | Variable<any, string>,
	/** Имя пользователя */
	username: string | Variable<any, string>
};
	["UpdateIndividualDataInput"]: {
	/** Дата рождения */
	birthdate: string | Variable<any, string>,
	/** Электронная почта */
	email: string | Variable<any, string>,
	/** Имя */
	first_name: string | Variable<any, string>,
	/** Полный адрес */
	full_address: string | Variable<any, string>,
	/** Фамилия */
	last_name: string | Variable<any, string>,
	/** Отчество */
	middle_name: string | Variable<any, string>,
	/** Данные паспорта */
	passport?: ValueTypes["PassportInput"] | undefined | null | Variable<any, string>,
	/** Телефон */
	phone: string | Variable<any, string>,
	/** Имя пользователя */
	username: string | Variable<any, string>
};
	["UpdateOrganizationDataInput"]: {
	/** Город */
	city: string | Variable<any, string>,
	/** Страна */
	country: string | Variable<any, string>,
	/** Детали организации */
	details: ValueTypes["OrganizationDetailsInput"] | Variable<any, string>,
	/** Электронная почта */
	email: string | Variable<any, string>,
	/** Фактический адрес */
	fact_address: string | Variable<any, string>,
	/** Полный адрес */
	full_address: string | Variable<any, string>,
	/** Полное наименование организации */
	full_name: string | Variable<any, string>,
	/** Телефон */
	phone: string | Variable<any, string>,
	/** Представитель организации */
	represented_by: ValueTypes["RepresentedByInput"] | Variable<any, string>,
	/** Краткое наименование организации */
	short_name: string | Variable<any, string>,
	/** Тип организации */
	type: string | Variable<any, string>,
	/** Имя пользователя */
	username: string | Variable<any, string>
};
	["UpdateRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** Дополнительные данные */
	data: string | Variable<any, string>,
	/** Идентификатор обмена */
	exchange_id: number | Variable<any, string>,
	/** Дополнительная информация */
	meta: string | Variable<any, string>,
	/** Оставшееся количество единиц */
	remain_units: string | Variable<any, string>,
	/** Стоимость за единицу в формате "10.0000 RUB" */
	unit_cost: string | Variable<any, string>,
	/** Имя аккаунта пользователя */
	username: string | Variable<any, string>
};
	["UserAccount"]: AliasType<{
	/** Метаинформация */
	meta?:boolean | `@${string}`,
	/** Реферал */
	referer?:boolean | `@${string}`,
	/** Дата регистрации */
	registered_at?:boolean | `@${string}`,
	/** Регистратор */
	registrator?:boolean | `@${string}`,
	/** Статус аккаунта */
	status?:boolean | `@${string}`,
	/** Список хранилищ */
	storages?:boolean | `@${string}`,
	/** Тип учетной записи */
	type?:boolean | `@${string}`,
	/** Имя аккаунта */
	username?:boolean | `@${string}`,
	/** Дата регистрации */
	verifications?:ValueTypes["Verification"],
		__typename?: boolean | `@${string}`
}>;
	/** Объединение сертификатов пользователей (сокращенная информация) */
["UserCertificateUnion"]: AliasType<{		["...on EntrepreneurCertificate"]?: ValueTypes["EntrepreneurCertificate"],
		["...on IndividualCertificate"]?: ValueTypes["IndividualCertificate"],
		["...on OrganizationCertificate"]?: ValueTypes["OrganizationCertificate"]
		__typename?: boolean | `@${string}`
}>;
	/** Статус пользователя */
["UserStatus"]:UserStatus;
	["Vars"]: AliasType<{
	confidential_email?:boolean | `@${string}`,
	confidential_link?:boolean | `@${string}`,
	contact_email?:boolean | `@${string}`,
	coopenomics_agreement?:ValueTypes["AgreementVar"],
	coopname?:boolean | `@${string}`,
	full_abbr?:boolean | `@${string}`,
	full_abbr_dative?:boolean | `@${string}`,
	full_abbr_genitive?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	participant_application?:ValueTypes["AgreementVar"],
	passport_request?:boolean | `@${string}`,
	privacy_agreement?:ValueTypes["AgreementVar"],
	short_abbr?:boolean | `@${string}`,
	signature_agreement?:ValueTypes["AgreementVar"],
	user_agreement?:ValueTypes["AgreementVar"],
	wallet_agreement?:ValueTypes["AgreementVar"],
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["VarsInput"]: {
	confidential_email: string | Variable<any, string>,
	confidential_link: string | Variable<any, string>,
	contact_email: string | Variable<any, string>,
	coopenomics_agreement?: ValueTypes["AgreementInput"] | undefined | null | Variable<any, string>,
	coopname: string | Variable<any, string>,
	full_abbr: string | Variable<any, string>,
	full_abbr_dative: string | Variable<any, string>,
	full_abbr_genitive: string | Variable<any, string>,
	name: string | Variable<any, string>,
	participant_application: ValueTypes["AgreementInput"] | Variable<any, string>,
	passport_request: string | Variable<any, string>,
	privacy_agreement: ValueTypes["AgreementInput"] | Variable<any, string>,
	short_abbr: string | Variable<any, string>,
	signature_agreement: ValueTypes["AgreementInput"] | Variable<any, string>,
	user_agreement: ValueTypes["AgreementInput"] | Variable<any, string>,
	wallet_agreement: ValueTypes["AgreementInput"] | Variable<any, string>,
	website: string | Variable<any, string>
};
	["Verification"]: AliasType<{
	/** Дата создания верификации */
	created_at?:boolean | `@${string}`,
	/** Флаг верификации */
	is_verified?:boolean | `@${string}`,
	/** Дата последнего обновления верификации */
	last_update?:boolean | `@${string}`,
	/** Заметка верификации */
	notice?:boolean | `@${string}`,
	/** Процедура верификации */
	procedure?:boolean | `@${string}`,
	/** Имя верификатора */
	verificator?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Пункт голосования для ежегодного общего собрания */
["VoteItemInput"]: {
	/** Идентификатор вопроса повестки */
	question_id: number | Variable<any, string>,
	/** Решение по вопросу (вариант голосования) */
	vote: string | Variable<any, string>
};
	/** Входные данные для голосования на ежегодном общем собрании */
["VoteOnAnnualGeneralMeetInput"]: {
	/** Подписанный бюллетень голосования */
	ballot: ValueTypes["AnnualGeneralMeetingVotingBallotSignedDocumentInput"] | Variable<any, string>,
	/** Имя аккаунта кооператива */
	coopname: string | Variable<any, string>,
	/** Хеш собрания, по которому производится голосование */
	hash: string | Variable<any, string>,
	/** Идентификатор члена кооператива, который голосует */
	username: string | Variable<any, string>,
	/** Бюллетень с решениями по вопросам повестки */
	votes: Array<ValueTypes["VoteItemInput"]> | Variable<any, string>
};
	["WaitWeight"]: AliasType<{
	/** Время ожидания в секундах */
	wait_sec?:boolean | `@${string}`,
	/** Вес */
	weight?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>
  }

export type ResolverInputTypes = {
    ["AcceptChildOrderInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Подписанное заявление на имущественный паевый взнос */
	document: ResolverInputTypes["AssetContributionStatementSignedDocumentInput"],
	/** Идентификатор заявки */
	exchange_id: string,
	/** Имя аккаунта пользователя */
	username: string
};
	["Account"]: AliasType<{
	/** объект аккаунта в блокчейне содержит системную информацию, такую как публичные ключи доступа, доступные вычислительные ресурсы, информация об установленном смарт-контракте, и т.д. и т.п. Это системный уровень обслуживания, где у каждого пайщика есть аккаунт, но не каждый аккаунт может быть пайщиком в каком-либо кооперативе. Все смарт-контракты устанавливаются и исполняются на этом уровне. */
	blockchain_account?:ResolverInputTypes["BlockchainAccount"],
	/** объект пайщика кооператива в таблице блокчейне, который определяет членство пайщика в конкретном кооперативе. Поскольку MONO обслуживает только один кооператив, то в participant_account обычно содержится информация, которая описывает членство пайщика в этом кооперативе. Этот объект обезличен, публичен, и хранится в блокчейне. */
	participant_account?:ResolverInputTypes["ParticipantAccount"],
	/** объект приватных данных пайщика кооператива. */
	private_account?:ResolverInputTypes["PrivateAccount"],
	/** объект аккаунта в системе учёта провайдера, т.е. MONO. Здесь хранится приватная информация о пайщике кооператива, которая содержит его приватные данные. Эти данные не публикуются в блокчейне и не выходят за пределы базы данных провайдера. Они используются для заполнения шаблонов документов при нажатии соответствующих кнопок на платформе.  */
	provider_account?:ResolverInputTypes["MonoAccount"],
	/** объект пользователя кооперативной экономики содержит в блокчейне информацию о типе аккаунта пайщика, а также, обезличенные публичные данные (хэши) для верификации пайщиков между кооперативами. Этот уровень предназначен для хранения информации пайщика, которая необходима всем кооперативам, но не относится к какому-либо из них конкретно. */
	user_account?:ResolverInputTypes["UserAccount"],
	/** Имя аккаунта кооператива */
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["AccountRamDelta"]: AliasType<{
	account?:boolean | `@${string}`,
	delta?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["AccountResourceInfo"]: AliasType<{
	/** Доступные ресурсы */
	available?:boolean | `@${string}`,
	/** Текущее использование ресурсов */
	current_used?:boolean | `@${string}`,
	/** Время последнего обновления использования ресурсов */
	last_usage_update_time?:boolean | `@${string}`,
	/** Максимальное количество ресурсов */
	max?:boolean | `@${string}`,
	/** Использовано ресурсов */
	used?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Тип аккаунта пользователя в системе */
["AccountType"]:AccountType;
	["AccountsPaginationResult"]: AliasType<{
	/** Текущая страница */
	currentPage?:boolean | `@${string}`,
	/** Элементы текущей страницы */
	items?:ResolverInputTypes["Account"],
	/** Общее количество элементов */
	totalCount?:boolean | `@${string}`,
	/** Общее количество страниц */
	totalPages?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Комплексный объект акта, содержащий полную информацию о сгенерированном и опубликованном документе с его агрегатом */
["ActDetailAggregate"]: AliasType<{
	action?:ResolverInputTypes["ExtendedBlockchainAction"],
	documentAggregate?:ResolverInputTypes["DocumentAggregate"],
		__typename?: boolean | `@${string}`
}>;
	["ActionAuthorization"]: AliasType<{
	actor?:boolean | `@${string}`,
	permission?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ActionReceipt"]: AliasType<{
	abi_sequence?:boolean | `@${string}`,
	act_digest?:boolean | `@${string}`,
	auth_sequence?:ResolverInputTypes["AuthSequence"],
	code_sequence?:boolean | `@${string}`,
	global_sequence?:boolean | `@${string}`,
	receiver?:boolean | `@${string}`,
	recv_sequence?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["AddParticipantInput"]: {
	/** Дата создания аккаунта в строковом формате даты EOSIO по UTC (2024-12-28T06:58:52.500) */
	created_at: string,
	/** Электронная почта */
	email: string,
	/** Данные индивидуального предпринимателя */
	entrepreneur_data?: ResolverInputTypes["CreateEntrepreneurDataInput"] | undefined | null,
	/** Данные физического лица */
	individual_data?: ResolverInputTypes["CreateIndividualDataInput"] | undefined | null,
	/** Вступительный взнос, который был внесён пайщиком */
	initial: string,
	/** Минимальный паевый взнос, который был внесён пайщиком */
	minimum: string,
	/** Данные организации */
	organization_data?: ResolverInputTypes["CreateOrganizationDataInput"] | undefined | null,
	/** Имя аккаунта реферера */
	referer?: string | undefined | null,
	/** Флаг распределения вступительного взноса в невозвратный фонд вступительных взносов кооператива */
	spread_initial: boolean,
	/** Тип аккаунта */
	type: ResolverInputTypes["AccountType"]
};
	["AddTrustedAccountInput"]: {
	/** Имя аккаунта кооперативного участка */
	braname: string,
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Имя аккаунта доверонного лица, который уполномачивается председателем кооперативного участка на совершение действий */
	trusted: string
};
	/** Пункт повестки общего собрания (для ввода) */
["AgendaGeneralMeetPointInput"]: {
	/** Контекст или дополнительная информация по пункту повестки */
	context: string,
	/** Предлагаемое решение по пункту повестки */
	decision: string,
	/** Заголовок пункта повестки */
	title: string
};
	/** Вопрос повестки общего собрания */
["AgendaGeneralMeetQuestion"]: {
	/** Контекст или дополнительная информация по вопросу */
	context?: string | undefined | null,
	/** Предлагаемое решение по вопросу повестки */
	decision: string,
	/** Номер вопроса в повестке */
	number: string,
	/** Заголовок вопроса повестки */
	title: string
};
	/** Данные собрания для повестки */
["AgendaMeet"]: {
	/** Дата и время окончания собрания */
	close_at_datetime: string,
	/** Дата и время начала собрания */
	open_at_datetime: string,
	/** Тип собрания (очередное или внеочередное) */
	type: string
};
	/** Пункт повестки собрания */
["AgendaMeetPoint"]: AliasType<{
	/** Контекст или дополнительная информация по пункту повестки */
	context?:boolean | `@${string}`,
	/** Предлагаемое решение по пункту повестки */
	decision?:boolean | `@${string}`,
	/** Заголовок пункта повестки */
	title?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["AgendaWithDocuments"]: AliasType<{
	/** Действие, которое привело к появлению вопроса на голосовании */
	action?:ResolverInputTypes["BlockchainAction"],
	/** Пакет документов, включающий разные подсекции */
	documents?:ResolverInputTypes["DocumentPackageAggregate"],
	/** Запись в таблице блокчейна о вопросе на голосовании */
	table?:ResolverInputTypes["BlockchainDecision"],
		__typename?: boolean | `@${string}`
}>;
	["AgreementInput"]: {
	protocol_day_month_year: string,
	protocol_number: string
};
	["AgreementVar"]: AliasType<{
	protocol_day_month_year?:boolean | `@${string}`,
	protocol_number?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["AnnualGeneralMeetingAgendaGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Флаг повторного собрания */
	is_repeated: boolean,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	meet: ResolverInputTypes["AgendaMeet"],
	questions: Array<ResolverInputTypes["AgendaGeneralMeetQuestion"]>,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["AnnualGeneralMeetingAgendaSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация для создания протокола решения */
	meta: ResolverInputTypes["AnnualGeneralMeetingAgendaSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<ResolverInputTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["AnnualGeneralMeetingAgendaSignedMetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Флаг повторного собрания */
	is_repeated: boolean,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	meet: ResolverInputTypes["AgendaMeet"],
	questions: Array<ResolverInputTypes["AgendaGeneralMeetQuestion"]>,
	/** ID документа в реестре */
	registry_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["AnnualGeneralMeetingDecisionGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Хеш собрания */
	meet_hash: string,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["AnnualGeneralMeetingDecisionSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация */
	meta: ResolverInputTypes["AnnualGeneralMeetingDecisionSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<ResolverInputTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["AnnualGeneralMeetingDecisionSignedMetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** Хеш собрания */
	meet_hash: string,
	/** ID документа в реестре */
	registry_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["AnnualGeneralMeetingNotificationGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Хеш собрания */
	meet_hash: string,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["AnnualGeneralMeetingNotificationSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация */
	meta: ResolverInputTypes["AnnualGeneralMeetingNotificationSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<ResolverInputTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["AnnualGeneralMeetingNotificationSignedMetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** Хеш собрания */
	meet_hash: string,
	/** ID документа в реестре */
	registry_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["AnnualGeneralMeetingSovietDecisionGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** ID решения совета */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Флаг повторного собрания */
	is_repeated: boolean,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Хеш собрания */
	meet_hash: string,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["AnnualGeneralMeetingVotingBallotGenerateDocumentInput"]: {
	/** Ответы голосования */
	answers: Array<ResolverInputTypes["AnswerInput"]>,
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Хеш собрания */
	meet_hash: string,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя голосующего */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["AnnualGeneralMeetingVotingBallotSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация для создания протокола решения */
	meta: ResolverInputTypes["AnnualGeneralMeetingVotingBallotSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<ResolverInputTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["AnnualGeneralMeetingVotingBallotSignedMetaDocumentInput"]: {
	/** Ответы голосования */
	answers: Array<ResolverInputTypes["AnswerInput"]>,
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** Хеш собрания */
	meet_hash: string,
	/** ID документа в реестре */
	registry_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя голосующего */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["AnswerInput"]: {
	/** ID вопроса */
	id: string,
	/** Номер вопроса */
	number: string,
	/** Голос (за/против/воздержался) */
	vote: string
};
	["AssetContributionActGenerateDocumentInput"]: {
	/** Идентификатор акта */
	act_id: string,
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Имя аккаунта кооперативного участка */
	braname?: string | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Идентификатор решения */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Имя аккаунта получателя на кооперативном участке */
	receiver: string,
	/** Идентификатор заявки */
	request_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["AssetContributionActSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация для создания проекта свободного решения */
	meta: ResolverInputTypes["AssetContributionActSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<ResolverInputTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["AssetContributionActSignedMetaDocumentInput"]: {
	/** Идентификатор акта */
	act_id: string,
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Имя аккаунта кооперативного участка */
	braname?: string | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Идентификатор решения */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** Имя аккаунта получателя на кооперативном участке */
	receiver: string,
	/** ID документа в реестре */
	registry_id: number,
	/** Идентификатор заявки */
	request_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["AssetContributionDecisionGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Идентификатор решения */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Идентификатор заявки */
	request_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["AssetContributionStatementGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Запрос на внесение имущественного паевого взноса */
	request: ResolverInputTypes["CommonRequestInput"],
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["AssetContributionStatementSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация для создания проекта свободного решения */
	meta: ResolverInputTypes["AssetContributionStatementSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<ResolverInputTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["AssetContributionStatementSignedMetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** ID документа в реестре */
	registry_id: number,
	/** Запрос на внесение имущественного паевого взноса */
	request: ResolverInputTypes["CommonRequestInput"],
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["AuthSequence"]: AliasType<{
	account?:boolean | `@${string}`,
	sequence?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["Authority"]: AliasType<{
	/** Уровни разрешений */
	accounts?:ResolverInputTypes["PermissionLevelWeight"],
	/** Ключи */
	keys?:ResolverInputTypes["KeyWeight"],
	/** Порог */
	threshold?:boolean | `@${string}`,
	/** Вес ожидания */
	waits?:ResolverInputTypes["WaitWeight"],
		__typename?: boolean | `@${string}`
}>;
	["BankAccount"]: AliasType<{
	/** Номер банковского счета */
	account_number?:boolean | `@${string}`,
	/** Название банка */
	bank_name?:boolean | `@${string}`,
	/** Номер карты */
	card_number?:boolean | `@${string}`,
	/** Валюта счета */
	currency?:boolean | `@${string}`,
	/** Детали счета */
	details?:ResolverInputTypes["BankAccountDetails"],
		__typename?: boolean | `@${string}`
}>;
	["BankAccountDetails"]: AliasType<{
	/** БИК банка */
	bik?:boolean | `@${string}`,
	/** Корреспондентский счет */
	corr?:boolean | `@${string}`,
	/** КПП банка */
	kpp?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["BankAccountDetailsInput"]: {
	/** БИК банка */
	bik: string,
	/** Корреспондентский счет */
	corr: string,
	/** КПП банка */
	kpp: string
};
	["BankAccountInput"]: {
	/** Номер банковского счета */
	account_number: string,
	/** Название банка */
	bank_name: string,
	/** Номер карты */
	card_number?: string | undefined | null,
	/** Валюта счета */
	currency: string,
	/** Детали счета */
	details: ResolverInputTypes["BankAccountDetailsInput"]
};
	["BankPaymentMethod"]: AliasType<{
	/** Дата создания */
	created_at?:boolean | `@${string}`,
	/** Данные метода оплаты */
	data?:ResolverInputTypes["BankAccount"],
	/** Флаг основного метода платежа, который отображается в документах */
	is_default?:boolean | `@${string}`,
	/** Идентификатор метода оплаты */
	method_id?:boolean | `@${string}`,
	/** Тип метода оплаты */
	method_type?:boolean | `@${string}`,
	/** Дата обновления */
	updated_at?:boolean | `@${string}`,
	/** Имя пользователя, к которому привязан метод оплаты */
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["BlockchainAccount"]: AliasType<{
	/** Имя аккаунта */
	account_name?:boolean | `@${string}`,
	/** Баланс */
	core_liquid_balance?:boolean | `@${string}`,
	/** Ограничения CPU */
	cpu_limit?:ResolverInputTypes["AccountResourceInfo"],
	/** Вес CPU */
	cpu_weight?:boolean | `@${string}`,
	/** Дата создания */
	created?:boolean | `@${string}`,
	/** Номер последнего блока */
	head_block_num?:boolean | `@${string}`,
	/** Время последнего блока */
	head_block_time?:boolean | `@${string}`,
	/** Время последнего обновления кода */
	last_code_update?:boolean | `@${string}`,
	/** Ограничения сети */
	net_limit?:ResolverInputTypes["AccountResourceInfo"],
	/** Вес сети */
	net_weight?:boolean | `@${string}`,
	/** Разрешения */
	permissions?:ResolverInputTypes["Permission"],
	/** Флаг привилегий */
	privileged?:boolean | `@${string}`,
	/** Квота RAM */
	ram_quota?:boolean | `@${string}`,
	/** Использование RAM */
	ram_usage?:boolean | `@${string}`,
	/** Запрос на возврат */
	refund_request?:ResolverInputTypes["RefundRequest"],
	/** Информация о REX */
	rex_info?:boolean | `@${string}`,
	/** Делегированные ресурсы */
	self_delegated_bandwidth?:ResolverInputTypes["ResourceDelegationDTO"],
	/** Общий обзор ресурсов */
	total_resources?:ResolverInputTypes["ResourceOverview"],
	/** Информация о голосовании */
	voter_info?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Объект действия в блокчейне */
["BlockchainAction"]: AliasType<{
	account?:boolean | `@${string}`,
	account_ram_deltas?:ResolverInputTypes["AccountRamDelta"],
	action_ordinal?:boolean | `@${string}`,
	authorization?:ResolverInputTypes["ActionAuthorization"],
	block_id?:boolean | `@${string}`,
	block_num?:boolean | `@${string}`,
	chain_id?:boolean | `@${string}`,
	console?:boolean | `@${string}`,
	context_free?:boolean | `@${string}`,
	creator_action_ordinal?:boolean | `@${string}`,
	/** Данные действия в формате JSON */
	data?:boolean | `@${string}`,
	elapsed?:boolean | `@${string}`,
	global_sequence?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	receipt?:ResolverInputTypes["ActionReceipt"],
	receiver?:boolean | `@${string}`,
	transaction_id?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Запись в таблице блокчейна о процессе принятия решения советом кооператива */
["BlockchainDecision"]: AliasType<{
	approved?:boolean | `@${string}`,
	authorization?:ResolverInputTypes["SignedBlockchainDocument"],
	authorized?:boolean | `@${string}`,
	authorized_by?:boolean | `@${string}`,
	batch_id?:boolean | `@${string}`,
	callback_contract?:boolean | `@${string}`,
	confirm_callback?:boolean | `@${string}`,
	coopname?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	decline_callback?:boolean | `@${string}`,
	expired_at?:boolean | `@${string}`,
	hash?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	meta?:boolean | `@${string}`,
	statement?:ResolverInputTypes["SignedBlockchainDocument"],
	type?:boolean | `@${string}`,
	username?:boolean | `@${string}`,
	/** Сертификат пользователя, создавшего решение */
	username_certificate?:ResolverInputTypes["UserCertificateUnion"],
	validated?:boolean | `@${string}`,
	votes_against?:boolean | `@${string}`,
	/** Сертификаты пользователей, голосовавших "против" */
	votes_against_certificates?:ResolverInputTypes["UserCertificateUnion"],
	votes_for?:boolean | `@${string}`,
	/** Сертификаты пользователей, голосовавших "за" */
	votes_for_certificates?:ResolverInputTypes["UserCertificateUnion"],
		__typename?: boolean | `@${string}`
}>;
	/** Информация о состоянии блокчейна */
["BlockchainInfoDTO"]: AliasType<{
	/** Лимит CPU для блока */
	block_cpu_limit?:boolean | `@${string}`,
	/** Лимит сети для блока */
	block_net_limit?:boolean | `@${string}`,
	/** Идентификатор цепочки (chain ID) */
	chain_id?:boolean | `@${string}`,
	/** Идентификатор головного блока в форк базе данных */
	fork_db_head_block_id?:boolean | `@${string}`,
	/** Номер головного блока в форк базе данных */
	fork_db_head_block_num?:boolean | `@${string}`,
	/** Идентификатор головного блока */
	head_block_id?:boolean | `@${string}`,
	/** Номер головного блока */
	head_block_num?:boolean | `@${string}`,
	/** Прозводитель головного блока */
	head_block_producer?:boolean | `@${string}`,
	/** Время головного блока */
	head_block_time?:boolean | `@${string}`,
	/** Идентификатор последнего необратимого блока */
	last_irreversible_block_id?:boolean | `@${string}`,
	/** Номер последнего необратимого блока */
	last_irreversible_block_num?:boolean | `@${string}`,
	/** Время последнего необратимого блока */
	last_irreversible_block_time?:boolean | `@${string}`,
	/** Версия сервера */
	server_version?:boolean | `@${string}`,
	/** Строковое представление версии сервера */
	server_version_string?:boolean | `@${string}`,
	/** Виртуальный лимит CPU для блока */
	virtual_block_cpu_limit?:boolean | `@${string}`,
	/** Виртуальный лимит сети для блока */
	virtual_block_net_limit?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["Branch"]: AliasType<{
	/** Банковский счёт */
	bank_account?:ResolverInputTypes["BankPaymentMethod"],
	/** Уникальное имя кооперативного участка */
	braname?:boolean | `@${string}`,
	/** Город */
	city?:boolean | `@${string}`,
	/** Имя аккаунта кооператива */
	coopname?:boolean | `@${string}`,
	/** Страна */
	country?:boolean | `@${string}`,
	/** Детали организации */
	details?:ResolverInputTypes["OrganizationDetails"],
	/** Email */
	email?:boolean | `@${string}`,
	/** Фактический адрес */
	fact_address?:boolean | `@${string}`,
	/** Полный адрес */
	full_address?:boolean | `@${string}`,
	/** Полное название организации */
	full_name?:boolean | `@${string}`,
	/** Телефон */
	phone?:boolean | `@${string}`,
	/** Представитель организации */
	represented_by?:ResolverInputTypes["RepresentedBy"],
	/** Краткое название организации */
	short_name?:boolean | `@${string}`,
	/** Доверенные аккаунты */
	trusted?:ResolverInputTypes["Individual"],
	/** Председатель кооперативного участка */
	trustee?:ResolverInputTypes["Individual"],
	/** Тип организации */
	type?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["CancelRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Идентификатор заявки */
	exchange_id: string,
	/** Имя аккаунта пользователя */
	username: string
};
	["CommonRequestInput"]: {
	currency: string,
	hash: string,
	program_id: number,
	title: string,
	total_cost: string,
	type: string,
	unit_cost: string,
	unit_of_measurement: string,
	units: number
};
	["CompleteRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Идентификатор обмена */
	exchange_id: string,
	/** Имя аккаунта пользователя */
	username: string
};
	/** Подтвердить получение имущества Уполномоченным лицом от Заказчика по новации и акту приёмки-передачи */
["ConfirmReceiveOnRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Подписанный акт приёмки-передачи имущества Уполномоченным лицом из Кооператива при возврате Заказчику по новации */
	document: ResolverInputTypes["ReturnByAssetActSignedDocumentInput"],
	/** Идентификатор обмена */
	exchange_id: string,
	/** Имя аккаунта пользователя */
	username: string
};
	/** Подтвердить поставку имущества Поставщиком по заявке Заказчика и акту приёма-передачи */
["ConfirmSupplyOnRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Подписанный акт приёма-передачи имущества от Поставщика в Кооператив */
	document: ResolverInputTypes["AssetContributionActSignedDocumentInput"],
	/** Идентификатор обмена */
	exchange_id: string,
	/** Имя аккаунта пользователя */
	username: string
};
	["ContactsDTO"]: AliasType<{
	chairman?:ResolverInputTypes["PublicChairman"],
	details?:ResolverInputTypes["OrganizationDetails"],
	email?:boolean | `@${string}`,
	full_address?:boolean | `@${string}`,
	full_name?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["CooperativeOperatorAccount"]: AliasType<{
	/** Количество активных участников */
	active_participants_count?:boolean | `@${string}`,
	/** Объявление кооператива */
	announce?:boolean | `@${string}`,
	/** Тип кооператива */
	coop_type?:boolean | `@${string}`,
	/** Дата создания */
	created_at?:boolean | `@${string}`,
	/** Описание кооператива */
	description?:boolean | `@${string}`,
	/** Документ кооператива */
	document?:ResolverInputTypes["SignedBlockchainDocument"],
	/** Начальный взнос */
	initial?:boolean | `@${string}`,
	/** Разветвленный ли кооператив */
	is_branched?:boolean | `@${string}`,
	/** Является ли это кооперативом */
	is_cooperative?:boolean | `@${string}`,
	/** Включен ли кооператив */
	is_enrolled?:boolean | `@${string}`,
	/** Метаинформация */
	meta?:boolean | `@${string}`,
	/** Минимальный взнос */
	minimum?:boolean | `@${string}`,
	/** Начальный взнос организации */
	org_initial?:boolean | `@${string}`,
	/** Минимальный взнос организации */
	org_minimum?:boolean | `@${string}`,
	/** Регистрационный взнос организации */
	org_registration?:boolean | `@${string}`,
	/** Родительское имя аккаунта кооператива */
	parent_username?:boolean | `@${string}`,
	/** Реферал кооператива */
	referer?:boolean | `@${string}`,
	/** Дата регистрации */
	registered_at?:boolean | `@${string}`,
	/** Регистрационный взнос */
	registration?:boolean | `@${string}`,
	/** Регистратор кооператива */
	registrator?:boolean | `@${string}`,
	/** Статус кооператива */
	status?:boolean | `@${string}`,
	/** Список хранилищ */
	storages?:boolean | `@${string}`,
	/** Тип учетной записи */
	type?:boolean | `@${string}`,
	/** Имя аккаунта кооператива */
	username?:boolean | `@${string}`,
	/** Дата регистрации */
	verifications?:ResolverInputTypes["Verification"],
		__typename?: boolean | `@${string}`
}>;
	/** Страна регистрации пользователя */
["Country"]:Country;
	["CreateAnnualGeneralMeetInput"]: {
	/** Повестка собрания */
	agenda: Array<ResolverInputTypes["AgendaGeneralMeetPointInput"]>,
	/** Время закрытия собрания */
	close_at: ResolverInputTypes["DateTime"],
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Имя аккаунта инициатора */
	initiator: string,
	/** Время открытия собрания */
	open_at: ResolverInputTypes["DateTime"],
	/** Имя аккаунта председателя */
	presider: string,
	/** Предложение повестки собрания */
	proposal: ResolverInputTypes["AnnualGeneralMeetingAgendaSignedDocumentInput"],
	/** Имя аккаунта секретаря */
	secretary: string
};
	["CreateBankAccountInput"]: {
	/** Данные для банковского перевода */
	data: ResolverInputTypes["BankAccountInput"],
	/** Флаг основного метода платежа, который отображается в документах */
	is_default: boolean,
	/** Имя аккаунта пользователя */
	username: string
};
	["CreateBranchInput"]: {
	/** Документ, на основании которого действует Уполномоченный (решение совета №СС-.. от ..) */
	based_on: string,
	/** Имя аккаунта кооперативного участка */
	braname: string,
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Электронная почта */
	email: string,
	/** Фактический адрес */
	fact_address: string,
	/** Полное имя организации кооперативного участка */
	full_name: string,
	/** Телефон */
	phone: string,
	/** Краткое имя организации кооперативного участка */
	short_name: string,
	/** Имя аккаунта уполномоченного (председателя) кооперативного участка */
	trustee: string
};
	["CreateChildOrderInput"]: {
	/** Имя кооператива */
	coopname: string,
	/** Дополнительные данные, специфичные для заявки */
	data: string,
	/** Подписанное заявление на возврат паевого взноса имуществом от Заказчика */
	document: ResolverInputTypes["ReturnByAssetStatementSignedDocumentInput"],
	/** Метаданные о заявке */
	meta: string,
	/** Идентификатор родительской заявки */
	parent_id: number,
	/** Время жизни продукта, заявляемое поставщиком (в секундах) */
	product_lifecycle_secs: number,
	/** Идентификатор программы */
	program_id: number,
	/** Цена за единицу (штуку) товара или результата услуги в формате "10.0000 RUB" */
	unit_cost: string,
	/** Количество частей (штук) товара или услуги */
	units: number,
	/** Имя пользователя, инициирующего или обновляющего заявку */
	username: string
};
	["CreateDepositPaymentInput"]: {
	/** Сумма взноса */
	quantity: number,
	/** Символ валюты */
	symbol: string,
	/** Имя аккаунта пользователя */
	username: string
};
	["CreateEntrepreneurDataInput"]: {
	/** Банковский счет */
	bank_account: ResolverInputTypes["BankAccountInput"],
	/** Дата рождения */
	birthdate: string,
	/** Город */
	city: string,
	/** Страна */
	country: ResolverInputTypes["Country"],
	/** Детали индивидуального предпринимателя */
	details: ResolverInputTypes["EntrepreneurDetailsInput"],
	/** Имя */
	first_name: string,
	/** Полный адрес */
	full_address: string,
	/** Фамилия */
	last_name: string,
	/** Отчество */
	middle_name: string,
	/** Телефон */
	phone: string
};
	["CreateIndividualDataInput"]: {
	/** Дата рождения */
	birthdate: string,
	/** Имя */
	first_name: string,
	/** Полный адрес */
	full_address: string,
	/** Фамилия */
	last_name: string,
	/** Отчество */
	middle_name: string,
	/** Данные паспорта */
	passport?: ResolverInputTypes["PassportInput"] | undefined | null,
	/** Телефон */
	phone: string
};
	["CreateInitialPaymentInput"]: {
	/** Имя аккаунта пользователя */
	username: string
};
	["CreateOrganizationDataInput"]: {
	/** Банковский счет организации */
	bank_account: ResolverInputTypes["BankAccountInput"],
	/** Город */
	city: string,
	/** Страна */
	country: string,
	/** Детали организации */
	details: ResolverInputTypes["OrganizationDetailsInput"],
	/** Фактический адрес */
	fact_address: string,
	/** Полный адрес */
	full_address: string,
	/** Полное наименование организации */
	full_name: string,
	/** Телефон */
	phone: string,
	/** Представитель организации */
	represented_by: ResolverInputTypes["RepresentedByInput"],
	/** Краткое наименование организации */
	short_name: string,
	/** Тип организации */
	type: ResolverInputTypes["OrganizationType"]
};
	["CreateParentOfferInput"]: {
	/** Имя кооператива */
	coopname: string,
	/** Дополнительные данные, специфичные для заявки */
	data: string,
	/** Метаданные о заявке */
	meta: string,
	/** Идентификатор родительской заявки */
	parent_id: number,
	/** Время жизни продукта, заявляемое поставщиком (в секундах) */
	product_lifecycle_secs: number,
	/** Идентификатор программы */
	program_id: number,
	/** Цена за единицу (штуку) товара или услуги в формате "10.0000 RUB" */
	unit_cost: string,
	/** Количество частей (штук) товара или услуги */
	units: number,
	/** Имя пользователя, инициирующего или обновляющего заявку */
	username: string
};
	["CreateProjectFreeDecisionInput"]: {
	/** Проект решения, которое предлагается принять */
	decision: string,
	/** Вопрос, который выносится на повестку */
	question: string
};
	["CreateWithdrawInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** ID метода платежа */
	method_id: string,
	/** Хеш платежа для связи с withdraw */
	payment_hash: string,
	/** Количество средств */
	quantity: number,
	/** Подписанное заявление на возврат средств */
	statement: ResolverInputTypes["ReturnByMoneySignedDocumentInput"],
	/** Символ валюты */
	symbol: string,
	/** Имя пользователя */
	username: string
};
	["CreateWithdrawResponse"]: AliasType<{
	/** Хеш созданной заявки на вывод */
	withdraw_hash?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["CreatedProjectFreeDecision"]: AliasType<{
	/** Проект решения, которое предлагается принять */
	decision?:boolean | `@${string}`,
	/** Идентификатор проекта свободного решения */
	id?:boolean | `@${string}`,
	/** Вопрос, который выносится на повестку */
	question?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format. */
["DateTime"]:unknown;
	/** Комплексный объект решения совета, включающий в себя информацию о голосовавших членах совета, расширенное действие, которое привело к появлению решения, и агрегат документа самого решения. */
["DecisionDetailAggregate"]: AliasType<{
	action?:ResolverInputTypes["ExtendedBlockchainAction"],
	documentAggregate?:ResolverInputTypes["DocumentAggregate"],
	votes_against?:ResolverInputTypes["ExtendedBlockchainAction"],
	votes_for?:ResolverInputTypes["ExtendedBlockchainAction"],
		__typename?: boolean | `@${string}`
}>;
	["DeclineRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Идентификатор обмена */
	exchange_id: number,
	/** Причина отказа */
	meta: string,
	/** Имя аккаунта пользователя */
	username: string
};
	["DeleteBranchInput"]: {
	/** Имя аккаунта кооперативного участка */
	braname: string,
	/** Имя аккаунта кооператива */
	coopname: string
};
	["DeletePaymentMethodInput"]: {
	/** Идентификатор метода оплаты */
	method_id: string,
	/** Имя пользователя, чей метод оплаты нужно удалить */
	username: string
};
	["DeleteTrustedAccountInput"]: {
	/** Имя аккаунта кооперативного участка */
	braname: string,
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Имя аккаунта доверонного лица, у которого отзывается право подписи за председателя кооперативного участка */
	trusted: string
};
	["DeliverOnRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Идентификатор обмена */
	exchange_id: number,
	/** Имя аккаунта пользователя */
	username: string
};
	["Desktop"]: AliasType<{
	/** Имя шаблона рабочих столов */
	authorizedHome?:boolean | `@${string}`,
	/** Имя аккаунта кооператива */
	coopname?:boolean | `@${string}`,
	/** Имя шаблона рабочих столов */
	layout?:boolean | `@${string}`,
	/** Имя шаблона рабочих столов */
	nonAuthorizedHome?:boolean | `@${string}`,
	/** Состав приложений рабочего стола */
	workspaces?:ResolverInputTypes["DesktopWorkspace"],
		__typename?: boolean | `@${string}`
}>;
	["DesktopWorkspace"]: AliasType<{
	/** Имя приложения */
	name?:boolean | `@${string}`,
	/** Отображаемое название приложения */
	title?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["DisputeOnRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Документ с аргументами спора */
	document: ResolverInputTypes["JSONObject"],
	/** Идентификатор обмена */
	exchange_id: number,
	/** Имя аккаунта пользователя */
	username: string
};
	["DocumentAggregate"]: AliasType<{
	document?:ResolverInputTypes["SignedDigitalDocument"],
	hash?:boolean | `@${string}`,
	rawDocument?:ResolverInputTypes["GeneratedDocument"],
		__typename?: boolean | `@${string}`
}>;
	/** Комплексный объект папки цифрового документа с агрегатами, который включает в себя заявление, решение, акты и связанные документы */
["DocumentPackageAggregate"]: AliasType<{
	/** Массив объект(ов) актов с агрегатами, относящихся к заявлению */
	acts?:ResolverInputTypes["ActDetailAggregate"],
	/** Объект цифрового документа решения с агрегатом */
	decision?:ResolverInputTypes["DecisionDetailAggregate"],
	/** Массив связанных документов с агрегатами, извлечённых из мета-данных */
	links?:ResolverInputTypes["DocumentAggregate"],
	/** Объект цифрового документа заявления с агрегатом */
	statement?:ResolverInputTypes["StatementDetailAggregate"],
		__typename?: boolean | `@${string}`
}>;
	["DocumentsAggregatePaginationResult"]: AliasType<{
	/** Текущая страница */
	currentPage?:boolean | `@${string}`,
	/** Элементы текущей страницы */
	items?:ResolverInputTypes["DocumentPackageAggregate"],
	/** Общее количество элементов */
	totalCount?:boolean | `@${string}`,
	/** Общее количество страниц */
	totalPages?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["EditBranchInput"]: {
	/** Документ, на основании которого действует Уполномоченный (решение совета №СС-.. от ..) */
	based_on: string,
	/** Имя аккаунта кооперативного участка */
	braname: string,
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Электронная почта */
	email: string,
	/** Фактический адрес */
	fact_address: string,
	/** Полное имя организации кооперативного участка */
	full_name: string,
	/** Телефон */
	phone: string,
	/** Краткое имя организации кооперативного участка */
	short_name: string,
	/** Имя аккаунта уполномоченного (председателя) кооперативного участка */
	trustee: string
};
	["Entrepreneur"]: AliasType<{
	/** Дата рождения */
	birthdate?:boolean | `@${string}`,
	/** Город */
	city?:boolean | `@${string}`,
	/** Страна */
	country?:boolean | `@${string}`,
	/** Детали ИП (ИНН, ОГРН) */
	details?:ResolverInputTypes["EntrepreneurDetails"],
	/** Email */
	email?:boolean | `@${string}`,
	/** Имя */
	first_name?:boolean | `@${string}`,
	/** Юридический адрес */
	full_address?:boolean | `@${string}`,
	/** Фамилия */
	last_name?:boolean | `@${string}`,
	/** Отчество */
	middle_name?:boolean | `@${string}`,
	/** Телефон */
	phone?:boolean | `@${string}`,
	/** Имя аккаунта */
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["EntrepreneurCertificate"]: AliasType<{
	/** Имя */
	first_name?:boolean | `@${string}`,
	/** ИНН */
	inn?:boolean | `@${string}`,
	/** Фамилия */
	last_name?:boolean | `@${string}`,
	/** Отчество */
	middle_name?:boolean | `@${string}`,
	/** Тип аккаунта */
	type?:boolean | `@${string}`,
	/** Имя аккаунта */
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["EntrepreneurDetails"]: AliasType<{
	/** ИНН */
	inn?:boolean | `@${string}`,
	/** ОГРН */
	ogrn?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["EntrepreneurDetailsInput"]: {
	/** ИНН */
	inn: string,
	/** ОГРН */
	ogrn: string
};
	/** Расширенное действие блокчейна с сертификатом пользователя, совершившего его. */
["ExtendedBlockchainAction"]: AliasType<{
	account?:boolean | `@${string}`,
	account_ram_deltas?:ResolverInputTypes["AccountRamDelta"],
	action_ordinal?:boolean | `@${string}`,
	/** Сертификат пользователя (сокращенная информация) */
	actor_certificate?:ResolverInputTypes["UserCertificateUnion"],
	authorization?:ResolverInputTypes["ActionAuthorization"],
	block_id?:boolean | `@${string}`,
	block_num?:boolean | `@${string}`,
	chain_id?:boolean | `@${string}`,
	console?:boolean | `@${string}`,
	context_free?:boolean | `@${string}`,
	creator_action_ordinal?:boolean | `@${string}`,
	/** Данные действия в формате JSON */
	data?:boolean | `@${string}`,
	elapsed?:boolean | `@${string}`,
	global_sequence?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	receipt?:ResolverInputTypes["ActionReceipt"],
	receiver?:boolean | `@${string}`,
	transaction_id?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Расширенный статус собрания на основе дат и состояния */
["ExtendedMeetStatus"]:ExtendedMeetStatus;
	["Extension"]: AliasType<{
	/** Настройки конфигурации для расширения */
	config?:boolean | `@${string}`,
	/** Дата создания расширения */
	created_at?:boolean | `@${string}`,
	/** Описание расширения */
	description?:boolean | `@${string}`,
	/** Показывает, включено ли расширение */
	enabled?:boolean | `@${string}`,
	/** Внешняя ссылка на iframe-интерфейс расширения */
	external_url?:boolean | `@${string}`,
	/** Изображение для расширения */
	image?:boolean | `@${string}`,
	/** Поле инструкция для установки (INSTALL) */
	instructions?:boolean | `@${string}`,
	/** Показывает, доступно ли расширение */
	is_available?:boolean | `@${string}`,
	/** Показывает, встроенное ли это расширение */
	is_builtin?:boolean | `@${string}`,
	/** Показывает, рабочий стол ли это */
	is_desktop?:boolean | `@${string}`,
	/** Показывает, установлено ли расширение */
	is_installed?:boolean | `@${string}`,
	/** Показывает, внутреннее ли это расширение */
	is_internal?:boolean | `@${string}`,
	/** Уникальное имя расширения */
	name?:boolean | `@${string}`,
	/** Поле подробного текстового описания (README) */
	readme?:boolean | `@${string}`,
	/** Схема настроек конфигурации для расширения */
	schema?:boolean | `@${string}`,
	/** Массив тегов для расширения */
	tags?:boolean | `@${string}`,
	/** Заголовок расширения */
	title?:boolean | `@${string}`,
	/** Дата последнего обновления расширения */
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ExtensionInput"]: {
	/** Объект конфигурации расширения */
	config: ResolverInputTypes["JSON"],
	/** Дата установки расширения */
	created_at?: ResolverInputTypes["DateTime"] | undefined | null,
	/** Флаг того, включено ли расширение сейчас */
	enabled: boolean,
	/** Уникальное имя расширения (является идентификатором) */
	name: string,
	/** Дата обновления расширения */
	updated_at?: ResolverInputTypes["DateTime"] | undefined | null
};
	["FreeDecisionGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Идентификатор протокола решения собрания совета */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Идентификатор проекта решения */
	project_id: string,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["GatewayPayment"]: AliasType<{
	/** Данные из блокчейна */
	blockchain_data?:boolean | `@${string}`,
	/** Можно ли изменить статус */
	can_change_status?:boolean | `@${string}`,
	/** Название кооператива */
	coopname?:boolean | `@${string}`,
	/** Дата создания */
	created_at?:boolean | `@${string}`,
	/** Направление платежа */
	direction?:boolean | `@${string}`,
	/** Человекочитаемое направление платежа */
	direction_label?:boolean | `@${string}`,
	/** Дата истечения */
	expired_at?:boolean | `@${string}`,
	/** Форматированная сумма */
	formatted_amount?:boolean | `@${string}`,
	/** Хеш платежа */
	hash?:boolean | `@${string}`,
	/** Уникальный идентификатор платежа */
	id?:boolean | `@${string}`,
	/** Хеш входящего платежа (устарело) */
	income_hash?:boolean | `@${string}`,
	/** Завершен ли платеж окончательно */
	is_final?:boolean | `@${string}`,
	/** Дополнительная информация */
	memo?:boolean | `@${string}`,
	/** Сообщение */
	message?:boolean | `@${string}`,
	/** Хеш исходящего платежа (устарело) */
	outcome_hash?:boolean | `@${string}`,
	/** Детали платежа */
	payment_details?:ResolverInputTypes["PaymentDetails"],
	/** ID платежного метода */
	payment_method_id?:boolean | `@${string}`,
	/** Провайдер платежа */
	provider?:boolean | `@${string}`,
	/** Количество/сумма */
	quantity?:boolean | `@${string}`,
	/** Подписанный документ заявления */
	statement?:boolean | `@${string}`,
	/** Статус платежа */
	status?:boolean | `@${string}`,
	/** Человекочитаемый статус */
	status_label?:boolean | `@${string}`,
	/** Символ валюты */
	symbol?:boolean | `@${string}`,
	/** Тип платежа */
	type?:boolean | `@${string}`,
	/** Человекочитаемый тип платежа */
	type_label?:boolean | `@${string}`,
	/** Дата обновления */
	updated_at?:boolean | `@${string}`,
	/** Имя пользователя */
	username?:boolean | `@${string}`,
	/** Сертификат пользователя, создавшего платеж */
	username_certificate?:ResolverInputTypes["UserCertificateUnion"],
		__typename?: boolean | `@${string}`
}>;
	["GenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["GenerateDocumentOptionsInput"]: {
	/** Язык документа */
	lang?: string | undefined | null,
	/** Пропустить сохранение */
	skip_save?: boolean | undefined | null
};
	["GeneratedDocument"]: AliasType<{
	/** Бинарное содержимое документа (base64) */
	binary?:boolean | `@${string}`,
	/** Полное название документа */
	full_title?:boolean | `@${string}`,
	/** Хэш документа */
	hash?:boolean | `@${string}`,
	/** HTML содержимое документа */
	html?:boolean | `@${string}`,
	/** Метаданные документа */
	meta?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["GetAccountInput"]: {
	/** Имя аккаунта пользователя */
	username: string
};
	["GetAccountsInput"]: {
	role?: string | undefined | null
};
	["GetBranchesInput"]: {
	/** Фильтр по имени аккаунта кооперативного участка */
	braname?: string | undefined | null,
	/** Имя аккаунта кооператива */
	coopname: string
};
	["GetDocumentsInput"]: {
	filter: ResolverInputTypes["JSON"],
	limit?: number | undefined | null,
	page?: number | undefined | null,
	type?: string | undefined | null,
	username: string
};
	["GetExtensionsInput"]: {
	/** Фильтр включенных расширений */
	enabled?: boolean | undefined | null,
	/** Фильтр активности */
	is_available?: boolean | undefined | null,
	/** Фильтр рабочих столов */
	is_desktop?: boolean | undefined | null,
	/** Фильтр установленных расширений */
	is_installed?: boolean | undefined | null,
	/** Фильтр по имени */
	name?: string | undefined | null
};
	["GetMeetInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Хеш собрания */
	hash: string
};
	["GetMeetsInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string
};
	["GetPaymentMethodsInput"]: {
	/** Количество элементов на странице */
	limit: number,
	/** Номер страницы */
	page: number,
	/** Ключ сортировки (например, "name") */
	sortBy?: string | undefined | null,
	/** Направление сортировки ("ASC" или "DESC") */
	sortOrder: string,
	/** Имя пользователя для фильтрации методов оплаты */
	username?: string | undefined | null
};
	["Individual"]: AliasType<{
	/** Дата рождения */
	birthdate?:boolean | `@${string}`,
	/** Email */
	email?:boolean | `@${string}`,
	/** Имя */
	first_name?:boolean | `@${string}`,
	/** Полный адрес */
	full_address?:boolean | `@${string}`,
	/** Фамилия */
	last_name?:boolean | `@${string}`,
	/** Отчество */
	middle_name?:boolean | `@${string}`,
	/** Данные паспорта */
	passport?:ResolverInputTypes["Passport"],
	/** Телефон */
	phone?:boolean | `@${string}`,
	/** Имя аккаунта */
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["IndividualCertificate"]: AliasType<{
	/** Имя */
	first_name?:boolean | `@${string}`,
	/** Фамилия */
	last_name?:boolean | `@${string}`,
	/** Отчество */
	middle_name?:boolean | `@${string}`,
	/** Тип аккаунта */
	type?:boolean | `@${string}`,
	/** Имя аккаунта */
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["Init"]: {
	/** Объект организации кооператива, которая обслуживает данный экземпляр программного обеспечения MONO */
	organization_data: ResolverInputTypes["CreateOrganizationDataInput"],
	/** Переменные кооператива, используемые для заполнения шаблонов документов */
	vars: ResolverInputTypes["VarsInput"]
};
	["Install"]: {
	soviet: Array<ResolverInputTypes["SovietMemberInput"]>,
	wif: string
};
	/** The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
["JSON"]:unknown;
	/** The `JSONObject` scalar type represents JSON objects as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
["JSONObject"]:unknown;
	["KeyWeight"]: AliasType<{
	/** Ключ */
	key?:boolean | `@${string}`,
	/** Вес */
	weight?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["LoginInput"]: {
	/** Электронная почта */
	email: string,
	/** Метка времени в строковом формате ISO */
	now: string,
	/** Цифровая подпись метки времени */
	signature: string
};
	["LogoutInput"]: {
	/** Токен обновления */
	access_token: string,
	/** Токен доступа */
	refresh_token: string
};
	/** Данные о собрании кооператива */
["Meet"]: AliasType<{
	/** Документ с решением совета о проведении собрания */
	authorization?:ResolverInputTypes["DocumentAggregate"],
	/** Дата закрытия собрания */
	close_at?:boolean | `@${string}`,
	/** Имя аккаунта кооператива */
	coopname?:boolean | `@${string}`,
	/** Дата создания собрания */
	created_at?:boolean | `@${string}`,
	/** Текущий процент кворума */
	current_quorum_percent?:boolean | `@${string}`,
	/** Цикл собрания */
	cycle?:boolean | `@${string}`,
	/** Документ с решением секретаря */
	decision1?:ResolverInputTypes["DocumentAggregate"],
	/** Документ с решением председателя */
	decision2?:ResolverInputTypes["DocumentAggregate"],
	/** Хеш собрания */
	hash?:boolean | `@${string}`,
	/** Уникальный идентификатор собрания */
	id?:boolean | `@${string}`,
	/** Инициатор собрания */
	initiator?:boolean | `@${string}`,
	/** Сертификат инициатора собрания */
	initiator_certificate?:ResolverInputTypes["UserCertificateUnion"],
	/** Уровень собрания */
	level?:boolean | `@${string}`,
	/** Список пользователей, которые подписали уведомление */
	notified_users?:boolean | `@${string}`,
	/** Дата открытия собрания */
	open_at?:boolean | `@${string}`,
	/** Председатель собрания */
	presider?:boolean | `@${string}`,
	/** Сертификат председателя собрания */
	presider_certificate?:ResolverInputTypes["UserCertificateUnion"],
	/** Документ с повесткой собрания */
	proposal?:ResolverInputTypes["DocumentAggregate"],
	/** Флаг достижения кворума */
	quorum_passed?:boolean | `@${string}`,
	/** Процент необходимого кворума */
	quorum_percent?:boolean | `@${string}`,
	/** Секретарь собрания */
	secretary?:boolean | `@${string}`,
	/** Сертификат секретаря собрания */
	secretary_certificate?:ResolverInputTypes["UserCertificateUnion"],
	/** Количество подписанных бюллетеней */
	signed_ballots?:boolean | `@${string}`,
	/** Статус собрания */
	status?:boolean | `@${string}`,
	/** Тип собрания */
	type?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Агрегат данных о собрании, содержащий информацию о разных этапах */
["MeetAggregate"]: AliasType<{
	/** Хеш собрания */
	hash?:boolean | `@${string}`,
	/** Данные собрания на этапе предварительной обработки */
	pre?:ResolverInputTypes["MeetPreProcessing"],
	/** Данные собрания после обработки */
	processed?:ResolverInputTypes["MeetProcessed"],
	/** Данные собрания на этапе обработки */
	processing?:ResolverInputTypes["MeetProcessing"],
		__typename?: boolean | `@${string}`
}>;
	/** Предварительные данные собрания перед обработкой */
["MeetPreProcessing"]: AliasType<{
	/** Повестка собрания */
	agenda?:ResolverInputTypes["AgendaMeetPoint"],
	/** Дата закрытия собрания */
	close_at?:boolean | `@${string}`,
	/** Имя аккаунта кооператива */
	coopname?:boolean | `@${string}`,
	/** Хеш собрания */
	hash?:boolean | `@${string}`,
	/** Инициатор собрания */
	initiator?:boolean | `@${string}`,
	/** Сертификат инициатора собрания */
	initiator_certificate?:ResolverInputTypes["UserCertificateUnion"],
	/** Дата открытия собрания */
	open_at?:boolean | `@${string}`,
	/** Председатель собрания */
	presider?:boolean | `@${string}`,
	/** Сертификат председателя собрания */
	presider_certificate?:ResolverInputTypes["UserCertificateUnion"],
	/** Документ с предложением повестки собрания */
	proposal?:ResolverInputTypes["DocumentAggregate"],
	/** Секретарь собрания */
	secretary?:boolean | `@${string}`,
	/** Сертификат секретаря собрания */
	secretary_certificate?:ResolverInputTypes["UserCertificateUnion"],
		__typename?: boolean | `@${string}`
}>;
	/** Данные о собрании после обработки */
["MeetProcessed"]: AliasType<{
	/** Имя кооператива */
	coopname?:boolean | `@${string}`,
	/** Документ решения из блокчейна */
	decision?:ResolverInputTypes["SignedDigitalDocument"],
	/** Агрегат документа решения */
	decisionAggregate?:ResolverInputTypes["DocumentAggregate"],
	/** Хеш собрания */
	hash?:boolean | `@${string}`,
	/** Председатель собрания */
	presider?:boolean | `@${string}`,
	/** Сертификат председателя собрания */
	presider_certificate?:ResolverInputTypes["UserCertificateUnion"],
	/** Пройден ли кворум */
	quorum_passed?:boolean | `@${string}`,
	/** Процент кворума */
	quorum_percent?:boolean | `@${string}`,
	/** Результаты голосования по вопросам */
	results?:ResolverInputTypes["MeetQuestionResult"],
	/** Секретарь собрания */
	secretary?:boolean | `@${string}`,
	/** Сертификат секретаря собрания */
	secretary_certificate?:ResolverInputTypes["UserCertificateUnion"],
	/** Количество подписанных бюллетеней */
	signed_ballots?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Данные о собрании в процессе обработки */
["MeetProcessing"]: AliasType<{
	/** Расширенный статус собрания на основе дат и состояния */
	extendedStatus?:boolean | `@${string}`,
	/** Хеш собрания */
	hash?:boolean | `@${string}`,
	/** Флаг указывающий, голосовал ли текущий пользователь */
	isVoted?:boolean | `@${string}`,
	/** Основная информация о собрании */
	meet?:ResolverInputTypes["Meet"],
	/** Список вопросов повестки собрания */
	questions?:ResolverInputTypes["Question"],
		__typename?: boolean | `@${string}`
}>;
	/** Результат голосования по вопросу */
["MeetQuestionResult"]: AliasType<{
	/** Принят ли вопрос */
	accepted?:boolean | `@${string}`,
	/** Контекст вопроса */
	context?:boolean | `@${string}`,
	/** Принятое решение */
	decision?:boolean | `@${string}`,
	/** Порядковый номер вопроса */
	number?:boolean | `@${string}`,
	/** Идентификатор вопроса */
	question_id?:boolean | `@${string}`,
	/** Заголовок вопроса */
	title?:boolean | `@${string}`,
	/** Количество воздержавшихся */
	votes_abstained?:boolean | `@${string}`,
	/** Количество голосов против */
	votes_against?:boolean | `@${string}`,
	/** Количество голосов за */
	votes_for?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["MetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** ID документа в реестре */
	registry_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["ModerateRequestInput"]: {
	/** Размер комиссии за отмену в формате "10.0000 RUB" */
	cancellation_fee: string,
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Идентификатор обмена */
	exchange_id: number,
	/** Имя аккаунта пользователя */
	username: string
};
	["MonoAccount"]: AliasType<{
	/** Электронная почта пользователя */
	email?:boolean | `@${string}`,
	/** Есть ли у пользователя аккаунт */
	has_account?:boolean | `@${string}`,
	/** ID начального заказа */
	initial_order?:boolean | `@${string}`,
	/** Подтверждена ли электронная почта */
	is_email_verified?:boolean | `@${string}`,
	/** Зарегистрирован ли пользователь */
	is_registered?:boolean | `@${string}`,
	/** Сообщение */
	message?:boolean | `@${string}`,
	/** Публичный ключ пользователя */
	public_key?:boolean | `@${string}`,
	/** Реферер пользователя */
	referer?:boolean | `@${string}`,
	/** Роль пользователя */
	role?:boolean | `@${string}`,
	/** Статус пользователя */
	status?:boolean | `@${string}`,
	/** Хэш подписчика для уведомлений */
	subscriber_hash?:boolean | `@${string}`,
	/** Идентификатор подписчика для уведомлений */
	subscriber_id?:boolean | `@${string}`,
	/** Тип пользователя */
	type?:boolean | `@${string}`,
	/** Имя пользователя */
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["Mutation"]: AliasType<{
acceptChildOrder?: [{	data: ResolverInputTypes["AcceptChildOrderInput"]},ResolverInputTypes["Transaction"]],
addParticipant?: [{	data: ResolverInputTypes["AddParticipantInput"]},ResolverInputTypes["Account"]],
addTrustedAccount?: [{	data: ResolverInputTypes["AddTrustedAccountInput"]},ResolverInputTypes["Branch"]],
cancelRequest?: [{	data: ResolverInputTypes["CancelRequestInput"]},ResolverInputTypes["Transaction"]],
completeRequest?: [{	data: ResolverInputTypes["CompleteRequestInput"]},ResolverInputTypes["Transaction"]],
confirmReceiveOnRequest?: [{	data: ResolverInputTypes["ConfirmReceiveOnRequestInput"]},ResolverInputTypes["Transaction"]],
confirmSupplyOnRequest?: [{	data: ResolverInputTypes["ConfirmSupplyOnRequestInput"]},ResolverInputTypes["Transaction"]],
createAnnualGeneralMeet?: [{	data: ResolverInputTypes["CreateAnnualGeneralMeetInput"]},ResolverInputTypes["MeetAggregate"]],
createBankAccount?: [{	data: ResolverInputTypes["CreateBankAccountInput"]},ResolverInputTypes["PaymentMethod"]],
createBranch?: [{	data: ResolverInputTypes["CreateBranchInput"]},ResolverInputTypes["Branch"]],
createChildOrder?: [{	data: ResolverInputTypes["CreateChildOrderInput"]},ResolverInputTypes["Transaction"]],
createDepositPayment?: [{	data: ResolverInputTypes["CreateDepositPaymentInput"]},ResolverInputTypes["GatewayPayment"]],
createInitialPayment?: [{	data: ResolverInputTypes["CreateInitialPaymentInput"]},ResolverInputTypes["GatewayPayment"]],
createParentOffer?: [{	data: ResolverInputTypes["CreateParentOfferInput"]},ResolverInputTypes["Transaction"]],
createProjectOfFreeDecision?: [{	data: ResolverInputTypes["CreateProjectFreeDecisionInput"]},ResolverInputTypes["CreatedProjectFreeDecision"]],
createWithdraw?: [{	input: ResolverInputTypes["CreateWithdrawInput"]},ResolverInputTypes["CreateWithdrawResponse"]],
declineRequest?: [{	data: ResolverInputTypes["DeclineRequestInput"]},ResolverInputTypes["Transaction"]],
deleteBranch?: [{	data: ResolverInputTypes["DeleteBranchInput"]},boolean | `@${string}`],
deletePaymentMethod?: [{	data: ResolverInputTypes["DeletePaymentMethodInput"]},boolean | `@${string}`],
deleteTrustedAccount?: [{	data: ResolverInputTypes["DeleteTrustedAccountInput"]},ResolverInputTypes["Branch"]],
deliverOnRequest?: [{	data: ResolverInputTypes["DeliverOnRequestInput"]},ResolverInputTypes["Transaction"]],
disputeOnRequest?: [{	data: ResolverInputTypes["DisputeOnRequestInput"]},ResolverInputTypes["Transaction"]],
editBranch?: [{	data: ResolverInputTypes["EditBranchInput"]},ResolverInputTypes["Branch"]],
generateAnnualGeneralMeetAgendaDocument?: [{	data: ResolverInputTypes["AnnualGeneralMeetingAgendaGenerateDocumentInput"],	options?: ResolverInputTypes["GenerateDocumentOptionsInput"] | undefined | null},ResolverInputTypes["GeneratedDocument"]],
generateAnnualGeneralMeetDecisionDocument?: [{	data: ResolverInputTypes["AnnualGeneralMeetingDecisionGenerateDocumentInput"],	options?: ResolverInputTypes["GenerateDocumentOptionsInput"] | undefined | null},ResolverInputTypes["GeneratedDocument"]],
generateAnnualGeneralMeetNotificationDocument?: [{	data: ResolverInputTypes["AnnualGeneralMeetingNotificationGenerateDocumentInput"],	options?: ResolverInputTypes["GenerateDocumentOptionsInput"] | undefined | null},ResolverInputTypes["GeneratedDocument"]],
generateAssetContributionAct?: [{	data: ResolverInputTypes["AssetContributionActGenerateDocumentInput"],	options?: ResolverInputTypes["GenerateDocumentOptionsInput"] | undefined | null},ResolverInputTypes["GeneratedDocument"]],
generateAssetContributionDecision?: [{	data: ResolverInputTypes["AssetContributionDecisionGenerateDocumentInput"],	options?: ResolverInputTypes["GenerateDocumentOptionsInput"] | undefined | null},ResolverInputTypes["GeneratedDocument"]],
generateAssetContributionStatement?: [{	data: ResolverInputTypes["AssetContributionStatementGenerateDocumentInput"],	options?: ResolverInputTypes["GenerateDocumentOptionsInput"] | undefined | null},ResolverInputTypes["GeneratedDocument"]],
generateBallotForAnnualGeneralMeetDocument?: [{	data: ResolverInputTypes["AnnualGeneralMeetingVotingBallotGenerateDocumentInput"],	options?: ResolverInputTypes["GenerateDocumentOptionsInput"] | undefined | null},ResolverInputTypes["GeneratedDocument"]],
generateFreeDecision?: [{	data: ResolverInputTypes["FreeDecisionGenerateDocumentInput"],	options?: ResolverInputTypes["GenerateDocumentOptionsInput"] | undefined | null},ResolverInputTypes["GeneratedDocument"]],
generateParticipantApplication?: [{	data: ResolverInputTypes["ParticipantApplicationGenerateDocumentInput"],	options?: ResolverInputTypes["GenerateDocumentOptionsInput"] | undefined | null},ResolverInputTypes["GeneratedDocument"]],
generateParticipantApplicationDecision?: [{	data: ResolverInputTypes["ParticipantApplicationDecisionGenerateDocumentInput"],	options?: ResolverInputTypes["GenerateDocumentOptionsInput"] | undefined | null},ResolverInputTypes["GeneratedDocument"]],
generatePrivacyAgreement?: [{	data: ResolverInputTypes["GenerateDocumentInput"],	options?: ResolverInputTypes["GenerateDocumentOptionsInput"] | undefined | null},ResolverInputTypes["GeneratedDocument"]],
generateProjectOfFreeDecision?: [{	data: ResolverInputTypes["ProjectFreeDecisionGenerateDocumentInput"],	options?: ResolverInputTypes["GenerateDocumentOptionsInput"] | undefined | null},ResolverInputTypes["GeneratedDocument"]],
generateReturnByAssetAct?: [{	data: ResolverInputTypes["ReturnByAssetActGenerateDocumentInput"],	options?: ResolverInputTypes["GenerateDocumentOptionsInput"] | undefined | null},ResolverInputTypes["GeneratedDocument"]],
generateReturnByAssetDecision?: [{	data: ResolverInputTypes["ReturnByAssetDecisionGenerateDocumentInput"],	options?: ResolverInputTypes["GenerateDocumentOptionsInput"] | undefined | null},ResolverInputTypes["GeneratedDocument"]],
generateReturnByAssetStatement?: [{	data: ResolverInputTypes["ReturnByAssetStatementGenerateDocumentInput"],	options?: ResolverInputTypes["GenerateDocumentOptionsInput"] | undefined | null},ResolverInputTypes["GeneratedDocument"]],
generateReturnByMoneyDecisionDocument?: [{	data: ResolverInputTypes["ReturnByMoneyDecisionGenerateDocumentInput"],	options?: ResolverInputTypes["GenerateDocumentOptionsInput"] | undefined | null},ResolverInputTypes["GeneratedDocument"]],
generateReturnByMoneyStatementDocument?: [{	data: ResolverInputTypes["ReturnByMoneyGenerateDocumentInput"],	options?: ResolverInputTypes["GenerateDocumentOptionsInput"] | undefined | null},ResolverInputTypes["GeneratedDocument"]],
generateSelectBranchDocument?: [{	data: ResolverInputTypes["SelectBranchGenerateDocumentInput"],	options?: ResolverInputTypes["GenerateDocumentOptionsInput"] | undefined | null},ResolverInputTypes["GeneratedDocument"]],
generateSignatureAgreement?: [{	data: ResolverInputTypes["GenerateDocumentInput"],	options?: ResolverInputTypes["GenerateDocumentOptionsInput"] | undefined | null},ResolverInputTypes["GeneratedDocument"]],
generateSovietDecisionOnAnnualMeetDocument?: [{	data: ResolverInputTypes["AnnualGeneralMeetingSovietDecisionGenerateDocumentInput"],	options?: ResolverInputTypes["GenerateDocumentOptionsInput"] | undefined | null},ResolverInputTypes["GeneratedDocument"]],
generateUserAgreement?: [{	data: ResolverInputTypes["GenerateDocumentInput"],	options?: ResolverInputTypes["GenerateDocumentOptionsInput"] | undefined | null},ResolverInputTypes["GeneratedDocument"]],
generateWalletAgreement?: [{	data: ResolverInputTypes["GenerateDocumentInput"],	options?: ResolverInputTypes["GenerateDocumentOptionsInput"] | undefined | null},ResolverInputTypes["GeneratedDocument"]],
initSystem?: [{	data: ResolverInputTypes["Init"]},ResolverInputTypes["SystemInfo"]],
installExtension?: [{	data: ResolverInputTypes["ExtensionInput"]},ResolverInputTypes["Extension"]],
installSystem?: [{	data: ResolverInputTypes["Install"]},ResolverInputTypes["SystemInfo"]],
login?: [{	data: ResolverInputTypes["LoginInput"]},ResolverInputTypes["RegisteredAccount"]],
logout?: [{	data: ResolverInputTypes["LogoutInput"]},boolean | `@${string}`],
moderateRequest?: [{	data: ResolverInputTypes["ModerateRequestInput"]},ResolverInputTypes["Transaction"]],
notifyOnAnnualGeneralMeet?: [{	data: ResolverInputTypes["NotifyOnAnnualGeneralMeetInput"]},ResolverInputTypes["MeetAggregate"]],
prohibitRequest?: [{	data: ResolverInputTypes["ProhibitRequestInput"]},ResolverInputTypes["Transaction"]],
publishProjectOfFreeDecision?: [{	data: ResolverInputTypes["PublishProjectFreeDecisionInput"]},boolean | `@${string}`],
publishRequest?: [{	data: ResolverInputTypes["PublishRequestInput"]},ResolverInputTypes["Transaction"]],
receiveOnRequest?: [{	data: ResolverInputTypes["ReceiveOnRequestInput"]},ResolverInputTypes["Transaction"]],
refresh?: [{	data: ResolverInputTypes["RefreshInput"]},ResolverInputTypes["RegisteredAccount"]],
registerAccount?: [{	data: ResolverInputTypes["RegisterAccountInput"]},ResolverInputTypes["RegisteredAccount"]],
registerParticipant?: [{	data: ResolverInputTypes["RegisterParticipantInput"]},ResolverInputTypes["Account"]],
resetKey?: [{	data: ResolverInputTypes["ResetKeyInput"]},boolean | `@${string}`],
restartAnnualGeneralMeet?: [{	data: ResolverInputTypes["RestartAnnualGeneralMeetInput"]},ResolverInputTypes["MeetAggregate"]],
selectBranch?: [{	data: ResolverInputTypes["SelectBranchInput"]},boolean | `@${string}`],
setPaymentStatus?: [{	data: ResolverInputTypes["SetPaymentStatusInput"]},ResolverInputTypes["GatewayPayment"]],
setWif?: [{	data: ResolverInputTypes["SetWifInput"]},boolean | `@${string}`],
signByPresiderOnAnnualGeneralMeet?: [{	data: ResolverInputTypes["SignByPresiderOnAnnualGeneralMeetInput"]},ResolverInputTypes["MeetAggregate"]],
signBySecretaryOnAnnualGeneralMeet?: [{	data: ResolverInputTypes["SignBySecretaryOnAnnualGeneralMeetInput"]},ResolverInputTypes["MeetAggregate"]],
startResetKey?: [{	data: ResolverInputTypes["StartResetKeyInput"]},boolean | `@${string}`],
supplyOnRequest?: [{	data: ResolverInputTypes["SupplyOnRequestInput"]},ResolverInputTypes["Transaction"]],
uninstallExtension?: [{	data: ResolverInputTypes["UninstallExtensionInput"]},boolean | `@${string}`],
unpublishRequest?: [{	data: ResolverInputTypes["UnpublishRequestInput"]},ResolverInputTypes["Transaction"]],
updateAccount?: [{	data: ResolverInputTypes["UpdateAccountInput"]},ResolverInputTypes["Account"]],
updateBankAccount?: [{	data: ResolverInputTypes["UpdateBankAccountInput"]},ResolverInputTypes["PaymentMethod"]],
updateExtension?: [{	data: ResolverInputTypes["ExtensionInput"]},ResolverInputTypes["Extension"]],
updateRequest?: [{	data: ResolverInputTypes["UpdateRequestInput"]},ResolverInputTypes["Transaction"]],
updateSystem?: [{	data: ResolverInputTypes["Update"]},ResolverInputTypes["SystemInfo"]],
voteOnAnnualGeneralMeet?: [{	data: ResolverInputTypes["VoteOnAnnualGeneralMeetInput"]},ResolverInputTypes["MeetAggregate"]],
		__typename?: boolean | `@${string}`
}>;
	["NotifyOnAnnualGeneralMeetInput"]: {
	coopname: string,
	meet_hash: string,
	notification: ResolverInputTypes["AnnualGeneralMeetingNotificationSignedDocumentInput"],
	username: string
};
	["Organization"]: AliasType<{
	/** Город */
	city?:boolean | `@${string}`,
	/** Страна */
	country?:boolean | `@${string}`,
	/** Детали организации */
	details?:ResolverInputTypes["OrganizationDetails"],
	/** Email */
	email?:boolean | `@${string}`,
	/** Фактический адрес */
	fact_address?:boolean | `@${string}`,
	/** Юридический адрес */
	full_address?:boolean | `@${string}`,
	/** Полное название */
	full_name?:boolean | `@${string}`,
	/** Телефон */
	phone?:boolean | `@${string}`,
	/** Представитель организации */
	represented_by?:ResolverInputTypes["RepresentedBy"],
	/** Краткое название */
	short_name?:boolean | `@${string}`,
	/** Тип организации */
	type?:boolean | `@${string}`,
	/** Имя аккаунта организации */
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["OrganizationCertificate"]: AliasType<{
	/** ИНН */
	inn?:boolean | `@${string}`,
	/** ОГРН */
	ogrn?:boolean | `@${string}`,
	/** Данные представителя */
	represented_by?:ResolverInputTypes["RepresentedByCertificate"],
	/** Короткое название организации */
	short_name?:boolean | `@${string}`,
	/** Тип аккаунта */
	type?:boolean | `@${string}`,
	/** Имя аккаунта */
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["OrganizationDetails"]: AliasType<{
	/** ИНН */
	inn?:boolean | `@${string}`,
	/** КПП */
	kpp?:boolean | `@${string}`,
	/** ОГРН */
	ogrn?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["OrganizationDetailsInput"]: {
	inn: string,
	kpp: string,
	ogrn: string
};
	/** Тип юридического лица */
["OrganizationType"]:OrganizationType;
	["PaginatedGatewayPaymentsPaginationResult"]: AliasType<{
	/** Текущая страница */
	currentPage?:boolean | `@${string}`,
	/** Элементы текущей страницы */
	items?:ResolverInputTypes["GatewayPayment"],
	/** Общее количество элементов */
	totalCount?:boolean | `@${string}`,
	/** Общее количество страниц */
	totalPages?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["PaginationInput"]: {
	/** Количество элементов на странице */
	limit: number,
	/** Номер страницы */
	page: number,
	/** Ключ сортировки (например, "name") */
	sortBy?: string | undefined | null,
	/** Направление сортировки ("ASC" или "DESC") */
	sortOrder: string
};
	["ParticipantAccount"]: AliasType<{
	/** Имя кооперативного участка */
	braname?:boolean | `@${string}`,
	/** Время создания записи о члене */
	created_at?:boolean | `@${string}`,
	/** LEGACY Флаг, имеет ли член право голоса */
	has_vote?:boolean | `@${string}`,
	/** Сумма вступительного взноса */
	initial_amount?:boolean | `@${string}`,
	/** LEGACY Флаг, внесен ли регистрационный взнос */
	is_initial?:boolean | `@${string}`,
	/** LEGACY Флаг, внесен ли минимальный паевый взнос */
	is_minimum?:boolean | `@${string}`,
	/** Время последнего минимального платежа */
	last_min_pay?:boolean | `@${string}`,
	/** Время последнего обновления информации о члене */
	last_update?:boolean | `@${string}`,
	/** Сумма минимального паевого взноса */
	minimum_amount?:boolean | `@${string}`,
	/** Статус члена кооператива (accepted | blocked) */
	status?:boolean | `@${string}`,
	/** Тип участника (individual | entrepreneur | organization) */
	type?:boolean | `@${string}`,
	/** Уникальное имя члена кооператива */
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ParticipantApplicationDecisionGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Идентификатор протокола решения собрания совета */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["ParticipantApplicationGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Имя аккаунта кооперативного участка */
	braname: string,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Изображение собственноручной подписи (base-64) */
	signature?: string | undefined | null,
	/** Флаг пропуска сохранения документа (используется для предварительной генерации и демонстрации пользователю) */
	skip_save: boolean,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["ParticipantApplicationSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	meta: ResolverInputTypes["ParticipantApplicationSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<ResolverInputTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["ParticipantApplicationSignedMetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Имя аккаунта кооперативного участка */
	braname: string,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** ID документа в реестре */
	registry_id: number,
	/** Изображение собственноручной подписи (base-64) */
	signature?: string | undefined | null,
	/** Флаг пропуска сохранения документа (используется для предварительной генерации и демонстрации пользователю) */
	skip_save: boolean,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["Passport"]: AliasType<{
	/** Код подразделения */
	code?:boolean | `@${string}`,
	/** Дата выдачи */
	issued_at?:boolean | `@${string}`,
	/** Кем выдан */
	issued_by?:boolean | `@${string}`,
	/** Номер паспорта */
	number?:boolean | `@${string}`,
	/** Серия паспорта */
	series?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["PassportInput"]: {
	code: string,
	issued_at: string,
	issued_by: string,
	number: number,
	series: number
};
	["PaymentDetails"]: AliasType<{
	/** Сумма платежа с учетом комиссии */
	amount_plus_fee?:boolean | `@${string}`,
	/** Сумма платежа без учета комиссии */
	amount_without_fee?:boolean | `@${string}`,
	/** Данные платежа (QR-код, токен, реквизиты и т.д.) */
	data?:boolean | `@${string}`,
	/** Фактический процент комиссии */
	fact_fee_percent?:boolean | `@${string}`,
	/** Размер комиссии в абсолютных значениях */
	fee_amount?:boolean | `@${string}`,
	/** Процент комиссии */
	fee_percent?:boolean | `@${string}`,
	/** Допустимый процент отклонения */
	tolerance_percent?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Направление платежа */
["PaymentDirection"]:PaymentDirection;
	["PaymentFiltersInput"]: {
	/** Название кооператива */
	coopname?: string | undefined | null,
	/** Направление платежа */
	direction?: ResolverInputTypes["PaymentDirection"] | undefined | null,
	/** Хэш платежа */
	hash?: string | undefined | null,
	/** Провайдер платежа */
	provider?: string | undefined | null,
	/** Статус платежа */
	status?: ResolverInputTypes["PaymentStatus"] | undefined | null,
	/** Тип платежа */
	type?: ResolverInputTypes["PaymentType"] | undefined | null,
	/** Имя пользователя */
	username?: string | undefined | null
};
	["PaymentMethod"]: AliasType<{
	/** Дата создания */
	created_at?:boolean | `@${string}`,
	/** Данные метода оплаты */
	data?:ResolverInputTypes["PaymentMethodData"],
	/** Флаг основного метода платежа, который отображается в документах */
	is_default?:boolean | `@${string}`,
	/** Идентификатор метода оплаты */
	method_id?:boolean | `@${string}`,
	/** Тип метода оплаты (например, sbp, bank_transfer) */
	method_type?:boolean | `@${string}`,
	/** Дата обновления */
	updated_at?:boolean | `@${string}`,
	/** Имя пользователя, к которому привязан метод оплаты */
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["PaymentMethodData"]: AliasType<{
	BankAccount?:ResolverInputTypes["BankAccount"],
	SbpAccount?:ResolverInputTypes["SbpAccount"],
		__typename?: boolean | `@${string}`
}>;
	["PaymentMethodPaginationResult"]: AliasType<{
	/** Текущая страница */
	currentPage?:boolean | `@${string}`,
	/** Элементы текущей страницы */
	items?:ResolverInputTypes["PaymentMethod"],
	/** Общее количество элементов */
	totalCount?:boolean | `@${string}`,
	/** Общее количество страниц */
	totalPages?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Статус платежа */
["PaymentStatus"]:PaymentStatus;
	/** Тип платежа по назначению */
["PaymentType"]:PaymentType;
	["Permission"]: AliasType<{
	/** Родительское разрешение */
	parent?:boolean | `@${string}`,
	/** Имя разрешения */
	perm_name?:boolean | `@${string}`,
	/** Требуемые разрешения */
	required_auth?:ResolverInputTypes["Authority"],
		__typename?: boolean | `@${string}`
}>;
	["PermissionLevel"]: AliasType<{
	/** Актор */
	actor?:boolean | `@${string}`,
	/** Разрешение */
	permission?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["PermissionLevelWeight"]: AliasType<{
	/** Уровень разрешения */
	permission?:ResolverInputTypes["PermissionLevel"],
	/** Вес */
	weight?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["PrivateAccount"]: AliasType<{
	entrepreneur_data?:ResolverInputTypes["Entrepreneur"],
	individual_data?:ResolverInputTypes["Individual"],
	organization_data?:ResolverInputTypes["Organization"],
	/** Тип аккаунта */
	type?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["PrivateAccountSearchData"]: AliasType<{
	Entrepreneur?:ResolverInputTypes["Entrepreneur"],
	Individual?:ResolverInputTypes["Individual"],
	Organization?:ResolverInputTypes["Organization"],
		__typename?: boolean | `@${string}`
}>;
	["PrivateAccountSearchResult"]: AliasType<{
	/** Данные найденного аккаунта */
	data?:ResolverInputTypes["PrivateAccountSearchData"],
	/** Поля, в которых найдены совпадения */
	highlightedFields?:boolean | `@${string}`,
	/** Оценка релевантности результата */
	score?:boolean | `@${string}`,
	/** Тип аккаунта */
	type?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ProhibitRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Идентификатор обмена */
	exchange_id: number,
	/** Дополнительная информация о отклоненной модерации */
	meta: string,
	/** Имя аккаунта пользователя */
	username: string
};
	["ProjectFreeDecisionGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Идентификатор проекта решения */
	project_id: string,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["ProjectFreeDecisionSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация для создания проекта свободного решения */
	meta: ResolverInputTypes["ProjectFreeDecisionSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<ResolverInputTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["ProjectFreeDecisionSignedMetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** Идентификатор проекта решения */
	project_id: string,
	/** ID документа в реестре */
	registry_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["PublicChairman"]: AliasType<{
	first_name?:boolean | `@${string}`,
	last_name?:boolean | `@${string}`,
	middle_name?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["PublishProjectFreeDecisionInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Подписанный электронный документ (generateProjectOfFreeDecision) */
	document: ResolverInputTypes["ProjectFreeDecisionSignedDocumentInput"],
	/** Строка мета-информации */
	meta: string,
	/** Имя аккаунта пользователя */
	username: string
};
	["PublishRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Идентификатор заявки */
	exchange_id: number,
	/** Имя аккаунта пользователя */
	username: string
};
	["Query"]: AliasType<{
getAccount?: [{	data: ResolverInputTypes["GetAccountInput"]},ResolverInputTypes["Account"]],
getAccounts?: [{	data?: ResolverInputTypes["GetAccountsInput"] | undefined | null,	options?: ResolverInputTypes["PaginationInput"] | undefined | null},ResolverInputTypes["AccountsPaginationResult"]],
	/** Получить список вопросов совета кооператива для голосования */
	getAgenda?:ResolverInputTypes["AgendaWithDocuments"],
getBranches?: [{	data: ResolverInputTypes["GetBranchesInput"]},ResolverInputTypes["Branch"]],
	/** Получить состав приложений рабочего стола */
	getDesktop?:ResolverInputTypes["Desktop"],
getDocuments?: [{	data: ResolverInputTypes["GetDocumentsInput"]},ResolverInputTypes["DocumentsAggregatePaginationResult"]],
getExtensions?: [{	data?: ResolverInputTypes["GetExtensionsInput"] | undefined | null},ResolverInputTypes["Extension"]],
getMeet?: [{	data: ResolverInputTypes["GetMeetInput"]},ResolverInputTypes["MeetAggregate"]],
getMeets?: [{	data: ResolverInputTypes["GetMeetsInput"]},ResolverInputTypes["MeetAggregate"]],
getPaymentMethods?: [{	data?: ResolverInputTypes["GetPaymentMethodsInput"] | undefined | null},ResolverInputTypes["PaymentMethodPaginationResult"]],
getPayments?: [{	data?: ResolverInputTypes["PaymentFiltersInput"] | undefined | null,	options?: ResolverInputTypes["PaginationInput"] | undefined | null},ResolverInputTypes["PaginatedGatewayPaymentsPaginationResult"]],
	/** Получить сводную публичную информацию о системе */
	getSystemInfo?:ResolverInputTypes["SystemInfo"],
searchPrivateAccounts?: [{	data: ResolverInputTypes["SearchPrivateAccountsInput"]},ResolverInputTypes["PrivateAccountSearchResult"]],
		__typename?: boolean | `@${string}`
}>;
	/** Вопрос повестки собрания с результатами голосования */
["Question"]: AliasType<{
	/** Контекст или дополнительная информация по вопросу */
	context?:boolean | `@${string}`,
	/** Имя аккаунта кооператива */
	coopname?:boolean | `@${string}`,
	/** Количество голосов "Воздержался" */
	counter_votes_abstained?:boolean | `@${string}`,
	/** Количество голосов "Против" */
	counter_votes_against?:boolean | `@${string}`,
	/** Количество голосов "За" */
	counter_votes_for?:boolean | `@${string}`,
	/** Предлагаемое решение по вопросу */
	decision?:boolean | `@${string}`,
	/** Уникальный идентификатор вопроса */
	id?:boolean | `@${string}`,
	/** Идентификатор собрания, к которому относится вопрос */
	meet_id?:boolean | `@${string}`,
	/** Порядковый номер вопроса в повестке */
	number?:boolean | `@${string}`,
	/** Заголовок вопроса */
	title?:boolean | `@${string}`,
	/** Список участников, проголосовавших "Воздержался" */
	voters_abstained?:boolean | `@${string}`,
	/** Список участников, проголосовавших "Против" */
	voters_against?:boolean | `@${string}`,
	/** Список участников, проголосовавших "За" */
	voters_for?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ReceiveOnRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Подписанный Заказчиком акт приёмки-передачи имущества из Кооператива по новации */
	document: ResolverInputTypes["ReturnByAssetActSignedDocumentInput"],
	/** Идентификатор заявки */
	exchange_id: number,
	/** Имя аккаунта пользователя */
	username: string
};
	["RefreshInput"]: {
	/** Токен доступа */
	access_token: string,
	/** Токен обновления */
	refresh_token: string
};
	["RefundRequest"]: AliasType<{
	/** Сумма CPU */
	cpu_amount?:boolean | `@${string}`,
	/** Сумма сети */
	net_amount?:boolean | `@${string}`,
	/** Владелец */
	owner?:boolean | `@${string}`,
	/** Время запроса */
	request_time?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["RegisterAccountInput"]: {
	/** Электронная почта */
	email: string,
	/** Данные индивидуального предпринимателя */
	entrepreneur_data?: ResolverInputTypes["CreateEntrepreneurDataInput"] | undefined | null,
	/** Данные физического лица */
	individual_data?: ResolverInputTypes["CreateIndividualDataInput"] | undefined | null,
	/** Данные организации */
	organization_data?: ResolverInputTypes["CreateOrganizationDataInput"] | undefined | null,
	/** Публичный ключ */
	public_key: string,
	/** Имя аккаунта реферера */
	referer?: string | undefined | null,
	/** Тип аккаунта */
	type: ResolverInputTypes["AccountType"],
	/** Имя пользователя */
	username: string
};
	["RegisterParticipantInput"]: {
	/** Имя кооперативного участка */
	braname?: string | undefined | null,
	/** Подписанный документ политики конфиденциальности от пайщика */
	privacy_agreement: ResolverInputTypes["SignedDigitalDocumentInput"],
	/** Подписанный документ положения о цифровой подписи от пайщика */
	signature_agreement: ResolverInputTypes["SignedDigitalDocumentInput"],
	/** Подписанный документ заявления на вступление в кооператив от пайщика */
	statement: ResolverInputTypes["ParticipantApplicationSignedDocumentInput"],
	/** Подписанный документ пользовательского соглашения от пайщика */
	user_agreement: ResolverInputTypes["SignedDigitalDocumentInput"],
	/** Имя аккаунта пайщика */
	username: string,
	/** Подписанный документ положения целевой потребительской программы "Цифровой Кошелёк" от пайщика */
	wallet_agreement: ResolverInputTypes["SignedDigitalDocumentInput"]
};
	["RegisteredAccount"]: AliasType<{
	/** Информация об зарегистрированном аккаунте */
	account?:ResolverInputTypes["Account"],
	/** Токены доступа и обновления */
	tokens?:ResolverInputTypes["Tokens"],
		__typename?: boolean | `@${string}`
}>;
	["RepresentedBy"]: AliasType<{
	/** На основании чего действует */
	based_on?:boolean | `@${string}`,
	/** Имя */
	first_name?:boolean | `@${string}`,
	/** Фамилия */
	last_name?:boolean | `@${string}`,
	/** Отчество */
	middle_name?:boolean | `@${string}`,
	/** Должность */
	position?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["RepresentedByCertificate"]: AliasType<{
	/** Имя */
	first_name?:boolean | `@${string}`,
	/** Фамилия */
	last_name?:boolean | `@${string}`,
	/** Отчество */
	middle_name?:boolean | `@${string}`,
	/** Должность */
	position?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["RepresentedByInput"]: {
	based_on: string,
	first_name: string,
	last_name: string,
	middle_name: string,
	position: string
};
	["ResetKeyInput"]: {
	/** Публичный ключ для замены */
	public_key: string,
	/** Токен авторизации для замены ключа, полученный по email */
	token: string
};
	["ResourceDelegationDTO"]: AliasType<{
	/** Вес CPU */
	cpu_weight?:boolean | `@${string}`,
	/** Отправитель */
	from?:boolean | `@${string}`,
	/** Вес сети */
	net_weight?:boolean | `@${string}`,
	/** Получатель */
	to?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ResourceOverview"]: AliasType<{
	/** Вес CPU */
	cpu_weight?:boolean | `@${string}`,
	/** Вес сети */
	net_weight?:boolean | `@${string}`,
	/** Владелец */
	owner?:boolean | `@${string}`,
	/** Используемая RAM */
	ram_bytes?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** DTO для перезапуска ежегодного общего собрания кооператива */
["RestartAnnualGeneralMeetInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Хеш собрания, которое необходимо перезапустить */
	hash: string,
	/** Новая дата закрытия собрания */
	new_close_at: ResolverInputTypes["DateTime"],
	/** Новая дата открытия собрания */
	new_open_at: ResolverInputTypes["DateTime"],
	/** Новое предложение повестки ежегодного общего собрания */
	newproposal: ResolverInputTypes["AnnualGeneralMeetingAgendaSignedDocumentInput"]
};
	["ReturnByAssetActGenerateDocumentInput"]: {
	/** Идентификатор акта */
	act_id: string,
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Имя аккаунта кооперативного участка */
	braname?: string | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Идентификатор решения */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Идентификатор заявки */
	request_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя аккаунта получателя на кооперативном участке */
	transmitter: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["ReturnByAssetActSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация для создания проекта свободного решения */
	meta: ResolverInputTypes["ReturnByAssetActSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<ResolverInputTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["ReturnByAssetActSignedMetaDocumentInput"]: {
	/** Идентификатор акта */
	act_id: string,
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Имя аккаунта кооперативного участка */
	braname?: string | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Идентификатор решения */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** ID документа в реестре */
	registry_id: number,
	/** Идентификатор заявки */
	request_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя аккаунта получателя на кооперативном участке */
	transmitter: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["ReturnByAssetDecisionGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Идентификатор решения */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Идентификатор заявки */
	request_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["ReturnByAssetStatementGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Запрос на внесение имущественного паевого взноса */
	request: ResolverInputTypes["CommonRequestInput"],
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["ReturnByAssetStatementSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация для создания проекта свободного решения */
	meta: ResolverInputTypes["ReturnByAssetStatementSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<ResolverInputTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["ReturnByAssetStatementSignedMetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** ID документа в реестре */
	registry_id: number,
	/** Запрос на внесение имущественного паевого взноса */
	request: ResolverInputTypes["CommonRequestInput"],
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["ReturnByMoneyDecisionGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Валюта */
	currency: string,
	/** ID решения совета */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Хэш платежа */
	payment_hash: string,
	/** Количество средств к возврату */
	quantity: string,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["ReturnByMoneyGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Валюта */
	currency: string,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** ID платежного метода */
	method_id: string,
	/** Хеш платежа для связи с withdraw */
	payment_hash: string,
	/** Количество средств к возврату */
	quantity: string,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["ReturnByMoneySignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация для документа заявления на возврат паевого взноса денежными средствами */
	meta: ResolverInputTypes["ReturnByMoneySignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<ResolverInputTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["ReturnByMoneySignedMetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Валюта */
	currency: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** ID платежного метода */
	method_id: string,
	/** Хеш платежа для связи с withdraw */
	payment_hash: string,
	/** Количество средств к возврату */
	quantity: string,
	/** ID документа в реестре */
	registry_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["SbpAccount"]: AliasType<{
	/** Мобильный телефон получателя */
	phone?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["SearchPrivateAccountsInput"]: {
	/** Поисковый запрос для поиска приватных аккаунтов */
	query: string
};
	["SelectBranchGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Идентификатор имени аккаунта кооперативного участка */
	braname: string,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["SelectBranchInput"]: {
	/** Имя аккаунта кооперативного участка */
	braname: string,
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Подписанный электронный документ (generateSelectBranchDocument) */
	document: ResolverInputTypes["SelectBranchSignedDocumentInput"],
	/** Имя аккаунта пользователя */
	username: string
};
	["SelectBranchSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация для документа выбора кооперативного участка */
	meta: ResolverInputTypes["SelectBranchSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<ResolverInputTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["SelectBranchSignedMetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Идентификатор имени аккаунта кооперативного участка */
	braname: string,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** ID документа в реестре */
	registry_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["SetPaymentStatusInput"]: {
	/** Идентификатор платежа, для которого устанавливается статус */
	id: string,
	/** Новый статус платежа */
	status: ResolverInputTypes["PaymentStatus"]
};
	["SetWifInput"]: {
	/** Тип разрешения ключа */
	permission: string,
	/** Имя пользователя, чей ключ */
	username: string,
	/** Приватный ключ */
	wif: string
};
	/** Входные данные для подписи решения председателем */
["SignByPresiderOnAnnualGeneralMeetInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Хеш собрания */
	hash: string,
	/** Подписанный документ с решением председателя */
	presider_decision: ResolverInputTypes["AnnualGeneralMeetingDecisionSignedDocumentInput"],
	/** Имя аккаунта пользователя */
	username: string
};
	/** Входные данные для подписи решения секретарём */
["SignBySecretaryOnAnnualGeneralMeetInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Хеш собрания */
	hash: string,
	/** Подписанный документ с решением секретаря */
	secretary_decision: ResolverInputTypes["AnnualGeneralMeetingDecisionSignedDocumentInput"],
	/** Имя аккаунта пользователя */
	username: string
};
	["SignatureInfo"]: AliasType<{
	id?:boolean | `@${string}`,
	is_valid?:boolean | `@${string}`,
	meta?:boolean | `@${string}`,
	public_key?:boolean | `@${string}`,
	signature?:boolean | `@${string}`,
	signed_at?:boolean | `@${string}`,
	signed_hash?:boolean | `@${string}`,
	signer?:boolean | `@${string}`,
	/** Сертификат подписанта (сокращенная информация) */
	signer_certificate?:ResolverInputTypes["UserCertificateUnion"],
		__typename?: boolean | `@${string}`
}>;
	["SignatureInfoInput"]: {
	/** Идентификатор номера подписи */
	id: number,
	/** Мета-данные подписи */
	meta: string,
	/** Публичный ключ */
	public_key: string,
	/** Подпись хэша */
	signature: string,
	/** Время подписания */
	signed_at: string,
	/** Подписанный хэш */
	signed_hash: string,
	/** Аккаунт подписавшего */
	signer: string
};
	["SignedBlockchainDocument"]: AliasType<{
	/** Хэш содержимого документа */
	doc_hash?:boolean | `@${string}`,
	/** Общий хэш (doc_hash + meta_hash) */
	hash?:boolean | `@${string}`,
	/** Метаинформация документа (в формате JSON-строки) */
	meta?:boolean | `@${string}`,
	/** Хэш мета-данных */
	meta_hash?:boolean | `@${string}`,
	/** Вектор подписей */
	signatures?:ResolverInputTypes["SignatureInfo"],
	/** Версия стандарта документа */
	version?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["SignedDigitalDocument"]: AliasType<{
	doc_hash?:boolean | `@${string}`,
	hash?:boolean | `@${string}`,
	meta?:boolean | `@${string}`,
	meta_hash?:boolean | `@${string}`,
	signatures?:ResolverInputTypes["SignatureInfo"],
	version?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["SignedDigitalDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация документа */
	meta: ResolverInputTypes["MetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<ResolverInputTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["SovietMemberInput"]: {
	individual_data: ResolverInputTypes["CreateIndividualDataInput"],
	role: string
};
	["StartResetKeyInput"]: {
	/** Электронная почта */
	email: string
};
	/** Комплексный объект цифрового документа заявления (или другого ведущего документа для цепочки принятия решений совета) с агрегатом документа */
["StatementDetailAggregate"]: AliasType<{
	action?:ResolverInputTypes["ExtendedBlockchainAction"],
	documentAggregate?:ResolverInputTypes["DocumentAggregate"],
		__typename?: boolean | `@${string}`
}>;
	["SupplyOnRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Подписанный Поставщиком акт приёма-передачи имущества в кооператив */
	document: ResolverInputTypes["AssetContributionActSignedDocumentInput"],
	/** Идентификатор обмена */
	exchange_id: number,
	/** Имя аккаунта пользователя */
	username: string
};
	["SystemInfo"]: AliasType<{
	/** Объект системного аккаунта кооператива в блокчейне */
	blockchain_account?:ResolverInputTypes["BlockchainAccount"],
	/** Набор данных с информацией о состоянии блокчейна */
	blockchain_info?:ResolverInputTypes["BlockchainInfoDTO"],
	/** Контакты кооператива */
	contacts?:ResolverInputTypes["ContactsDTO"],
	/** Объект аккаунта кооператива у оператора */
	cooperator_account?:ResolverInputTypes["CooperativeOperatorAccount"],
	/** Имя аккаунта кооператива */
	coopname?:boolean | `@${string}`,
	/** Статус контроллера кооператива */
	system_status?:boolean | `@${string}`,
	/** Переменные кооператива */
	vars?:ResolverInputTypes["Vars"],
		__typename?: boolean | `@${string}`
}>;
	/** Состояние контроллера кооператива */
["SystemStatus"]:SystemStatus;
	["Token"]: AliasType<{
	/** Дата истечения токена доступа */
	expires?:boolean | `@${string}`,
	/** Токен доступа */
	token?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["Tokens"]: AliasType<{
	/** Токен доступа */
	access?:ResolverInputTypes["Token"],
	/** Токен обновления */
	refresh?:ResolverInputTypes["Token"],
		__typename?: boolean | `@${string}`
}>;
	["Transaction"]: AliasType<{
	/** Блокчейн, который использовался */
	chain?:boolean | `@${string}`,
	/** Запрос на подписание транзакции */
	request?:boolean | `@${string}`,
	/** Разрешенный запрос на подписание транзакции */
	resolved?:boolean | `@${string}`,
	/** Ответ от API после отправки транзакции (если был выполнен бродкаст) */
	response?:boolean | `@${string}`,
	/** Возвращаемые значения после выполнения транзакции */
	returns?:boolean | `@${string}`,
	/** Ревизии транзакции, измененные плагинами в ESR формате */
	revisions?:boolean | `@${string}`,
	/** Подписи транзакции */
	signatures?:boolean | `@${string}`,
	/** Авторизованный подписант */
	signer?:boolean | `@${string}`,
	/** Итоговая транзакция */
	transaction?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UninstallExtensionInput"]: {
	/** Фильтр по имени */
	name: string
};
	["UnpublishRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Идентификатор обмена */
	exchange_id: number,
	/** Имя аккаунта пользователя */
	username: string
};
	["Update"]: {
	/** Собственные данные кооператива, обслуживающего экземпляр платформы */
	organization_data?: ResolverInputTypes["UpdateOrganizationDataInput"] | undefined | null,
	/** Переменные кооператива, используемые для заполнения шаблонов документов */
	vars?: ResolverInputTypes["VarsInput"] | undefined | null
};
	["UpdateAccountInput"]: {
	/** Данные индивидуального предпринимателя */
	entrepreneur_data?: ResolverInputTypes["UpdateEntrepreneurDataInput"] | undefined | null,
	/** Данные физического лица */
	individual_data?: ResolverInputTypes["UpdateIndividualDataInput"] | undefined | null,
	/** Данные организации */
	organization_data?: ResolverInputTypes["UpdateOrganizationDataInput"] | undefined | null,
	/** Публичный ключ */
	public_key?: string | undefined | null,
	/** Имя аккаунта реферера */
	referer?: string | undefined | null,
	/** Имя пользователя */
	username: string
};
	["UpdateBankAccountInput"]: {
	/** Данные банковского счёта */
	data: ResolverInputTypes["BankAccountInput"],
	/** Флаг основного метода платежа, который отображается в документах */
	is_default: boolean,
	/** Идентификатор платежного метода */
	method_id: string,
	/** Имя аккаунта пользователя */
	username: string
};
	["UpdateEntrepreneurDataInput"]: {
	/** Дата рождения */
	birthdate: string,
	/** Город */
	city: string,
	/** Страна */
	country: ResolverInputTypes["Country"],
	/** Детали индивидуального предпринимателя */
	details: ResolverInputTypes["EntrepreneurDetailsInput"],
	/** Электронная почта */
	email: string,
	/** Имя */
	first_name: string,
	/** Полный адрес */
	full_address: string,
	/** Фамилия */
	last_name: string,
	/** Отчество */
	middle_name: string,
	/** Телефон */
	phone: string,
	/** Имя пользователя */
	username: string
};
	["UpdateIndividualDataInput"]: {
	/** Дата рождения */
	birthdate: string,
	/** Электронная почта */
	email: string,
	/** Имя */
	first_name: string,
	/** Полный адрес */
	full_address: string,
	/** Фамилия */
	last_name: string,
	/** Отчество */
	middle_name: string,
	/** Данные паспорта */
	passport?: ResolverInputTypes["PassportInput"] | undefined | null,
	/** Телефон */
	phone: string,
	/** Имя пользователя */
	username: string
};
	["UpdateOrganizationDataInput"]: {
	/** Город */
	city: string,
	/** Страна */
	country: string,
	/** Детали организации */
	details: ResolverInputTypes["OrganizationDetailsInput"],
	/** Электронная почта */
	email: string,
	/** Фактический адрес */
	fact_address: string,
	/** Полный адрес */
	full_address: string,
	/** Полное наименование организации */
	full_name: string,
	/** Телефон */
	phone: string,
	/** Представитель организации */
	represented_by: ResolverInputTypes["RepresentedByInput"],
	/** Краткое наименование организации */
	short_name: string,
	/** Тип организации */
	type: string,
	/** Имя пользователя */
	username: string
};
	["UpdateRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Дополнительные данные */
	data: string,
	/** Идентификатор обмена */
	exchange_id: number,
	/** Дополнительная информация */
	meta: string,
	/** Оставшееся количество единиц */
	remain_units: string,
	/** Стоимость за единицу в формате "10.0000 RUB" */
	unit_cost: string,
	/** Имя аккаунта пользователя */
	username: string
};
	["UserAccount"]: AliasType<{
	/** Метаинформация */
	meta?:boolean | `@${string}`,
	/** Реферал */
	referer?:boolean | `@${string}`,
	/** Дата регистрации */
	registered_at?:boolean | `@${string}`,
	/** Регистратор */
	registrator?:boolean | `@${string}`,
	/** Статус аккаунта */
	status?:boolean | `@${string}`,
	/** Список хранилищ */
	storages?:boolean | `@${string}`,
	/** Тип учетной записи */
	type?:boolean | `@${string}`,
	/** Имя аккаунта */
	username?:boolean | `@${string}`,
	/** Дата регистрации */
	verifications?:ResolverInputTypes["Verification"],
		__typename?: boolean | `@${string}`
}>;
	/** Объединение сертификатов пользователей (сокращенная информация) */
["UserCertificateUnion"]: AliasType<{
	EntrepreneurCertificate?:ResolverInputTypes["EntrepreneurCertificate"],
	IndividualCertificate?:ResolverInputTypes["IndividualCertificate"],
	OrganizationCertificate?:ResolverInputTypes["OrganizationCertificate"],
		__typename?: boolean | `@${string}`
}>;
	/** Статус пользователя */
["UserStatus"]:UserStatus;
	["Vars"]: AliasType<{
	confidential_email?:boolean | `@${string}`,
	confidential_link?:boolean | `@${string}`,
	contact_email?:boolean | `@${string}`,
	coopenomics_agreement?:ResolverInputTypes["AgreementVar"],
	coopname?:boolean | `@${string}`,
	full_abbr?:boolean | `@${string}`,
	full_abbr_dative?:boolean | `@${string}`,
	full_abbr_genitive?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	participant_application?:ResolverInputTypes["AgreementVar"],
	passport_request?:boolean | `@${string}`,
	privacy_agreement?:ResolverInputTypes["AgreementVar"],
	short_abbr?:boolean | `@${string}`,
	signature_agreement?:ResolverInputTypes["AgreementVar"],
	user_agreement?:ResolverInputTypes["AgreementVar"],
	wallet_agreement?:ResolverInputTypes["AgreementVar"],
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["VarsInput"]: {
	confidential_email: string,
	confidential_link: string,
	contact_email: string,
	coopenomics_agreement?: ResolverInputTypes["AgreementInput"] | undefined | null,
	coopname: string,
	full_abbr: string,
	full_abbr_dative: string,
	full_abbr_genitive: string,
	name: string,
	participant_application: ResolverInputTypes["AgreementInput"],
	passport_request: string,
	privacy_agreement: ResolverInputTypes["AgreementInput"],
	short_abbr: string,
	signature_agreement: ResolverInputTypes["AgreementInput"],
	user_agreement: ResolverInputTypes["AgreementInput"],
	wallet_agreement: ResolverInputTypes["AgreementInput"],
	website: string
};
	["Verification"]: AliasType<{
	/** Дата создания верификации */
	created_at?:boolean | `@${string}`,
	/** Флаг верификации */
	is_verified?:boolean | `@${string}`,
	/** Дата последнего обновления верификации */
	last_update?:boolean | `@${string}`,
	/** Заметка верификации */
	notice?:boolean | `@${string}`,
	/** Процедура верификации */
	procedure?:boolean | `@${string}`,
	/** Имя верификатора */
	verificator?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Пункт голосования для ежегодного общего собрания */
["VoteItemInput"]: {
	/** Идентификатор вопроса повестки */
	question_id: number,
	/** Решение по вопросу (вариант голосования) */
	vote: string
};
	/** Входные данные для голосования на ежегодном общем собрании */
["VoteOnAnnualGeneralMeetInput"]: {
	/** Подписанный бюллетень голосования */
	ballot: ResolverInputTypes["AnnualGeneralMeetingVotingBallotSignedDocumentInput"],
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Хеш собрания, по которому производится голосование */
	hash: string,
	/** Идентификатор члена кооператива, который голосует */
	username: string,
	/** Бюллетень с решениями по вопросам повестки */
	votes: Array<ResolverInputTypes["VoteItemInput"]>
};
	["WaitWeight"]: AliasType<{
	/** Время ожидания в секундах */
	wait_sec?:boolean | `@${string}`,
	/** Вес */
	weight?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["schema"]: AliasType<{
	query?:ResolverInputTypes["Query"],
	mutation?:ResolverInputTypes["Mutation"],
		__typename?: boolean | `@${string}`
}>
  }

export type ModelTypes = {
    ["AcceptChildOrderInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Подписанное заявление на имущественный паевый взнос */
	document: ModelTypes["AssetContributionStatementSignedDocumentInput"],
	/** Идентификатор заявки */
	exchange_id: string,
	/** Имя аккаунта пользователя */
	username: string
};
	["Account"]: {
		/** объект аккаунта в блокчейне содержит системную информацию, такую как публичные ключи доступа, доступные вычислительные ресурсы, информация об установленном смарт-контракте, и т.д. и т.п. Это системный уровень обслуживания, где у каждого пайщика есть аккаунт, но не каждый аккаунт может быть пайщиком в каком-либо кооперативе. Все смарт-контракты устанавливаются и исполняются на этом уровне. */
	blockchain_account?: ModelTypes["BlockchainAccount"] | undefined | null,
	/** объект пайщика кооператива в таблице блокчейне, который определяет членство пайщика в конкретном кооперативе. Поскольку MONO обслуживает только один кооператив, то в participant_account обычно содержится информация, которая описывает членство пайщика в этом кооперативе. Этот объект обезличен, публичен, и хранится в блокчейне. */
	participant_account?: ModelTypes["ParticipantAccount"] | undefined | null,
	/** объект приватных данных пайщика кооператива. */
	private_account?: ModelTypes["PrivateAccount"] | undefined | null,
	/** объект аккаунта в системе учёта провайдера, т.е. MONO. Здесь хранится приватная информация о пайщике кооператива, которая содержит его приватные данные. Эти данные не публикуются в блокчейне и не выходят за пределы базы данных провайдера. Они используются для заполнения шаблонов документов при нажатии соответствующих кнопок на платформе.  */
	provider_account?: ModelTypes["MonoAccount"] | undefined | null,
	/** объект пользователя кооперативной экономики содержит в блокчейне информацию о типе аккаунта пайщика, а также, обезличенные публичные данные (хэши) для верификации пайщиков между кооперативами. Этот уровень предназначен для хранения информации пайщика, которая необходима всем кооперативам, но не относится к какому-либо из них конкретно. */
	user_account?: ModelTypes["UserAccount"] | undefined | null,
	/** Имя аккаунта кооператива */
	username: string
};
	["AccountRamDelta"]: {
		account: string,
	delta: number
};
	["AccountResourceInfo"]: {
		/** Доступные ресурсы */
	available: string,
	/** Текущее использование ресурсов */
	current_used?: string | undefined | null,
	/** Время последнего обновления использования ресурсов */
	last_usage_update_time?: string | undefined | null,
	/** Максимальное количество ресурсов */
	max: string,
	/** Использовано ресурсов */
	used: string
};
	["AccountType"]:AccountType;
	["AccountsPaginationResult"]: {
		/** Текущая страница */
	currentPage: number,
	/** Элементы текущей страницы */
	items: Array<ModelTypes["Account"]>,
	/** Общее количество элементов */
	totalCount: number,
	/** Общее количество страниц */
	totalPages: number
};
	/** Комплексный объект акта, содержащий полную информацию о сгенерированном и опубликованном документе с его агрегатом */
["ActDetailAggregate"]: {
		action?: ModelTypes["ExtendedBlockchainAction"] | undefined | null,
	documentAggregate?: ModelTypes["DocumentAggregate"] | undefined | null
};
	["ActionAuthorization"]: {
		actor: string,
	permission: string
};
	["ActionReceipt"]: {
		abi_sequence: number,
	act_digest: string,
	auth_sequence: Array<ModelTypes["AuthSequence"]>,
	code_sequence: number,
	global_sequence: string,
	receiver: string,
	recv_sequence: string
};
	["AddParticipantInput"]: {
	/** Дата создания аккаунта в строковом формате даты EOSIO по UTC (2024-12-28T06:58:52.500) */
	created_at: string,
	/** Электронная почта */
	email: string,
	/** Данные индивидуального предпринимателя */
	entrepreneur_data?: ModelTypes["CreateEntrepreneurDataInput"] | undefined | null,
	/** Данные физического лица */
	individual_data?: ModelTypes["CreateIndividualDataInput"] | undefined | null,
	/** Вступительный взнос, который был внесён пайщиком */
	initial: string,
	/** Минимальный паевый взнос, который был внесён пайщиком */
	minimum: string,
	/** Данные организации */
	organization_data?: ModelTypes["CreateOrganizationDataInput"] | undefined | null,
	/** Имя аккаунта реферера */
	referer?: string | undefined | null,
	/** Флаг распределения вступительного взноса в невозвратный фонд вступительных взносов кооператива */
	spread_initial: boolean,
	/** Тип аккаунта */
	type: ModelTypes["AccountType"]
};
	["AddTrustedAccountInput"]: {
	/** Имя аккаунта кооперативного участка */
	braname: string,
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Имя аккаунта доверонного лица, который уполномачивается председателем кооперативного участка на совершение действий */
	trusted: string
};
	/** Пункт повестки общего собрания (для ввода) */
["AgendaGeneralMeetPointInput"]: {
	/** Контекст или дополнительная информация по пункту повестки */
	context: string,
	/** Предлагаемое решение по пункту повестки */
	decision: string,
	/** Заголовок пункта повестки */
	title: string
};
	/** Вопрос повестки общего собрания */
["AgendaGeneralMeetQuestion"]: {
	/** Контекст или дополнительная информация по вопросу */
	context?: string | undefined | null,
	/** Предлагаемое решение по вопросу повестки */
	decision: string,
	/** Номер вопроса в повестке */
	number: string,
	/** Заголовок вопроса повестки */
	title: string
};
	/** Данные собрания для повестки */
["AgendaMeet"]: {
	/** Дата и время окончания собрания */
	close_at_datetime: string,
	/** Дата и время начала собрания */
	open_at_datetime: string,
	/** Тип собрания (очередное или внеочередное) */
	type: string
};
	/** Пункт повестки собрания */
["AgendaMeetPoint"]: {
		/** Контекст или дополнительная информация по пункту повестки */
	context: string,
	/** Предлагаемое решение по пункту повестки */
	decision: string,
	/** Заголовок пункта повестки */
	title: string
};
	["AgendaWithDocuments"]: {
		/** Действие, которое привело к появлению вопроса на голосовании */
	action: ModelTypes["BlockchainAction"],
	/** Пакет документов, включающий разные подсекции */
	documents: ModelTypes["DocumentPackageAggregate"],
	/** Запись в таблице блокчейна о вопросе на голосовании */
	table: ModelTypes["BlockchainDecision"]
};
	["AgreementInput"]: {
	protocol_day_month_year: string,
	protocol_number: string
};
	["AgreementVar"]: {
		protocol_day_month_year: string,
	protocol_number: string
};
	["AnnualGeneralMeetingAgendaGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Флаг повторного собрания */
	is_repeated: boolean,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	meet: ModelTypes["AgendaMeet"],
	questions: Array<ModelTypes["AgendaGeneralMeetQuestion"]>,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["AnnualGeneralMeetingAgendaSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация для создания протокола решения */
	meta: ModelTypes["AnnualGeneralMeetingAgendaSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<ModelTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["AnnualGeneralMeetingAgendaSignedMetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Флаг повторного собрания */
	is_repeated: boolean,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	meet: ModelTypes["AgendaMeet"],
	questions: Array<ModelTypes["AgendaGeneralMeetQuestion"]>,
	/** ID документа в реестре */
	registry_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["AnnualGeneralMeetingDecisionGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Хеш собрания */
	meet_hash: string,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["AnnualGeneralMeetingDecisionSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация */
	meta: ModelTypes["AnnualGeneralMeetingDecisionSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<ModelTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["AnnualGeneralMeetingDecisionSignedMetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** Хеш собрания */
	meet_hash: string,
	/** ID документа в реестре */
	registry_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["AnnualGeneralMeetingNotificationGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Хеш собрания */
	meet_hash: string,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["AnnualGeneralMeetingNotificationSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация */
	meta: ModelTypes["AnnualGeneralMeetingNotificationSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<ModelTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["AnnualGeneralMeetingNotificationSignedMetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** Хеш собрания */
	meet_hash: string,
	/** ID документа в реестре */
	registry_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["AnnualGeneralMeetingSovietDecisionGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** ID решения совета */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Флаг повторного собрания */
	is_repeated: boolean,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Хеш собрания */
	meet_hash: string,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["AnnualGeneralMeetingVotingBallotGenerateDocumentInput"]: {
	/** Ответы голосования */
	answers: Array<ModelTypes["AnswerInput"]>,
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Хеш собрания */
	meet_hash: string,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя голосующего */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["AnnualGeneralMeetingVotingBallotSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация для создания протокола решения */
	meta: ModelTypes["AnnualGeneralMeetingVotingBallotSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<ModelTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["AnnualGeneralMeetingVotingBallotSignedMetaDocumentInput"]: {
	/** Ответы голосования */
	answers: Array<ModelTypes["AnswerInput"]>,
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** Хеш собрания */
	meet_hash: string,
	/** ID документа в реестре */
	registry_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя голосующего */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["AnswerInput"]: {
	/** ID вопроса */
	id: string,
	/** Номер вопроса */
	number: string,
	/** Голос (за/против/воздержался) */
	vote: string
};
	["AssetContributionActGenerateDocumentInput"]: {
	/** Идентификатор акта */
	act_id: string,
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Имя аккаунта кооперативного участка */
	braname?: string | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Идентификатор решения */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Имя аккаунта получателя на кооперативном участке */
	receiver: string,
	/** Идентификатор заявки */
	request_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["AssetContributionActSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация для создания проекта свободного решения */
	meta: ModelTypes["AssetContributionActSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<ModelTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["AssetContributionActSignedMetaDocumentInput"]: {
	/** Идентификатор акта */
	act_id: string,
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Имя аккаунта кооперативного участка */
	braname?: string | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Идентификатор решения */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** Имя аккаунта получателя на кооперативном участке */
	receiver: string,
	/** ID документа в реестре */
	registry_id: number,
	/** Идентификатор заявки */
	request_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["AssetContributionDecisionGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Идентификатор решения */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Идентификатор заявки */
	request_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["AssetContributionStatementGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Запрос на внесение имущественного паевого взноса */
	request: ModelTypes["CommonRequestInput"],
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["AssetContributionStatementSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация для создания проекта свободного решения */
	meta: ModelTypes["AssetContributionStatementSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<ModelTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["AssetContributionStatementSignedMetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** ID документа в реестре */
	registry_id: number,
	/** Запрос на внесение имущественного паевого взноса */
	request: ModelTypes["CommonRequestInput"],
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["AuthSequence"]: {
		account: string,
	sequence: string
};
	["Authority"]: {
		/** Уровни разрешений */
	accounts: Array<ModelTypes["PermissionLevelWeight"]>,
	/** Ключи */
	keys: Array<ModelTypes["KeyWeight"]>,
	/** Порог */
	threshold: number,
	/** Вес ожидания */
	waits: Array<ModelTypes["WaitWeight"]>
};
	["BankAccount"]: {
		/** Номер банковского счета */
	account_number: string,
	/** Название банка */
	bank_name: string,
	/** Номер карты */
	card_number?: string | undefined | null,
	/** Валюта счета */
	currency: string,
	/** Детали счета */
	details: ModelTypes["BankAccountDetails"]
};
	["BankAccountDetails"]: {
		/** БИК банка */
	bik: string,
	/** Корреспондентский счет */
	corr: string,
	/** КПП банка */
	kpp: string
};
	["BankAccountDetailsInput"]: {
	/** БИК банка */
	bik: string,
	/** Корреспондентский счет */
	corr: string,
	/** КПП банка */
	kpp: string
};
	["BankAccountInput"]: {
	/** Номер банковского счета */
	account_number: string,
	/** Название банка */
	bank_name: string,
	/** Номер карты */
	card_number?: string | undefined | null,
	/** Валюта счета */
	currency: string,
	/** Детали счета */
	details: ModelTypes["BankAccountDetailsInput"]
};
	["BankPaymentMethod"]: {
		/** Дата создания */
	created_at: ModelTypes["DateTime"],
	/** Данные метода оплаты */
	data: ModelTypes["BankAccount"],
	/** Флаг основного метода платежа, который отображается в документах */
	is_default: boolean,
	/** Идентификатор метода оплаты */
	method_id: string,
	/** Тип метода оплаты */
	method_type: string,
	/** Дата обновления */
	updated_at: ModelTypes["DateTime"],
	/** Имя пользователя, к которому привязан метод оплаты */
	username: string
};
	["BlockchainAccount"]: {
		/** Имя аккаунта */
	account_name: string,
	/** Баланс */
	core_liquid_balance?: string | undefined | null,
	/** Ограничения CPU */
	cpu_limit: ModelTypes["AccountResourceInfo"],
	/** Вес CPU */
	cpu_weight: string,
	/** Дата создания */
	created: string,
	/** Номер последнего блока */
	head_block_num: number,
	/** Время последнего блока */
	head_block_time: string,
	/** Время последнего обновления кода */
	last_code_update: string,
	/** Ограничения сети */
	net_limit: ModelTypes["AccountResourceInfo"],
	/** Вес сети */
	net_weight: string,
	/** Разрешения */
	permissions: Array<ModelTypes["Permission"]>,
	/** Флаг привилегий */
	privileged: boolean,
	/** Квота RAM */
	ram_quota: number,
	/** Использование RAM */
	ram_usage: number,
	/** Запрос на возврат */
	refund_request?: ModelTypes["RefundRequest"] | undefined | null,
	/** Информация о REX */
	rex_info?: string | undefined | null,
	/** Делегированные ресурсы */
	self_delegated_bandwidth?: ModelTypes["ResourceDelegationDTO"] | undefined | null,
	/** Общий обзор ресурсов */
	total_resources?: ModelTypes["ResourceOverview"] | undefined | null,
	/** Информация о голосовании */
	voter_info?: string | undefined | null
};
	/** Объект действия в блокчейне */
["BlockchainAction"]: {
		account: string,
	account_ram_deltas: Array<ModelTypes["AccountRamDelta"]>,
	action_ordinal: number,
	authorization: Array<ModelTypes["ActionAuthorization"]>,
	block_id: string,
	block_num: number,
	chain_id: string,
	console: string,
	context_free: boolean,
	creator_action_ordinal: number,
	/** Данные действия в формате JSON */
	data: ModelTypes["JSON"],
	elapsed: number,
	global_sequence: string,
	name: string,
	receipt: ModelTypes["ActionReceipt"],
	receiver: string,
	transaction_id: string
};
	/** Запись в таблице блокчейна о процессе принятия решения советом кооператива */
["BlockchainDecision"]: {
		approved: boolean,
	authorization: ModelTypes["SignedBlockchainDocument"],
	authorized: boolean,
	authorized_by: string,
	batch_id: number,
	callback_contract?: string | undefined | null,
	confirm_callback?: string | undefined | null,
	coopname: string,
	created_at: string,
	decline_callback?: string | undefined | null,
	expired_at: string,
	hash?: string | undefined | null,
	id: number,
	meta: string,
	statement: ModelTypes["SignedBlockchainDocument"],
	type: string,
	username: string,
	/** Сертификат пользователя, создавшего решение */
	username_certificate?: ModelTypes["UserCertificateUnion"] | undefined | null,
	validated: boolean,
	votes_against: Array<string>,
	/** Сертификаты пользователей, голосовавших "против" */
	votes_against_certificates: Array<ModelTypes["UserCertificateUnion"]>,
	votes_for: Array<string>,
	/** Сертификаты пользователей, голосовавших "за" */
	votes_for_certificates: Array<ModelTypes["UserCertificateUnion"]>
};
	/** Информация о состоянии блокчейна */
["BlockchainInfoDTO"]: {
		/** Лимит CPU для блока */
	block_cpu_limit: number,
	/** Лимит сети для блока */
	block_net_limit: number,
	/** Идентификатор цепочки (chain ID) */
	chain_id: string,
	/** Идентификатор головного блока в форк базе данных */
	fork_db_head_block_id?: string | undefined | null,
	/** Номер головного блока в форк базе данных */
	fork_db_head_block_num?: number | undefined | null,
	/** Идентификатор головного блока */
	head_block_id: string,
	/** Номер головного блока */
	head_block_num: number,
	/** Прозводитель головного блока */
	head_block_producer: string,
	/** Время головного блока */
	head_block_time: string,
	/** Идентификатор последнего необратимого блока */
	last_irreversible_block_id: string,
	/** Номер последнего необратимого блока */
	last_irreversible_block_num: number,
	/** Время последнего необратимого блока */
	last_irreversible_block_time?: string | undefined | null,
	/** Версия сервера */
	server_version: string,
	/** Строковое представление версии сервера */
	server_version_string?: string | undefined | null,
	/** Виртуальный лимит CPU для блока */
	virtual_block_cpu_limit: number,
	/** Виртуальный лимит сети для блока */
	virtual_block_net_limit: number
};
	["Branch"]: {
		/** Банковский счёт */
	bank_account: ModelTypes["BankPaymentMethod"],
	/** Уникальное имя кооперативного участка */
	braname: string,
	/** Город */
	city: string,
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Страна */
	country: string,
	/** Детали организации */
	details: ModelTypes["OrganizationDetails"],
	/** Email */
	email: string,
	/** Фактический адрес */
	fact_address: string,
	/** Полный адрес */
	full_address: string,
	/** Полное название организации */
	full_name: string,
	/** Телефон */
	phone: string,
	/** Представитель организации */
	represented_by: ModelTypes["RepresentedBy"],
	/** Краткое название организации */
	short_name: string,
	/** Доверенные аккаунты */
	trusted: Array<ModelTypes["Individual"]>,
	/** Председатель кооперативного участка */
	trustee: ModelTypes["Individual"],
	/** Тип организации */
	type: string
};
	["CancelRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Идентификатор заявки */
	exchange_id: string,
	/** Имя аккаунта пользователя */
	username: string
};
	["CommonRequestInput"]: {
	currency: string,
	hash: string,
	program_id: number,
	title: string,
	total_cost: string,
	type: string,
	unit_cost: string,
	unit_of_measurement: string,
	units: number
};
	["CompleteRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Идентификатор обмена */
	exchange_id: string,
	/** Имя аккаунта пользователя */
	username: string
};
	/** Подтвердить получение имущества Уполномоченным лицом от Заказчика по новации и акту приёмки-передачи */
["ConfirmReceiveOnRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Подписанный акт приёмки-передачи имущества Уполномоченным лицом из Кооператива при возврате Заказчику по новации */
	document: ModelTypes["ReturnByAssetActSignedDocumentInput"],
	/** Идентификатор обмена */
	exchange_id: string,
	/** Имя аккаунта пользователя */
	username: string
};
	/** Подтвердить поставку имущества Поставщиком по заявке Заказчика и акту приёма-передачи */
["ConfirmSupplyOnRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Подписанный акт приёма-передачи имущества от Поставщика в Кооператив */
	document: ModelTypes["AssetContributionActSignedDocumentInput"],
	/** Идентификатор обмена */
	exchange_id: string,
	/** Имя аккаунта пользователя */
	username: string
};
	["ContactsDTO"]: {
		chairman: ModelTypes["PublicChairman"],
	details: ModelTypes["OrganizationDetails"],
	email: string,
	full_address: string,
	full_name: string,
	phone: string
};
	["CooperativeOperatorAccount"]: {
		/** Количество активных участников */
	active_participants_count: number,
	/** Объявление кооператива */
	announce: string,
	/** Тип кооператива */
	coop_type: string,
	/** Дата создания */
	created_at: string,
	/** Описание кооператива */
	description: string,
	/** Документ кооператива */
	document: ModelTypes["SignedBlockchainDocument"],
	/** Начальный взнос */
	initial: string,
	/** Разветвленный ли кооператив */
	is_branched: boolean,
	/** Является ли это кооперативом */
	is_cooperative: boolean,
	/** Включен ли кооператив */
	is_enrolled: boolean,
	/** Метаинформация */
	meta: string,
	/** Минимальный взнос */
	minimum: string,
	/** Начальный взнос организации */
	org_initial: string,
	/** Минимальный взнос организации */
	org_minimum: string,
	/** Регистрационный взнос организации */
	org_registration: string,
	/** Родительское имя аккаунта кооператива */
	parent_username: string,
	/** Реферал кооператива */
	referer: string,
	/** Дата регистрации */
	registered_at: string,
	/** Регистрационный взнос */
	registration: string,
	/** Регистратор кооператива */
	registrator: string,
	/** Статус кооператива */
	status: string,
	/** Список хранилищ */
	storages: Array<string>,
	/** Тип учетной записи */
	type: string,
	/** Имя аккаунта кооператива */
	username: string,
	/** Дата регистрации */
	verifications: Array<ModelTypes["Verification"]>
};
	["Country"]:Country;
	["CreateAnnualGeneralMeetInput"]: {
	/** Повестка собрания */
	agenda: Array<ModelTypes["AgendaGeneralMeetPointInput"]>,
	/** Время закрытия собрания */
	close_at: ModelTypes["DateTime"],
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Имя аккаунта инициатора */
	initiator: string,
	/** Время открытия собрания */
	open_at: ModelTypes["DateTime"],
	/** Имя аккаунта председателя */
	presider: string,
	/** Предложение повестки собрания */
	proposal: ModelTypes["AnnualGeneralMeetingAgendaSignedDocumentInput"],
	/** Имя аккаунта секретаря */
	secretary: string
};
	["CreateBankAccountInput"]: {
	/** Данные для банковского перевода */
	data: ModelTypes["BankAccountInput"],
	/** Флаг основного метода платежа, который отображается в документах */
	is_default: boolean,
	/** Имя аккаунта пользователя */
	username: string
};
	["CreateBranchInput"]: {
	/** Документ, на основании которого действует Уполномоченный (решение совета №СС-.. от ..) */
	based_on: string,
	/** Имя аккаунта кооперативного участка */
	braname: string,
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Электронная почта */
	email: string,
	/** Фактический адрес */
	fact_address: string,
	/** Полное имя организации кооперативного участка */
	full_name: string,
	/** Телефон */
	phone: string,
	/** Краткое имя организации кооперативного участка */
	short_name: string,
	/** Имя аккаунта уполномоченного (председателя) кооперативного участка */
	trustee: string
};
	["CreateChildOrderInput"]: {
	/** Имя кооператива */
	coopname: string,
	/** Дополнительные данные, специфичные для заявки */
	data: string,
	/** Подписанное заявление на возврат паевого взноса имуществом от Заказчика */
	document: ModelTypes["ReturnByAssetStatementSignedDocumentInput"],
	/** Метаданные о заявке */
	meta: string,
	/** Идентификатор родительской заявки */
	parent_id: number,
	/** Время жизни продукта, заявляемое поставщиком (в секундах) */
	product_lifecycle_secs: number,
	/** Идентификатор программы */
	program_id: number,
	/** Цена за единицу (штуку) товара или результата услуги в формате "10.0000 RUB" */
	unit_cost: string,
	/** Количество частей (штук) товара или услуги */
	units: number,
	/** Имя пользователя, инициирующего или обновляющего заявку */
	username: string
};
	["CreateDepositPaymentInput"]: {
	/** Сумма взноса */
	quantity: number,
	/** Символ валюты */
	symbol: string,
	/** Имя аккаунта пользователя */
	username: string
};
	["CreateEntrepreneurDataInput"]: {
	/** Банковский счет */
	bank_account: ModelTypes["BankAccountInput"],
	/** Дата рождения */
	birthdate: string,
	/** Город */
	city: string,
	/** Страна */
	country: ModelTypes["Country"],
	/** Детали индивидуального предпринимателя */
	details: ModelTypes["EntrepreneurDetailsInput"],
	/** Имя */
	first_name: string,
	/** Полный адрес */
	full_address: string,
	/** Фамилия */
	last_name: string,
	/** Отчество */
	middle_name: string,
	/** Телефон */
	phone: string
};
	["CreateIndividualDataInput"]: {
	/** Дата рождения */
	birthdate: string,
	/** Имя */
	first_name: string,
	/** Полный адрес */
	full_address: string,
	/** Фамилия */
	last_name: string,
	/** Отчество */
	middle_name: string,
	/** Данные паспорта */
	passport?: ModelTypes["PassportInput"] | undefined | null,
	/** Телефон */
	phone: string
};
	["CreateInitialPaymentInput"]: {
	/** Имя аккаунта пользователя */
	username: string
};
	["CreateOrganizationDataInput"]: {
	/** Банковский счет организации */
	bank_account: ModelTypes["BankAccountInput"],
	/** Город */
	city: string,
	/** Страна */
	country: string,
	/** Детали организации */
	details: ModelTypes["OrganizationDetailsInput"],
	/** Фактический адрес */
	fact_address: string,
	/** Полный адрес */
	full_address: string,
	/** Полное наименование организации */
	full_name: string,
	/** Телефон */
	phone: string,
	/** Представитель организации */
	represented_by: ModelTypes["RepresentedByInput"],
	/** Краткое наименование организации */
	short_name: string,
	/** Тип организации */
	type: ModelTypes["OrganizationType"]
};
	["CreateParentOfferInput"]: {
	/** Имя кооператива */
	coopname: string,
	/** Дополнительные данные, специфичные для заявки */
	data: string,
	/** Метаданные о заявке */
	meta: string,
	/** Идентификатор родительской заявки */
	parent_id: number,
	/** Время жизни продукта, заявляемое поставщиком (в секундах) */
	product_lifecycle_secs: number,
	/** Идентификатор программы */
	program_id: number,
	/** Цена за единицу (штуку) товара или услуги в формате "10.0000 RUB" */
	unit_cost: string,
	/** Количество частей (штук) товара или услуги */
	units: number,
	/** Имя пользователя, инициирующего или обновляющего заявку */
	username: string
};
	["CreateProjectFreeDecisionInput"]: {
	/** Проект решения, которое предлагается принять */
	decision: string,
	/** Вопрос, который выносится на повестку */
	question: string
};
	["CreateWithdrawInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** ID метода платежа */
	method_id: string,
	/** Хеш платежа для связи с withdraw */
	payment_hash: string,
	/** Количество средств */
	quantity: number,
	/** Подписанное заявление на возврат средств */
	statement: ModelTypes["ReturnByMoneySignedDocumentInput"],
	/** Символ валюты */
	symbol: string,
	/** Имя пользователя */
	username: string
};
	["CreateWithdrawResponse"]: {
		/** Хеш созданной заявки на вывод */
	withdraw_hash: string
};
	["CreatedProjectFreeDecision"]: {
		/** Проект решения, которое предлагается принять */
	decision: string,
	/** Идентификатор проекта свободного решения */
	id: string,
	/** Вопрос, который выносится на повестку */
	question: string
};
	/** A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format. */
["DateTime"]:any;
	/** Комплексный объект решения совета, включающий в себя информацию о голосовавших членах совета, расширенное действие, которое привело к появлению решения, и агрегат документа самого решения. */
["DecisionDetailAggregate"]: {
		action: ModelTypes["ExtendedBlockchainAction"],
	documentAggregate: ModelTypes["DocumentAggregate"],
	votes_against: Array<ModelTypes["ExtendedBlockchainAction"]>,
	votes_for: Array<ModelTypes["ExtendedBlockchainAction"]>
};
	["DeclineRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Идентификатор обмена */
	exchange_id: number,
	/** Причина отказа */
	meta: string,
	/** Имя аккаунта пользователя */
	username: string
};
	["DeleteBranchInput"]: {
	/** Имя аккаунта кооперативного участка */
	braname: string,
	/** Имя аккаунта кооператива */
	coopname: string
};
	["DeletePaymentMethodInput"]: {
	/** Идентификатор метода оплаты */
	method_id: string,
	/** Имя пользователя, чей метод оплаты нужно удалить */
	username: string
};
	["DeleteTrustedAccountInput"]: {
	/** Имя аккаунта кооперативного участка */
	braname: string,
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Имя аккаунта доверонного лица, у которого отзывается право подписи за председателя кооперативного участка */
	trusted: string
};
	["DeliverOnRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Идентификатор обмена */
	exchange_id: number,
	/** Имя аккаунта пользователя */
	username: string
};
	["Desktop"]: {
		/** Имя шаблона рабочих столов */
	authorizedHome: string,
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Имя шаблона рабочих столов */
	layout: string,
	/** Имя шаблона рабочих столов */
	nonAuthorizedHome: string,
	/** Состав приложений рабочего стола */
	workspaces: Array<ModelTypes["DesktopWorkspace"]>
};
	["DesktopWorkspace"]: {
		/** Имя приложения */
	name: string,
	/** Отображаемое название приложения */
	title: string
};
	["DisputeOnRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Документ с аргументами спора */
	document: ModelTypes["JSONObject"],
	/** Идентификатор обмена */
	exchange_id: number,
	/** Имя аккаунта пользователя */
	username: string
};
	["DocumentAggregate"]: {
		document: ModelTypes["SignedDigitalDocument"],
	hash: string,
	rawDocument?: ModelTypes["GeneratedDocument"] | undefined | null
};
	/** Комплексный объект папки цифрового документа с агрегатами, который включает в себя заявление, решение, акты и связанные документы */
["DocumentPackageAggregate"]: {
		/** Массив объект(ов) актов с агрегатами, относящихся к заявлению */
	acts: Array<ModelTypes["ActDetailAggregate"]>,
	/** Объект цифрового документа решения с агрегатом */
	decision?: ModelTypes["DecisionDetailAggregate"] | undefined | null,
	/** Массив связанных документов с агрегатами, извлечённых из мета-данных */
	links: Array<ModelTypes["DocumentAggregate"]>,
	/** Объект цифрового документа заявления с агрегатом */
	statement?: ModelTypes["StatementDetailAggregate"] | undefined | null
};
	["DocumentsAggregatePaginationResult"]: {
		/** Текущая страница */
	currentPage: number,
	/** Элементы текущей страницы */
	items: Array<ModelTypes["DocumentPackageAggregate"]>,
	/** Общее количество элементов */
	totalCount: number,
	/** Общее количество страниц */
	totalPages: number
};
	["EditBranchInput"]: {
	/** Документ, на основании которого действует Уполномоченный (решение совета №СС-.. от ..) */
	based_on: string,
	/** Имя аккаунта кооперативного участка */
	braname: string,
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Электронная почта */
	email: string,
	/** Фактический адрес */
	fact_address: string,
	/** Полное имя организации кооперативного участка */
	full_name: string,
	/** Телефон */
	phone: string,
	/** Краткое имя организации кооперативного участка */
	short_name: string,
	/** Имя аккаунта уполномоченного (председателя) кооперативного участка */
	trustee: string
};
	["Entrepreneur"]: {
		/** Дата рождения */
	birthdate: string,
	/** Город */
	city: string,
	/** Страна */
	country: string,
	/** Детали ИП (ИНН, ОГРН) */
	details: ModelTypes["EntrepreneurDetails"],
	/** Email */
	email: string,
	/** Имя */
	first_name: string,
	/** Юридический адрес */
	full_address: string,
	/** Фамилия */
	last_name: string,
	/** Отчество */
	middle_name: string,
	/** Телефон */
	phone: string,
	/** Имя аккаунта */
	username: string
};
	["EntrepreneurCertificate"]: {
		/** Имя */
	first_name: string,
	/** ИНН */
	inn: string,
	/** Фамилия */
	last_name: string,
	/** Отчество */
	middle_name?: string | undefined | null,
	/** Тип аккаунта */
	type: ModelTypes["AccountType"],
	/** Имя аккаунта */
	username: string
};
	["EntrepreneurDetails"]: {
		/** ИНН */
	inn: string,
	/** ОГРН */
	ogrn: string
};
	["EntrepreneurDetailsInput"]: {
	/** ИНН */
	inn: string,
	/** ОГРН */
	ogrn: string
};
	/** Расширенное действие блокчейна с сертификатом пользователя, совершившего его. */
["ExtendedBlockchainAction"]: {
		account: string,
	account_ram_deltas: Array<ModelTypes["AccountRamDelta"]>,
	action_ordinal: number,
	/** Сертификат пользователя (сокращенная информация) */
	actor_certificate?: ModelTypes["UserCertificateUnion"] | undefined | null,
	authorization: Array<ModelTypes["ActionAuthorization"]>,
	block_id: string,
	block_num: number,
	chain_id: string,
	console: string,
	context_free: boolean,
	creator_action_ordinal: number,
	/** Данные действия в формате JSON */
	data: ModelTypes["JSON"],
	elapsed: number,
	global_sequence: string,
	name: string,
	receipt: ModelTypes["ActionReceipt"],
	receiver: string,
	transaction_id: string
};
	["ExtendedMeetStatus"]:ExtendedMeetStatus;
	["Extension"]: {
		/** Настройки конфигурации для расширения */
	config?: ModelTypes["JSON"] | undefined | null,
	/** Дата создания расширения */
	created_at: ModelTypes["DateTime"],
	/** Описание расширения */
	description?: string | undefined | null,
	/** Показывает, включено ли расширение */
	enabled: boolean,
	/** Внешняя ссылка на iframe-интерфейс расширения */
	external_url?: string | undefined | null,
	/** Изображение для расширения */
	image?: string | undefined | null,
	/** Поле инструкция для установки (INSTALL) */
	instructions: string,
	/** Показывает, доступно ли расширение */
	is_available: boolean,
	/** Показывает, встроенное ли это расширение */
	is_builtin: boolean,
	/** Показывает, рабочий стол ли это */
	is_desktop: boolean,
	/** Показывает, установлено ли расширение */
	is_installed: boolean,
	/** Показывает, внутреннее ли это расширение */
	is_internal: boolean,
	/** Уникальное имя расширения */
	name: string,
	/** Поле подробного текстового описания (README) */
	readme: string,
	/** Схема настроек конфигурации для расширения */
	schema?: ModelTypes["JSON"] | undefined | null,
	/** Массив тегов для расширения */
	tags: Array<string>,
	/** Заголовок расширения */
	title?: string | undefined | null,
	/** Дата последнего обновления расширения */
	updated_at: ModelTypes["DateTime"]
};
	["ExtensionInput"]: {
	/** Объект конфигурации расширения */
	config: ModelTypes["JSON"],
	/** Дата установки расширения */
	created_at?: ModelTypes["DateTime"] | undefined | null,
	/** Флаг того, включено ли расширение сейчас */
	enabled: boolean,
	/** Уникальное имя расширения (является идентификатором) */
	name: string,
	/** Дата обновления расширения */
	updated_at?: ModelTypes["DateTime"] | undefined | null
};
	["FreeDecisionGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Идентификатор протокола решения собрания совета */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Идентификатор проекта решения */
	project_id: string,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["GatewayPayment"]: {
		/** Данные из блокчейна */
	blockchain_data?: ModelTypes["JSON"] | undefined | null,
	/** Можно ли изменить статус */
	can_change_status: boolean,
	/** Название кооператива */
	coopname: string,
	/** Дата создания */
	created_at: ModelTypes["DateTime"],
	/** Направление платежа */
	direction: ModelTypes["PaymentDirection"],
	/** Человекочитаемое направление платежа */
	direction_label: string,
	/** Дата истечения */
	expired_at?: ModelTypes["DateTime"] | undefined | null,
	/** Форматированная сумма */
	formatted_amount: string,
	/** Хеш платежа */
	hash?: string | undefined | null,
	/** Уникальный идентификатор платежа */
	id?: string | undefined | null,
	/** Хеш входящего платежа (устарело) */
	income_hash?: string | undefined | null,
	/** Завершен ли платеж окончательно */
	is_final: boolean,
	/** Дополнительная информация */
	memo?: string | undefined | null,
	/** Сообщение */
	message?: string | undefined | null,
	/** Хеш исходящего платежа (устарело) */
	outcome_hash?: string | undefined | null,
	/** Детали платежа */
	payment_details?: ModelTypes["PaymentDetails"] | undefined | null,
	/** ID платежного метода */
	payment_method_id?: string | undefined | null,
	/** Провайдер платежа */
	provider?: string | undefined | null,
	/** Количество/сумма */
	quantity: number,
	/** Подписанный документ заявления */
	statement?: ModelTypes["JSON"] | undefined | null,
	/** Статус платежа */
	status: ModelTypes["PaymentStatus"],
	/** Человекочитаемый статус */
	status_label: string,
	/** Символ валюты */
	symbol: string,
	/** Тип платежа */
	type: ModelTypes["PaymentType"],
	/** Человекочитаемый тип платежа */
	type_label: string,
	/** Дата обновления */
	updated_at?: ModelTypes["DateTime"] | undefined | null,
	/** Имя пользователя */
	username: string,
	/** Сертификат пользователя, создавшего платеж */
	username_certificate?: ModelTypes["UserCertificateUnion"] | undefined | null
};
	["GenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["GenerateDocumentOptionsInput"]: {
	/** Язык документа */
	lang?: string | undefined | null,
	/** Пропустить сохранение */
	skip_save?: boolean | undefined | null
};
	["GeneratedDocument"]: {
		/** Бинарное содержимое документа (base64) */
	binary: string,
	/** Полное название документа */
	full_title: string,
	/** Хэш документа */
	hash: string,
	/** HTML содержимое документа */
	html: string,
	/** Метаданные документа */
	meta: ModelTypes["JSON"]
};
	["GetAccountInput"]: {
	/** Имя аккаунта пользователя */
	username: string
};
	["GetAccountsInput"]: {
	role?: string | undefined | null
};
	["GetBranchesInput"]: {
	/** Фильтр по имени аккаунта кооперативного участка */
	braname?: string | undefined | null,
	/** Имя аккаунта кооператива */
	coopname: string
};
	["GetDocumentsInput"]: {
	filter: ModelTypes["JSON"],
	limit?: number | undefined | null,
	page?: number | undefined | null,
	type?: string | undefined | null,
	username: string
};
	["GetExtensionsInput"]: {
	/** Фильтр включенных расширений */
	enabled?: boolean | undefined | null,
	/** Фильтр активности */
	is_available?: boolean | undefined | null,
	/** Фильтр рабочих столов */
	is_desktop?: boolean | undefined | null,
	/** Фильтр установленных расширений */
	is_installed?: boolean | undefined | null,
	/** Фильтр по имени */
	name?: string | undefined | null
};
	["GetMeetInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Хеш собрания */
	hash: string
};
	["GetMeetsInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string
};
	["GetPaymentMethodsInput"]: {
	/** Количество элементов на странице */
	limit: number,
	/** Номер страницы */
	page: number,
	/** Ключ сортировки (например, "name") */
	sortBy?: string | undefined | null,
	/** Направление сортировки ("ASC" или "DESC") */
	sortOrder: string,
	/** Имя пользователя для фильтрации методов оплаты */
	username?: string | undefined | null
};
	["Individual"]: {
		/** Дата рождения */
	birthdate: string,
	/** Email */
	email: string,
	/** Имя */
	first_name: string,
	/** Полный адрес */
	full_address: string,
	/** Фамилия */
	last_name: string,
	/** Отчество */
	middle_name: string,
	/** Данные паспорта */
	passport?: ModelTypes["Passport"] | undefined | null,
	/** Телефон */
	phone: string,
	/** Имя аккаунта */
	username: string
};
	["IndividualCertificate"]: {
		/** Имя */
	first_name: string,
	/** Фамилия */
	last_name: string,
	/** Отчество */
	middle_name?: string | undefined | null,
	/** Тип аккаунта */
	type: ModelTypes["AccountType"],
	/** Имя аккаунта */
	username: string
};
	["Init"]: {
	/** Объект организации кооператива, которая обслуживает данный экземпляр программного обеспечения MONO */
	organization_data: ModelTypes["CreateOrganizationDataInput"],
	/** Переменные кооператива, используемые для заполнения шаблонов документов */
	vars: ModelTypes["VarsInput"]
};
	["Install"]: {
	soviet: Array<ModelTypes["SovietMemberInput"]>,
	wif: string
};
	/** The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
["JSON"]:any;
	/** The `JSONObject` scalar type represents JSON objects as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
["JSONObject"]:any;
	["KeyWeight"]: {
		/** Ключ */
	key: string,
	/** Вес */
	weight: number
};
	["LoginInput"]: {
	/** Электронная почта */
	email: string,
	/** Метка времени в строковом формате ISO */
	now: string,
	/** Цифровая подпись метки времени */
	signature: string
};
	["LogoutInput"]: {
	/** Токен обновления */
	access_token: string,
	/** Токен доступа */
	refresh_token: string
};
	/** Данные о собрании кооператива */
["Meet"]: {
		/** Документ с решением совета о проведении собрания */
	authorization?: ModelTypes["DocumentAggregate"] | undefined | null,
	/** Дата закрытия собрания */
	close_at: ModelTypes["DateTime"],
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Дата создания собрания */
	created_at: ModelTypes["DateTime"],
	/** Текущий процент кворума */
	current_quorum_percent: number,
	/** Цикл собрания */
	cycle: number,
	/** Документ с решением секретаря */
	decision1?: ModelTypes["DocumentAggregate"] | undefined | null,
	/** Документ с решением председателя */
	decision2?: ModelTypes["DocumentAggregate"] | undefined | null,
	/** Хеш собрания */
	hash: string,
	/** Уникальный идентификатор собрания */
	id: number,
	/** Инициатор собрания */
	initiator: string,
	/** Сертификат инициатора собрания */
	initiator_certificate?: ModelTypes["UserCertificateUnion"] | undefined | null,
	/** Уровень собрания */
	level: string,
	/** Список пользователей, которые подписали уведомление */
	notified_users: Array<string>,
	/** Дата открытия собрания */
	open_at: ModelTypes["DateTime"],
	/** Председатель собрания */
	presider: string,
	/** Сертификат председателя собрания */
	presider_certificate?: ModelTypes["UserCertificateUnion"] | undefined | null,
	/** Документ с повесткой собрания */
	proposal?: ModelTypes["DocumentAggregate"] | undefined | null,
	/** Флаг достижения кворума */
	quorum_passed: boolean,
	/** Процент необходимого кворума */
	quorum_percent: number,
	/** Секретарь собрания */
	secretary: string,
	/** Сертификат секретаря собрания */
	secretary_certificate?: ModelTypes["UserCertificateUnion"] | undefined | null,
	/** Количество подписанных бюллетеней */
	signed_ballots: number,
	/** Статус собрания */
	status: string,
	/** Тип собрания */
	type: string
};
	/** Агрегат данных о собрании, содержащий информацию о разных этапах */
["MeetAggregate"]: {
		/** Хеш собрания */
	hash: string,
	/** Данные собрания на этапе предварительной обработки */
	pre?: ModelTypes["MeetPreProcessing"] | undefined | null,
	/** Данные собрания после обработки */
	processed?: ModelTypes["MeetProcessed"] | undefined | null,
	/** Данные собрания на этапе обработки */
	processing?: ModelTypes["MeetProcessing"] | undefined | null
};
	/** Предварительные данные собрания перед обработкой */
["MeetPreProcessing"]: {
		/** Повестка собрания */
	agenda: Array<ModelTypes["AgendaMeetPoint"]>,
	/** Дата закрытия собрания */
	close_at: ModelTypes["DateTime"],
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Хеш собрания */
	hash: string,
	/** Инициатор собрания */
	initiator: string,
	/** Сертификат инициатора собрания */
	initiator_certificate?: ModelTypes["UserCertificateUnion"] | undefined | null,
	/** Дата открытия собрания */
	open_at: ModelTypes["DateTime"],
	/** Председатель собрания */
	presider: string,
	/** Сертификат председателя собрания */
	presider_certificate?: ModelTypes["UserCertificateUnion"] | undefined | null,
	/** Документ с предложением повестки собрания */
	proposal?: ModelTypes["DocumentAggregate"] | undefined | null,
	/** Секретарь собрания */
	secretary: string,
	/** Сертификат секретаря собрания */
	secretary_certificate?: ModelTypes["UserCertificateUnion"] | undefined | null
};
	/** Данные о собрании после обработки */
["MeetProcessed"]: {
		/** Имя кооператива */
	coopname: string,
	/** Документ решения из блокчейна */
	decision: ModelTypes["SignedDigitalDocument"],
	/** Агрегат документа решения */
	decisionAggregate?: ModelTypes["DocumentAggregate"] | undefined | null,
	/** Хеш собрания */
	hash: string,
	/** Председатель собрания */
	presider: string,
	/** Сертификат председателя собрания */
	presider_certificate?: ModelTypes["UserCertificateUnion"] | undefined | null,
	/** Пройден ли кворум */
	quorum_passed: boolean,
	/** Процент кворума */
	quorum_percent: number,
	/** Результаты голосования по вопросам */
	results: Array<ModelTypes["MeetQuestionResult"]>,
	/** Секретарь собрания */
	secretary: string,
	/** Сертификат секретаря собрания */
	secretary_certificate?: ModelTypes["UserCertificateUnion"] | undefined | null,
	/** Количество подписанных бюллетеней */
	signed_ballots: number
};
	/** Данные о собрании в процессе обработки */
["MeetProcessing"]: {
		/** Расширенный статус собрания на основе дат и состояния */
	extendedStatus: ModelTypes["ExtendedMeetStatus"],
	/** Хеш собрания */
	hash: string,
	/** Флаг указывающий, голосовал ли текущий пользователь */
	isVoted: boolean,
	/** Основная информация о собрании */
	meet: ModelTypes["Meet"],
	/** Список вопросов повестки собрания */
	questions: Array<ModelTypes["Question"]>
};
	/** Результат голосования по вопросу */
["MeetQuestionResult"]: {
		/** Принят ли вопрос */
	accepted: boolean,
	/** Контекст вопроса */
	context: string,
	/** Принятое решение */
	decision: string,
	/** Порядковый номер вопроса */
	number: number,
	/** Идентификатор вопроса */
	question_id: number,
	/** Заголовок вопроса */
	title: string,
	/** Количество воздержавшихся */
	votes_abstained: number,
	/** Количество голосов против */
	votes_against: number,
	/** Количество голосов за */
	votes_for: number
};
	["MetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** ID документа в реестре */
	registry_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["ModerateRequestInput"]: {
	/** Размер комиссии за отмену в формате "10.0000 RUB" */
	cancellation_fee: string,
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Идентификатор обмена */
	exchange_id: number,
	/** Имя аккаунта пользователя */
	username: string
};
	["MonoAccount"]: {
		/** Электронная почта пользователя */
	email: string,
	/** Есть ли у пользователя аккаунт */
	has_account: boolean,
	/** ID начального заказа */
	initial_order?: string | undefined | null,
	/** Подтверждена ли электронная почта */
	is_email_verified: boolean,
	/** Зарегистрирован ли пользователь */
	is_registered: boolean,
	/** Сообщение */
	message?: string | undefined | null,
	/** Публичный ключ пользователя */
	public_key: string,
	/** Реферер пользователя */
	referer: string,
	/** Роль пользователя */
	role: string,
	/** Статус пользователя */
	status: ModelTypes["UserStatus"],
	/** Хэш подписчика для уведомлений */
	subscriber_hash: string,
	/** Идентификатор подписчика для уведомлений */
	subscriber_id: string,
	/** Тип пользователя */
	type: string,
	/** Имя пользователя */
	username: string
};
	["Mutation"]: {
		/** Подтвердить поставку имущества на заявку */
	acceptChildOrder: ModelTypes["Transaction"],
	/** Добавить активного пайщика, который вступил в кооператив, не используя платформу (заполнив заявление собственноручно, оплатив вступительный и минимальный паевый взносы, и получив протокол решения совета) */
	addParticipant: ModelTypes["Account"],
	/** Добавить доверенное лицо кооперативного участка */
	addTrustedAccount: ModelTypes["Branch"],
	/** Отменить заявку */
	cancelRequest: ModelTypes["Transaction"],
	/** Завершить заявку по истечению гарантийного срока */
	completeRequest: ModelTypes["Transaction"],
	/** Подтвердить получение имущества Уполномоченным лицом от Заказчика по новации и акту приёмки-передачи */
	confirmReceiveOnRequest: ModelTypes["Transaction"],
	/** Подтвердить поставку имущества Поставщиком по заявке Заказчика и акту приёма-передачи */
	confirmSupplyOnRequest: ModelTypes["Transaction"],
	/** Сгенерировать документ предложения повестки очередного общего собрания пайщиков */
	createAnnualGeneralMeet: ModelTypes["MeetAggregate"],
	/** Добавить метод оплаты */
	createBankAccount: ModelTypes["PaymentMethod"],
	/** Создать кооперативный участок */
	createBranch: ModelTypes["Branch"],
	/** Создать заявку на поставку имущества по предложению Поставщика */
	createChildOrder: ModelTypes["Transaction"],
	/** Создание объекта паевого платежа производится мутацией createDepositPayment. Выполнение мутации возвращает идентификатор платежа и данные для его совершения в зависимости от выбранного платежного провайдера. */
	createDepositPayment: ModelTypes["GatewayPayment"],
	/** Создание объекта регистрационного платежа производится мутацией createInitialPayment. Выполнение мутации возвращает идентификатор платежа и данные для его совершения в зависимости от выбранного платежного провайдера. */
	createInitialPayment: ModelTypes["GatewayPayment"],
	/** Создать предложение на поставку имущества */
	createParentOffer: ModelTypes["Transaction"],
	/** Создать повестку дня и проект решения, и сохранить в хранилище для дальнейшей генерации документа и его публикации */
	createProjectOfFreeDecision: ModelTypes["CreatedProjectFreeDecision"],
	/** Создать заявку на вывод средств */
	createWithdraw: ModelTypes["CreateWithdrawResponse"],
	/** Отклонить заявку */
	declineRequest: ModelTypes["Transaction"],
	/** Удалить кооперативный участок */
	deleteBranch: boolean,
	/** Удалить метод оплаты */
	deletePaymentMethod: boolean,
	/** Удалить доверенное лицо кооперативного участка */
	deleteTrustedAccount: ModelTypes["Branch"],
	/** Подтвердить доставку имущества Заказчику по заявке */
	deliverOnRequest: ModelTypes["Transaction"],
	/** Открыть спор по заявке */
	disputeOnRequest: ModelTypes["Transaction"],
	/** Изменить кооперативный участок */
	editBranch: ModelTypes["Branch"],
	/** Сгенерировать предложение повестки общего собрания пайщиков */
	generateAnnualGeneralMeetAgendaDocument: ModelTypes["GeneratedDocument"],
	/** Сгенерировать документ решения общего собрания пайщиков */
	generateAnnualGeneralMeetDecisionDocument: ModelTypes["GeneratedDocument"],
	/** Сгенерировать документ уведомления о проведении общего собрания пайщиков */
	generateAnnualGeneralMeetNotificationDocument: ModelTypes["GeneratedDocument"],
	/** Сгенерировать документ акта приема-передачи. */
	generateAssetContributionAct: ModelTypes["GeneratedDocument"],
	/** Сгенерировать документ решения о вступлении в кооператив. */
	generateAssetContributionDecision: ModelTypes["GeneratedDocument"],
	/** Сгенерировать документ заявления о вступлении в кооператив. */
	generateAssetContributionStatement: ModelTypes["GeneratedDocument"],
	/** Сгенерировать бюллетень для голосования на общем собрании пайщиков */
	generateBallotForAnnualGeneralMeetDocument: ModelTypes["GeneratedDocument"],
	/** Сгенерировать протокол решения по предложенной повестке */
	generateFreeDecision: ModelTypes["GeneratedDocument"],
	/** Сгенерировать документ заявления о вступлении в кооператив. */
	generateParticipantApplication: ModelTypes["GeneratedDocument"],
	/** Сгенерировать документ протокол решения собрания совета */
	generateParticipantApplicationDecision: ModelTypes["GeneratedDocument"],
	/** Сгенерировать документ согласия с политикой конфиденциальности. */
	generatePrivacyAgreement: ModelTypes["GeneratedDocument"],
	/** Сгенерировать документ проекта свободного решения */
	generateProjectOfFreeDecision: ModelTypes["GeneratedDocument"],
	/** Сгенерировать документ акта возврата имущества. */
	generateReturnByAssetAct: ModelTypes["GeneratedDocument"],
	/** Сгенерировать документ решения о возврате имущества. */
	generateReturnByAssetDecision: ModelTypes["GeneratedDocument"],
	/** Сгенерировать документ заявления о возврате имущества. */
	generateReturnByAssetStatement: ModelTypes["GeneratedDocument"],
	/** Сгенерировать документ решения совета о возврате паевого взноса */
	generateReturnByMoneyDecisionDocument: ModelTypes["GeneratedDocument"],
	/** Сгенерировать документ заявления на возврат паевого взноса */
	generateReturnByMoneyStatementDocument: ModelTypes["GeneratedDocument"],
	/** Сгенерировать документ, подтверждающий выбор кооперативного участка */
	generateSelectBranchDocument: ModelTypes["GeneratedDocument"],
	/** Сгенерировать документ соглашения о порядка и правилах использования простой электронной подписи. */
	generateSignatureAgreement: ModelTypes["GeneratedDocument"],
	/** Сгенерировать документ решения Совета по проведению общего собрания пайщиков */
	generateSovietDecisionOnAnnualMeetDocument: ModelTypes["GeneratedDocument"],
	/** Сгенерировать документ пользовательского соглашения. */
	generateUserAgreement: ModelTypes["GeneratedDocument"],
	/** Сгенерировать документ соглашения о целевой потребительской программе "Цифровой Кошелёк" */
	generateWalletAgreement: ModelTypes["GeneratedDocument"],
	/** Произвести инициализацию программного обеспечения перед установкой совета методом install */
	initSystem: ModelTypes["SystemInfo"],
	/** Установить расширение */
	installExtension: ModelTypes["Extension"],
	/** Произвести установку членов совета перед началом работы */
	installSystem: ModelTypes["SystemInfo"],
	/** Войти в систему с помощью цифровой подписи и получить JWT-токены доступа */
	login: ModelTypes["RegisteredAccount"],
	/** Выйти из системы и заблокировать JWT-токены */
	logout: boolean,
	/** Модерировать заявку */
	moderateRequest: ModelTypes["Transaction"],
	/** Уведомление о проведении общего собрания пайщиков */
	notifyOnAnnualGeneralMeet: ModelTypes["MeetAggregate"],
	/** Отклонить модерацию по заявке */
	prohibitRequest: ModelTypes["Transaction"],
	/** Опубликовать предложенную повестку и проект решения для дальнейшего голосования совета по нему */
	publishProjectOfFreeDecision: boolean,
	/** Опубликовать заявку */
	publishRequest: ModelTypes["Transaction"],
	/** Подтвердить получение имущества Уполномоченным лицом от Заказчика по акту приёмки-передачи */
	receiveOnRequest: ModelTypes["Transaction"],
	/** Обновить токен доступа аккаунта */
	refresh: ModelTypes["RegisteredAccount"],
	/** Зарегистрировать аккаунт пользователя в системе */
	registerAccount: ModelTypes["RegisteredAccount"],
	/** Зарегистрировать заявление и подписанные положения, подготовив пакет документов к отправке в совет на голосование после поступления оплаты. */
	registerParticipant: ModelTypes["Account"],
	/** Заменить приватный ключ аккаунта */
	resetKey: boolean,
	/** Перезапуск общего собрания пайщиков */
	restartAnnualGeneralMeet: ModelTypes["MeetAggregate"],
	/** Выбрать кооперативный участок */
	selectBranch: boolean,
	/** Управление статусом платежа осущствляется мутацией setPaymentStatus. При переходе платежа в статус PAID вызывается эффект в блокчейне, который завершает операцию автоматическим переводом платежа в статус COMPLETED. При установке статуса REFUNDED запускается процесс отмены платежа в блокчейне. Остальные статусы не приводят к эффектам в блокчейне. */
	setPaymentStatus: ModelTypes["GatewayPayment"],
	/** Сохранить приватный ключ в зашифрованном серверном хранилище */
	setWif: boolean,
	/** Подписание решения председателем на общем собрании пайщиков */
	signByPresiderOnAnnualGeneralMeet: ModelTypes["MeetAggregate"],
	/** Подписание решения секретарём на общем собрании пайщиков */
	signBySecretaryOnAnnualGeneralMeet: ModelTypes["MeetAggregate"],
	/** Выслать токен для замены приватного ключа аккаунта на электронную почту */
	startResetKey: boolean,
	/** Подтвердить поставку имущества Поставщиком по заявке Заказчика и акту приёма-передачи */
	supplyOnRequest: ModelTypes["Transaction"],
	/** Удалить расширение */
	uninstallExtension: boolean,
	/** Снять с публикации заявку */
	unpublishRequest: ModelTypes["Transaction"],
	/** Обновить аккаунт в системе провайдера. Обновление аккаунта пользователя производится по username. Мутация позволяет изменить приватные данные пользователя, а также, адрес электронной почты в MONO. Использовать мутацию может только председатель совета. */
	updateAccount: ModelTypes["Account"],
	/** Обновить банковский счёт */
	updateBankAccount: ModelTypes["PaymentMethod"],
	/** Обновить расширение */
	updateExtension: ModelTypes["Extension"],
	/** Обновить заявку */
	updateRequest: ModelTypes["Transaction"],
	/** Обновить параметры системы */
	updateSystem: ModelTypes["SystemInfo"],
	/** Голосование на общем собрании пайщиков */
	voteOnAnnualGeneralMeet: ModelTypes["MeetAggregate"]
};
	["NotifyOnAnnualGeneralMeetInput"]: {
	coopname: string,
	meet_hash: string,
	notification: ModelTypes["AnnualGeneralMeetingNotificationSignedDocumentInput"],
	username: string
};
	["Organization"]: {
		/** Город */
	city: string,
	/** Страна */
	country: string,
	/** Детали организации */
	details: ModelTypes["OrganizationDetails"],
	/** Email */
	email: string,
	/** Фактический адрес */
	fact_address: string,
	/** Юридический адрес */
	full_address: string,
	/** Полное название */
	full_name: string,
	/** Телефон */
	phone: string,
	/** Представитель организации */
	represented_by: ModelTypes["RepresentedBy"],
	/** Краткое название */
	short_name: string,
	/** Тип организации */
	type: string,
	/** Имя аккаунта организации */
	username: string
};
	["OrganizationCertificate"]: {
		/** ИНН */
	inn: string,
	/** ОГРН */
	ogrn: string,
	/** Данные представителя */
	represented_by: ModelTypes["RepresentedByCertificate"],
	/** Короткое название организации */
	short_name: string,
	/** Тип аккаунта */
	type: ModelTypes["AccountType"],
	/** Имя аккаунта */
	username: string
};
	["OrganizationDetails"]: {
		/** ИНН */
	inn: string,
	/** КПП */
	kpp: string,
	/** ОГРН */
	ogrn: string
};
	["OrganizationDetailsInput"]: {
	inn: string,
	kpp: string,
	ogrn: string
};
	["OrganizationType"]:OrganizationType;
	["PaginatedGatewayPaymentsPaginationResult"]: {
		/** Текущая страница */
	currentPage: number,
	/** Элементы текущей страницы */
	items: Array<ModelTypes["GatewayPayment"]>,
	/** Общее количество элементов */
	totalCount: number,
	/** Общее количество страниц */
	totalPages: number
};
	["PaginationInput"]: {
	/** Количество элементов на странице */
	limit: number,
	/** Номер страницы */
	page: number,
	/** Ключ сортировки (например, "name") */
	sortBy?: string | undefined | null,
	/** Направление сортировки ("ASC" или "DESC") */
	sortOrder: string
};
	["ParticipantAccount"]: {
		/** Имя кооперативного участка */
	braname?: string | undefined | null,
	/** Время создания записи о члене */
	created_at: ModelTypes["DateTime"],
	/** LEGACY Флаг, имеет ли член право голоса */
	has_vote: boolean,
	/** Сумма вступительного взноса */
	initial_amount?: string | undefined | null,
	/** LEGACY Флаг, внесен ли регистрационный взнос */
	is_initial: boolean,
	/** LEGACY Флаг, внесен ли минимальный паевый взнос */
	is_minimum: boolean,
	/** Время последнего минимального платежа */
	last_min_pay: ModelTypes["DateTime"],
	/** Время последнего обновления информации о члене */
	last_update: ModelTypes["DateTime"],
	/** Сумма минимального паевого взноса */
	minimum_amount?: string | undefined | null,
	/** Статус члена кооператива (accepted | blocked) */
	status: string,
	/** Тип участника (individual | entrepreneur | organization) */
	type?: string | undefined | null,
	/** Уникальное имя члена кооператива */
	username: string
};
	["ParticipantApplicationDecisionGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Идентификатор протокола решения собрания совета */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["ParticipantApplicationGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Имя аккаунта кооперативного участка */
	braname: string,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Изображение собственноручной подписи (base-64) */
	signature?: string | undefined | null,
	/** Флаг пропуска сохранения документа (используется для предварительной генерации и демонстрации пользователю) */
	skip_save: boolean,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["ParticipantApplicationSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	meta: ModelTypes["ParticipantApplicationSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<ModelTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["ParticipantApplicationSignedMetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Имя аккаунта кооперативного участка */
	braname: string,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** ID документа в реестре */
	registry_id: number,
	/** Изображение собственноручной подписи (base-64) */
	signature?: string | undefined | null,
	/** Флаг пропуска сохранения документа (используется для предварительной генерации и демонстрации пользователю) */
	skip_save: boolean,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["Passport"]: {
		/** Код подразделения */
	code: string,
	/** Дата выдачи */
	issued_at: string,
	/** Кем выдан */
	issued_by: string,
	/** Номер паспорта */
	number: number,
	/** Серия паспорта */
	series: number
};
	["PassportInput"]: {
	code: string,
	issued_at: string,
	issued_by: string,
	number: number,
	series: number
};
	["PaymentDetails"]: {
		/** Сумма платежа с учетом комиссии */
	amount_plus_fee: string,
	/** Сумма платежа без учета комиссии */
	amount_without_fee: string,
	/** Данные платежа (QR-код, токен, реквизиты и т.д.) */
	data: ModelTypes["JSON"],
	/** Фактический процент комиссии */
	fact_fee_percent: number,
	/** Размер комиссии в абсолютных значениях */
	fee_amount: string,
	/** Процент комиссии */
	fee_percent: number,
	/** Допустимый процент отклонения */
	tolerance_percent: number
};
	["PaymentDirection"]:PaymentDirection;
	["PaymentFiltersInput"]: {
	/** Название кооператива */
	coopname?: string | undefined | null,
	/** Направление платежа */
	direction?: ModelTypes["PaymentDirection"] | undefined | null,
	/** Хэш платежа */
	hash?: string | undefined | null,
	/** Провайдер платежа */
	provider?: string | undefined | null,
	/** Статус платежа */
	status?: ModelTypes["PaymentStatus"] | undefined | null,
	/** Тип платежа */
	type?: ModelTypes["PaymentType"] | undefined | null,
	/** Имя пользователя */
	username?: string | undefined | null
};
	["PaymentMethod"]: {
		/** Дата создания */
	created_at: ModelTypes["DateTime"],
	/** Данные метода оплаты */
	data: ModelTypes["PaymentMethodData"],
	/** Флаг основного метода платежа, который отображается в документах */
	is_default: boolean,
	/** Идентификатор метода оплаты */
	method_id: string,
	/** Тип метода оплаты (например, sbp, bank_transfer) */
	method_type: string,
	/** Дата обновления */
	updated_at: ModelTypes["DateTime"],
	/** Имя пользователя, к которому привязан метод оплаты */
	username: string
};
	["PaymentMethodData"]:ModelTypes["BankAccount"] | ModelTypes["SbpAccount"];
	["PaymentMethodPaginationResult"]: {
		/** Текущая страница */
	currentPage: number,
	/** Элементы текущей страницы */
	items: Array<ModelTypes["PaymentMethod"]>,
	/** Общее количество элементов */
	totalCount: number,
	/** Общее количество страниц */
	totalPages: number
};
	["PaymentStatus"]:PaymentStatus;
	["PaymentType"]:PaymentType;
	["Permission"]: {
		/** Родительское разрешение */
	parent: string,
	/** Имя разрешения */
	perm_name: string,
	/** Требуемые разрешения */
	required_auth: ModelTypes["Authority"]
};
	["PermissionLevel"]: {
		/** Актор */
	actor: string,
	/** Разрешение */
	permission: string
};
	["PermissionLevelWeight"]: {
		/** Уровень разрешения */
	permission: ModelTypes["PermissionLevel"],
	/** Вес */
	weight: number
};
	["PrivateAccount"]: {
		entrepreneur_data?: ModelTypes["Entrepreneur"] | undefined | null,
	individual_data?: ModelTypes["Individual"] | undefined | null,
	organization_data?: ModelTypes["Organization"] | undefined | null,
	/** Тип аккаунта */
	type: ModelTypes["AccountType"]
};
	["PrivateAccountSearchData"]:ModelTypes["Entrepreneur"] | ModelTypes["Individual"] | ModelTypes["Organization"];
	["PrivateAccountSearchResult"]: {
		/** Данные найденного аккаунта */
	data: ModelTypes["PrivateAccountSearchData"],
	/** Поля, в которых найдены совпадения */
	highlightedFields?: Array<string> | undefined | null,
	/** Оценка релевантности результата */
	score?: number | undefined | null,
	/** Тип аккаунта */
	type: string
};
	["ProhibitRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Идентификатор обмена */
	exchange_id: number,
	/** Дополнительная информация о отклоненной модерации */
	meta: string,
	/** Имя аккаунта пользователя */
	username: string
};
	["ProjectFreeDecisionGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Идентификатор проекта решения */
	project_id: string,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["ProjectFreeDecisionSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация для создания проекта свободного решения */
	meta: ModelTypes["ProjectFreeDecisionSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<ModelTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["ProjectFreeDecisionSignedMetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** Идентификатор проекта решения */
	project_id: string,
	/** ID документа в реестре */
	registry_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["PublicChairman"]: {
		first_name: string,
	last_name: string,
	middle_name: string
};
	["PublishProjectFreeDecisionInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Подписанный электронный документ (generateProjectOfFreeDecision) */
	document: ModelTypes["ProjectFreeDecisionSignedDocumentInput"],
	/** Строка мета-информации */
	meta: string,
	/** Имя аккаунта пользователя */
	username: string
};
	["PublishRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Идентификатор заявки */
	exchange_id: number,
	/** Имя аккаунта пользователя */
	username: string
};
	["Query"]: {
		/** Получить сводную информацию о аккаунте */
	getAccount: ModelTypes["Account"],
	/** Получить сводную информацию о аккаунтах системы */
	getAccounts: ModelTypes["AccountsPaginationResult"],
	/** Получить список вопросов совета кооператива для голосования */
	getAgenda: Array<ModelTypes["AgendaWithDocuments"]>,
	/** Получить список кооперативных участков */
	getBranches: Array<ModelTypes["Branch"]>,
	/** Получить состав приложений рабочего стола */
	getDesktop: ModelTypes["Desktop"],
	getDocuments: ModelTypes["DocumentsAggregatePaginationResult"],
	/** Получить список расширений */
	getExtensions: Array<ModelTypes["Extension"]>,
	/** Получить данные собрания по хешу */
	getMeet: ModelTypes["MeetAggregate"],
	/** Получить список всех собраний кооператива */
	getMeets: Array<ModelTypes["MeetAggregate"]>,
	/** Получить список методов оплаты */
	getPaymentMethods: ModelTypes["PaymentMethodPaginationResult"],
	/** Получить список платежей с возможностью фильтрации по типу, статусу и направлению. */
	getPayments: ModelTypes["PaginatedGatewayPaymentsPaginationResult"],
	/** Получить сводную публичную информацию о системе */
	getSystemInfo: ModelTypes["SystemInfo"],
	/** Поиск приватных данных аккаунтов по запросу. Поиск осуществляется по полям ФИО, ИНН, ОГРН, наименованию организации и другим приватным данным. */
	searchPrivateAccounts: Array<ModelTypes["PrivateAccountSearchResult"]>
};
	/** Вопрос повестки собрания с результатами голосования */
["Question"]: {
		/** Контекст или дополнительная информация по вопросу */
	context: string,
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Количество голосов "Воздержался" */
	counter_votes_abstained: number,
	/** Количество голосов "Против" */
	counter_votes_against: number,
	/** Количество голосов "За" */
	counter_votes_for: number,
	/** Предлагаемое решение по вопросу */
	decision: string,
	/** Уникальный идентификатор вопроса */
	id: number,
	/** Идентификатор собрания, к которому относится вопрос */
	meet_id: number,
	/** Порядковый номер вопроса в повестке */
	number: number,
	/** Заголовок вопроса */
	title: string,
	/** Список участников, проголосовавших "Воздержался" */
	voters_abstained: Array<string>,
	/** Список участников, проголосовавших "Против" */
	voters_against: Array<string>,
	/** Список участников, проголосовавших "За" */
	voters_for: Array<string>
};
	["ReceiveOnRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Подписанный Заказчиком акт приёмки-передачи имущества из Кооператива по новации */
	document: ModelTypes["ReturnByAssetActSignedDocumentInput"],
	/** Идентификатор заявки */
	exchange_id: number,
	/** Имя аккаунта пользователя */
	username: string
};
	["RefreshInput"]: {
	/** Токен доступа */
	access_token: string,
	/** Токен обновления */
	refresh_token: string
};
	["RefundRequest"]: {
		/** Сумма CPU */
	cpu_amount: string,
	/** Сумма сети */
	net_amount: string,
	/** Владелец */
	owner: string,
	/** Время запроса */
	request_time: string
};
	["RegisterAccountInput"]: {
	/** Электронная почта */
	email: string,
	/** Данные индивидуального предпринимателя */
	entrepreneur_data?: ModelTypes["CreateEntrepreneurDataInput"] | undefined | null,
	/** Данные физического лица */
	individual_data?: ModelTypes["CreateIndividualDataInput"] | undefined | null,
	/** Данные организации */
	organization_data?: ModelTypes["CreateOrganizationDataInput"] | undefined | null,
	/** Публичный ключ */
	public_key: string,
	/** Имя аккаунта реферера */
	referer?: string | undefined | null,
	/** Тип аккаунта */
	type: ModelTypes["AccountType"],
	/** Имя пользователя */
	username: string
};
	["RegisterParticipantInput"]: {
	/** Имя кооперативного участка */
	braname?: string | undefined | null,
	/** Подписанный документ политики конфиденциальности от пайщика */
	privacy_agreement: ModelTypes["SignedDigitalDocumentInput"],
	/** Подписанный документ положения о цифровой подписи от пайщика */
	signature_agreement: ModelTypes["SignedDigitalDocumentInput"],
	/** Подписанный документ заявления на вступление в кооператив от пайщика */
	statement: ModelTypes["ParticipantApplicationSignedDocumentInput"],
	/** Подписанный документ пользовательского соглашения от пайщика */
	user_agreement: ModelTypes["SignedDigitalDocumentInput"],
	/** Имя аккаунта пайщика */
	username: string,
	/** Подписанный документ положения целевой потребительской программы "Цифровой Кошелёк" от пайщика */
	wallet_agreement: ModelTypes["SignedDigitalDocumentInput"]
};
	["RegisteredAccount"]: {
		/** Информация об зарегистрированном аккаунте */
	account: ModelTypes["Account"],
	/** Токены доступа и обновления */
	tokens: ModelTypes["Tokens"]
};
	["RepresentedBy"]: {
		/** На основании чего действует */
	based_on: string,
	/** Имя */
	first_name: string,
	/** Фамилия */
	last_name: string,
	/** Отчество */
	middle_name: string,
	/** Должность */
	position: string
};
	["RepresentedByCertificate"]: {
		/** Имя */
	first_name: string,
	/** Фамилия */
	last_name: string,
	/** Отчество */
	middle_name: string,
	/** Должность */
	position: string
};
	["RepresentedByInput"]: {
	based_on: string,
	first_name: string,
	last_name: string,
	middle_name: string,
	position: string
};
	["ResetKeyInput"]: {
	/** Публичный ключ для замены */
	public_key: string,
	/** Токен авторизации для замены ключа, полученный по email */
	token: string
};
	["ResourceDelegationDTO"]: {
		/** Вес CPU */
	cpu_weight: string,
	/** Отправитель */
	from: string,
	/** Вес сети */
	net_weight: string,
	/** Получатель */
	to: string
};
	["ResourceOverview"]: {
		/** Вес CPU */
	cpu_weight: string,
	/** Вес сети */
	net_weight: string,
	/** Владелец */
	owner: string,
	/** Используемая RAM */
	ram_bytes: number
};
	/** DTO для перезапуска ежегодного общего собрания кооператива */
["RestartAnnualGeneralMeetInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Хеш собрания, которое необходимо перезапустить */
	hash: string,
	/** Новая дата закрытия собрания */
	new_close_at: ModelTypes["DateTime"],
	/** Новая дата открытия собрания */
	new_open_at: ModelTypes["DateTime"],
	/** Новое предложение повестки ежегодного общего собрания */
	newproposal: ModelTypes["AnnualGeneralMeetingAgendaSignedDocumentInput"]
};
	["ReturnByAssetActGenerateDocumentInput"]: {
	/** Идентификатор акта */
	act_id: string,
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Имя аккаунта кооперативного участка */
	braname?: string | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Идентификатор решения */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Идентификатор заявки */
	request_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя аккаунта получателя на кооперативном участке */
	transmitter: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["ReturnByAssetActSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация для создания проекта свободного решения */
	meta: ModelTypes["ReturnByAssetActSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<ModelTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["ReturnByAssetActSignedMetaDocumentInput"]: {
	/** Идентификатор акта */
	act_id: string,
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Имя аккаунта кооперативного участка */
	braname?: string | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Идентификатор решения */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** ID документа в реестре */
	registry_id: number,
	/** Идентификатор заявки */
	request_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя аккаунта получателя на кооперативном участке */
	transmitter: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["ReturnByAssetDecisionGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Идентификатор решения */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Идентификатор заявки */
	request_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["ReturnByAssetStatementGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Запрос на внесение имущественного паевого взноса */
	request: ModelTypes["CommonRequestInput"],
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["ReturnByAssetStatementSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация для создания проекта свободного решения */
	meta: ModelTypes["ReturnByAssetStatementSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<ModelTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["ReturnByAssetStatementSignedMetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** ID документа в реестре */
	registry_id: number,
	/** Запрос на внесение имущественного паевого взноса */
	request: ModelTypes["CommonRequestInput"],
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["ReturnByMoneyDecisionGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Валюта */
	currency: string,
	/** ID решения совета */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Хэш платежа */
	payment_hash: string,
	/** Количество средств к возврату */
	quantity: string,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["ReturnByMoneyGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Валюта */
	currency: string,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** ID платежного метода */
	method_id: string,
	/** Хеш платежа для связи с withdraw */
	payment_hash: string,
	/** Количество средств к возврату */
	quantity: string,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["ReturnByMoneySignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация для документа заявления на возврат паевого взноса денежными средствами */
	meta: ModelTypes["ReturnByMoneySignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<ModelTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["ReturnByMoneySignedMetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Валюта */
	currency: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** ID платежного метода */
	method_id: string,
	/** Хеш платежа для связи с withdraw */
	payment_hash: string,
	/** Количество средств к возврату */
	quantity: string,
	/** ID документа в реестре */
	registry_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["SbpAccount"]: {
		/** Мобильный телефон получателя */
	phone: string
};
	["SearchPrivateAccountsInput"]: {
	/** Поисковый запрос для поиска приватных аккаунтов */
	query: string
};
	["SelectBranchGenerateDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Идентификатор имени аккаунта кооперативного участка */
	braname: string,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["SelectBranchInput"]: {
	/** Имя аккаунта кооперативного участка */
	braname: string,
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Подписанный электронный документ (generateSelectBranchDocument) */
	document: ModelTypes["SelectBranchSignedDocumentInput"],
	/** Имя аккаунта пользователя */
	username: string
};
	["SelectBranchSignedDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация для документа выбора кооперативного участка */
	meta: ModelTypes["SelectBranchSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<ModelTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["SelectBranchSignedMetaDocumentInput"]: {
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Идентификатор имени аккаунта кооперативного участка */
	braname: string,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** ID документа в реестре */
	registry_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["SetPaymentStatusInput"]: {
	/** Идентификатор платежа, для которого устанавливается статус */
	id: string,
	/** Новый статус платежа */
	status: ModelTypes["PaymentStatus"]
};
	["SetWifInput"]: {
	/** Тип разрешения ключа */
	permission: string,
	/** Имя пользователя, чей ключ */
	username: string,
	/** Приватный ключ */
	wif: string
};
	/** Входные данные для подписи решения председателем */
["SignByPresiderOnAnnualGeneralMeetInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Хеш собрания */
	hash: string,
	/** Подписанный документ с решением председателя */
	presider_decision: ModelTypes["AnnualGeneralMeetingDecisionSignedDocumentInput"],
	/** Имя аккаунта пользователя */
	username: string
};
	/** Входные данные для подписи решения секретарём */
["SignBySecretaryOnAnnualGeneralMeetInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Хеш собрания */
	hash: string,
	/** Подписанный документ с решением секретаря */
	secretary_decision: ModelTypes["AnnualGeneralMeetingDecisionSignedDocumentInput"],
	/** Имя аккаунта пользователя */
	username: string
};
	["SignatureInfo"]: {
		id: number,
	is_valid?: boolean | undefined | null,
	meta: ModelTypes["JSON"],
	public_key: string,
	signature: string,
	signed_at: string,
	signed_hash: string,
	signer: string,
	/** Сертификат подписанта (сокращенная информация) */
	signer_certificate?: ModelTypes["UserCertificateUnion"] | undefined | null
};
	["SignatureInfoInput"]: {
	/** Идентификатор номера подписи */
	id: number,
	/** Мета-данные подписи */
	meta: string,
	/** Публичный ключ */
	public_key: string,
	/** Подпись хэша */
	signature: string,
	/** Время подписания */
	signed_at: string,
	/** Подписанный хэш */
	signed_hash: string,
	/** Аккаунт подписавшего */
	signer: string
};
	["SignedBlockchainDocument"]: {
		/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация документа (в формате JSON-строки) */
	meta: string,
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<ModelTypes["SignatureInfo"]>,
	/** Версия стандарта документа */
	version: string
};
	["SignedDigitalDocument"]: {
		doc_hash: string,
	hash: string,
	meta: ModelTypes["JSON"],
	meta_hash: string,
	signatures: Array<ModelTypes["SignatureInfo"]>,
	version: string
};
	["SignedDigitalDocumentInput"]: {
	/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация документа */
	meta: ModelTypes["MetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<ModelTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["SovietMemberInput"]: {
	individual_data: ModelTypes["CreateIndividualDataInput"],
	role: string
};
	["StartResetKeyInput"]: {
	/** Электронная почта */
	email: string
};
	/** Комплексный объект цифрового документа заявления (или другого ведущего документа для цепочки принятия решений совета) с агрегатом документа */
["StatementDetailAggregate"]: {
		action: ModelTypes["ExtendedBlockchainAction"],
	documentAggregate: ModelTypes["DocumentAggregate"]
};
	["SupplyOnRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Подписанный Поставщиком акт приёма-передачи имущества в кооператив */
	document: ModelTypes["AssetContributionActSignedDocumentInput"],
	/** Идентификатор обмена */
	exchange_id: number,
	/** Имя аккаунта пользователя */
	username: string
};
	["SystemInfo"]: {
		/** Объект системного аккаунта кооператива в блокчейне */
	blockchain_account: ModelTypes["BlockchainAccount"],
	/** Набор данных с информацией о состоянии блокчейна */
	blockchain_info: ModelTypes["BlockchainInfoDTO"],
	/** Контакты кооператива */
	contacts?: ModelTypes["ContactsDTO"] | undefined | null,
	/** Объект аккаунта кооператива у оператора */
	cooperator_account: ModelTypes["CooperativeOperatorAccount"],
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Статус контроллера кооператива */
	system_status: ModelTypes["SystemStatus"],
	/** Переменные кооператива */
	vars?: ModelTypes["Vars"] | undefined | null
};
	["SystemStatus"]:SystemStatus;
	["Token"]: {
		/** Дата истечения токена доступа */
	expires: ModelTypes["DateTime"],
	/** Токен доступа */
	token: string
};
	["Tokens"]: {
		/** Токен доступа */
	access: ModelTypes["Token"],
	/** Токен обновления */
	refresh: ModelTypes["Token"]
};
	["Transaction"]: {
		/** Блокчейн, который использовался */
	chain: ModelTypes["JSONObject"],
	/** Запрос на подписание транзакции */
	request: ModelTypes["JSONObject"],
	/** Разрешенный запрос на подписание транзакции */
	resolved?: ModelTypes["JSONObject"] | undefined | null,
	/** Ответ от API после отправки транзакции (если был выполнен бродкаст) */
	response?: ModelTypes["JSONObject"] | undefined | null,
	/** Возвращаемые значения после выполнения транзакции */
	returns: ModelTypes["JSONObject"],
	/** Ревизии транзакции, измененные плагинами в ESR формате */
	revisions: ModelTypes["JSONObject"],
	/** Подписи транзакции */
	signatures: ModelTypes["JSONObject"],
	/** Авторизованный подписант */
	signer: ModelTypes["JSONObject"],
	/** Итоговая транзакция */
	transaction?: ModelTypes["JSONObject"] | undefined | null
};
	["UninstallExtensionInput"]: {
	/** Фильтр по имени */
	name: string
};
	["UnpublishRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Идентификатор обмена */
	exchange_id: number,
	/** Имя аккаунта пользователя */
	username: string
};
	["Update"]: {
	/** Собственные данные кооператива, обслуживающего экземпляр платформы */
	organization_data?: ModelTypes["UpdateOrganizationDataInput"] | undefined | null,
	/** Переменные кооператива, используемые для заполнения шаблонов документов */
	vars?: ModelTypes["VarsInput"] | undefined | null
};
	["UpdateAccountInput"]: {
	/** Данные индивидуального предпринимателя */
	entrepreneur_data?: ModelTypes["UpdateEntrepreneurDataInput"] | undefined | null,
	/** Данные физического лица */
	individual_data?: ModelTypes["UpdateIndividualDataInput"] | undefined | null,
	/** Данные организации */
	organization_data?: ModelTypes["UpdateOrganizationDataInput"] | undefined | null,
	/** Публичный ключ */
	public_key?: string | undefined | null,
	/** Имя аккаунта реферера */
	referer?: string | undefined | null,
	/** Имя пользователя */
	username: string
};
	["UpdateBankAccountInput"]: {
	/** Данные банковского счёта */
	data: ModelTypes["BankAccountInput"],
	/** Флаг основного метода платежа, который отображается в документах */
	is_default: boolean,
	/** Идентификатор платежного метода */
	method_id: string,
	/** Имя аккаунта пользователя */
	username: string
};
	["UpdateEntrepreneurDataInput"]: {
	/** Дата рождения */
	birthdate: string,
	/** Город */
	city: string,
	/** Страна */
	country: ModelTypes["Country"],
	/** Детали индивидуального предпринимателя */
	details: ModelTypes["EntrepreneurDetailsInput"],
	/** Электронная почта */
	email: string,
	/** Имя */
	first_name: string,
	/** Полный адрес */
	full_address: string,
	/** Фамилия */
	last_name: string,
	/** Отчество */
	middle_name: string,
	/** Телефон */
	phone: string,
	/** Имя пользователя */
	username: string
};
	["UpdateIndividualDataInput"]: {
	/** Дата рождения */
	birthdate: string,
	/** Электронная почта */
	email: string,
	/** Имя */
	first_name: string,
	/** Полный адрес */
	full_address: string,
	/** Фамилия */
	last_name: string,
	/** Отчество */
	middle_name: string,
	/** Данные паспорта */
	passport?: ModelTypes["PassportInput"] | undefined | null,
	/** Телефон */
	phone: string,
	/** Имя пользователя */
	username: string
};
	["UpdateOrganizationDataInput"]: {
	/** Город */
	city: string,
	/** Страна */
	country: string,
	/** Детали организации */
	details: ModelTypes["OrganizationDetailsInput"],
	/** Электронная почта */
	email: string,
	/** Фактический адрес */
	fact_address: string,
	/** Полный адрес */
	full_address: string,
	/** Полное наименование организации */
	full_name: string,
	/** Телефон */
	phone: string,
	/** Представитель организации */
	represented_by: ModelTypes["RepresentedByInput"],
	/** Краткое наименование организации */
	short_name: string,
	/** Тип организации */
	type: string,
	/** Имя пользователя */
	username: string
};
	["UpdateRequestInput"]: {
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Дополнительные данные */
	data: string,
	/** Идентификатор обмена */
	exchange_id: number,
	/** Дополнительная информация */
	meta: string,
	/** Оставшееся количество единиц */
	remain_units: string,
	/** Стоимость за единицу в формате "10.0000 RUB" */
	unit_cost: string,
	/** Имя аккаунта пользователя */
	username: string
};
	["UserAccount"]: {
		/** Метаинформация */
	meta: string,
	/** Реферал */
	referer: string,
	/** Дата регистрации */
	registered_at: string,
	/** Регистратор */
	registrator: string,
	/** Статус аккаунта */
	status: string,
	/** Список хранилищ */
	storages: Array<string>,
	/** Тип учетной записи */
	type: string,
	/** Имя аккаунта */
	username: string,
	/** Дата регистрации */
	verifications: Array<ModelTypes["Verification"]>
};
	/** Объединение сертификатов пользователей (сокращенная информация) */
["UserCertificateUnion"]:ModelTypes["EntrepreneurCertificate"] | ModelTypes["IndividualCertificate"] | ModelTypes["OrganizationCertificate"];
	["UserStatus"]:UserStatus;
	["Vars"]: {
		confidential_email: string,
	confidential_link: string,
	contact_email: string,
	coopenomics_agreement?: ModelTypes["AgreementVar"] | undefined | null,
	coopname: string,
	full_abbr: string,
	full_abbr_dative: string,
	full_abbr_genitive: string,
	name: string,
	participant_application: ModelTypes["AgreementVar"],
	passport_request: string,
	privacy_agreement: ModelTypes["AgreementVar"],
	short_abbr: string,
	signature_agreement: ModelTypes["AgreementVar"],
	user_agreement: ModelTypes["AgreementVar"],
	wallet_agreement: ModelTypes["AgreementVar"],
	website: string
};
	["VarsInput"]: {
	confidential_email: string,
	confidential_link: string,
	contact_email: string,
	coopenomics_agreement?: ModelTypes["AgreementInput"] | undefined | null,
	coopname: string,
	full_abbr: string,
	full_abbr_dative: string,
	full_abbr_genitive: string,
	name: string,
	participant_application: ModelTypes["AgreementInput"],
	passport_request: string,
	privacy_agreement: ModelTypes["AgreementInput"],
	short_abbr: string,
	signature_agreement: ModelTypes["AgreementInput"],
	user_agreement: ModelTypes["AgreementInput"],
	wallet_agreement: ModelTypes["AgreementInput"],
	website: string
};
	["Verification"]: {
		/** Дата создания верификации */
	created_at: string,
	/** Флаг верификации */
	is_verified: boolean,
	/** Дата последнего обновления верификации */
	last_update: string,
	/** Заметка верификации */
	notice: string,
	/** Процедура верификации */
	procedure: string,
	/** Имя верификатора */
	verificator: string
};
	/** Пункт голосования для ежегодного общего собрания */
["VoteItemInput"]: {
	/** Идентификатор вопроса повестки */
	question_id: number,
	/** Решение по вопросу (вариант голосования) */
	vote: string
};
	/** Входные данные для голосования на ежегодном общем собрании */
["VoteOnAnnualGeneralMeetInput"]: {
	/** Подписанный бюллетень голосования */
	ballot: ModelTypes["AnnualGeneralMeetingVotingBallotSignedDocumentInput"],
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Хеш собрания, по которому производится голосование */
	hash: string,
	/** Идентификатор члена кооператива, который голосует */
	username: string,
	/** Бюллетень с решениями по вопросам повестки */
	votes: Array<ModelTypes["VoteItemInput"]>
};
	["WaitWeight"]: {
		/** Время ожидания в секундах */
	wait_sec: number,
	/** Вес */
	weight: number
};
	["schema"]: {
	query?: ModelTypes["Query"] | undefined | null,
	mutation?: ModelTypes["Mutation"] | undefined | null
}
    }

export type GraphQLTypes = {
    // ------------------------------------------------------;
	// THIS FILE WAS AUTOMATICALLY GENERATED (DO NOT MODIFY);
	// ------------------------------------------------------;
	["AcceptChildOrderInput"]: {
		/** Имя аккаунта кооператива */
	coopname: string,
	/** Подписанное заявление на имущественный паевый взнос */
	document: GraphQLTypes["AssetContributionStatementSignedDocumentInput"],
	/** Идентификатор заявки */
	exchange_id: string,
	/** Имя аккаунта пользователя */
	username: string
};
	["Account"]: {
	__typename: "Account",
	/** объект аккаунта в блокчейне содержит системную информацию, такую как публичные ключи доступа, доступные вычислительные ресурсы, информация об установленном смарт-контракте, и т.д. и т.п. Это системный уровень обслуживания, где у каждого пайщика есть аккаунт, но не каждый аккаунт может быть пайщиком в каком-либо кооперативе. Все смарт-контракты устанавливаются и исполняются на этом уровне. */
	blockchain_account?: GraphQLTypes["BlockchainAccount"] | undefined | null,
	/** объект пайщика кооператива в таблице блокчейне, который определяет членство пайщика в конкретном кооперативе. Поскольку MONO обслуживает только один кооператив, то в participant_account обычно содержится информация, которая описывает членство пайщика в этом кооперативе. Этот объект обезличен, публичен, и хранится в блокчейне. */
	participant_account?: GraphQLTypes["ParticipantAccount"] | undefined | null,
	/** объект приватных данных пайщика кооператива. */
	private_account?: GraphQLTypes["PrivateAccount"] | undefined | null,
	/** объект аккаунта в системе учёта провайдера, т.е. MONO. Здесь хранится приватная информация о пайщике кооператива, которая содержит его приватные данные. Эти данные не публикуются в блокчейне и не выходят за пределы базы данных провайдера. Они используются для заполнения шаблонов документов при нажатии соответствующих кнопок на платформе.  */
	provider_account?: GraphQLTypes["MonoAccount"] | undefined | null,
	/** объект пользователя кооперативной экономики содержит в блокчейне информацию о типе аккаунта пайщика, а также, обезличенные публичные данные (хэши) для верификации пайщиков между кооперативами. Этот уровень предназначен для хранения информации пайщика, которая необходима всем кооперативам, но не относится к какому-либо из них конкретно. */
	user_account?: GraphQLTypes["UserAccount"] | undefined | null,
	/** Имя аккаунта кооператива */
	username: string
};
	["AccountRamDelta"]: {
	__typename: "AccountRamDelta",
	account: string,
	delta: number
};
	["AccountResourceInfo"]: {
	__typename: "AccountResourceInfo",
	/** Доступные ресурсы */
	available: string,
	/** Текущее использование ресурсов */
	current_used?: string | undefined | null,
	/** Время последнего обновления использования ресурсов */
	last_usage_update_time?: string | undefined | null,
	/** Максимальное количество ресурсов */
	max: string,
	/** Использовано ресурсов */
	used: string
};
	/** Тип аккаунта пользователя в системе */
["AccountType"]: AccountType;
	["AccountsPaginationResult"]: {
	__typename: "AccountsPaginationResult",
	/** Текущая страница */
	currentPage: number,
	/** Элементы текущей страницы */
	items: Array<GraphQLTypes["Account"]>,
	/** Общее количество элементов */
	totalCount: number,
	/** Общее количество страниц */
	totalPages: number
};
	/** Комплексный объект акта, содержащий полную информацию о сгенерированном и опубликованном документе с его агрегатом */
["ActDetailAggregate"]: {
	__typename: "ActDetailAggregate",
	action?: GraphQLTypes["ExtendedBlockchainAction"] | undefined | null,
	documentAggregate?: GraphQLTypes["DocumentAggregate"] | undefined | null
};
	["ActionAuthorization"]: {
	__typename: "ActionAuthorization",
	actor: string,
	permission: string
};
	["ActionReceipt"]: {
	__typename: "ActionReceipt",
	abi_sequence: number,
	act_digest: string,
	auth_sequence: Array<GraphQLTypes["AuthSequence"]>,
	code_sequence: number,
	global_sequence: string,
	receiver: string,
	recv_sequence: string
};
	["AddParticipantInput"]: {
		/** Дата создания аккаунта в строковом формате даты EOSIO по UTC (2024-12-28T06:58:52.500) */
	created_at: string,
	/** Электронная почта */
	email: string,
	/** Данные индивидуального предпринимателя */
	entrepreneur_data?: GraphQLTypes["CreateEntrepreneurDataInput"] | undefined | null,
	/** Данные физического лица */
	individual_data?: GraphQLTypes["CreateIndividualDataInput"] | undefined | null,
	/** Вступительный взнос, который был внесён пайщиком */
	initial: string,
	/** Минимальный паевый взнос, который был внесён пайщиком */
	minimum: string,
	/** Данные организации */
	organization_data?: GraphQLTypes["CreateOrganizationDataInput"] | undefined | null,
	/** Имя аккаунта реферера */
	referer?: string | undefined | null,
	/** Флаг распределения вступительного взноса в невозвратный фонд вступительных взносов кооператива */
	spread_initial: boolean,
	/** Тип аккаунта */
	type: GraphQLTypes["AccountType"]
};
	["AddTrustedAccountInput"]: {
		/** Имя аккаунта кооперативного участка */
	braname: string,
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Имя аккаунта доверонного лица, который уполномачивается председателем кооперативного участка на совершение действий */
	trusted: string
};
	/** Пункт повестки общего собрания (для ввода) */
["AgendaGeneralMeetPointInput"]: {
		/** Контекст или дополнительная информация по пункту повестки */
	context: string,
	/** Предлагаемое решение по пункту повестки */
	decision: string,
	/** Заголовок пункта повестки */
	title: string
};
	/** Вопрос повестки общего собрания */
["AgendaGeneralMeetQuestion"]: {
		/** Контекст или дополнительная информация по вопросу */
	context?: string | undefined | null,
	/** Предлагаемое решение по вопросу повестки */
	decision: string,
	/** Номер вопроса в повестке */
	number: string,
	/** Заголовок вопроса повестки */
	title: string
};
	/** Данные собрания для повестки */
["AgendaMeet"]: {
		/** Дата и время окончания собрания */
	close_at_datetime: string,
	/** Дата и время начала собрания */
	open_at_datetime: string,
	/** Тип собрания (очередное или внеочередное) */
	type: string
};
	/** Пункт повестки собрания */
["AgendaMeetPoint"]: {
	__typename: "AgendaMeetPoint",
	/** Контекст или дополнительная информация по пункту повестки */
	context: string,
	/** Предлагаемое решение по пункту повестки */
	decision: string,
	/** Заголовок пункта повестки */
	title: string
};
	["AgendaWithDocuments"]: {
	__typename: "AgendaWithDocuments",
	/** Действие, которое привело к появлению вопроса на голосовании */
	action: GraphQLTypes["BlockchainAction"],
	/** Пакет документов, включающий разные подсекции */
	documents: GraphQLTypes["DocumentPackageAggregate"],
	/** Запись в таблице блокчейна о вопросе на голосовании */
	table: GraphQLTypes["BlockchainDecision"]
};
	["AgreementInput"]: {
		protocol_day_month_year: string,
	protocol_number: string
};
	["AgreementVar"]: {
	__typename: "AgreementVar",
	protocol_day_month_year: string,
	protocol_number: string
};
	["AnnualGeneralMeetingAgendaGenerateDocumentInput"]: {
		/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Флаг повторного собрания */
	is_repeated: boolean,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	meet: GraphQLTypes["AgendaMeet"],
	questions: Array<GraphQLTypes["AgendaGeneralMeetQuestion"]>,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["AnnualGeneralMeetingAgendaSignedDocumentInput"]: {
		/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация для создания протокола решения */
	meta: GraphQLTypes["AnnualGeneralMeetingAgendaSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<GraphQLTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["AnnualGeneralMeetingAgendaSignedMetaDocumentInput"]: {
		/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Флаг повторного собрания */
	is_repeated: boolean,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	meet: GraphQLTypes["AgendaMeet"],
	questions: Array<GraphQLTypes["AgendaGeneralMeetQuestion"]>,
	/** ID документа в реестре */
	registry_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["AnnualGeneralMeetingDecisionGenerateDocumentInput"]: {
		/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Хеш собрания */
	meet_hash: string,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["AnnualGeneralMeetingDecisionSignedDocumentInput"]: {
		/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация */
	meta: GraphQLTypes["AnnualGeneralMeetingDecisionSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<GraphQLTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["AnnualGeneralMeetingDecisionSignedMetaDocumentInput"]: {
		/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** Хеш собрания */
	meet_hash: string,
	/** ID документа в реестре */
	registry_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["AnnualGeneralMeetingNotificationGenerateDocumentInput"]: {
		/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Хеш собрания */
	meet_hash: string,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["AnnualGeneralMeetingNotificationSignedDocumentInput"]: {
		/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация */
	meta: GraphQLTypes["AnnualGeneralMeetingNotificationSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<GraphQLTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["AnnualGeneralMeetingNotificationSignedMetaDocumentInput"]: {
		/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** Хеш собрания */
	meet_hash: string,
	/** ID документа в реестре */
	registry_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["AnnualGeneralMeetingSovietDecisionGenerateDocumentInput"]: {
		/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** ID решения совета */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Флаг повторного собрания */
	is_repeated: boolean,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Хеш собрания */
	meet_hash: string,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["AnnualGeneralMeetingVotingBallotGenerateDocumentInput"]: {
		/** Ответы голосования */
	answers: Array<GraphQLTypes["AnswerInput"]>,
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Хеш собрания */
	meet_hash: string,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя голосующего */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["AnnualGeneralMeetingVotingBallotSignedDocumentInput"]: {
		/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация для создания протокола решения */
	meta: GraphQLTypes["AnnualGeneralMeetingVotingBallotSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<GraphQLTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["AnnualGeneralMeetingVotingBallotSignedMetaDocumentInput"]: {
		/** Ответы голосования */
	answers: Array<GraphQLTypes["AnswerInput"]>,
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** Хеш собрания */
	meet_hash: string,
	/** ID документа в реестре */
	registry_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя голосующего */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["AnswerInput"]: {
		/** ID вопроса */
	id: string,
	/** Номер вопроса */
	number: string,
	/** Голос (за/против/воздержался) */
	vote: string
};
	["AssetContributionActGenerateDocumentInput"]: {
		/** Идентификатор акта */
	act_id: string,
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Имя аккаунта кооперативного участка */
	braname?: string | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Идентификатор решения */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Имя аккаунта получателя на кооперативном участке */
	receiver: string,
	/** Идентификатор заявки */
	request_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["AssetContributionActSignedDocumentInput"]: {
		/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация для создания проекта свободного решения */
	meta: GraphQLTypes["AssetContributionActSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<GraphQLTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["AssetContributionActSignedMetaDocumentInput"]: {
		/** Идентификатор акта */
	act_id: string,
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Имя аккаунта кооперативного участка */
	braname?: string | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Идентификатор решения */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** Имя аккаунта получателя на кооперативном участке */
	receiver: string,
	/** ID документа в реестре */
	registry_id: number,
	/** Идентификатор заявки */
	request_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["AssetContributionDecisionGenerateDocumentInput"]: {
		/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Идентификатор решения */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Идентификатор заявки */
	request_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["AssetContributionStatementGenerateDocumentInput"]: {
		/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Запрос на внесение имущественного паевого взноса */
	request: GraphQLTypes["CommonRequestInput"],
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["AssetContributionStatementSignedDocumentInput"]: {
		/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация для создания проекта свободного решения */
	meta: GraphQLTypes["AssetContributionStatementSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<GraphQLTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["AssetContributionStatementSignedMetaDocumentInput"]: {
		/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** ID документа в реестре */
	registry_id: number,
	/** Запрос на внесение имущественного паевого взноса */
	request: GraphQLTypes["CommonRequestInput"],
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["AuthSequence"]: {
	__typename: "AuthSequence",
	account: string,
	sequence: string
};
	["Authority"]: {
	__typename: "Authority",
	/** Уровни разрешений */
	accounts: Array<GraphQLTypes["PermissionLevelWeight"]>,
	/** Ключи */
	keys: Array<GraphQLTypes["KeyWeight"]>,
	/** Порог */
	threshold: number,
	/** Вес ожидания */
	waits: Array<GraphQLTypes["WaitWeight"]>
};
	["BankAccount"]: {
	__typename: "BankAccount",
	/** Номер банковского счета */
	account_number: string,
	/** Название банка */
	bank_name: string,
	/** Номер карты */
	card_number?: string | undefined | null,
	/** Валюта счета */
	currency: string,
	/** Детали счета */
	details: GraphQLTypes["BankAccountDetails"]
};
	["BankAccountDetails"]: {
	__typename: "BankAccountDetails",
	/** БИК банка */
	bik: string,
	/** Корреспондентский счет */
	corr: string,
	/** КПП банка */
	kpp: string
};
	["BankAccountDetailsInput"]: {
		/** БИК банка */
	bik: string,
	/** Корреспондентский счет */
	corr: string,
	/** КПП банка */
	kpp: string
};
	["BankAccountInput"]: {
		/** Номер банковского счета */
	account_number: string,
	/** Название банка */
	bank_name: string,
	/** Номер карты */
	card_number?: string | undefined | null,
	/** Валюта счета */
	currency: string,
	/** Детали счета */
	details: GraphQLTypes["BankAccountDetailsInput"]
};
	["BankPaymentMethod"]: {
	__typename: "BankPaymentMethod",
	/** Дата создания */
	created_at: GraphQLTypes["DateTime"],
	/** Данные метода оплаты */
	data: GraphQLTypes["BankAccount"],
	/** Флаг основного метода платежа, который отображается в документах */
	is_default: boolean,
	/** Идентификатор метода оплаты */
	method_id: string,
	/** Тип метода оплаты */
	method_type: string,
	/** Дата обновления */
	updated_at: GraphQLTypes["DateTime"],
	/** Имя пользователя, к которому привязан метод оплаты */
	username: string
};
	["BlockchainAccount"]: {
	__typename: "BlockchainAccount",
	/** Имя аккаунта */
	account_name: string,
	/** Баланс */
	core_liquid_balance?: string | undefined | null,
	/** Ограничения CPU */
	cpu_limit: GraphQLTypes["AccountResourceInfo"],
	/** Вес CPU */
	cpu_weight: string,
	/** Дата создания */
	created: string,
	/** Номер последнего блока */
	head_block_num: number,
	/** Время последнего блока */
	head_block_time: string,
	/** Время последнего обновления кода */
	last_code_update: string,
	/** Ограничения сети */
	net_limit: GraphQLTypes["AccountResourceInfo"],
	/** Вес сети */
	net_weight: string,
	/** Разрешения */
	permissions: Array<GraphQLTypes["Permission"]>,
	/** Флаг привилегий */
	privileged: boolean,
	/** Квота RAM */
	ram_quota: number,
	/** Использование RAM */
	ram_usage: number,
	/** Запрос на возврат */
	refund_request?: GraphQLTypes["RefundRequest"] | undefined | null,
	/** Информация о REX */
	rex_info?: string | undefined | null,
	/** Делегированные ресурсы */
	self_delegated_bandwidth?: GraphQLTypes["ResourceDelegationDTO"] | undefined | null,
	/** Общий обзор ресурсов */
	total_resources?: GraphQLTypes["ResourceOverview"] | undefined | null,
	/** Информация о голосовании */
	voter_info?: string | undefined | null
};
	/** Объект действия в блокчейне */
["BlockchainAction"]: {
	__typename: "BlockchainAction",
	account: string,
	account_ram_deltas: Array<GraphQLTypes["AccountRamDelta"]>,
	action_ordinal: number,
	authorization: Array<GraphQLTypes["ActionAuthorization"]>,
	block_id: string,
	block_num: number,
	chain_id: string,
	console: string,
	context_free: boolean,
	creator_action_ordinal: number,
	/** Данные действия в формате JSON */
	data: GraphQLTypes["JSON"],
	elapsed: number,
	global_sequence: string,
	name: string,
	receipt: GraphQLTypes["ActionReceipt"],
	receiver: string,
	transaction_id: string
};
	/** Запись в таблице блокчейна о процессе принятия решения советом кооператива */
["BlockchainDecision"]: {
	__typename: "BlockchainDecision",
	approved: boolean,
	authorization: GraphQLTypes["SignedBlockchainDocument"],
	authorized: boolean,
	authorized_by: string,
	batch_id: number,
	callback_contract?: string | undefined | null,
	confirm_callback?: string | undefined | null,
	coopname: string,
	created_at: string,
	decline_callback?: string | undefined | null,
	expired_at: string,
	hash?: string | undefined | null,
	id: number,
	meta: string,
	statement: GraphQLTypes["SignedBlockchainDocument"],
	type: string,
	username: string,
	/** Сертификат пользователя, создавшего решение */
	username_certificate?: GraphQLTypes["UserCertificateUnion"] | undefined | null,
	validated: boolean,
	votes_against: Array<string>,
	/** Сертификаты пользователей, голосовавших "против" */
	votes_against_certificates: Array<GraphQLTypes["UserCertificateUnion"]>,
	votes_for: Array<string>,
	/** Сертификаты пользователей, голосовавших "за" */
	votes_for_certificates: Array<GraphQLTypes["UserCertificateUnion"]>
};
	/** Информация о состоянии блокчейна */
["BlockchainInfoDTO"]: {
	__typename: "BlockchainInfoDTO",
	/** Лимит CPU для блока */
	block_cpu_limit: number,
	/** Лимит сети для блока */
	block_net_limit: number,
	/** Идентификатор цепочки (chain ID) */
	chain_id: string,
	/** Идентификатор головного блока в форк базе данных */
	fork_db_head_block_id?: string | undefined | null,
	/** Номер головного блока в форк базе данных */
	fork_db_head_block_num?: number | undefined | null,
	/** Идентификатор головного блока */
	head_block_id: string,
	/** Номер головного блока */
	head_block_num: number,
	/** Прозводитель головного блока */
	head_block_producer: string,
	/** Время головного блока */
	head_block_time: string,
	/** Идентификатор последнего необратимого блока */
	last_irreversible_block_id: string,
	/** Номер последнего необратимого блока */
	last_irreversible_block_num: number,
	/** Время последнего необратимого блока */
	last_irreversible_block_time?: string | undefined | null,
	/** Версия сервера */
	server_version: string,
	/** Строковое представление версии сервера */
	server_version_string?: string | undefined | null,
	/** Виртуальный лимит CPU для блока */
	virtual_block_cpu_limit: number,
	/** Виртуальный лимит сети для блока */
	virtual_block_net_limit: number
};
	["Branch"]: {
	__typename: "Branch",
	/** Банковский счёт */
	bank_account: GraphQLTypes["BankPaymentMethod"],
	/** Уникальное имя кооперативного участка */
	braname: string,
	/** Город */
	city: string,
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Страна */
	country: string,
	/** Детали организации */
	details: GraphQLTypes["OrganizationDetails"],
	/** Email */
	email: string,
	/** Фактический адрес */
	fact_address: string,
	/** Полный адрес */
	full_address: string,
	/** Полное название организации */
	full_name: string,
	/** Телефон */
	phone: string,
	/** Представитель организации */
	represented_by: GraphQLTypes["RepresentedBy"],
	/** Краткое название организации */
	short_name: string,
	/** Доверенные аккаунты */
	trusted: Array<GraphQLTypes["Individual"]>,
	/** Председатель кооперативного участка */
	trustee: GraphQLTypes["Individual"],
	/** Тип организации */
	type: string
};
	["CancelRequestInput"]: {
		/** Имя аккаунта кооператива */
	coopname: string,
	/** Идентификатор заявки */
	exchange_id: string,
	/** Имя аккаунта пользователя */
	username: string
};
	["CommonRequestInput"]: {
		currency: string,
	hash: string,
	program_id: number,
	title: string,
	total_cost: string,
	type: string,
	unit_cost: string,
	unit_of_measurement: string,
	units: number
};
	["CompleteRequestInput"]: {
		/** Имя аккаунта кооператива */
	coopname: string,
	/** Идентификатор обмена */
	exchange_id: string,
	/** Имя аккаунта пользователя */
	username: string
};
	/** Подтвердить получение имущества Уполномоченным лицом от Заказчика по новации и акту приёмки-передачи */
["ConfirmReceiveOnRequestInput"]: {
		/** Имя аккаунта кооператива */
	coopname: string,
	/** Подписанный акт приёмки-передачи имущества Уполномоченным лицом из Кооператива при возврате Заказчику по новации */
	document: GraphQLTypes["ReturnByAssetActSignedDocumentInput"],
	/** Идентификатор обмена */
	exchange_id: string,
	/** Имя аккаунта пользователя */
	username: string
};
	/** Подтвердить поставку имущества Поставщиком по заявке Заказчика и акту приёма-передачи */
["ConfirmSupplyOnRequestInput"]: {
		/** Имя аккаунта кооператива */
	coopname: string,
	/** Подписанный акт приёма-передачи имущества от Поставщика в Кооператив */
	document: GraphQLTypes["AssetContributionActSignedDocumentInput"],
	/** Идентификатор обмена */
	exchange_id: string,
	/** Имя аккаунта пользователя */
	username: string
};
	["ContactsDTO"]: {
	__typename: "ContactsDTO",
	chairman: GraphQLTypes["PublicChairman"],
	details: GraphQLTypes["OrganizationDetails"],
	email: string,
	full_address: string,
	full_name: string,
	phone: string
};
	["CooperativeOperatorAccount"]: {
	__typename: "CooperativeOperatorAccount",
	/** Количество активных участников */
	active_participants_count: number,
	/** Объявление кооператива */
	announce: string,
	/** Тип кооператива */
	coop_type: string,
	/** Дата создания */
	created_at: string,
	/** Описание кооператива */
	description: string,
	/** Документ кооператива */
	document: GraphQLTypes["SignedBlockchainDocument"],
	/** Начальный взнос */
	initial: string,
	/** Разветвленный ли кооператив */
	is_branched: boolean,
	/** Является ли это кооперативом */
	is_cooperative: boolean,
	/** Включен ли кооператив */
	is_enrolled: boolean,
	/** Метаинформация */
	meta: string,
	/** Минимальный взнос */
	minimum: string,
	/** Начальный взнос организации */
	org_initial: string,
	/** Минимальный взнос организации */
	org_minimum: string,
	/** Регистрационный взнос организации */
	org_registration: string,
	/** Родительское имя аккаунта кооператива */
	parent_username: string,
	/** Реферал кооператива */
	referer: string,
	/** Дата регистрации */
	registered_at: string,
	/** Регистрационный взнос */
	registration: string,
	/** Регистратор кооператива */
	registrator: string,
	/** Статус кооператива */
	status: string,
	/** Список хранилищ */
	storages: Array<string>,
	/** Тип учетной записи */
	type: string,
	/** Имя аккаунта кооператива */
	username: string,
	/** Дата регистрации */
	verifications: Array<GraphQLTypes["Verification"]>
};
	/** Страна регистрации пользователя */
["Country"]: Country;
	["CreateAnnualGeneralMeetInput"]: {
		/** Повестка собрания */
	agenda: Array<GraphQLTypes["AgendaGeneralMeetPointInput"]>,
	/** Время закрытия собрания */
	close_at: GraphQLTypes["DateTime"],
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Имя аккаунта инициатора */
	initiator: string,
	/** Время открытия собрания */
	open_at: GraphQLTypes["DateTime"],
	/** Имя аккаунта председателя */
	presider: string,
	/** Предложение повестки собрания */
	proposal: GraphQLTypes["AnnualGeneralMeetingAgendaSignedDocumentInput"],
	/** Имя аккаунта секретаря */
	secretary: string
};
	["CreateBankAccountInput"]: {
		/** Данные для банковского перевода */
	data: GraphQLTypes["BankAccountInput"],
	/** Флаг основного метода платежа, который отображается в документах */
	is_default: boolean,
	/** Имя аккаунта пользователя */
	username: string
};
	["CreateBranchInput"]: {
		/** Документ, на основании которого действует Уполномоченный (решение совета №СС-.. от ..) */
	based_on: string,
	/** Имя аккаунта кооперативного участка */
	braname: string,
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Электронная почта */
	email: string,
	/** Фактический адрес */
	fact_address: string,
	/** Полное имя организации кооперативного участка */
	full_name: string,
	/** Телефон */
	phone: string,
	/** Краткое имя организации кооперативного участка */
	short_name: string,
	/** Имя аккаунта уполномоченного (председателя) кооперативного участка */
	trustee: string
};
	["CreateChildOrderInput"]: {
		/** Имя кооператива */
	coopname: string,
	/** Дополнительные данные, специфичные для заявки */
	data: string,
	/** Подписанное заявление на возврат паевого взноса имуществом от Заказчика */
	document: GraphQLTypes["ReturnByAssetStatementSignedDocumentInput"],
	/** Метаданные о заявке */
	meta: string,
	/** Идентификатор родительской заявки */
	parent_id: number,
	/** Время жизни продукта, заявляемое поставщиком (в секундах) */
	product_lifecycle_secs: number,
	/** Идентификатор программы */
	program_id: number,
	/** Цена за единицу (штуку) товара или результата услуги в формате "10.0000 RUB" */
	unit_cost: string,
	/** Количество частей (штук) товара или услуги */
	units: number,
	/** Имя пользователя, инициирующего или обновляющего заявку */
	username: string
};
	["CreateDepositPaymentInput"]: {
		/** Сумма взноса */
	quantity: number,
	/** Символ валюты */
	symbol: string,
	/** Имя аккаунта пользователя */
	username: string
};
	["CreateEntrepreneurDataInput"]: {
		/** Банковский счет */
	bank_account: GraphQLTypes["BankAccountInput"],
	/** Дата рождения */
	birthdate: string,
	/** Город */
	city: string,
	/** Страна */
	country: GraphQLTypes["Country"],
	/** Детали индивидуального предпринимателя */
	details: GraphQLTypes["EntrepreneurDetailsInput"],
	/** Имя */
	first_name: string,
	/** Полный адрес */
	full_address: string,
	/** Фамилия */
	last_name: string,
	/** Отчество */
	middle_name: string,
	/** Телефон */
	phone: string
};
	["CreateIndividualDataInput"]: {
		/** Дата рождения */
	birthdate: string,
	/** Имя */
	first_name: string,
	/** Полный адрес */
	full_address: string,
	/** Фамилия */
	last_name: string,
	/** Отчество */
	middle_name: string,
	/** Данные паспорта */
	passport?: GraphQLTypes["PassportInput"] | undefined | null,
	/** Телефон */
	phone: string
};
	["CreateInitialPaymentInput"]: {
		/** Имя аккаунта пользователя */
	username: string
};
	["CreateOrganizationDataInput"]: {
		/** Банковский счет организации */
	bank_account: GraphQLTypes["BankAccountInput"],
	/** Город */
	city: string,
	/** Страна */
	country: string,
	/** Детали организации */
	details: GraphQLTypes["OrganizationDetailsInput"],
	/** Фактический адрес */
	fact_address: string,
	/** Полный адрес */
	full_address: string,
	/** Полное наименование организации */
	full_name: string,
	/** Телефон */
	phone: string,
	/** Представитель организации */
	represented_by: GraphQLTypes["RepresentedByInput"],
	/** Краткое наименование организации */
	short_name: string,
	/** Тип организации */
	type: GraphQLTypes["OrganizationType"]
};
	["CreateParentOfferInput"]: {
		/** Имя кооператива */
	coopname: string,
	/** Дополнительные данные, специфичные для заявки */
	data: string,
	/** Метаданные о заявке */
	meta: string,
	/** Идентификатор родительской заявки */
	parent_id: number,
	/** Время жизни продукта, заявляемое поставщиком (в секундах) */
	product_lifecycle_secs: number,
	/** Идентификатор программы */
	program_id: number,
	/** Цена за единицу (штуку) товара или услуги в формате "10.0000 RUB" */
	unit_cost: string,
	/** Количество частей (штук) товара или услуги */
	units: number,
	/** Имя пользователя, инициирующего или обновляющего заявку */
	username: string
};
	["CreateProjectFreeDecisionInput"]: {
		/** Проект решения, которое предлагается принять */
	decision: string,
	/** Вопрос, который выносится на повестку */
	question: string
};
	["CreateWithdrawInput"]: {
		/** Имя аккаунта кооператива */
	coopname: string,
	/** ID метода платежа */
	method_id: string,
	/** Хеш платежа для связи с withdraw */
	payment_hash: string,
	/** Количество средств */
	quantity: number,
	/** Подписанное заявление на возврат средств */
	statement: GraphQLTypes["ReturnByMoneySignedDocumentInput"],
	/** Символ валюты */
	symbol: string,
	/** Имя пользователя */
	username: string
};
	["CreateWithdrawResponse"]: {
	__typename: "CreateWithdrawResponse",
	/** Хеш созданной заявки на вывод */
	withdraw_hash: string
};
	["CreatedProjectFreeDecision"]: {
	__typename: "CreatedProjectFreeDecision",
	/** Проект решения, которое предлагается принять */
	decision: string,
	/** Идентификатор проекта свободного решения */
	id: string,
	/** Вопрос, который выносится на повестку */
	question: string
};
	/** A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format. */
["DateTime"]: "scalar" & { name: "DateTime" };
	/** Комплексный объект решения совета, включающий в себя информацию о голосовавших членах совета, расширенное действие, которое привело к появлению решения, и агрегат документа самого решения. */
["DecisionDetailAggregate"]: {
	__typename: "DecisionDetailAggregate",
	action: GraphQLTypes["ExtendedBlockchainAction"],
	documentAggregate: GraphQLTypes["DocumentAggregate"],
	votes_against: Array<GraphQLTypes["ExtendedBlockchainAction"]>,
	votes_for: Array<GraphQLTypes["ExtendedBlockchainAction"]>
};
	["DeclineRequestInput"]: {
		/** Имя аккаунта кооператива */
	coopname: string,
	/** Идентификатор обмена */
	exchange_id: number,
	/** Причина отказа */
	meta: string,
	/** Имя аккаунта пользователя */
	username: string
};
	["DeleteBranchInput"]: {
		/** Имя аккаунта кооперативного участка */
	braname: string,
	/** Имя аккаунта кооператива */
	coopname: string
};
	["DeletePaymentMethodInput"]: {
		/** Идентификатор метода оплаты */
	method_id: string,
	/** Имя пользователя, чей метод оплаты нужно удалить */
	username: string
};
	["DeleteTrustedAccountInput"]: {
		/** Имя аккаунта кооперативного участка */
	braname: string,
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Имя аккаунта доверонного лица, у которого отзывается право подписи за председателя кооперативного участка */
	trusted: string
};
	["DeliverOnRequestInput"]: {
		/** Имя аккаунта кооператива */
	coopname: string,
	/** Идентификатор обмена */
	exchange_id: number,
	/** Имя аккаунта пользователя */
	username: string
};
	["Desktop"]: {
	__typename: "Desktop",
	/** Имя шаблона рабочих столов */
	authorizedHome: string,
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Имя шаблона рабочих столов */
	layout: string,
	/** Имя шаблона рабочих столов */
	nonAuthorizedHome: string,
	/** Состав приложений рабочего стола */
	workspaces: Array<GraphQLTypes["DesktopWorkspace"]>
};
	["DesktopWorkspace"]: {
	__typename: "DesktopWorkspace",
	/** Имя приложения */
	name: string,
	/** Отображаемое название приложения */
	title: string
};
	["DisputeOnRequestInput"]: {
		/** Имя аккаунта кооператива */
	coopname: string,
	/** Документ с аргументами спора */
	document: GraphQLTypes["JSONObject"],
	/** Идентификатор обмена */
	exchange_id: number,
	/** Имя аккаунта пользователя */
	username: string
};
	["DocumentAggregate"]: {
	__typename: "DocumentAggregate",
	document: GraphQLTypes["SignedDigitalDocument"],
	hash: string,
	rawDocument?: GraphQLTypes["GeneratedDocument"] | undefined | null
};
	/** Комплексный объект папки цифрового документа с агрегатами, который включает в себя заявление, решение, акты и связанные документы */
["DocumentPackageAggregate"]: {
	__typename: "DocumentPackageAggregate",
	/** Массив объект(ов) актов с агрегатами, относящихся к заявлению */
	acts: Array<GraphQLTypes["ActDetailAggregate"]>,
	/** Объект цифрового документа решения с агрегатом */
	decision?: GraphQLTypes["DecisionDetailAggregate"] | undefined | null,
	/** Массив связанных документов с агрегатами, извлечённых из мета-данных */
	links: Array<GraphQLTypes["DocumentAggregate"]>,
	/** Объект цифрового документа заявления с агрегатом */
	statement?: GraphQLTypes["StatementDetailAggregate"] | undefined | null
};
	["DocumentsAggregatePaginationResult"]: {
	__typename: "DocumentsAggregatePaginationResult",
	/** Текущая страница */
	currentPage: number,
	/** Элементы текущей страницы */
	items: Array<GraphQLTypes["DocumentPackageAggregate"]>,
	/** Общее количество элементов */
	totalCount: number,
	/** Общее количество страниц */
	totalPages: number
};
	["EditBranchInput"]: {
		/** Документ, на основании которого действует Уполномоченный (решение совета №СС-.. от ..) */
	based_on: string,
	/** Имя аккаунта кооперативного участка */
	braname: string,
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Электронная почта */
	email: string,
	/** Фактический адрес */
	fact_address: string,
	/** Полное имя организации кооперативного участка */
	full_name: string,
	/** Телефон */
	phone: string,
	/** Краткое имя организации кооперативного участка */
	short_name: string,
	/** Имя аккаунта уполномоченного (председателя) кооперативного участка */
	trustee: string
};
	["Entrepreneur"]: {
	__typename: "Entrepreneur",
	/** Дата рождения */
	birthdate: string,
	/** Город */
	city: string,
	/** Страна */
	country: string,
	/** Детали ИП (ИНН, ОГРН) */
	details: GraphQLTypes["EntrepreneurDetails"],
	/** Email */
	email: string,
	/** Имя */
	first_name: string,
	/** Юридический адрес */
	full_address: string,
	/** Фамилия */
	last_name: string,
	/** Отчество */
	middle_name: string,
	/** Телефон */
	phone: string,
	/** Имя аккаунта */
	username: string
};
	["EntrepreneurCertificate"]: {
	__typename: "EntrepreneurCertificate",
	/** Имя */
	first_name: string,
	/** ИНН */
	inn: string,
	/** Фамилия */
	last_name: string,
	/** Отчество */
	middle_name?: string | undefined | null,
	/** Тип аккаунта */
	type: GraphQLTypes["AccountType"],
	/** Имя аккаунта */
	username: string
};
	["EntrepreneurDetails"]: {
	__typename: "EntrepreneurDetails",
	/** ИНН */
	inn: string,
	/** ОГРН */
	ogrn: string
};
	["EntrepreneurDetailsInput"]: {
		/** ИНН */
	inn: string,
	/** ОГРН */
	ogrn: string
};
	/** Расширенное действие блокчейна с сертификатом пользователя, совершившего его. */
["ExtendedBlockchainAction"]: {
	__typename: "ExtendedBlockchainAction",
	account: string,
	account_ram_deltas: Array<GraphQLTypes["AccountRamDelta"]>,
	action_ordinal: number,
	/** Сертификат пользователя (сокращенная информация) */
	actor_certificate?: GraphQLTypes["UserCertificateUnion"] | undefined | null,
	authorization: Array<GraphQLTypes["ActionAuthorization"]>,
	block_id: string,
	block_num: number,
	chain_id: string,
	console: string,
	context_free: boolean,
	creator_action_ordinal: number,
	/** Данные действия в формате JSON */
	data: GraphQLTypes["JSON"],
	elapsed: number,
	global_sequence: string,
	name: string,
	receipt: GraphQLTypes["ActionReceipt"],
	receiver: string,
	transaction_id: string
};
	/** Расширенный статус собрания на основе дат и состояния */
["ExtendedMeetStatus"]: ExtendedMeetStatus;
	["Extension"]: {
	__typename: "Extension",
	/** Настройки конфигурации для расширения */
	config?: GraphQLTypes["JSON"] | undefined | null,
	/** Дата создания расширения */
	created_at: GraphQLTypes["DateTime"],
	/** Описание расширения */
	description?: string | undefined | null,
	/** Показывает, включено ли расширение */
	enabled: boolean,
	/** Внешняя ссылка на iframe-интерфейс расширения */
	external_url?: string | undefined | null,
	/** Изображение для расширения */
	image?: string | undefined | null,
	/** Поле инструкция для установки (INSTALL) */
	instructions: string,
	/** Показывает, доступно ли расширение */
	is_available: boolean,
	/** Показывает, встроенное ли это расширение */
	is_builtin: boolean,
	/** Показывает, рабочий стол ли это */
	is_desktop: boolean,
	/** Показывает, установлено ли расширение */
	is_installed: boolean,
	/** Показывает, внутреннее ли это расширение */
	is_internal: boolean,
	/** Уникальное имя расширения */
	name: string,
	/** Поле подробного текстового описания (README) */
	readme: string,
	/** Схема настроек конфигурации для расширения */
	schema?: GraphQLTypes["JSON"] | undefined | null,
	/** Массив тегов для расширения */
	tags: Array<string>,
	/** Заголовок расширения */
	title?: string | undefined | null,
	/** Дата последнего обновления расширения */
	updated_at: GraphQLTypes["DateTime"]
};
	["ExtensionInput"]: {
		/** Объект конфигурации расширения */
	config: GraphQLTypes["JSON"],
	/** Дата установки расширения */
	created_at?: GraphQLTypes["DateTime"] | undefined | null,
	/** Флаг того, включено ли расширение сейчас */
	enabled: boolean,
	/** Уникальное имя расширения (является идентификатором) */
	name: string,
	/** Дата обновления расширения */
	updated_at?: GraphQLTypes["DateTime"] | undefined | null
};
	["FreeDecisionGenerateDocumentInput"]: {
		/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Идентификатор протокола решения собрания совета */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Идентификатор проекта решения */
	project_id: string,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["GatewayPayment"]: {
	__typename: "GatewayPayment",
	/** Данные из блокчейна */
	blockchain_data?: GraphQLTypes["JSON"] | undefined | null,
	/** Можно ли изменить статус */
	can_change_status: boolean,
	/** Название кооператива */
	coopname: string,
	/** Дата создания */
	created_at: GraphQLTypes["DateTime"],
	/** Направление платежа */
	direction: GraphQLTypes["PaymentDirection"],
	/** Человекочитаемое направление платежа */
	direction_label: string,
	/** Дата истечения */
	expired_at?: GraphQLTypes["DateTime"] | undefined | null,
	/** Форматированная сумма */
	formatted_amount: string,
	/** Хеш платежа */
	hash?: string | undefined | null,
	/** Уникальный идентификатор платежа */
	id?: string | undefined | null,
	/** Хеш входящего платежа (устарело) */
	income_hash?: string | undefined | null,
	/** Завершен ли платеж окончательно */
	is_final: boolean,
	/** Дополнительная информация */
	memo?: string | undefined | null,
	/** Сообщение */
	message?: string | undefined | null,
	/** Хеш исходящего платежа (устарело) */
	outcome_hash?: string | undefined | null,
	/** Детали платежа */
	payment_details?: GraphQLTypes["PaymentDetails"] | undefined | null,
	/** ID платежного метода */
	payment_method_id?: string | undefined | null,
	/** Провайдер платежа */
	provider?: string | undefined | null,
	/** Количество/сумма */
	quantity: number,
	/** Подписанный документ заявления */
	statement?: GraphQLTypes["JSON"] | undefined | null,
	/** Статус платежа */
	status: GraphQLTypes["PaymentStatus"],
	/** Человекочитаемый статус */
	status_label: string,
	/** Символ валюты */
	symbol: string,
	/** Тип платежа */
	type: GraphQLTypes["PaymentType"],
	/** Человекочитаемый тип платежа */
	type_label: string,
	/** Дата обновления */
	updated_at?: GraphQLTypes["DateTime"] | undefined | null,
	/** Имя пользователя */
	username: string,
	/** Сертификат пользователя, создавшего платеж */
	username_certificate?: GraphQLTypes["UserCertificateUnion"] | undefined | null
};
	["GenerateDocumentInput"]: {
		/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["GenerateDocumentOptionsInput"]: {
		/** Язык документа */
	lang?: string | undefined | null,
	/** Пропустить сохранение */
	skip_save?: boolean | undefined | null
};
	["GeneratedDocument"]: {
	__typename: "GeneratedDocument",
	/** Бинарное содержимое документа (base64) */
	binary: string,
	/** Полное название документа */
	full_title: string,
	/** Хэш документа */
	hash: string,
	/** HTML содержимое документа */
	html: string,
	/** Метаданные документа */
	meta: GraphQLTypes["JSON"]
};
	["GetAccountInput"]: {
		/** Имя аккаунта пользователя */
	username: string
};
	["GetAccountsInput"]: {
		role?: string | undefined | null
};
	["GetBranchesInput"]: {
		/** Фильтр по имени аккаунта кооперативного участка */
	braname?: string | undefined | null,
	/** Имя аккаунта кооператива */
	coopname: string
};
	["GetDocumentsInput"]: {
		filter: GraphQLTypes["JSON"],
	limit?: number | undefined | null,
	page?: number | undefined | null,
	type?: string | undefined | null,
	username: string
};
	["GetExtensionsInput"]: {
		/** Фильтр включенных расширений */
	enabled?: boolean | undefined | null,
	/** Фильтр активности */
	is_available?: boolean | undefined | null,
	/** Фильтр рабочих столов */
	is_desktop?: boolean | undefined | null,
	/** Фильтр установленных расширений */
	is_installed?: boolean | undefined | null,
	/** Фильтр по имени */
	name?: string | undefined | null
};
	["GetMeetInput"]: {
		/** Имя аккаунта кооператива */
	coopname: string,
	/** Хеш собрания */
	hash: string
};
	["GetMeetsInput"]: {
		/** Имя аккаунта кооператива */
	coopname: string
};
	["GetPaymentMethodsInput"]: {
		/** Количество элементов на странице */
	limit: number,
	/** Номер страницы */
	page: number,
	/** Ключ сортировки (например, "name") */
	sortBy?: string | undefined | null,
	/** Направление сортировки ("ASC" или "DESC") */
	sortOrder: string,
	/** Имя пользователя для фильтрации методов оплаты */
	username?: string | undefined | null
};
	["Individual"]: {
	__typename: "Individual",
	/** Дата рождения */
	birthdate: string,
	/** Email */
	email: string,
	/** Имя */
	first_name: string,
	/** Полный адрес */
	full_address: string,
	/** Фамилия */
	last_name: string,
	/** Отчество */
	middle_name: string,
	/** Данные паспорта */
	passport?: GraphQLTypes["Passport"] | undefined | null,
	/** Телефон */
	phone: string,
	/** Имя аккаунта */
	username: string
};
	["IndividualCertificate"]: {
	__typename: "IndividualCertificate",
	/** Имя */
	first_name: string,
	/** Фамилия */
	last_name: string,
	/** Отчество */
	middle_name?: string | undefined | null,
	/** Тип аккаунта */
	type: GraphQLTypes["AccountType"],
	/** Имя аккаунта */
	username: string
};
	["Init"]: {
		/** Объект организации кооператива, которая обслуживает данный экземпляр программного обеспечения MONO */
	organization_data: GraphQLTypes["CreateOrganizationDataInput"],
	/** Переменные кооператива, используемые для заполнения шаблонов документов */
	vars: GraphQLTypes["VarsInput"]
};
	["Install"]: {
		soviet: Array<GraphQLTypes["SovietMemberInput"]>,
	wif: string
};
	/** The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
["JSON"]: "scalar" & { name: "JSON" };
	/** The `JSONObject` scalar type represents JSON objects as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
["JSONObject"]: "scalar" & { name: "JSONObject" };
	["KeyWeight"]: {
	__typename: "KeyWeight",
	/** Ключ */
	key: string,
	/** Вес */
	weight: number
};
	["LoginInput"]: {
		/** Электронная почта */
	email: string,
	/** Метка времени в строковом формате ISO */
	now: string,
	/** Цифровая подпись метки времени */
	signature: string
};
	["LogoutInput"]: {
		/** Токен обновления */
	access_token: string,
	/** Токен доступа */
	refresh_token: string
};
	/** Данные о собрании кооператива */
["Meet"]: {
	__typename: "Meet",
	/** Документ с решением совета о проведении собрания */
	authorization?: GraphQLTypes["DocumentAggregate"] | undefined | null,
	/** Дата закрытия собрания */
	close_at: GraphQLTypes["DateTime"],
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Дата создания собрания */
	created_at: GraphQLTypes["DateTime"],
	/** Текущий процент кворума */
	current_quorum_percent: number,
	/** Цикл собрания */
	cycle: number,
	/** Документ с решением секретаря */
	decision1?: GraphQLTypes["DocumentAggregate"] | undefined | null,
	/** Документ с решением председателя */
	decision2?: GraphQLTypes["DocumentAggregate"] | undefined | null,
	/** Хеш собрания */
	hash: string,
	/** Уникальный идентификатор собрания */
	id: number,
	/** Инициатор собрания */
	initiator: string,
	/** Сертификат инициатора собрания */
	initiator_certificate?: GraphQLTypes["UserCertificateUnion"] | undefined | null,
	/** Уровень собрания */
	level: string,
	/** Список пользователей, которые подписали уведомление */
	notified_users: Array<string>,
	/** Дата открытия собрания */
	open_at: GraphQLTypes["DateTime"],
	/** Председатель собрания */
	presider: string,
	/** Сертификат председателя собрания */
	presider_certificate?: GraphQLTypes["UserCertificateUnion"] | undefined | null,
	/** Документ с повесткой собрания */
	proposal?: GraphQLTypes["DocumentAggregate"] | undefined | null,
	/** Флаг достижения кворума */
	quorum_passed: boolean,
	/** Процент необходимого кворума */
	quorum_percent: number,
	/** Секретарь собрания */
	secretary: string,
	/** Сертификат секретаря собрания */
	secretary_certificate?: GraphQLTypes["UserCertificateUnion"] | undefined | null,
	/** Количество подписанных бюллетеней */
	signed_ballots: number,
	/** Статус собрания */
	status: string,
	/** Тип собрания */
	type: string
};
	/** Агрегат данных о собрании, содержащий информацию о разных этапах */
["MeetAggregate"]: {
	__typename: "MeetAggregate",
	/** Хеш собрания */
	hash: string,
	/** Данные собрания на этапе предварительной обработки */
	pre?: GraphQLTypes["MeetPreProcessing"] | undefined | null,
	/** Данные собрания после обработки */
	processed?: GraphQLTypes["MeetProcessed"] | undefined | null,
	/** Данные собрания на этапе обработки */
	processing?: GraphQLTypes["MeetProcessing"] | undefined | null
};
	/** Предварительные данные собрания перед обработкой */
["MeetPreProcessing"]: {
	__typename: "MeetPreProcessing",
	/** Повестка собрания */
	agenda: Array<GraphQLTypes["AgendaMeetPoint"]>,
	/** Дата закрытия собрания */
	close_at: GraphQLTypes["DateTime"],
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Хеш собрания */
	hash: string,
	/** Инициатор собрания */
	initiator: string,
	/** Сертификат инициатора собрания */
	initiator_certificate?: GraphQLTypes["UserCertificateUnion"] | undefined | null,
	/** Дата открытия собрания */
	open_at: GraphQLTypes["DateTime"],
	/** Председатель собрания */
	presider: string,
	/** Сертификат председателя собрания */
	presider_certificate?: GraphQLTypes["UserCertificateUnion"] | undefined | null,
	/** Документ с предложением повестки собрания */
	proposal?: GraphQLTypes["DocumentAggregate"] | undefined | null,
	/** Секретарь собрания */
	secretary: string,
	/** Сертификат секретаря собрания */
	secretary_certificate?: GraphQLTypes["UserCertificateUnion"] | undefined | null
};
	/** Данные о собрании после обработки */
["MeetProcessed"]: {
	__typename: "MeetProcessed",
	/** Имя кооператива */
	coopname: string,
	/** Документ решения из блокчейна */
	decision: GraphQLTypes["SignedDigitalDocument"],
	/** Агрегат документа решения */
	decisionAggregate?: GraphQLTypes["DocumentAggregate"] | undefined | null,
	/** Хеш собрания */
	hash: string,
	/** Председатель собрания */
	presider: string,
	/** Сертификат председателя собрания */
	presider_certificate?: GraphQLTypes["UserCertificateUnion"] | undefined | null,
	/** Пройден ли кворум */
	quorum_passed: boolean,
	/** Процент кворума */
	quorum_percent: number,
	/** Результаты голосования по вопросам */
	results: Array<GraphQLTypes["MeetQuestionResult"]>,
	/** Секретарь собрания */
	secretary: string,
	/** Сертификат секретаря собрания */
	secretary_certificate?: GraphQLTypes["UserCertificateUnion"] | undefined | null,
	/** Количество подписанных бюллетеней */
	signed_ballots: number
};
	/** Данные о собрании в процессе обработки */
["MeetProcessing"]: {
	__typename: "MeetProcessing",
	/** Расширенный статус собрания на основе дат и состояния */
	extendedStatus: GraphQLTypes["ExtendedMeetStatus"],
	/** Хеш собрания */
	hash: string,
	/** Флаг указывающий, голосовал ли текущий пользователь */
	isVoted: boolean,
	/** Основная информация о собрании */
	meet: GraphQLTypes["Meet"],
	/** Список вопросов повестки собрания */
	questions: Array<GraphQLTypes["Question"]>
};
	/** Результат голосования по вопросу */
["MeetQuestionResult"]: {
	__typename: "MeetQuestionResult",
	/** Принят ли вопрос */
	accepted: boolean,
	/** Контекст вопроса */
	context: string,
	/** Принятое решение */
	decision: string,
	/** Порядковый номер вопроса */
	number: number,
	/** Идентификатор вопроса */
	question_id: number,
	/** Заголовок вопроса */
	title: string,
	/** Количество воздержавшихся */
	votes_abstained: number,
	/** Количество голосов против */
	votes_against: number,
	/** Количество голосов за */
	votes_for: number
};
	["MetaDocumentInput"]: {
		/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** ID документа в реестре */
	registry_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["ModerateRequestInput"]: {
		/** Размер комиссии за отмену в формате "10.0000 RUB" */
	cancellation_fee: string,
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Идентификатор обмена */
	exchange_id: number,
	/** Имя аккаунта пользователя */
	username: string
};
	["MonoAccount"]: {
	__typename: "MonoAccount",
	/** Электронная почта пользователя */
	email: string,
	/** Есть ли у пользователя аккаунт */
	has_account: boolean,
	/** ID начального заказа */
	initial_order?: string | undefined | null,
	/** Подтверждена ли электронная почта */
	is_email_verified: boolean,
	/** Зарегистрирован ли пользователь */
	is_registered: boolean,
	/** Сообщение */
	message?: string | undefined | null,
	/** Публичный ключ пользователя */
	public_key: string,
	/** Реферер пользователя */
	referer: string,
	/** Роль пользователя */
	role: string,
	/** Статус пользователя */
	status: GraphQLTypes["UserStatus"],
	/** Хэш подписчика для уведомлений */
	subscriber_hash: string,
	/** Идентификатор подписчика для уведомлений */
	subscriber_id: string,
	/** Тип пользователя */
	type: string,
	/** Имя пользователя */
	username: string
};
	["Mutation"]: {
	__typename: "Mutation",
	/** Подтвердить поставку имущества на заявку */
	acceptChildOrder: GraphQLTypes["Transaction"],
	/** Добавить активного пайщика, который вступил в кооператив, не используя платформу (заполнив заявление собственноручно, оплатив вступительный и минимальный паевый взносы, и получив протокол решения совета) */
	addParticipant: GraphQLTypes["Account"],
	/** Добавить доверенное лицо кооперативного участка */
	addTrustedAccount: GraphQLTypes["Branch"],
	/** Отменить заявку */
	cancelRequest: GraphQLTypes["Transaction"],
	/** Завершить заявку по истечению гарантийного срока */
	completeRequest: GraphQLTypes["Transaction"],
	/** Подтвердить получение имущества Уполномоченным лицом от Заказчика по новации и акту приёмки-передачи */
	confirmReceiveOnRequest: GraphQLTypes["Transaction"],
	/** Подтвердить поставку имущества Поставщиком по заявке Заказчика и акту приёма-передачи */
	confirmSupplyOnRequest: GraphQLTypes["Transaction"],
	/** Сгенерировать документ предложения повестки очередного общего собрания пайщиков */
	createAnnualGeneralMeet: GraphQLTypes["MeetAggregate"],
	/** Добавить метод оплаты */
	createBankAccount: GraphQLTypes["PaymentMethod"],
	/** Создать кооперативный участок */
	createBranch: GraphQLTypes["Branch"],
	/** Создать заявку на поставку имущества по предложению Поставщика */
	createChildOrder: GraphQLTypes["Transaction"],
	/** Создание объекта паевого платежа производится мутацией createDepositPayment. Выполнение мутации возвращает идентификатор платежа и данные для его совершения в зависимости от выбранного платежного провайдера. */
	createDepositPayment: GraphQLTypes["GatewayPayment"],
	/** Создание объекта регистрационного платежа производится мутацией createInitialPayment. Выполнение мутации возвращает идентификатор платежа и данные для его совершения в зависимости от выбранного платежного провайдера. */
	createInitialPayment: GraphQLTypes["GatewayPayment"],
	/** Создать предложение на поставку имущества */
	createParentOffer: GraphQLTypes["Transaction"],
	/** Создать повестку дня и проект решения, и сохранить в хранилище для дальнейшей генерации документа и его публикации */
	createProjectOfFreeDecision: GraphQLTypes["CreatedProjectFreeDecision"],
	/** Создать заявку на вывод средств */
	createWithdraw: GraphQLTypes["CreateWithdrawResponse"],
	/** Отклонить заявку */
	declineRequest: GraphQLTypes["Transaction"],
	/** Удалить кооперативный участок */
	deleteBranch: boolean,
	/** Удалить метод оплаты */
	deletePaymentMethod: boolean,
	/** Удалить доверенное лицо кооперативного участка */
	deleteTrustedAccount: GraphQLTypes["Branch"],
	/** Подтвердить доставку имущества Заказчику по заявке */
	deliverOnRequest: GraphQLTypes["Transaction"],
	/** Открыть спор по заявке */
	disputeOnRequest: GraphQLTypes["Transaction"],
	/** Изменить кооперативный участок */
	editBranch: GraphQLTypes["Branch"],
	/** Сгенерировать предложение повестки общего собрания пайщиков */
	generateAnnualGeneralMeetAgendaDocument: GraphQLTypes["GeneratedDocument"],
	/** Сгенерировать документ решения общего собрания пайщиков */
	generateAnnualGeneralMeetDecisionDocument: GraphQLTypes["GeneratedDocument"],
	/** Сгенерировать документ уведомления о проведении общего собрания пайщиков */
	generateAnnualGeneralMeetNotificationDocument: GraphQLTypes["GeneratedDocument"],
	/** Сгенерировать документ акта приема-передачи. */
	generateAssetContributionAct: GraphQLTypes["GeneratedDocument"],
	/** Сгенерировать документ решения о вступлении в кооператив. */
	generateAssetContributionDecision: GraphQLTypes["GeneratedDocument"],
	/** Сгенерировать документ заявления о вступлении в кооператив. */
	generateAssetContributionStatement: GraphQLTypes["GeneratedDocument"],
	/** Сгенерировать бюллетень для голосования на общем собрании пайщиков */
	generateBallotForAnnualGeneralMeetDocument: GraphQLTypes["GeneratedDocument"],
	/** Сгенерировать протокол решения по предложенной повестке */
	generateFreeDecision: GraphQLTypes["GeneratedDocument"],
	/** Сгенерировать документ заявления о вступлении в кооператив. */
	generateParticipantApplication: GraphQLTypes["GeneratedDocument"],
	/** Сгенерировать документ протокол решения собрания совета */
	generateParticipantApplicationDecision: GraphQLTypes["GeneratedDocument"],
	/** Сгенерировать документ согласия с политикой конфиденциальности. */
	generatePrivacyAgreement: GraphQLTypes["GeneratedDocument"],
	/** Сгенерировать документ проекта свободного решения */
	generateProjectOfFreeDecision: GraphQLTypes["GeneratedDocument"],
	/** Сгенерировать документ акта возврата имущества. */
	generateReturnByAssetAct: GraphQLTypes["GeneratedDocument"],
	/** Сгенерировать документ решения о возврате имущества. */
	generateReturnByAssetDecision: GraphQLTypes["GeneratedDocument"],
	/** Сгенерировать документ заявления о возврате имущества. */
	generateReturnByAssetStatement: GraphQLTypes["GeneratedDocument"],
	/** Сгенерировать документ решения совета о возврате паевого взноса */
	generateReturnByMoneyDecisionDocument: GraphQLTypes["GeneratedDocument"],
	/** Сгенерировать документ заявления на возврат паевого взноса */
	generateReturnByMoneyStatementDocument: GraphQLTypes["GeneratedDocument"],
	/** Сгенерировать документ, подтверждающий выбор кооперативного участка */
	generateSelectBranchDocument: GraphQLTypes["GeneratedDocument"],
	/** Сгенерировать документ соглашения о порядка и правилах использования простой электронной подписи. */
	generateSignatureAgreement: GraphQLTypes["GeneratedDocument"],
	/** Сгенерировать документ решения Совета по проведению общего собрания пайщиков */
	generateSovietDecisionOnAnnualMeetDocument: GraphQLTypes["GeneratedDocument"],
	/** Сгенерировать документ пользовательского соглашения. */
	generateUserAgreement: GraphQLTypes["GeneratedDocument"],
	/** Сгенерировать документ соглашения о целевой потребительской программе "Цифровой Кошелёк" */
	generateWalletAgreement: GraphQLTypes["GeneratedDocument"],
	/** Произвести инициализацию программного обеспечения перед установкой совета методом install */
	initSystem: GraphQLTypes["SystemInfo"],
	/** Установить расширение */
	installExtension: GraphQLTypes["Extension"],
	/** Произвести установку членов совета перед началом работы */
	installSystem: GraphQLTypes["SystemInfo"],
	/** Войти в систему с помощью цифровой подписи и получить JWT-токены доступа */
	login: GraphQLTypes["RegisteredAccount"],
	/** Выйти из системы и заблокировать JWT-токены */
	logout: boolean,
	/** Модерировать заявку */
	moderateRequest: GraphQLTypes["Transaction"],
	/** Уведомление о проведении общего собрания пайщиков */
	notifyOnAnnualGeneralMeet: GraphQLTypes["MeetAggregate"],
	/** Отклонить модерацию по заявке */
	prohibitRequest: GraphQLTypes["Transaction"],
	/** Опубликовать предложенную повестку и проект решения для дальнейшего голосования совета по нему */
	publishProjectOfFreeDecision: boolean,
	/** Опубликовать заявку */
	publishRequest: GraphQLTypes["Transaction"],
	/** Подтвердить получение имущества Уполномоченным лицом от Заказчика по акту приёмки-передачи */
	receiveOnRequest: GraphQLTypes["Transaction"],
	/** Обновить токен доступа аккаунта */
	refresh: GraphQLTypes["RegisteredAccount"],
	/** Зарегистрировать аккаунт пользователя в системе */
	registerAccount: GraphQLTypes["RegisteredAccount"],
	/** Зарегистрировать заявление и подписанные положения, подготовив пакет документов к отправке в совет на голосование после поступления оплаты. */
	registerParticipant: GraphQLTypes["Account"],
	/** Заменить приватный ключ аккаунта */
	resetKey: boolean,
	/** Перезапуск общего собрания пайщиков */
	restartAnnualGeneralMeet: GraphQLTypes["MeetAggregate"],
	/** Выбрать кооперативный участок */
	selectBranch: boolean,
	/** Управление статусом платежа осущствляется мутацией setPaymentStatus. При переходе платежа в статус PAID вызывается эффект в блокчейне, который завершает операцию автоматическим переводом платежа в статус COMPLETED. При установке статуса REFUNDED запускается процесс отмены платежа в блокчейне. Остальные статусы не приводят к эффектам в блокчейне. */
	setPaymentStatus: GraphQLTypes["GatewayPayment"],
	/** Сохранить приватный ключ в зашифрованном серверном хранилище */
	setWif: boolean,
	/** Подписание решения председателем на общем собрании пайщиков */
	signByPresiderOnAnnualGeneralMeet: GraphQLTypes["MeetAggregate"],
	/** Подписание решения секретарём на общем собрании пайщиков */
	signBySecretaryOnAnnualGeneralMeet: GraphQLTypes["MeetAggregate"],
	/** Выслать токен для замены приватного ключа аккаунта на электронную почту */
	startResetKey: boolean,
	/** Подтвердить поставку имущества Поставщиком по заявке Заказчика и акту приёма-передачи */
	supplyOnRequest: GraphQLTypes["Transaction"],
	/** Удалить расширение */
	uninstallExtension: boolean,
	/** Снять с публикации заявку */
	unpublishRequest: GraphQLTypes["Transaction"],
	/** Обновить аккаунт в системе провайдера. Обновление аккаунта пользователя производится по username. Мутация позволяет изменить приватные данные пользователя, а также, адрес электронной почты в MONO. Использовать мутацию может только председатель совета. */
	updateAccount: GraphQLTypes["Account"],
	/** Обновить банковский счёт */
	updateBankAccount: GraphQLTypes["PaymentMethod"],
	/** Обновить расширение */
	updateExtension: GraphQLTypes["Extension"],
	/** Обновить заявку */
	updateRequest: GraphQLTypes["Transaction"],
	/** Обновить параметры системы */
	updateSystem: GraphQLTypes["SystemInfo"],
	/** Голосование на общем собрании пайщиков */
	voteOnAnnualGeneralMeet: GraphQLTypes["MeetAggregate"]
};
	["NotifyOnAnnualGeneralMeetInput"]: {
		coopname: string,
	meet_hash: string,
	notification: GraphQLTypes["AnnualGeneralMeetingNotificationSignedDocumentInput"],
	username: string
};
	["Organization"]: {
	__typename: "Organization",
	/** Город */
	city: string,
	/** Страна */
	country: string,
	/** Детали организации */
	details: GraphQLTypes["OrganizationDetails"],
	/** Email */
	email: string,
	/** Фактический адрес */
	fact_address: string,
	/** Юридический адрес */
	full_address: string,
	/** Полное название */
	full_name: string,
	/** Телефон */
	phone: string,
	/** Представитель организации */
	represented_by: GraphQLTypes["RepresentedBy"],
	/** Краткое название */
	short_name: string,
	/** Тип организации */
	type: string,
	/** Имя аккаунта организации */
	username: string
};
	["OrganizationCertificate"]: {
	__typename: "OrganizationCertificate",
	/** ИНН */
	inn: string,
	/** ОГРН */
	ogrn: string,
	/** Данные представителя */
	represented_by: GraphQLTypes["RepresentedByCertificate"],
	/** Короткое название организации */
	short_name: string,
	/** Тип аккаунта */
	type: GraphQLTypes["AccountType"],
	/** Имя аккаунта */
	username: string
};
	["OrganizationDetails"]: {
	__typename: "OrganizationDetails",
	/** ИНН */
	inn: string,
	/** КПП */
	kpp: string,
	/** ОГРН */
	ogrn: string
};
	["OrganizationDetailsInput"]: {
		inn: string,
	kpp: string,
	ogrn: string
};
	/** Тип юридического лица */
["OrganizationType"]: OrganizationType;
	["PaginatedGatewayPaymentsPaginationResult"]: {
	__typename: "PaginatedGatewayPaymentsPaginationResult",
	/** Текущая страница */
	currentPage: number,
	/** Элементы текущей страницы */
	items: Array<GraphQLTypes["GatewayPayment"]>,
	/** Общее количество элементов */
	totalCount: number,
	/** Общее количество страниц */
	totalPages: number
};
	["PaginationInput"]: {
		/** Количество элементов на странице */
	limit: number,
	/** Номер страницы */
	page: number,
	/** Ключ сортировки (например, "name") */
	sortBy?: string | undefined | null,
	/** Направление сортировки ("ASC" или "DESC") */
	sortOrder: string
};
	["ParticipantAccount"]: {
	__typename: "ParticipantAccount",
	/** Имя кооперативного участка */
	braname?: string | undefined | null,
	/** Время создания записи о члене */
	created_at: GraphQLTypes["DateTime"],
	/** LEGACY Флаг, имеет ли член право голоса */
	has_vote: boolean,
	/** Сумма вступительного взноса */
	initial_amount?: string | undefined | null,
	/** LEGACY Флаг, внесен ли регистрационный взнос */
	is_initial: boolean,
	/** LEGACY Флаг, внесен ли минимальный паевый взнос */
	is_minimum: boolean,
	/** Время последнего минимального платежа */
	last_min_pay: GraphQLTypes["DateTime"],
	/** Время последнего обновления информации о члене */
	last_update: GraphQLTypes["DateTime"],
	/** Сумма минимального паевого взноса */
	minimum_amount?: string | undefined | null,
	/** Статус члена кооператива (accepted | blocked) */
	status: string,
	/** Тип участника (individual | entrepreneur | organization) */
	type?: string | undefined | null,
	/** Уникальное имя члена кооператива */
	username: string
};
	["ParticipantApplicationDecisionGenerateDocumentInput"]: {
		/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Идентификатор протокола решения собрания совета */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["ParticipantApplicationGenerateDocumentInput"]: {
		/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Имя аккаунта кооперативного участка */
	braname: string,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Изображение собственноручной подписи (base-64) */
	signature?: string | undefined | null,
	/** Флаг пропуска сохранения документа (используется для предварительной генерации и демонстрации пользователю) */
	skip_save: boolean,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["ParticipantApplicationSignedDocumentInput"]: {
		/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	meta: GraphQLTypes["ParticipantApplicationSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<GraphQLTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["ParticipantApplicationSignedMetaDocumentInput"]: {
		/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Имя аккаунта кооперативного участка */
	braname: string,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** ID документа в реестре */
	registry_id: number,
	/** Изображение собственноручной подписи (base-64) */
	signature?: string | undefined | null,
	/** Флаг пропуска сохранения документа (используется для предварительной генерации и демонстрации пользователю) */
	skip_save: boolean,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["Passport"]: {
	__typename: "Passport",
	/** Код подразделения */
	code: string,
	/** Дата выдачи */
	issued_at: string,
	/** Кем выдан */
	issued_by: string,
	/** Номер паспорта */
	number: number,
	/** Серия паспорта */
	series: number
};
	["PassportInput"]: {
		code: string,
	issued_at: string,
	issued_by: string,
	number: number,
	series: number
};
	["PaymentDetails"]: {
	__typename: "PaymentDetails",
	/** Сумма платежа с учетом комиссии */
	amount_plus_fee: string,
	/** Сумма платежа без учета комиссии */
	amount_without_fee: string,
	/** Данные платежа (QR-код, токен, реквизиты и т.д.) */
	data: GraphQLTypes["JSON"],
	/** Фактический процент комиссии */
	fact_fee_percent: number,
	/** Размер комиссии в абсолютных значениях */
	fee_amount: string,
	/** Процент комиссии */
	fee_percent: number,
	/** Допустимый процент отклонения */
	tolerance_percent: number
};
	/** Направление платежа */
["PaymentDirection"]: PaymentDirection;
	["PaymentFiltersInput"]: {
		/** Название кооператива */
	coopname?: string | undefined | null,
	/** Направление платежа */
	direction?: GraphQLTypes["PaymentDirection"] | undefined | null,
	/** Хэш платежа */
	hash?: string | undefined | null,
	/** Провайдер платежа */
	provider?: string | undefined | null,
	/** Статус платежа */
	status?: GraphQLTypes["PaymentStatus"] | undefined | null,
	/** Тип платежа */
	type?: GraphQLTypes["PaymentType"] | undefined | null,
	/** Имя пользователя */
	username?: string | undefined | null
};
	["PaymentMethod"]: {
	__typename: "PaymentMethod",
	/** Дата создания */
	created_at: GraphQLTypes["DateTime"],
	/** Данные метода оплаты */
	data: GraphQLTypes["PaymentMethodData"],
	/** Флаг основного метода платежа, который отображается в документах */
	is_default: boolean,
	/** Идентификатор метода оплаты */
	method_id: string,
	/** Тип метода оплаты (например, sbp, bank_transfer) */
	method_type: string,
	/** Дата обновления */
	updated_at: GraphQLTypes["DateTime"],
	/** Имя пользователя, к которому привязан метод оплаты */
	username: string
};
	["PaymentMethodData"]:{
        	__typename:"BankAccount" | "SbpAccount"
        	['...on BankAccount']: '__union' & GraphQLTypes["BankAccount"];
	['...on SbpAccount']: '__union' & GraphQLTypes["SbpAccount"];
};
	["PaymentMethodPaginationResult"]: {
	__typename: "PaymentMethodPaginationResult",
	/** Текущая страница */
	currentPage: number,
	/** Элементы текущей страницы */
	items: Array<GraphQLTypes["PaymentMethod"]>,
	/** Общее количество элементов */
	totalCount: number,
	/** Общее количество страниц */
	totalPages: number
};
	/** Статус платежа */
["PaymentStatus"]: PaymentStatus;
	/** Тип платежа по назначению */
["PaymentType"]: PaymentType;
	["Permission"]: {
	__typename: "Permission",
	/** Родительское разрешение */
	parent: string,
	/** Имя разрешения */
	perm_name: string,
	/** Требуемые разрешения */
	required_auth: GraphQLTypes["Authority"]
};
	["PermissionLevel"]: {
	__typename: "PermissionLevel",
	/** Актор */
	actor: string,
	/** Разрешение */
	permission: string
};
	["PermissionLevelWeight"]: {
	__typename: "PermissionLevelWeight",
	/** Уровень разрешения */
	permission: GraphQLTypes["PermissionLevel"],
	/** Вес */
	weight: number
};
	["PrivateAccount"]: {
	__typename: "PrivateAccount",
	entrepreneur_data?: GraphQLTypes["Entrepreneur"] | undefined | null,
	individual_data?: GraphQLTypes["Individual"] | undefined | null,
	organization_data?: GraphQLTypes["Organization"] | undefined | null,
	/** Тип аккаунта */
	type: GraphQLTypes["AccountType"]
};
	["PrivateAccountSearchData"]:{
        	__typename:"Entrepreneur" | "Individual" | "Organization"
        	['...on Entrepreneur']: '__union' & GraphQLTypes["Entrepreneur"];
	['...on Individual']: '__union' & GraphQLTypes["Individual"];
	['...on Organization']: '__union' & GraphQLTypes["Organization"];
};
	["PrivateAccountSearchResult"]: {
	__typename: "PrivateAccountSearchResult",
	/** Данные найденного аккаунта */
	data: GraphQLTypes["PrivateAccountSearchData"],
	/** Поля, в которых найдены совпадения */
	highlightedFields?: Array<string> | undefined | null,
	/** Оценка релевантности результата */
	score?: number | undefined | null,
	/** Тип аккаунта */
	type: string
};
	["ProhibitRequestInput"]: {
		/** Имя аккаунта кооператива */
	coopname: string,
	/** Идентификатор обмена */
	exchange_id: number,
	/** Дополнительная информация о отклоненной модерации */
	meta: string,
	/** Имя аккаунта пользователя */
	username: string
};
	["ProjectFreeDecisionGenerateDocumentInput"]: {
		/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Идентификатор проекта решения */
	project_id: string,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["ProjectFreeDecisionSignedDocumentInput"]: {
		/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация для создания проекта свободного решения */
	meta: GraphQLTypes["ProjectFreeDecisionSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<GraphQLTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["ProjectFreeDecisionSignedMetaDocumentInput"]: {
		/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** Идентификатор проекта решения */
	project_id: string,
	/** ID документа в реестре */
	registry_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["PublicChairman"]: {
	__typename: "PublicChairman",
	first_name: string,
	last_name: string,
	middle_name: string
};
	["PublishProjectFreeDecisionInput"]: {
		/** Имя аккаунта кооператива */
	coopname: string,
	/** Подписанный электронный документ (generateProjectOfFreeDecision) */
	document: GraphQLTypes["ProjectFreeDecisionSignedDocumentInput"],
	/** Строка мета-информации */
	meta: string,
	/** Имя аккаунта пользователя */
	username: string
};
	["PublishRequestInput"]: {
		/** Имя аккаунта кооператива */
	coopname: string,
	/** Идентификатор заявки */
	exchange_id: number,
	/** Имя аккаунта пользователя */
	username: string
};
	["Query"]: {
	__typename: "Query",
	/** Получить сводную информацию о аккаунте */
	getAccount: GraphQLTypes["Account"],
	/** Получить сводную информацию о аккаунтах системы */
	getAccounts: GraphQLTypes["AccountsPaginationResult"],
	/** Получить список вопросов совета кооператива для голосования */
	getAgenda: Array<GraphQLTypes["AgendaWithDocuments"]>,
	/** Получить список кооперативных участков */
	getBranches: Array<GraphQLTypes["Branch"]>,
	/** Получить состав приложений рабочего стола */
	getDesktop: GraphQLTypes["Desktop"],
	getDocuments: GraphQLTypes["DocumentsAggregatePaginationResult"],
	/** Получить список расширений */
	getExtensions: Array<GraphQLTypes["Extension"]>,
	/** Получить данные собрания по хешу */
	getMeet: GraphQLTypes["MeetAggregate"],
	/** Получить список всех собраний кооператива */
	getMeets: Array<GraphQLTypes["MeetAggregate"]>,
	/** Получить список методов оплаты */
	getPaymentMethods: GraphQLTypes["PaymentMethodPaginationResult"],
	/** Получить список платежей с возможностью фильтрации по типу, статусу и направлению. */
	getPayments: GraphQLTypes["PaginatedGatewayPaymentsPaginationResult"],
	/** Получить сводную публичную информацию о системе */
	getSystemInfo: GraphQLTypes["SystemInfo"],
	/** Поиск приватных данных аккаунтов по запросу. Поиск осуществляется по полям ФИО, ИНН, ОГРН, наименованию организации и другим приватным данным. */
	searchPrivateAccounts: Array<GraphQLTypes["PrivateAccountSearchResult"]>
};
	/** Вопрос повестки собрания с результатами голосования */
["Question"]: {
	__typename: "Question",
	/** Контекст или дополнительная информация по вопросу */
	context: string,
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Количество голосов "Воздержался" */
	counter_votes_abstained: number,
	/** Количество голосов "Против" */
	counter_votes_against: number,
	/** Количество голосов "За" */
	counter_votes_for: number,
	/** Предлагаемое решение по вопросу */
	decision: string,
	/** Уникальный идентификатор вопроса */
	id: number,
	/** Идентификатор собрания, к которому относится вопрос */
	meet_id: number,
	/** Порядковый номер вопроса в повестке */
	number: number,
	/** Заголовок вопроса */
	title: string,
	/** Список участников, проголосовавших "Воздержался" */
	voters_abstained: Array<string>,
	/** Список участников, проголосовавших "Против" */
	voters_against: Array<string>,
	/** Список участников, проголосовавших "За" */
	voters_for: Array<string>
};
	["ReceiveOnRequestInput"]: {
		/** Имя аккаунта кооператива */
	coopname: string,
	/** Подписанный Заказчиком акт приёмки-передачи имущества из Кооператива по новации */
	document: GraphQLTypes["ReturnByAssetActSignedDocumentInput"],
	/** Идентификатор заявки */
	exchange_id: number,
	/** Имя аккаунта пользователя */
	username: string
};
	["RefreshInput"]: {
		/** Токен доступа */
	access_token: string,
	/** Токен обновления */
	refresh_token: string
};
	["RefundRequest"]: {
	__typename: "RefundRequest",
	/** Сумма CPU */
	cpu_amount: string,
	/** Сумма сети */
	net_amount: string,
	/** Владелец */
	owner: string,
	/** Время запроса */
	request_time: string
};
	["RegisterAccountInput"]: {
		/** Электронная почта */
	email: string,
	/** Данные индивидуального предпринимателя */
	entrepreneur_data?: GraphQLTypes["CreateEntrepreneurDataInput"] | undefined | null,
	/** Данные физического лица */
	individual_data?: GraphQLTypes["CreateIndividualDataInput"] | undefined | null,
	/** Данные организации */
	organization_data?: GraphQLTypes["CreateOrganizationDataInput"] | undefined | null,
	/** Публичный ключ */
	public_key: string,
	/** Имя аккаунта реферера */
	referer?: string | undefined | null,
	/** Тип аккаунта */
	type: GraphQLTypes["AccountType"],
	/** Имя пользователя */
	username: string
};
	["RegisterParticipantInput"]: {
		/** Имя кооперативного участка */
	braname?: string | undefined | null,
	/** Подписанный документ политики конфиденциальности от пайщика */
	privacy_agreement: GraphQLTypes["SignedDigitalDocumentInput"],
	/** Подписанный документ положения о цифровой подписи от пайщика */
	signature_agreement: GraphQLTypes["SignedDigitalDocumentInput"],
	/** Подписанный документ заявления на вступление в кооператив от пайщика */
	statement: GraphQLTypes["ParticipantApplicationSignedDocumentInput"],
	/** Подписанный документ пользовательского соглашения от пайщика */
	user_agreement: GraphQLTypes["SignedDigitalDocumentInput"],
	/** Имя аккаунта пайщика */
	username: string,
	/** Подписанный документ положения целевой потребительской программы "Цифровой Кошелёк" от пайщика */
	wallet_agreement: GraphQLTypes["SignedDigitalDocumentInput"]
};
	["RegisteredAccount"]: {
	__typename: "RegisteredAccount",
	/** Информация об зарегистрированном аккаунте */
	account: GraphQLTypes["Account"],
	/** Токены доступа и обновления */
	tokens: GraphQLTypes["Tokens"]
};
	["RepresentedBy"]: {
	__typename: "RepresentedBy",
	/** На основании чего действует */
	based_on: string,
	/** Имя */
	first_name: string,
	/** Фамилия */
	last_name: string,
	/** Отчество */
	middle_name: string,
	/** Должность */
	position: string
};
	["RepresentedByCertificate"]: {
	__typename: "RepresentedByCertificate",
	/** Имя */
	first_name: string,
	/** Фамилия */
	last_name: string,
	/** Отчество */
	middle_name: string,
	/** Должность */
	position: string
};
	["RepresentedByInput"]: {
		based_on: string,
	first_name: string,
	last_name: string,
	middle_name: string,
	position: string
};
	["ResetKeyInput"]: {
		/** Публичный ключ для замены */
	public_key: string,
	/** Токен авторизации для замены ключа, полученный по email */
	token: string
};
	["ResourceDelegationDTO"]: {
	__typename: "ResourceDelegationDTO",
	/** Вес CPU */
	cpu_weight: string,
	/** Отправитель */
	from: string,
	/** Вес сети */
	net_weight: string,
	/** Получатель */
	to: string
};
	["ResourceOverview"]: {
	__typename: "ResourceOverview",
	/** Вес CPU */
	cpu_weight: string,
	/** Вес сети */
	net_weight: string,
	/** Владелец */
	owner: string,
	/** Используемая RAM */
	ram_bytes: number
};
	/** DTO для перезапуска ежегодного общего собрания кооператива */
["RestartAnnualGeneralMeetInput"]: {
		/** Имя аккаунта кооператива */
	coopname: string,
	/** Хеш собрания, которое необходимо перезапустить */
	hash: string,
	/** Новая дата закрытия собрания */
	new_close_at: GraphQLTypes["DateTime"],
	/** Новая дата открытия собрания */
	new_open_at: GraphQLTypes["DateTime"],
	/** Новое предложение повестки ежегодного общего собрания */
	newproposal: GraphQLTypes["AnnualGeneralMeetingAgendaSignedDocumentInput"]
};
	["ReturnByAssetActGenerateDocumentInput"]: {
		/** Идентификатор акта */
	act_id: string,
	/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Имя аккаунта кооперативного участка */
	braname?: string | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Идентификатор решения */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Идентификатор заявки */
	request_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя аккаунта получателя на кооперативном участке */
	transmitter: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["ReturnByAssetActSignedDocumentInput"]: {
		/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация для создания проекта свободного решения */
	meta: GraphQLTypes["ReturnByAssetActSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<GraphQLTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["ReturnByAssetActSignedMetaDocumentInput"]: {
		/** Идентификатор акта */
	act_id: string,
	/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Имя аккаунта кооперативного участка */
	braname?: string | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Идентификатор решения */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** ID документа в реестре */
	registry_id: number,
	/** Идентификатор заявки */
	request_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя аккаунта получателя на кооперативном участке */
	transmitter: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["ReturnByAssetDecisionGenerateDocumentInput"]: {
		/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Идентификатор решения */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Идентификатор заявки */
	request_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["ReturnByAssetStatementGenerateDocumentInput"]: {
		/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Запрос на внесение имущественного паевого взноса */
	request: GraphQLTypes["CommonRequestInput"],
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["ReturnByAssetStatementSignedDocumentInput"]: {
		/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация для создания проекта свободного решения */
	meta: GraphQLTypes["ReturnByAssetStatementSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<GraphQLTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["ReturnByAssetStatementSignedMetaDocumentInput"]: {
		/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** ID документа в реестре */
	registry_id: number,
	/** Запрос на внесение имущественного паевого взноса */
	request: GraphQLTypes["CommonRequestInput"],
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["ReturnByMoneyDecisionGenerateDocumentInput"]: {
		/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Валюта */
	currency: string,
	/** ID решения совета */
	decision_id: number,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Хэш платежа */
	payment_hash: string,
	/** Количество средств к возврату */
	quantity: string,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["ReturnByMoneyGenerateDocumentInput"]: {
		/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Валюта */
	currency: string,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** ID платежного метода */
	method_id: string,
	/** Хеш платежа для связи с withdraw */
	payment_hash: string,
	/** Количество средств к возврату */
	quantity: string,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["ReturnByMoneySignedDocumentInput"]: {
		/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация для документа заявления на возврат паевого взноса денежными средствами */
	meta: GraphQLTypes["ReturnByMoneySignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<GraphQLTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["ReturnByMoneySignedMetaDocumentInput"]: {
		/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Валюта */
	currency: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** ID платежного метода */
	method_id: string,
	/** Хеш платежа для связи с withdraw */
	payment_hash: string,
	/** Количество средств к возврату */
	quantity: string,
	/** ID документа в реестре */
	registry_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["SbpAccount"]: {
	__typename: "SbpAccount",
	/** Мобильный телефон получателя */
	phone: string
};
	["SearchPrivateAccountsInput"]: {
		/** Поисковый запрос для поиска приватных аккаунтов */
	query: string
};
	["SelectBranchGenerateDocumentInput"]: {
		/** Номер блока, на котором был создан документ */
	block_num?: number | undefined | null,
	/** Идентификатор имени аккаунта кооперативного участка */
	braname: string,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at?: string | undefined | null,
	/** Имя генератора, использованного для создания документа */
	generator?: string | undefined | null,
	/** Язык документа */
	lang?: string | undefined | null,
	/** Ссылки, связанные с документом */
	links?: Array<string> | undefined | null,
	/** Часовой пояс, в котором был создан документ */
	timezone?: string | undefined | null,
	/** Название документа */
	title?: string | undefined | null,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version?: string | undefined | null
};
	["SelectBranchInput"]: {
		/** Имя аккаунта кооперативного участка */
	braname: string,
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Подписанный электронный документ (generateSelectBranchDocument) */
	document: GraphQLTypes["SelectBranchSignedDocumentInput"],
	/** Имя аккаунта пользователя */
	username: string
};
	["SelectBranchSignedDocumentInput"]: {
		/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация для документа выбора кооперативного участка */
	meta: GraphQLTypes["SelectBranchSignedMetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<GraphQLTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["SelectBranchSignedMetaDocumentInput"]: {
		/** Номер блока, на котором был создан документ */
	block_num: number,
	/** Идентификатор имени аккаунта кооперативного участка */
	braname: string,
	/** Название кооператива, связанное с документом */
	coopname: string,
	/** Дата и время создания документа */
	created_at: string,
	/** Имя генератора, использованного для создания документа */
	generator: string,
	/** Язык документа */
	lang: string,
	/** Ссылки, связанные с документом */
	links: Array<string>,
	/** ID документа в реестре */
	registry_id: number,
	/** Часовой пояс, в котором был создан документ */
	timezone: string,
	/** Название документа */
	title: string,
	/** Имя пользователя, создавшего документ */
	username: string,
	/** Версия генератора, использованного для создания документа */
	version: string
};
	["SetPaymentStatusInput"]: {
		/** Идентификатор платежа, для которого устанавливается статус */
	id: string,
	/** Новый статус платежа */
	status: GraphQLTypes["PaymentStatus"]
};
	["SetWifInput"]: {
		/** Тип разрешения ключа */
	permission: string,
	/** Имя пользователя, чей ключ */
	username: string,
	/** Приватный ключ */
	wif: string
};
	/** Входные данные для подписи решения председателем */
["SignByPresiderOnAnnualGeneralMeetInput"]: {
		/** Имя аккаунта кооператива */
	coopname: string,
	/** Хеш собрания */
	hash: string,
	/** Подписанный документ с решением председателя */
	presider_decision: GraphQLTypes["AnnualGeneralMeetingDecisionSignedDocumentInput"],
	/** Имя аккаунта пользователя */
	username: string
};
	/** Входные данные для подписи решения секретарём */
["SignBySecretaryOnAnnualGeneralMeetInput"]: {
		/** Имя аккаунта кооператива */
	coopname: string,
	/** Хеш собрания */
	hash: string,
	/** Подписанный документ с решением секретаря */
	secretary_decision: GraphQLTypes["AnnualGeneralMeetingDecisionSignedDocumentInput"],
	/** Имя аккаунта пользователя */
	username: string
};
	["SignatureInfo"]: {
	__typename: "SignatureInfo",
	id: number,
	is_valid?: boolean | undefined | null,
	meta: GraphQLTypes["JSON"],
	public_key: string,
	signature: string,
	signed_at: string,
	signed_hash: string,
	signer: string,
	/** Сертификат подписанта (сокращенная информация) */
	signer_certificate?: GraphQLTypes["UserCertificateUnion"] | undefined | null
};
	["SignatureInfoInput"]: {
		/** Идентификатор номера подписи */
	id: number,
	/** Мета-данные подписи */
	meta: string,
	/** Публичный ключ */
	public_key: string,
	/** Подпись хэша */
	signature: string,
	/** Время подписания */
	signed_at: string,
	/** Подписанный хэш */
	signed_hash: string,
	/** Аккаунт подписавшего */
	signer: string
};
	["SignedBlockchainDocument"]: {
	__typename: "SignedBlockchainDocument",
	/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация документа (в формате JSON-строки) */
	meta: string,
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<GraphQLTypes["SignatureInfo"]>,
	/** Версия стандарта документа */
	version: string
};
	["SignedDigitalDocument"]: {
	__typename: "SignedDigitalDocument",
	doc_hash: string,
	hash: string,
	meta: GraphQLTypes["JSON"],
	meta_hash: string,
	signatures: Array<GraphQLTypes["SignatureInfo"]>,
	version: string
};
	["SignedDigitalDocumentInput"]: {
		/** Хэш содержимого документа */
	doc_hash: string,
	/** Общий хэш (doc_hash + meta_hash) */
	hash: string,
	/** Метаинформация документа */
	meta: GraphQLTypes["MetaDocumentInput"],
	/** Хэш мета-данных */
	meta_hash: string,
	/** Вектор подписей */
	signatures: Array<GraphQLTypes["SignatureInfoInput"]>,
	/** Версия стандарта документа */
	version: string
};
	["SovietMemberInput"]: {
		individual_data: GraphQLTypes["CreateIndividualDataInput"],
	role: string
};
	["StartResetKeyInput"]: {
		/** Электронная почта */
	email: string
};
	/** Комплексный объект цифрового документа заявления (или другого ведущего документа для цепочки принятия решений совета) с агрегатом документа */
["StatementDetailAggregate"]: {
	__typename: "StatementDetailAggregate",
	action: GraphQLTypes["ExtendedBlockchainAction"],
	documentAggregate: GraphQLTypes["DocumentAggregate"]
};
	["SupplyOnRequestInput"]: {
		/** Имя аккаунта кооператива */
	coopname: string,
	/** Подписанный Поставщиком акт приёма-передачи имущества в кооператив */
	document: GraphQLTypes["AssetContributionActSignedDocumentInput"],
	/** Идентификатор обмена */
	exchange_id: number,
	/** Имя аккаунта пользователя */
	username: string
};
	["SystemInfo"]: {
	__typename: "SystemInfo",
	/** Объект системного аккаунта кооператива в блокчейне */
	blockchain_account: GraphQLTypes["BlockchainAccount"],
	/** Набор данных с информацией о состоянии блокчейна */
	blockchain_info: GraphQLTypes["BlockchainInfoDTO"],
	/** Контакты кооператива */
	contacts?: GraphQLTypes["ContactsDTO"] | undefined | null,
	/** Объект аккаунта кооператива у оператора */
	cooperator_account: GraphQLTypes["CooperativeOperatorAccount"],
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Статус контроллера кооператива */
	system_status: GraphQLTypes["SystemStatus"],
	/** Переменные кооператива */
	vars?: GraphQLTypes["Vars"] | undefined | null
};
	/** Состояние контроллера кооператива */
["SystemStatus"]: SystemStatus;
	["Token"]: {
	__typename: "Token",
	/** Дата истечения токена доступа */
	expires: GraphQLTypes["DateTime"],
	/** Токен доступа */
	token: string
};
	["Tokens"]: {
	__typename: "Tokens",
	/** Токен доступа */
	access: GraphQLTypes["Token"],
	/** Токен обновления */
	refresh: GraphQLTypes["Token"]
};
	["Transaction"]: {
	__typename: "Transaction",
	/** Блокчейн, который использовался */
	chain: GraphQLTypes["JSONObject"],
	/** Запрос на подписание транзакции */
	request: GraphQLTypes["JSONObject"],
	/** Разрешенный запрос на подписание транзакции */
	resolved?: GraphQLTypes["JSONObject"] | undefined | null,
	/** Ответ от API после отправки транзакции (если был выполнен бродкаст) */
	response?: GraphQLTypes["JSONObject"] | undefined | null,
	/** Возвращаемые значения после выполнения транзакции */
	returns: GraphQLTypes["JSONObject"],
	/** Ревизии транзакции, измененные плагинами в ESR формате */
	revisions: GraphQLTypes["JSONObject"],
	/** Подписи транзакции */
	signatures: GraphQLTypes["JSONObject"],
	/** Авторизованный подписант */
	signer: GraphQLTypes["JSONObject"],
	/** Итоговая транзакция */
	transaction?: GraphQLTypes["JSONObject"] | undefined | null
};
	["UninstallExtensionInput"]: {
		/** Фильтр по имени */
	name: string
};
	["UnpublishRequestInput"]: {
		/** Имя аккаунта кооператива */
	coopname: string,
	/** Идентификатор обмена */
	exchange_id: number,
	/** Имя аккаунта пользователя */
	username: string
};
	["Update"]: {
		/** Собственные данные кооператива, обслуживающего экземпляр платформы */
	organization_data?: GraphQLTypes["UpdateOrganizationDataInput"] | undefined | null,
	/** Переменные кооператива, используемые для заполнения шаблонов документов */
	vars?: GraphQLTypes["VarsInput"] | undefined | null
};
	["UpdateAccountInput"]: {
		/** Данные индивидуального предпринимателя */
	entrepreneur_data?: GraphQLTypes["UpdateEntrepreneurDataInput"] | undefined | null,
	/** Данные физического лица */
	individual_data?: GraphQLTypes["UpdateIndividualDataInput"] | undefined | null,
	/** Данные организации */
	organization_data?: GraphQLTypes["UpdateOrganizationDataInput"] | undefined | null,
	/** Публичный ключ */
	public_key?: string | undefined | null,
	/** Имя аккаунта реферера */
	referer?: string | undefined | null,
	/** Имя пользователя */
	username: string
};
	["UpdateBankAccountInput"]: {
		/** Данные банковского счёта */
	data: GraphQLTypes["BankAccountInput"],
	/** Флаг основного метода платежа, который отображается в документах */
	is_default: boolean,
	/** Идентификатор платежного метода */
	method_id: string,
	/** Имя аккаунта пользователя */
	username: string
};
	["UpdateEntrepreneurDataInput"]: {
		/** Дата рождения */
	birthdate: string,
	/** Город */
	city: string,
	/** Страна */
	country: GraphQLTypes["Country"],
	/** Детали индивидуального предпринимателя */
	details: GraphQLTypes["EntrepreneurDetailsInput"],
	/** Электронная почта */
	email: string,
	/** Имя */
	first_name: string,
	/** Полный адрес */
	full_address: string,
	/** Фамилия */
	last_name: string,
	/** Отчество */
	middle_name: string,
	/** Телефон */
	phone: string,
	/** Имя пользователя */
	username: string
};
	["UpdateIndividualDataInput"]: {
		/** Дата рождения */
	birthdate: string,
	/** Электронная почта */
	email: string,
	/** Имя */
	first_name: string,
	/** Полный адрес */
	full_address: string,
	/** Фамилия */
	last_name: string,
	/** Отчество */
	middle_name: string,
	/** Данные паспорта */
	passport?: GraphQLTypes["PassportInput"] | undefined | null,
	/** Телефон */
	phone: string,
	/** Имя пользователя */
	username: string
};
	["UpdateOrganizationDataInput"]: {
		/** Город */
	city: string,
	/** Страна */
	country: string,
	/** Детали организации */
	details: GraphQLTypes["OrganizationDetailsInput"],
	/** Электронная почта */
	email: string,
	/** Фактический адрес */
	fact_address: string,
	/** Полный адрес */
	full_address: string,
	/** Полное наименование организации */
	full_name: string,
	/** Телефон */
	phone: string,
	/** Представитель организации */
	represented_by: GraphQLTypes["RepresentedByInput"],
	/** Краткое наименование организации */
	short_name: string,
	/** Тип организации */
	type: string,
	/** Имя пользователя */
	username: string
};
	["UpdateRequestInput"]: {
		/** Имя аккаунта кооператива */
	coopname: string,
	/** Дополнительные данные */
	data: string,
	/** Идентификатор обмена */
	exchange_id: number,
	/** Дополнительная информация */
	meta: string,
	/** Оставшееся количество единиц */
	remain_units: string,
	/** Стоимость за единицу в формате "10.0000 RUB" */
	unit_cost: string,
	/** Имя аккаунта пользователя */
	username: string
};
	["UserAccount"]: {
	__typename: "UserAccount",
	/** Метаинформация */
	meta: string,
	/** Реферал */
	referer: string,
	/** Дата регистрации */
	registered_at: string,
	/** Регистратор */
	registrator: string,
	/** Статус аккаунта */
	status: string,
	/** Список хранилищ */
	storages: Array<string>,
	/** Тип учетной записи */
	type: string,
	/** Имя аккаунта */
	username: string,
	/** Дата регистрации */
	verifications: Array<GraphQLTypes["Verification"]>
};
	/** Объединение сертификатов пользователей (сокращенная информация) */
["UserCertificateUnion"]:{
        	__typename:"EntrepreneurCertificate" | "IndividualCertificate" | "OrganizationCertificate"
        	['...on EntrepreneurCertificate']: '__union' & GraphQLTypes["EntrepreneurCertificate"];
	['...on IndividualCertificate']: '__union' & GraphQLTypes["IndividualCertificate"];
	['...on OrganizationCertificate']: '__union' & GraphQLTypes["OrganizationCertificate"];
};
	/** Статус пользователя */
["UserStatus"]: UserStatus;
	["Vars"]: {
	__typename: "Vars",
	confidential_email: string,
	confidential_link: string,
	contact_email: string,
	coopenomics_agreement?: GraphQLTypes["AgreementVar"] | undefined | null,
	coopname: string,
	full_abbr: string,
	full_abbr_dative: string,
	full_abbr_genitive: string,
	name: string,
	participant_application: GraphQLTypes["AgreementVar"],
	passport_request: string,
	privacy_agreement: GraphQLTypes["AgreementVar"],
	short_abbr: string,
	signature_agreement: GraphQLTypes["AgreementVar"],
	user_agreement: GraphQLTypes["AgreementVar"],
	wallet_agreement: GraphQLTypes["AgreementVar"],
	website: string
};
	["VarsInput"]: {
		confidential_email: string,
	confidential_link: string,
	contact_email: string,
	coopenomics_agreement?: GraphQLTypes["AgreementInput"] | undefined | null,
	coopname: string,
	full_abbr: string,
	full_abbr_dative: string,
	full_abbr_genitive: string,
	name: string,
	participant_application: GraphQLTypes["AgreementInput"],
	passport_request: string,
	privacy_agreement: GraphQLTypes["AgreementInput"],
	short_abbr: string,
	signature_agreement: GraphQLTypes["AgreementInput"],
	user_agreement: GraphQLTypes["AgreementInput"],
	wallet_agreement: GraphQLTypes["AgreementInput"],
	website: string
};
	["Verification"]: {
	__typename: "Verification",
	/** Дата создания верификации */
	created_at: string,
	/** Флаг верификации */
	is_verified: boolean,
	/** Дата последнего обновления верификации */
	last_update: string,
	/** Заметка верификации */
	notice: string,
	/** Процедура верификации */
	procedure: string,
	/** Имя верификатора */
	verificator: string
};
	/** Пункт голосования для ежегодного общего собрания */
["VoteItemInput"]: {
		/** Идентификатор вопроса повестки */
	question_id: number,
	/** Решение по вопросу (вариант голосования) */
	vote: string
};
	/** Входные данные для голосования на ежегодном общем собрании */
["VoteOnAnnualGeneralMeetInput"]: {
		/** Подписанный бюллетень голосования */
	ballot: GraphQLTypes["AnnualGeneralMeetingVotingBallotSignedDocumentInput"],
	/** Имя аккаунта кооператива */
	coopname: string,
	/** Хеш собрания, по которому производится голосование */
	hash: string,
	/** Идентификатор члена кооператива, который голосует */
	username: string,
	/** Бюллетень с решениями по вопросам повестки */
	votes: Array<GraphQLTypes["VoteItemInput"]>
};
	["WaitWeight"]: {
	__typename: "WaitWeight",
	/** Время ожидания в секундах */
	wait_sec: number,
	/** Вес */
	weight: number
}
    }
/** Тип аккаунта пользователя в системе */
export enum AccountType {
	entrepreneur = "entrepreneur",
	individual = "individual",
	organization = "organization"
}
/** Страна регистрации пользователя */
export enum Country {
	Russia = "Russia"
}
/** Расширенный статус собрания на основе дат и состояния */
export enum ExtendedMeetStatus {
	AUTHORIZED = "AUTHORIZED",
	CLOSED = "CLOSED",
	CREATED = "CREATED",
	EXPIRED_NO_QUORUM = "EXPIRED_NO_QUORUM",
	NONE = "NONE",
	ONRESTART = "ONRESTART",
	PRECLOSED = "PRECLOSED",
	VOTING_COMPLETED = "VOTING_COMPLETED",
	VOTING_IN_PROGRESS = "VOTING_IN_PROGRESS",
	WAITING_FOR_OPENING = "WAITING_FOR_OPENING"
}
/** Тип юридического лица */
export enum OrganizationType {
	AO = "AO",
	COOP = "COOP",
	OAO = "OAO",
	OOO = "OOO",
	PAO = "PAO",
	PRODCOOP = "PRODCOOP",
	ZAO = "ZAO"
}
/** Направление платежа */
export enum PaymentDirection {
	INCOMING = "INCOMING",
	OUTGOING = "OUTGOING"
}
/** Статус платежа */
export enum PaymentStatus {
	CANCELLED = "CANCELLED",
	COMPLETED = "COMPLETED",
	EXPIRED = "EXPIRED",
	FAILED = "FAILED",
	PAID = "PAID",
	PENDING = "PENDING",
	PROCESSING = "PROCESSING",
	REFUNDED = "REFUNDED"
}
/** Тип платежа по назначению */
export enum PaymentType {
	DEPOSIT = "DEPOSIT",
	REGISTRATION = "REGISTRATION",
	WITHDRAWAL = "WITHDRAWAL"
}
/** Состояние контроллера кооператива */
export enum SystemStatus {
	active = "active",
	install = "install",
	maintenance = "maintenance"
}
/** Статус пользователя */
export enum UserStatus {
	Active = "Active",
	Blocked = "Blocked",
	Created = "Created",
	Failed = "Failed",
	Joined = "Joined",
	Payed = "Payed",
	Refunded = "Refunded",
	Registered = "Registered"
}

type ZEUS_VARIABLES = {
	["AcceptChildOrderInput"]: ValueTypes["AcceptChildOrderInput"];
	["AccountType"]: ValueTypes["AccountType"];
	["AddParticipantInput"]: ValueTypes["AddParticipantInput"];
	["AddTrustedAccountInput"]: ValueTypes["AddTrustedAccountInput"];
	["AgendaGeneralMeetPointInput"]: ValueTypes["AgendaGeneralMeetPointInput"];
	["AgendaGeneralMeetQuestion"]: ValueTypes["AgendaGeneralMeetQuestion"];
	["AgendaMeet"]: ValueTypes["AgendaMeet"];
	["AgreementInput"]: ValueTypes["AgreementInput"];
	["AnnualGeneralMeetingAgendaGenerateDocumentInput"]: ValueTypes["AnnualGeneralMeetingAgendaGenerateDocumentInput"];
	["AnnualGeneralMeetingAgendaSignedDocumentInput"]: ValueTypes["AnnualGeneralMeetingAgendaSignedDocumentInput"];
	["AnnualGeneralMeetingAgendaSignedMetaDocumentInput"]: ValueTypes["AnnualGeneralMeetingAgendaSignedMetaDocumentInput"];
	["AnnualGeneralMeetingDecisionGenerateDocumentInput"]: ValueTypes["AnnualGeneralMeetingDecisionGenerateDocumentInput"];
	["AnnualGeneralMeetingDecisionSignedDocumentInput"]: ValueTypes["AnnualGeneralMeetingDecisionSignedDocumentInput"];
	["AnnualGeneralMeetingDecisionSignedMetaDocumentInput"]: ValueTypes["AnnualGeneralMeetingDecisionSignedMetaDocumentInput"];
	["AnnualGeneralMeetingNotificationGenerateDocumentInput"]: ValueTypes["AnnualGeneralMeetingNotificationGenerateDocumentInput"];
	["AnnualGeneralMeetingNotificationSignedDocumentInput"]: ValueTypes["AnnualGeneralMeetingNotificationSignedDocumentInput"];
	["AnnualGeneralMeetingNotificationSignedMetaDocumentInput"]: ValueTypes["AnnualGeneralMeetingNotificationSignedMetaDocumentInput"];
	["AnnualGeneralMeetingSovietDecisionGenerateDocumentInput"]: ValueTypes["AnnualGeneralMeetingSovietDecisionGenerateDocumentInput"];
	["AnnualGeneralMeetingVotingBallotGenerateDocumentInput"]: ValueTypes["AnnualGeneralMeetingVotingBallotGenerateDocumentInput"];
	["AnnualGeneralMeetingVotingBallotSignedDocumentInput"]: ValueTypes["AnnualGeneralMeetingVotingBallotSignedDocumentInput"];
	["AnnualGeneralMeetingVotingBallotSignedMetaDocumentInput"]: ValueTypes["AnnualGeneralMeetingVotingBallotSignedMetaDocumentInput"];
	["AnswerInput"]: ValueTypes["AnswerInput"];
	["AssetContributionActGenerateDocumentInput"]: ValueTypes["AssetContributionActGenerateDocumentInput"];
	["AssetContributionActSignedDocumentInput"]: ValueTypes["AssetContributionActSignedDocumentInput"];
	["AssetContributionActSignedMetaDocumentInput"]: ValueTypes["AssetContributionActSignedMetaDocumentInput"];
	["AssetContributionDecisionGenerateDocumentInput"]: ValueTypes["AssetContributionDecisionGenerateDocumentInput"];
	["AssetContributionStatementGenerateDocumentInput"]: ValueTypes["AssetContributionStatementGenerateDocumentInput"];
	["AssetContributionStatementSignedDocumentInput"]: ValueTypes["AssetContributionStatementSignedDocumentInput"];
	["AssetContributionStatementSignedMetaDocumentInput"]: ValueTypes["AssetContributionStatementSignedMetaDocumentInput"];
	["BankAccountDetailsInput"]: ValueTypes["BankAccountDetailsInput"];
	["BankAccountInput"]: ValueTypes["BankAccountInput"];
	["CancelRequestInput"]: ValueTypes["CancelRequestInput"];
	["CommonRequestInput"]: ValueTypes["CommonRequestInput"];
	["CompleteRequestInput"]: ValueTypes["CompleteRequestInput"];
	["ConfirmReceiveOnRequestInput"]: ValueTypes["ConfirmReceiveOnRequestInput"];
	["ConfirmSupplyOnRequestInput"]: ValueTypes["ConfirmSupplyOnRequestInput"];
	["Country"]: ValueTypes["Country"];
	["CreateAnnualGeneralMeetInput"]: ValueTypes["CreateAnnualGeneralMeetInput"];
	["CreateBankAccountInput"]: ValueTypes["CreateBankAccountInput"];
	["CreateBranchInput"]: ValueTypes["CreateBranchInput"];
	["CreateChildOrderInput"]: ValueTypes["CreateChildOrderInput"];
	["CreateDepositPaymentInput"]: ValueTypes["CreateDepositPaymentInput"];
	["CreateEntrepreneurDataInput"]: ValueTypes["CreateEntrepreneurDataInput"];
	["CreateIndividualDataInput"]: ValueTypes["CreateIndividualDataInput"];
	["CreateInitialPaymentInput"]: ValueTypes["CreateInitialPaymentInput"];
	["CreateOrganizationDataInput"]: ValueTypes["CreateOrganizationDataInput"];
	["CreateParentOfferInput"]: ValueTypes["CreateParentOfferInput"];
	["CreateProjectFreeDecisionInput"]: ValueTypes["CreateProjectFreeDecisionInput"];
	["CreateWithdrawInput"]: ValueTypes["CreateWithdrawInput"];
	["DateTime"]: ValueTypes["DateTime"];
	["DeclineRequestInput"]: ValueTypes["DeclineRequestInput"];
	["DeleteBranchInput"]: ValueTypes["DeleteBranchInput"];
	["DeletePaymentMethodInput"]: ValueTypes["DeletePaymentMethodInput"];
	["DeleteTrustedAccountInput"]: ValueTypes["DeleteTrustedAccountInput"];
	["DeliverOnRequestInput"]: ValueTypes["DeliverOnRequestInput"];
	["DisputeOnRequestInput"]: ValueTypes["DisputeOnRequestInput"];
	["EditBranchInput"]: ValueTypes["EditBranchInput"];
	["EntrepreneurDetailsInput"]: ValueTypes["EntrepreneurDetailsInput"];
	["ExtendedMeetStatus"]: ValueTypes["ExtendedMeetStatus"];
	["ExtensionInput"]: ValueTypes["ExtensionInput"];
	["FreeDecisionGenerateDocumentInput"]: ValueTypes["FreeDecisionGenerateDocumentInput"];
	["GenerateDocumentInput"]: ValueTypes["GenerateDocumentInput"];
	["GenerateDocumentOptionsInput"]: ValueTypes["GenerateDocumentOptionsInput"];
	["GetAccountInput"]: ValueTypes["GetAccountInput"];
	["GetAccountsInput"]: ValueTypes["GetAccountsInput"];
	["GetBranchesInput"]: ValueTypes["GetBranchesInput"];
	["GetDocumentsInput"]: ValueTypes["GetDocumentsInput"];
	["GetExtensionsInput"]: ValueTypes["GetExtensionsInput"];
	["GetMeetInput"]: ValueTypes["GetMeetInput"];
	["GetMeetsInput"]: ValueTypes["GetMeetsInput"];
	["GetPaymentMethodsInput"]: ValueTypes["GetPaymentMethodsInput"];
	["Init"]: ValueTypes["Init"];
	["Install"]: ValueTypes["Install"];
	["JSON"]: ValueTypes["JSON"];
	["JSONObject"]: ValueTypes["JSONObject"];
	["LoginInput"]: ValueTypes["LoginInput"];
	["LogoutInput"]: ValueTypes["LogoutInput"];
	["MetaDocumentInput"]: ValueTypes["MetaDocumentInput"];
	["ModerateRequestInput"]: ValueTypes["ModerateRequestInput"];
	["NotifyOnAnnualGeneralMeetInput"]: ValueTypes["NotifyOnAnnualGeneralMeetInput"];
	["OrganizationDetailsInput"]: ValueTypes["OrganizationDetailsInput"];
	["OrganizationType"]: ValueTypes["OrganizationType"];
	["PaginationInput"]: ValueTypes["PaginationInput"];
	["ParticipantApplicationDecisionGenerateDocumentInput"]: ValueTypes["ParticipantApplicationDecisionGenerateDocumentInput"];
	["ParticipantApplicationGenerateDocumentInput"]: ValueTypes["ParticipantApplicationGenerateDocumentInput"];
	["ParticipantApplicationSignedDocumentInput"]: ValueTypes["ParticipantApplicationSignedDocumentInput"];
	["ParticipantApplicationSignedMetaDocumentInput"]: ValueTypes["ParticipantApplicationSignedMetaDocumentInput"];
	["PassportInput"]: ValueTypes["PassportInput"];
	["PaymentDirection"]: ValueTypes["PaymentDirection"];
	["PaymentFiltersInput"]: ValueTypes["PaymentFiltersInput"];
	["PaymentStatus"]: ValueTypes["PaymentStatus"];
	["PaymentType"]: ValueTypes["PaymentType"];
	["ProhibitRequestInput"]: ValueTypes["ProhibitRequestInput"];
	["ProjectFreeDecisionGenerateDocumentInput"]: ValueTypes["ProjectFreeDecisionGenerateDocumentInput"];
	["ProjectFreeDecisionSignedDocumentInput"]: ValueTypes["ProjectFreeDecisionSignedDocumentInput"];
	["ProjectFreeDecisionSignedMetaDocumentInput"]: ValueTypes["ProjectFreeDecisionSignedMetaDocumentInput"];
	["PublishProjectFreeDecisionInput"]: ValueTypes["PublishProjectFreeDecisionInput"];
	["PublishRequestInput"]: ValueTypes["PublishRequestInput"];
	["ReceiveOnRequestInput"]: ValueTypes["ReceiveOnRequestInput"];
	["RefreshInput"]: ValueTypes["RefreshInput"];
	["RegisterAccountInput"]: ValueTypes["RegisterAccountInput"];
	["RegisterParticipantInput"]: ValueTypes["RegisterParticipantInput"];
	["RepresentedByInput"]: ValueTypes["RepresentedByInput"];
	["ResetKeyInput"]: ValueTypes["ResetKeyInput"];
	["RestartAnnualGeneralMeetInput"]: ValueTypes["RestartAnnualGeneralMeetInput"];
	["ReturnByAssetActGenerateDocumentInput"]: ValueTypes["ReturnByAssetActGenerateDocumentInput"];
	["ReturnByAssetActSignedDocumentInput"]: ValueTypes["ReturnByAssetActSignedDocumentInput"];
	["ReturnByAssetActSignedMetaDocumentInput"]: ValueTypes["ReturnByAssetActSignedMetaDocumentInput"];
	["ReturnByAssetDecisionGenerateDocumentInput"]: ValueTypes["ReturnByAssetDecisionGenerateDocumentInput"];
	["ReturnByAssetStatementGenerateDocumentInput"]: ValueTypes["ReturnByAssetStatementGenerateDocumentInput"];
	["ReturnByAssetStatementSignedDocumentInput"]: ValueTypes["ReturnByAssetStatementSignedDocumentInput"];
	["ReturnByAssetStatementSignedMetaDocumentInput"]: ValueTypes["ReturnByAssetStatementSignedMetaDocumentInput"];
	["ReturnByMoneyDecisionGenerateDocumentInput"]: ValueTypes["ReturnByMoneyDecisionGenerateDocumentInput"];
	["ReturnByMoneyGenerateDocumentInput"]: ValueTypes["ReturnByMoneyGenerateDocumentInput"];
	["ReturnByMoneySignedDocumentInput"]: ValueTypes["ReturnByMoneySignedDocumentInput"];
	["ReturnByMoneySignedMetaDocumentInput"]: ValueTypes["ReturnByMoneySignedMetaDocumentInput"];
	["SearchPrivateAccountsInput"]: ValueTypes["SearchPrivateAccountsInput"];
	["SelectBranchGenerateDocumentInput"]: ValueTypes["SelectBranchGenerateDocumentInput"];
	["SelectBranchInput"]: ValueTypes["SelectBranchInput"];
	["SelectBranchSignedDocumentInput"]: ValueTypes["SelectBranchSignedDocumentInput"];
	["SelectBranchSignedMetaDocumentInput"]: ValueTypes["SelectBranchSignedMetaDocumentInput"];
	["SetPaymentStatusInput"]: ValueTypes["SetPaymentStatusInput"];
	["SetWifInput"]: ValueTypes["SetWifInput"];
	["SignByPresiderOnAnnualGeneralMeetInput"]: ValueTypes["SignByPresiderOnAnnualGeneralMeetInput"];
	["SignBySecretaryOnAnnualGeneralMeetInput"]: ValueTypes["SignBySecretaryOnAnnualGeneralMeetInput"];
	["SignatureInfoInput"]: ValueTypes["SignatureInfoInput"];
	["SignedDigitalDocumentInput"]: ValueTypes["SignedDigitalDocumentInput"];
	["SovietMemberInput"]: ValueTypes["SovietMemberInput"];
	["StartResetKeyInput"]: ValueTypes["StartResetKeyInput"];
	["SupplyOnRequestInput"]: ValueTypes["SupplyOnRequestInput"];
	["SystemStatus"]: ValueTypes["SystemStatus"];
	["UninstallExtensionInput"]: ValueTypes["UninstallExtensionInput"];
	["UnpublishRequestInput"]: ValueTypes["UnpublishRequestInput"];
	["Update"]: ValueTypes["Update"];
	["UpdateAccountInput"]: ValueTypes["UpdateAccountInput"];
	["UpdateBankAccountInput"]: ValueTypes["UpdateBankAccountInput"];
	["UpdateEntrepreneurDataInput"]: ValueTypes["UpdateEntrepreneurDataInput"];
	["UpdateIndividualDataInput"]: ValueTypes["UpdateIndividualDataInput"];
	["UpdateOrganizationDataInput"]: ValueTypes["UpdateOrganizationDataInput"];
	["UpdateRequestInput"]: ValueTypes["UpdateRequestInput"];
	["UserStatus"]: ValueTypes["UserStatus"];
	["VarsInput"]: ValueTypes["VarsInput"];
	["VoteItemInput"]: ValueTypes["VoteItemInput"];
	["VoteOnAnnualGeneralMeetInput"]: ValueTypes["VoteOnAnnualGeneralMeetInput"];
}