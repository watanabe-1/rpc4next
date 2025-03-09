import { createQueryParamsProxy } from "@/lib/proxies/createQueryParamsProxy";

describe("createQueryParamsProxy", () => {
  it("should dynamically access query parameters as properties", () => {
    const searchParams = new URLSearchParams("param1=value1&param2=value2");
    const proxy = createQueryParamsProxy<{ param1: string; param2: string }>(
      searchParams,
    );

    expect(proxy.param1).toBe("value1");
    expect(proxy.param2).toBe("value2");
  });

  it("should return undefined for non-existent query parameters", () => {
    const searchParams = new URLSearchParams("param1=value1");
    const proxy = createQueryParamsProxy<{ param1: string; param2: string }>(
      searchParams,
    );

    expect(proxy.param2).toBeUndefined();
  });
});
