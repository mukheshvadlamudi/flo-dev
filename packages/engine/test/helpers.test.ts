import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertPublicUrl, parseGitHubUrl, probeLiveSite } from "../src/index.js";
import { redact } from "../src/core/rules/helpers.js";
import { parseHtml } from "../src/core/live.js";

describe("redact", () => {
  it("masks credential values", () => {
    const key = ["sk", "live", "abcdefghijklmnopqrstuv"].join("_");
    expect(redact(`const k = "${key}"`)).not.toContain(key);
    expect(redact('password: "hunter2hunter2"')).not.toContain("hunter2hunter2");
  });
});

describe("parseGitHubUrl", () => {
  it("accepts common forms", () => {
    expect(parseGitHubUrl("https://github.com/acme/app")).toEqual({ owner: "acme", repo: "app", ref: undefined });
    expect(parseGitHubUrl("github.com/acme/app.git")).toMatchObject({ repo: "app" });
    expect(parseGitHubUrl("acme/app")).toMatchObject({ owner: "acme" });
    expect(parseGitHubUrl("https://github.com/acme/app/tree/dev")).toMatchObject({ ref: "dev" });
  });
  it("rejects other hosts and injection attempts", () => {
    expect(parseGitHubUrl("https://evil.com/acme/app")).toBeUndefined();
    expect(parseGitHubUrl("https://github.com/acme/app;rm -rf /")).toBeUndefined();
    expect(parseGitHubUrl("--upload-pack=touch /tmp/x")).toBeUndefined();
  });
});

describe("assertPublicUrl", () => {
  it("blocks private and metadata addresses", async () => {
    for (const u of ["http://127.0.0.1", "http://localhost:3000", "http://169.254.169.254/latest", "http://10.0.0.5", "http://[::1]/", "file:///etc/passwd", "http://user:pw@example.com"]) {
      await expect(assertPublicUrl(u), u).rejects.toThrow();
    }
  });
});

describe("parseHtml", () => {
  it("extracts SEO signals", () => {
    const h = parseHtml(
      `<html><head><title>Smile Dental</title><meta name="description" content="Dentist in Pune"><meta property="og:image" content="https://x/og.png"><script src="https://a.com/x.js"></script><script type="application/ld+json">{"@type":"Dentist"}</script></head><body><img src=a.png><img src=b.png alt="b"><a href="/about">About</a></body></html>`,
      "https://smile.example/",
    );
    expect(h).toMatchObject({ title: "Smile Dental", description: "Dentist in Pune", ogImage: "https://x/og.png", jsonLdTypes: ["Dentist"], imgWithoutAlt: 1, imgTotal: 2, links: 1, blockingScripts: 1 });
  });
});

describe("probeLiveSite", () => {
  let server: http.Server;
  let base = "";
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === "/") return res.writeHead(200, { "content-type": "text/html", "x-frame-options": "DENY" }).end("<title>Home</title>");
      if (req.url === "/robots.txt") return res.writeHead(200).end("User-agent: *\nAllow: /");
      res.writeHead(200).end("<title>Home</title>"); // soft 404
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => server.close());

  it("refuses localhost by default", async () => {
    const p = await probeLiveSite(base);
    expect(p.ok).toBe(false);
  });

  it("detects soft 404s and headers when allowed", async () => {
    const p = await probeLiveSite(base, { allowPrivate: true });
    expect(p.ok).toBe(true);
    expect(p.notFound?.status).toBe(200);
    expect(p.robots?.status).toBe(200);
    expect(p.sitemap?.status).toBe(200);
    expect(p.headers["x-frame-options"]).toBe("DENY");
  });
});
