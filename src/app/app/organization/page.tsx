import { db } from "@/lib/db";
import { orgPageContext } from "@/lib/page-context";
import { DOCUMENT_KIND_LABEL, PROFILE_FIELDS, PROFILE_GROUPS } from "@/lib/catalog";
import { formatDate, formatDateTime } from "@/lib/format";
import { ACCEPTED_DOCS_LABEL, ACCEPTED_LOGO_LABEL } from "@/lib/extraction/files";
import { Badge, Card, Notice, PageHeader } from "@/components/ui";
import { FactStatus } from "@/components/status";
import { ConflictResolver, FactEditor } from "@/components/client/fact-editor";
import { ActionButton } from "@/components/client/action-button";
import { UploadForm } from "@/components/client/upload";
import { DocMetaEditor, ExtractFromDocs, IdentityForm } from "@/components/client/org-tools";
import * as act from "../../actions/org";

export const metadata = { title: "ملف الجمعية" };

const ORG_KINDS = ["ORG_PROFILE_DECK", "ORG_DOC", "ORG_LICENSE", "ORG_FINANCIAL", "BUDGET_SHEET", "PARTNER_EVIDENCE", "OTHER"];

export default async function OrganizationPage(props: PageProps<"/app/organization">) {
  const ctx = await orgPageContext();
  const sp = await props.searchParams;
  const [facts, docs, profile] = await Promise.all([
    db.fact.findMany({ where: { organizationId: ctx.orgId, scopeRef: "org" } }),
    db.document.findMany({ where: { organizationId: ctx.orgId, opportunityId: null }, orderBy: { createdAt: "desc" } }),
    db.organizationProfile.findUnique({ where: { organizationId: ctx.orgId } }),
  ]);
  const docName = new Map(docs.map((d) => [d.id, d.label ?? d.filename]));
  const byKey = new Map(facts.map((f) => [f.key, f]));
  const counts = {
    confirmed: facts.filter((f) => f.status === "CONFIRMED").length,
    unconfirmed: facts.filter((f) => f.status === "EXTRACTED_UNCONFIRMED").length,
    conflict: facts.filter((f) => f.status === "CONFLICT").length,
    missing: PROFILE_FIELDS.filter((f) => !byKey.get(f.key) || byKey.get(f.key)!.status === "MISSING").length,
  };
  const logos = docs.filter((d) => d.kind === "LOGO");
  const textDocs = docs.filter((d) => d.kind !== "LOGO" && d.status === "EXTRACTED");
  const presentKinds = new Set(docs.map((d) => d.kind));

  return (
    <div>
      <PageHeader title="عرّفنا بجمعيتك" description="ملف معرفي يُعاد استخدامه في كل طلب. كل معلومة مهمة تحتفظ بمصدرها، ولا تُعتمد إلا بعد تأكيدك." />
      {sp.welcome && (
        <div className="mb-4"><Notice title="أهلًا بك">هل لديكم ملفات؟ ارفع الملف التعريفي أو أي مستند نصي لنستخرج منه البيانات، أو ابدأ بإدخال البيانات الأساسية مباشرة.</Notice></div>
      )}
      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        <Badge tone="ok">مؤكدة: {counts.confirmed}</Badge>
        <Badge tone="warn">تحتاج تأكيدًا: {counts.unconfirmed}</Badge>
        <Badge tone="danger">متعارضة: {counts.conflict}</Badge>
        <Badge>ناقصة: {counts.missing}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {PROFILE_GROUPS.map((g) => (
            <Card key={g.key} aria-labelledby={`g-${g.key}`}>
              <h2 id={`g-${g.key}`} className="mb-4 text-lg font-bold text-brand-900">{g.label}</h2>
              <div className="divide-y divide-line">
                {PROFILE_FIELDS.filter((f) => f.group === g.key).map((f) => {
                  const fact = byKey.get(f.key);
                  const status = fact?.status ?? "MISSING";
                  return (
                    <div key={f.key} className="grid gap-2 py-3 md:grid-cols-[200px_1fr]">
                      <div>
                        <div className="font-medium">{f.label}{f.important && <span className="text-gold-600" title="معلومة مهمة"> *</span>}</div>
                        <div className="mt-1"><FactStatus status={status} /></div>
                      </div>
                      <div className="min-w-0">
                        {status === "CONFLICT" ? (
                          <ConflictResolver
                            canEdit={ctx.canEdit}
                            alternatives={((fact?.alternatives as { value: unknown; sourceDocId?: string; sourceLocator?: string; sourceExcerpt?: string }[]) ?? []).map((a) => ({ ...a, docName: a.sourceDocId ? docName.get(a.sourceDocId) : "إدخال المستخدم" }))}
                            resolve={act.saveProfileFactAction.bind(null, f.key)}
                          />
                        ) : (
                          <FactEditor type={f.type} value={fact?.value ?? null} status={status} canEdit={ctx.canEdit} fieldLabel={f.label} save={act.saveProfileFactAction.bind(null, f.key)} />
                        )}
                        {fact && fact.status !== "MISSING" && (
                          <div className="mt-2 text-xs text-muted">
                            المصدر: {fact.sourceType === "USER" ? `إدخال المستخدم${fact.confirmedAt ? ` — ${formatDateTime(fact.confirmedAt)}` : ""}` : `${fact.sourceDocId ? docName.get(fact.sourceDocId) ?? "مستند" : "مستند محذوف"}${fact.sourceLocator ? ` — ${fact.sourceLocator}` : ""}`}
                            {fact.sourceExcerpt && <blockquote className="mt-1 border-s-2 border-gold-400 ps-2">«{fact.sourceExcerpt}»</blockquote>}
                          </div>
                        )}
                        {f.hint && <div className="mt-1 text-xs text-muted">{f.hint}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>

        <aside className="space-y-6">
          <Card>
            <h2 className="mb-1 text-lg font-bold text-brand-900">مستندات الجمعية</h2>
            <p className="mb-3 text-xs text-muted">{ACCEPTED_DOCS_LABEL}. غياب مستند عن المنصة لا يعني أن الجمعية لا تملكه.</p>
            {ctx.canEdit && <UploadForm kinds={ORG_KINDS} />}
            {ctx.org.isDemo && ctx.canEdit && (
              <div className="mt-4 rounded-xl bg-gold-100 p-3 text-sm">
                <div className="mb-2 font-bold text-gold-600">ملفات مثال تجريبية</div>
                <div className="flex flex-wrap gap-2">
                  {!presentKinds.has("ORG_FINANCIAL") && <ActionButton size="sm" variant="secondary" label="أضف القوائم المالية التجريبية" action={act.addDemoSampleAction.bind(null, "financials")} />}
                  {!docs.some((d) => d.label?.includes("تعهد")) && <ActionButton size="sm" variant="secondary" label="أضف خطاب التعهد التجريبي" action={act.addDemoSampleAction.bind(null, "pledge")} />}
                </div>
              </div>
            )}
            <ul className="mt-4 divide-y divide-line">
              {docs.filter((d) => d.kind !== "LOGO").map((d) => (
                <li key={d.id} className="py-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <a href={`/api/documents/${d.id}`} className="font-medium text-brand-800 underline break-all">{d.label ?? d.filename}</a>
                      <div className="text-xs text-muted">{DOCUMENT_KIND_LABEL[d.kind]} · {formatDate(d.createdAt)}{d.expiresOn ? ` · ينتهي ${formatDate(d.expiresOn)}` : ""}</div>
                    </div>
                    <Badge tone={d.status === "EXTRACTED" ? "ok" : d.status === "FAILED" ? "danger" : "warn"}>{d.status === "EXTRACTED" ? "نُص مستخرج" : d.status === "FAILED" ? "فشل الاستخراج" : "قيد المعالجة"}</Badge>
                  </div>
                  {d.extractionError && <p className="mt-1 text-xs text-danger-700">{d.extractionError}</p>}
                  {ctx.canEdit && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <DocMetaEditor kind={d.kind} label={d.label ?? ""} expiresOn={d.expiresOn ? d.expiresOn.toISOString().slice(0, 10) : ""} kinds={ORG_KINDS.map((k) => [k, DOCUMENT_KIND_LABEL[k]])} save={act.updateDocumentMetaAction.bind(null, d.id)} />
                      {d.status === "FAILED" && <ActionButton size="sm" variant="ghost" label="إعادة المعالجة" action={act.reprocessDocumentAction.bind(null, d.id)} />}
                      <ActionButton size="sm" variant="danger" label="حذف" confirm="سيُحذف المستند ونصوصه المستخرجة ونتائج تحليله. المعلومات التي أكدتها تبقى مع الإشارة إلى أن مصدرها حُذف. متابعة؟" action={act.deleteDocumentAction.bind(null, d.id)} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          {ctx.canEdit && (
            <Card>
              <h2 className="mb-3 text-lg font-bold text-brand-900">راجع ما استخرجناه</h2>
              <ExtractFromDocs docs={textDocs.map((d) => ({ id: d.id, filename: d.filename, label: d.label }))} extract={act.extractProfileAction} />
            </Card>
          )}

          <Card>
            <h2 className="mb-3 text-lg font-bold text-brand-900">الهوية البصرية</h2>
            {profile?.logoDocumentId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/documents/${profile.logoDocumentId}?inline=1`} alt="شعار الجمعية" className="mb-3 h-20 w-20 rounded-lg border border-line object-contain" />
            ) : (
              <p className="mb-3 text-sm text-muted">لا يوجد شعار.</p>
            )}
            {ctx.canEdit && <UploadForm kinds={["LOGO"]} accept=".png,.jpg,.jpeg,.webp" hint={ACCEPTED_LOGO_LABEL} compact />}
            {logos.length > 1 && ctx.canEdit && (
              <div className="mt-2 flex flex-wrap gap-2">
                {logos.filter((l) => l.id !== profile?.logoDocumentId).map((l) => <ActionButton key={l.id} size="sm" variant="ghost" label={`استخدم ${l.filename}`} action={act.setLogoAction.bind(null, l.id)} />)}
              </div>
            )}
            <div className="mt-4"><IdentityForm primary={profile?.primaryColor ?? "#0f3d2e"} secondary={profile?.secondaryColor ?? "#d6b25e"} save={act.updateIdentityAction} canEdit={ctx.canEdit} /></div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
