import type { CodeRef } from "@flo/engine";
import { FileCode2 } from "lucide-react";

export function CodeRefList({ refs, repoUrl, commit }: { refs: CodeRef[]; repoUrl?: string; commit?: string }) {
  if (!refs.length) return null;
  return (
    <ul className="mt-3 space-y-1.5">
      {refs.map((r, i) => (
        <li key={`${r.file}:${r.line}:${i}`} className="overflow-hidden rounded-lg border border-line bg-sunken">
          <div className="flex items-center gap-2 px-3 py-1.5 font-mono text-[11.5px] text-muted">
            <FileCode2 className="size-3.5 shrink-0 text-faint" />
            {repoUrl && r.file ? (
              <a href={`${repoUrl}/blob/${commit ?? "HEAD"}/${r.file}${r.line ? `#L${r.line}` : ""}`} target="_blank" rel="noreferrer" className="truncate hover:text-fg hover:underline">
                {r.file}
                {r.line ? `:${r.line}` : ""}
              </a>
            ) : (
              <span className="truncate">
                {r.file}
                {r.line ? `:${r.line}` : ""}
              </span>
            )}
          </div>
          {r.snippet && <pre className="overflow-x-auto border-t border-line px-3 py-2 font-mono text-[12px] leading-relaxed text-fg">{r.snippet}</pre>}
        </li>
      ))}
    </ul>
  );
}

export function repoUrlFrom(source: string): string | undefined {
  const m = source.match(/^github\.com\/([^/]+)\/([^@\s]+)/);
  return m ? `https://github.com/${m[1]}/${m[2]}` : undefined;
}
