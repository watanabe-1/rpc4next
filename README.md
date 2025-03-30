# rpc4next

Lightweight, type-safe RPC system for Next.js App Router projects.

Inspired by Hono RPC and Pathpida, **rpc4next** automatically generates a type-safe client for your existing `route.ts` **and** `page.tsx` files, enabling seamless server-client communication with full type inference.

---

## ✨ Features

- ✅ 既存の `app/**/route.ts` および `app/**/page.tsx` を活用するため、新たなハンドラファイルの作成は不要
- ✅ ルート、パラメータ、リクエストボディ、レスポンスの型安全なクライアント生成
- ✅ 最小限のセットアップで、カスタムサーバー不要
- ✅ 動的ルート（`[id]`、`[...slug]` など）に対応
- ✅ CLI による自動クライアント用型定義生成

> **注意**  
> RPCとしてresponseの戻り値の推論が機能するのは、対象となる `route.ts` の HTTPメソッドハンドラ内で`NextResponse.json()` をしている物のみになります。

---

## 🚀 Getting Started

### 1. Install rpc4next

```bash
npm install rpc4next
```

### 2. Define API Routes in Next.js

Next.js プロジェクト内の既存の `app/**/route.ts` と `app/**/page.tsx` ファイルをそのまま利用できます。

```ts
// app/api/user/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { id } = await segmentData.params;
  return NextResponse.json({ name: `User ${id}` });
}
```

- **RPCとしてresponseの戻り値の推論が機能するのは、対象となる `route.ts` の HTTPメソッドハンドラ内で`NextResponse.json()` をしている物のみになります**

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

  ※ このオプションを指定する際は、必ずファイル名をセットしてください。ファイル名が指定されない場合、エラーが発生します。

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
  const res = await rpc.api.user._id("123").$get();
  const json = await res.json();
  return <div>{json.name}</div>;
}
```

- エディタの補完機能により、利用可能なエンドポイントが自動的に表示されます。
- リクエストの構造（params, searchParams）はサーバーコードから推論され、レスポンスも型安全に扱えます。

---

## ✅ さらに型安全にしたい場合 `honolike` + `createRouteHandler` による Next.js の型安全強化

さらに `honolike` をベースとした `createRouteHandler()` を組み合わせることで、

### 📌 主なメリット

1. **レスポンス型安全**

   - ステータス、Content-Type、Body がすべて型で保証される
   - クライアントは受け取るレスポンス型を完全に推論可能

2. **クライアント側補完強化**

   - `status`, `content-type`, `json()`, `text()` などがステータスに応じて適切に補完される

3. **サーバー側 params / query も型安全**
   - `routeHandlerFactory()` を使えば、`params`, `query` も型推論可能

---

### ✅ 基本的な使い方

```ts
const createRouteHandler = routeHandlerFactory((err, rc) =>
  rc.text("error", { status: 400 })
);

const { POST } = createRouteHandler().post(
  async (rc) => rc.json("json response"),
  async (rc) => rc.text("plain text")
);
```

これだけで、POST リクエストの返り値が、responseの内容(json,textなど)、status,contenttypeが型付けされるようになります。

## 🚧 Requirements

- Next.js 14+ (App Router 使用)
- Node.js 18+

---

## 💼 License

MIT
