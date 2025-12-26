let isTty = () => Boolean(process.stdout?.isTTY);

export const __testing = {
  setIsTty(fn: () => boolean) {
    isTty = fn;
  },
};

const color = (code: number) => (text: string) =>
  isTty() ? `\u001b[${code}m${text}\u001b[0m` : text;

export const cyan = color(36);
export const green = color(32);
export const red = color(31);
