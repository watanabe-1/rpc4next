# rpc4next

Lightweight, type-safe RPC system for Next.js App Router projects.

Inspired by Hono RPC and Pathpida, **rpc4next** automatically generates a type-safe client for your existing `route.ts` **and** `page.tsx` files, enabling seamless server-client communication with full type inference.

---

## ✨ Features

- ✅ ルート、パラメータ、クエリパラメータ、 リクエストボディ、レスポンスの型安全なクライアント生成
- ✅ 既存の `app/**/route.ts` および `app/**/page.tsx` を活用するため、新たなハンドラファイルの作成は不要
- ✅ 最小限のセットアップで、カスタムサーバー不要
- ✅ 動的ルート（`[id]`、`[...slug]` など）に対応
- ✅ CLI による自動クライアント用型定義生成

---

## 🚀 Getting Started

### 1. Install rpc4next

```bash
npm install rpc4next
```

### 2. Define API Routes in Next.js

Next.js プロジェクト内の既存の `app/**/route.ts` と `app/**/page.tsx` ファイルをそのまま利用できます。
さらに、クエリパラメータ（searchParams）の型安全性を有効にするには、対象のファイル内で `Query` または `OptionalQuery` 型を定義し、`export` してください。

```ts
// app/api/user/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";

// searchParams用の型定義
export type Query = {
  q: string; // 必須
  page?: number; // 任意
};

export async function GET(
  req: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { id } = await segmentData.params;
  const q = req.nextUrl.searchParams.get("q");
  return NextResponse.json({ id, q });
}
```

🚩 Query or OptionalQuery 型を export することで、searchParams の型も自動的にクライアントに反映されます。

- **RPCとしてresponseの戻り値の推論が機能するのは、対象となる `route.ts` の HTTPメソッドハンドラ内で`NextResponse.json()` をしている関数のみになります**

---

### 3. Generate Type Definitions with CLI

CLI を利用して、Next.js のルート構造から型安全な RPC クライアントの定義を自動生成します。

```bash
npx rpc4next <baseDir> <outputPath>
```

- `<baseDir>`: Next.js の Appルータが配置されたベースディレクトリ
- `<outputPath>`: 生成された型定義ファイルの出力先

#### オプション

- **ウォッチモード**  
  ファイル変更を検知して自動的に再生成する場合は `--watch` or `-w` オプションを付けます。

  ```bash
  npx rpc4next <baseDir> <outputPath> --watch
  ```

- **パラメータ型ファイルの生成**  
  各ルートに対して個別のパラメータ型定義ファイルを生成する場合は、`--params-file` or `-p` オプションにファイル名を指定します。

  ```bash
  npx rpc4next <baseDir> <outputPath> --generate-params-types <paramsFileName>
  ```

---

### 4. Create Your RPC Client

生成された型定義ファイルを基に、RPC クライアントを作成します。

```ts
// lib/rpcClient.ts
import { createClient } from "rpc4next/client";
import type { PathStructure } from "あなたが生成した型定義ファイル";

export const rpc = createClient<PathStructure>();
```

---

### 5. Use It in Your Components

コンポーネント内で生成された RPC クライアントを使用します。

```tsx
// app/page.tsx
import { rpc } from "@/lib/rpcClient";

export default async function Page() {
  const res = await rpc.api.user._id("123").$get({
    query: { q: "hello", page: 1 },
  });
  const json = await res.json();
  return <div>{json.q}</div>;
}
```

- エディタの補完機能により、利用可能なエンドポイントが自動的に表示されます。
- リクエストの構造（params, query）はサーバーコードから推論され、レスポンスも型安全に扱えます。

---

## ✅ さらに型安全にしたい場合 `createRouteHandler` による Next.js の型安全強化

### 📌 主なメリット

1. **レスポンス型安全**

   - ステータス、Content-Type、Body がすべて型で保証される
   - クライアントは受け取るレスポンス型を完全に推論可能

2. **クライアント側補完強化**

   - `status`, `content-type`, `json()`, `text()` などが適切に補完される

3. **サーバー側 params / query も型安全**
   - `createRouteHandler()` + `zValidator()` を使えば、`params`, `query`, `headers`, `cookies`, `json` も型推論・バリデーション可能

---

### ✅ 基本的な使い方

```ts
const createRouteHandler = routeHandlerFactory((err, rc) =>
  rc.text("error", { status: 400 })
);

const { POST } = createRouteHandler().post(async (rc) => rc.text("plain text"));
```

これだけで、POSTリクエストの返り値に、レスポンスの内容 (`json`, `text`など)、`status`, `content-type` が型付けされるようになります。

---

### 👤 サーバー側でのより型安全なルート作成

`createRouteHandler()` と `zValidator()` を使うことで、各リクエストパーツに対して **型安全なバリデーション** をかけられます。

#### シンプルな例

```ts
import { createRouteHandler } from "@/path/to/createRouteHandler";
import { zValidator } from "@/path/to/zValidator";
import { z } from "zod";

// Zodスキーマを定義
const paramsSchema = z.object({
  userId: z.string(),
});

// バリデーション付きルートハンドラを作成
export const handler = createRouteHandler<{
  params: z.infer<typeof paramsSchema>;
}>().get(
  zValidator("params", paramsSchema), // paramsを検証
  async (rc) => {
    const params = rc.req.valid("params"); // バリデーション済みparamsを取得
    return rc.json({ message: `User ID is ${params.userId}` });
  }
);
```

---

### ✅ サポートされているバリデーションターゲット

次のリクエスト部分に対して、個別に型付け・バリデーションが可能です：

- `params`
- `query`
- `headers`
- `cookies`
- `json`

#### 例：複数ターゲットを検証する

```ts
const querySchema = z.object({
  page: z.string().regex(/^\d+$/),
});

const jsonSchema = z.object({
  name: z.string(),
  age: z.number(),
});

export const handler = createRouteHandler<{
  query: z.infer<typeof querySchema>;
}>().post(
  zValidator("query", querySchema),
  zValidator("json", jsonSchema),
  async (rc) => {
    const query = rc.req.valid("query");
    const body = rc.req.valid("json");
    return rc.json({ query, body });
  }
);
```

---

### ⚡ バリデーション失敗時のカスタムエラーハンドリング

- デフォルトでは、バリデーション失敗時に自動で `400 Bad Request` を返します。
- 必要に応じて、**カスタムフック**でエラー対応を制御できます。

```ts
zValidator("params", paramsSchema, (result, rc) => {
  if (!result.success) {
    return rc.json({ error: result.error.errors }, { status: 422 });
  }
});
```

> （フック内でレスポンスを返さない場合は、通常通り例外がスローされます）

---

## 🚧 Requirements

- Next.js 14+ (App Router 使用)
- Node.js 18+

---

## 💼 License

MIT
