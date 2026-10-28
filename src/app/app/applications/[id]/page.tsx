import Link from "next/link";
import { appPageContext } from "@/lib/page-context";
import { buildSnapshot } from "@/lib/services/snapshot";
import { computeReadiness, GROUP_LABEL } from "@/lib/domain/readiness";
import { STAGES } from "@/lib/catalog";
import { Badge, Card, LinkButton } from "@/components/ui";
import { ActionButton } from "@/components/client/action-button";
import { deleteApplicationAction } from "../../../actions/app";

export default async function Overview(props: PageProps<"/app/applications/[id]">) {
  const { id } = await props.params;
  const ctx = await appPageContext(id);
  const r = computeReadiness(await buildSnapshot(id));
  const idx = STAGES.findIndex((s) => s.key === ctx.app.stage);
  const next = STAGES[Math.max(0, idx)];
  const groups = Object.entries(GROUP_LABEL).map(([g, label]) => {
    const items = r.items.filter((i) => i.group === g);
    return { g, label, blockers: items.filter((i) => i.status === "blocker").length, ok: items.filter((i) => i.status === "ok").length, total: items.length };
  });
  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-brand-900">الخطوة الحالية: {next.label}</h2>
            <p className="text-sm text-muted">يمكنك الحفظ والخروج والعودة إلى نفس المرحلة في أي وقت.</p>
          </div>
          <LinkButton href={`/app/applications/${id}/${next.path}`}>متابعة</LinkButton>
        </div>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {groups.filter((g) => g.total).map((g) => (
          <Card key={g.g} className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">{g.label}</h3>
              {g.blockers ? <Badge tone="danger">{g.blockers} عوائق</Badge> : <Badge tone="ok">لا عوائق</Badge>}
            </div>
            <div className="mt-1 text-sm text-muted tabular">{g.ok} من {g.total} عناصر مكتملة</div>
          </Card>
        ))}
      </div>
      <Card>
        <h2 className="mb-3 font-bold text-brand-900">مراحل الطلب</h2>
        <ol className="space-y-2">
          {STAGES.map((s, i) => (
            <li key={s.key} className="flex items-center gap-3">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${i < idx ? "bg-ok-50 text-ok-700" : i === idx ? "bg-brand-900 text-white" : "bg-[#efece4]"}`}>{i < idx ? "✓" : i + 1}</span>
              <Link href={`/app/applications/${id}/${s.path}`} className="hover:underline">{s.label}</Link>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted">{r.formula}</p>
      </Card>
      {ctx.isOwner && (
        <Card>
          <h2 className="mb-1 font-bold text-danger-700">حذف الطلب</h2>
          <p className="mb-3 text-sm text-muted">يحذف الطلب ونسخه ومخرجاته ومحادثاته وطلبات المراجعة. الفرصة ومستنداتها تُحذف إن لم ترتبط بطلب آخر. لا يمكن التراجع.</p>
          <ActionButton variant="danger" size="sm" label="حذف الطلب نهائيًا" confirm="سيُحذف الطلب وكل مشتقاته نهائيًا. متابعة؟" action={deleteApplicationAction.bind(null, id)} />
        </Card>
      )}
    </div>
  );
}
