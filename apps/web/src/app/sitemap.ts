import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/sample", "/expert-audit", "/privacy", "/terms"].map((p) => ({ url: `${SITE.url}${p}`, changeFrequency: "weekly", priority: p === "" ? 1 : 0.6 }));
}
