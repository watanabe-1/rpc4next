"use client";

import { useState } from "react";

type ClientPageViewProps = {
  initialCount: number;
  label: string;
};

export const ClientPageView = ({ initialCount, label }: ClientPageViewProps) => {
  const [count, setCount] = useState(initialCount);

  return (
    <div>
      <div>client-page:{label}</div>
      <button type="button" onClick={() => setCount((current) => current + 1)}>
        count:{count}
      </button>
    </div>
  );
};
