type CancellableDebounced<T extends (...args: any[]) => Promise<void> | void> = ((
  ...args: Parameters<T>
) => void) & {
  cancel: () => void;
};

export const debounceOnceRunningWithTrailing = <T extends (...args: any[]) => Promise<void> | void>(
  func: T,
  delay: number,
): CancellableDebounced<T> => {
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

  const debounced = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);

    timer = setTimeout(() => {
      // Drop the fired timer so its closed-over args can be released.
      timer = null;

      if (isRunning) {
        pendingArgs = args;

        return;
      }

      execute(...args);
    }, delay);
  };

  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    pendingArgs = null;
  };

  return debounced;
};
