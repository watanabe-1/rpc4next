import { expect, test } from "@playwright/test";

test.describe("integration next-app rpc4next browser client e2e", () => {
  test("generated client performs live GET and POST requests in the browser", async ({
    page,
  }) => {
    await page.goto("/e2e-client");

    await expect(
      page.getByRole("heading", { name: "rpc4next browser client e2e" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "call users" }).click();
    await expect(page.getByTestId("users-result")).toHaveText(
      JSON.stringify({
        ok: true,
        status: 200,
        body: {
          ok: true,
          userId: "browser-user",
          includePosts: true,
        },
      }),
    );

    await page.getByRole("button", { name: "call posts" }).click();
    await expect(page.getByTestId("posts-result")).toHaveText(
      JSON.stringify({
        ok: true,
        status: 201,
        body: {
          ok: true,
          title: "browser-title",
        },
      }),
    );
  });

  test("generated client sends browser headers and surfaces validation errors", async ({
    page,
  }) => {
    await page.goto("/e2e-client");

    await page.getByRole("button", { name: "call request-meta" }).click();
    await expect(page.getByTestId("request-meta-result")).toHaveText(
      JSON.stringify({
        ok: true,
        status: 200,
        body: {
          header: "browser-header",
          session: "browser-session",
        },
      }),
    );

    await page.getByRole("button", { name: "call invalid users" }).click();
    await expect(page.getByTestId("invalid-users-result")).toContainText(
      '"status":400',
    );
    await expect(page.getByTestId("invalid-users-result")).toContainText(
      '"name":"ZodError"',
    );
    await expect(page.getByTestId("invalid-users-result")).toContainText(
      "includePosts",
    );
  });
});
