import path from "path";
import mock from "mock-fs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { clearVisitedDirsCacheAbove, visitedDirsCache } from "./cache";

describe("clearVisitedDirsCacheAbove - ディレクトリパスの場合", () => {
  beforeEach(() => {
    // テストごとにキャッシュをリセット
    visitedDirsCache.clear();

    // 例として、以下のパスをキャッシュに設定
    // 基準とするディレクトリより上のパス（祖先）
    visitedDirsCache.set("/project", true);
    visitedDirsCache.set("/project/src", true);
    visitedDirsCache.set("/project/src/app", true);
    // 基準となるディレクトリとその配下
    visitedDirsCache.set("/project/src/app/foo", true);
    visitedDirsCache.set("/project/src/app/foo/bar", true);
    // 影響を受けないキー
    visitedDirsCache.set("/project/other", true);
  });

  it("対象ディレクトリパスが与えられた場合、基準およびその上位階層が削除される", () => {
    // 対象: /project/src/app/foo を基準とする
    // 期待: /project, /project/src, /project/src/app, /project/src/app/foo を削除
    //       ただし、/project/src/app/foo/bar（基準の下）は削除されない
    clearVisitedDirsCacheAbove("/project/src/app/foo");

    expect(visitedDirsCache.has("/project")).toBe(false);
    expect(visitedDirsCache.has("/project/src")).toBe(false);
    expect(visitedDirsCache.has("/project/src/app")).toBe(false);
    expect(visitedDirsCache.has("/project/src/app/foo")).toBe(false);

    // 基準の下の階層は影響なし
    expect(visitedDirsCache.has("/project/src/app/foo/bar")).toBe(true);
    // 影響を受けないキー
    expect(visitedDirsCache.has("/project/other")).toBe(true);
  });

  it("対象ディレクトリパスに末尾スラッシュが付いていても正しく動作する", () => {
    clearVisitedDirsCacheAbove("/project/src/app/foo/");

    expect(visitedDirsCache.has("/project")).toBe(false);
    expect(visitedDirsCache.has("/project/src")).toBe(false);
    expect(visitedDirsCache.has("/project/src/app")).toBe(false);
    expect(visitedDirsCache.has("/project/src/app/foo")).toBe(false);

    expect(visitedDirsCache.has("/project/src/app/foo/bar")).toBe(true);
    expect(visitedDirsCache.has("/project/other")).toBe(true);
  });

  it("存在しないディレクトリパスの場合は、キャッチして既存のキャッシュに一致する祖先が削除される（存在しなければ変更なし）", () => {
    // 存在しないパス "/not/exist" の場合、resolve された値に一致する祖先がなければ変更なし
    clearVisitedDirsCacheAbove("/not/exist");

    // 初期設定していた6件のうち、"/not/exist" の祖先に該当するものは無いので変更なし
    expect(visitedDirsCache.size).toBe(6);
  });

  it("相対パスでも正しく動作する", () => {
    // relative path を指定
    const relativeTarget = "./project/src/app/foo";
    const absoluteTarget = path.resolve(relativeTarget);

    // さらに、絶対パスの祖先としてキーを追加
    visitedDirsCache.set(absoluteTarget, true);
    visitedDirsCache.set(path.join(absoluteTarget, "subdir"), true);

    clearVisitedDirsCacheAbove(relativeTarget);

    // 祖先キー（絶対パスとそれより上）が削除される
    expect(visitedDirsCache.has(absoluteTarget)).toBe(false);
    // 基準の下（子供側）は削除されない
    expect(visitedDirsCache.has(path.join(absoluteTarget, "subdir"))).toBe(
      true
    );
  });
});

describe("clearVisitedDirsCacheAbove - ファイルパスの場合", () => {
  beforeEach(() => {
    visitedDirsCache.clear();

    // 以下のキーをキャッシュに設定
    visitedDirsCache.set("/project", true);
    visitedDirsCache.set("/project/src", true);
    visitedDirsCache.set("/project/src/app", true);
    visitedDirsCache.set("/project/src/app/foo", true);
    visitedDirsCache.set("/project/src/app/foo/bar", true);
    visitedDirsCache.set("/project/other", true);

    // mock-fs によりファイルシステムを構築
    // 例として /project/src/app/foo/file.txt をファイルとして作成
    mock({
      "/project/src/app/foo": {
        "file.txt": "dummy content",
        bar: {}, // ディレクトリ
      },
      "/project": {},
      "/project/other": {},
      "/project/src": {},
      "/project/src/app": {},
    });
  });

  afterEach(() => {
    mock.restore();
  });

  it("ファイルパスが渡された場合、その親ディレクトリおよびその上位階層を削除する", () => {
    const filePath = "/project/src/app/foo/file.txt";
    // この場合、基準は filePath の親である "/project/src/app/foo" になる
    // 期待: "/project", "/project/src", "/project/src/app", "/project/src/app/foo" が削除され、
    //       基準の下の階層 "/project/src/app/foo/bar" は削除されない
    clearVisitedDirsCacheAbove(filePath);

    expect(visitedDirsCache.has("/project")).toBe(false);
    expect(visitedDirsCache.has("/project/src")).toBe(false);
    expect(visitedDirsCache.has("/project/src/app")).toBe(false);
    expect(visitedDirsCache.has("/project/src/app/foo")).toBe(false);

    expect(visitedDirsCache.has("/project/src/app/foo/bar")).toBe(true);
    expect(visitedDirsCache.has("/project/other")).toBe(true);
  });

  it("存在しないファイルパスの場合は、エラーを catch して何も削除されない", () => {
    const filePath = "/non/existent/file.txt";
    const originalSize = visitedDirsCache.size;
    clearVisitedDirsCacheAbove(filePath);
    expect(visitedDirsCache.size).toBe(originalSize);
  });
});
