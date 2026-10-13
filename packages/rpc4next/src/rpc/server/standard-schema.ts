/** Minimal Standard Schema V1 interface accepted by rpc4next input and output contracts. */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaV1Props<Input, Output>;
}

/** Runtime Standard Schema V1 metadata and validation function. */
export interface StandardSchemaV1Props<Input = unknown, Output = Input> {
  readonly version: 1;
  readonly vendor: string;
  readonly validate: (
    value: unknown,
    options?: StandardSchemaV1Options,
  ) => StandardSchemaV1Result<Output> | Promise<StandardSchemaV1Result<Output>>;
  readonly types?: StandardSchemaV1Types<Input, Output>;
}

/** Optional type carrier used by schema libraries for input and output inference. */
export interface StandardSchemaV1Types<Input = unknown, Output = Input> {
  readonly input: Input;
  readonly output: Output;
}

/** Optional validation options forwarded to schema implementations. */
export interface StandardSchemaV1Options {
  readonly libraryOptions?: Record<string, unknown>;
}

/** Result returned by a Standard Schema V1 validation function. */
export type StandardSchemaV1Result<Output> =
  | StandardSchemaV1SuccessResult<Output>
  | StandardSchemaV1FailureResult;

/** Successful Standard Schema V1 validation result. */
export interface StandardSchemaV1SuccessResult<Output> {
  readonly value: Output;
  readonly issues?: undefined;
}

/** Failed Standard Schema V1 validation result. */
export interface StandardSchemaV1FailureResult {
  readonly issues: readonly StandardSchemaV1Issue[];
}

/** Validation issue shape consumed by rpc4next error handlers. */
export interface StandardSchemaV1Issue {
  readonly message: string;
  readonly path?: ReadonlyArray<PropertyKey | { key: PropertyKey }>;
}

/** Runtime guard for values that implement the Standard Schema V1 contract. */
export const isStandardSchemaV1 = (value: unknown): value is StandardSchemaV1 => {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "~standard" in value &&
    typeof value["~standard"] === "object" &&
    value["~standard"] !== null &&
    "validate" in value["~standard"] &&
    typeof value["~standard"].validate === "function"
  );
};
