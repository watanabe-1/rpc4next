import { expect, test } from "@playwright/test";

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
  const response = await request.get(
    "/api/users/e2e-user?includePosts=true",
  );

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
