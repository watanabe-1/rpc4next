export const debounceOnceRunningWithTrailing = <
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends (...args: any[]) => Promise<void> | void,
>(
  func: T,
  delay: number
) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let isRunning = false;
  let pendingArgs: Parameters<T> | null = null;

  const execute = async (...args: Parameters<T>) => {
    isRunning = true;
    try {
      await func(...args);
    } finally {
      isRunning = false;

      if (pendingArgs) {
        const nextArgs = pendingArgs;
        pendingArgs = null;
        execute(...nextArgs);
      }
    }
  };

  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);

    timer = setTimeout(() => {
      if (isRunning) {
        pendingArgs = args ?? [];

        return;
      }

      execute(...(args ?? []));
    }, delay);
  };
};
