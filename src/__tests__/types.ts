// Inspired by @type-challenges/utils
// https://github.com/type-challenges/type-challenges/blob/main/utils/index.d.ts

export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

export type Expect<T extends true> = T;
