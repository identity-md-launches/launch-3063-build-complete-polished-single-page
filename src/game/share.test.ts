import { describe, expect, it } from "vitest";
import { formatAura, shareText, shareUrl } from "./share";

describe("share score on X", () => {
  it("pre-fills the score, rank and Squeekchain", () => {
    const text = shareText(1240, "The Buildooooor");
    expect(text).toContain("1,240 Aura");
    expect(text).toContain("Squeekchain");
    expect(text).toContain("The Buildooooor");
  });

  it("builds an X intent URL and encodes the rank's parentheses and spaces", () => {
    const url = new URL(shareUrl(2600, "The Ringleader (Genesis WL)", { protocol: "https:", href: "https://example.org/game/#qa" }));
    expect(url.origin + url.pathname).toBe("https://x.com/intent/tweet");
    expect(url.searchParams.get("text")).toContain("The Ringleader (Genesis WL)");
    expect(url.searchParams.get("url")).toBe("https://example.org/game/");
  });

  it("falls back to Squeekchain when the game is not on https", () => {
    const url = new URL(shareUrl(10, "Signed Up", { protocol: "http:", href: "http://127.0.0.1:4173/" }));
    expect(url.searchParams.get("url")).toBe("https://squeekchain.com");
  });

  it("fits in a post", () => {
    const text = shareText(1234567, "The Ringleader (Genesis WL)");
    expect(text.length + 23 + 13).toBeLessThanOrEqual(280);
  });

  it("groups thousands", () => {
    expect(formatAura(1234567)).toBe("1,234,567");
  });
});
