type JsonPrimitive = string | number | boolean | null;
type OmittedJsonValue = undefined | symbol | ((...args: never[]) => unknown);
type JsonReplacement<T> = T extends { toJSON: (...args: never[]) => infer TResult }
  ? T extends Date
    ? string extends TResult
      ? TResult | null
      : TResult
    : TResult
  : T extends { toJSON?: infer TMethod }
    ? T | (TMethod extends (...args: never[]) => infer TResult ? TResult : never)
    : T;
type JsonArrayElement<T> =
  | JsonParsedValue<Exclude<JsonReplacement<T>, OmittedJsonValue>>
  | (Extract<JsonReplacement<T>, OmittedJsonValue> extends never ? never : null);
type JsonTuple<T extends readonly unknown[]> = {
  [K in keyof T]: JsonArrayElement<T[K]> | (number extends T["length"] ? null : never);
};
type JsonArray<T extends readonly unknown[]> = T extends unknown[]
  ? (JsonArrayElement<T[number]> | null)[]
  : JsonTuple<T>;
type JsonObjectKeys<T> =
  T extends ReadonlyMap<unknown, unknown>
    ? Exclude<keyof T, keyof Map<unknown, unknown>>
    : T extends ReadonlySet<unknown>
      ? Exclude<keyof T, keyof Set<unknown>>
      : T extends WeakMap<WeakKey, unknown>
        ? Exclude<keyof T, keyof WeakMap<WeakKey, unknown>>
        : T extends WeakSet<WeakKey>
          ? Exclude<keyof T, keyof WeakSet<WeakKey>>
          : T extends RegExp
            ? Exclude<keyof T, keyof RegExp>
            : keyof T;
type JsonPropertyMayBeOmitted<T, K extends keyof T> = unknown extends T[K]
  ? true
  : "stack" extends keyof T
    ? T extends Error
      ? K extends keyof Error | "cause"
        ? true
        : Extract<JsonReplacement<T[K]>, OmittedJsonValue> extends never
          ? false
          : true
      : Extract<JsonReplacement<T[K]>, OmittedJsonValue> extends never
        ? false
        : true
    : Extract<JsonReplacement<T[K]>, OmittedJsonValue> extends never
      ? false
      : true;
type JsonObject<T extends object> = {
  [
    K in JsonObjectKeys<T> as K extends symbol
      ? never
      : Exclude<JsonReplacement<T[K]>, OmittedJsonValue> extends never
        ? never
        : JsonPropertyMayBeOmitted<T, K> extends true
          ? never
          : K
  ]: JsonParsed<T[K]>;
} & {
  [
    K in JsonObjectKeys<T> as K extends symbol
      ? never
      : Exclude<JsonReplacement<T[K]>, OmittedJsonValue> extends never
        ? never
        : JsonPropertyMayBeOmitted<T, K> extends true
          ? K
          : never
  ]?: JsonParsedValue<Exclude<JsonReplacement<T[K]>, OmittedJsonValue>>;
};

/** The value produced by parsing a successfully serialized JSON payload. */
export type JsonParsed<T> = unknown extends T ? T : JsonParsedValue<JsonReplacement<T>>;

type JsonParsedValue<T> = unknown extends T
  ? T
  : T extends number
    ? number extends T
      ? number | null
      : T
    : T extends JsonPrimitive
      ? T
      : T extends OmittedJsonValue | bigint
        ? never
        : T extends readonly unknown[]
          ? JsonArray<T>
          : T extends InstanceType<NumberConstructor>
            ? number | null | { [K in keyof JsonObject<T>]: JsonObject<T>[K] }
            : T extends InstanceType<StringConstructor>
              ? string | { [K in keyof JsonObject<T>]: JsonObject<T>[K] }
              : T extends InstanceType<BooleanConstructor>
                ? boolean | { [K in keyof JsonObject<T>]: JsonObject<T>[K] }
                : T extends object
                  ? { [K in keyof JsonObject<T>]: JsonObject<T>[K] }
                  : never;
