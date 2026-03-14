import { expect, test } from "@playwright/test";

test.describe("integration next-app e2e", () => {
  test("home page renders generated rpc url", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "rpc4next integration app" }),
    ).toBeVisible();
    await expect(
      page.getByText("/api/users/demo-user?includePosts=true"),
    ).toBeVisible();
  });

  test("dynamic photo route renders segment params", async ({ page }) => {
    await page.goto("/photo/demo-photo");

    await expect(page.getByText("photo:demo-photo")).toBeVisible();
  });

  test("nested dynamic route renders both params", async ({ page }) => {
    await page.goto("/photo/demo-photo/comments/demo-comment");

    await expect(
      page.getByText("photo-comment:demo-photo/demo-comment"),
    ).toBeVisible();
  });

  test("dynamic API route returns validated query and params", async ({
    request,
  }) => {
    const response = await request.get("/api/users/e2e-user?includePosts=true");

    expect(response.ok()).toBe(true);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      userId: "e2e-user",
      includePosts: true,
    });
  });

  test("static API route accepts JSON POST bodies", async ({ request }) => {
    const response = await request.post("/api/posts", {
      data: { title: "hello from playwright" },
    });

    expect(response.status()).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      title: "hello from playwright",
    });
  });

  test("request metadata API route validates headers and cookies", async ({
    request,
  }) => {
    const response = await request.get("/api/request-meta", {
      headers: {
        "x-integration-test": "playwright",
        cookie: "session=e2e-session",
      },
    });

    expect(response.ok()).toBe(true);
    await expect(response.json()).resolves.toEqual({
      header: "playwright",
      session: "e2e-session",
    });
  });

  test("error API route uses the custom error handler", async ({ request }) => {
    const response = await request.get("/api/error-demo");

    expect(response.status()).toBe(500);
    await expect(response.text()).resolves.toBe(
      "handled:expected integration failure",
    );
  });

  test("redirect API route returns the redirect response", async ({
    request,
  }) => {
    const response = await request.get("/api/redirect-me", {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe("http://127.0.0.1:3000/feed");
  });

  test("pattern routes resolve dynamic and catch-all params", async ({
    page,
  }) => {
    await page.goto("/patterns/dynamic/books/ts-guide");

    await expect(page.getByText("nested-dynamic:books/ts-guide")).toBeVisible();

    await page.goto("/patterns/catch-all/alpha/beta");
    await expect(page.getByText("catch-all:alpha/beta")).toBeVisible();

    await page.goto("/patterns/optional-catch-all");
    await expect(page.getByText("optional-catch-all:root")).toBeVisible();

    await page.goto("/patterns/optional-catch-all/one/two");
    await expect(page.getByText("optional-catch-all:one/two")).toBeVisible();
  });

  test("pattern routes expose grouped and parallel branches on public urls", async ({
    page,
  }) => {
    await page.goto("/patterns/reports");
    await expect(page.getByText("grouped-pattern")).toBeVisible();

    await page.goto("/patterns/parallel");
    await expect(page.getByText("parallel-pattern-index")).toBeVisible();
    await expect(page.getByText("analytics-default")).toBeVisible();
    await expect(page.getByText("team-default")).toBeVisible();

    await page.goto("/patterns/_escaped");
    await expect(page.getByText("escaped-underscore-pattern")).toBeVisible();

    await page.goto("/patterns/%E3%81%ZZ");
    await expect(page.getByText("malformed-encoded-pattern")).toBeVisible();
  });

  test("parallel child routes are not exposed as direct public urls", async ({
    page,
  }) => {
    await page.goto("/patterns/parallel/views");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();

    await page.goto("/patterns/parallel/members");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  });
});
