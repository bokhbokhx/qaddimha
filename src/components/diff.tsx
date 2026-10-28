import { diffWords } from "diff";

/** عرض الفرق بين نصين على مستوى الكلمات: المحذوف مشطوب والمضاف مظلل */
export function TextDiff({ before, after }: { before: string; after: string }) {
  const parts = diffWords(before, after);
  return (
    <div className="whitespace-pre-wrap rounded-lg border border-line bg-white p-3 text-sm leading-8">
      {parts.map((p, i) =>
        p.added ? <ins key={i} className="rounded bg-ok-50 text-ok-700 no-underline">{p.value}</ins>
        : p.removed ? <del key={i} className="rounded bg-danger-50 text-danger-700">{p.value}</del>
        : <span key={i}>{p.value}</span>,
      )}
    </div>
  );
}
