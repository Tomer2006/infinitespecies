export function resolveNamePath<T>(
  path: string,
  root: T | null | undefined,
  nameOf: (node: T) => string,
  childrenOf: (node: T) => Iterable<T>,
): T | null;
