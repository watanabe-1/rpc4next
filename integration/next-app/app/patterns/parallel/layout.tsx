import type { ReactNode } from "react";

type ParallelPatternLayoutProps = {
  analytics: ReactNode;
  children: ReactNode;
  team: ReactNode;
};

export default function ParallelPatternLayout({
  analytics,
  children,
  team,
}: ParallelPatternLayoutProps) {
  return (
    <section>
      <div>{children}</div>
      <div>{analytics}</div>
      <div>{team}</div>
    </section>
  );
}
