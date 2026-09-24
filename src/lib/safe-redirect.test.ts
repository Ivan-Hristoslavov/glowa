import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("keeps our own paths, query and hash included", () => {
    expect(safeRedirectPath("/bg/onboarding")).toBe("/bg/onboarding");
    expect(safeRedirectPath("/bg/business/demo/book?service=1#confirm")).toBe(
      "/bg/business/demo/book?service=1#confirm",
    );
  });

  it("refuses anything that leaves the origin", () => {
    expect(safeRedirectPath("//evil.example")).toBeNull();
    expect(safeRedirectPath("/\\evil.example")).toBeNull();
    expect(safeRedirectPath("/%5Cevil.example")).toBe("/%5Cevil.example");
    expect(safeRedirectPath("https://evil.example")).toBeNull();
    expect(safeRedirectPath("javascript:alert(1)")).toBeNull();
    expect(safeRedirectPath("/\tevil")).toBeNull();
  });

  it("refuses non-strings and relative paths", () => {
    expect(safeRedirectPath(null)).toBeNull();
    expect(safeRedirectPath(undefined)).toBeNull();
    expect(safeRedirectPath("profile")).toBeNull();
  });
});
