import { describe, it, expect } from "vitest";
import { storagePath } from "./storage";

describe("private images: stored values", () => {
  it("reads the path from v1's public URLs", () => {
    expect(storagePath("https://abc.supabase.co/storage/v1/object/public/expense-images/u1/9f.jpg")).toBe("u1/9f.jpg");
    expect(storagePath("https://abc.supabase.co/storage/v1/object/public/expense-images/u1/avatar.png?t=123")).toBe("u1/avatar.png");
    expect(storagePath("https://abc.supabase.co/storage/v1/object/public/expense-images/u1/a%20b.jpg")).toBe("u1/a b.jpg");
  });
  it("uses a stored path as it is", () => {
    expect(storagePath("u1/9f.jpg")).toBe("u1/9f.jpg");
    expect(storagePath("u1/avatar.png?t=123")).toBe("u1/avatar.png");
  });
  it("leaves previews and other URLs alone", () => {
    expect(storagePath("blob:http://localhost/123")).toBeNull();
    expect(storagePath("data:image/png;base64,AAAA")).toBeNull();
    expect(storagePath("https://lh3.googleusercontent.com/a/photo.jpg")).toBeNull();
    expect(storagePath(null)).toBeNull();
    expect(storagePath("")).toBeNull();
  });
});
