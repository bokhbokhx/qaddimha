"use client";
import { useState } from "react";
import { btnClass, inputClass } from "../ui";
import { Feedback, useAction, type Result } from "./use-action";

type Option = { title: string; rationale: string; assumptions: string[]; requirements: string[] };
type Turn = { reply: string; questions: string[]; understood: { key: string; label: string; value: string }[]; ideaOptions: Option[]; ideaSummary: string | null; outOfScopeWarning: string | null };

export function IdeaWorkspace({
  fields, inputs, messages, latest, summary, approved, canEdit, isDemoMode, isDemoGrant,
  saveInputs, turn, saveSummary,
}: {
  fields: { key: string; label: string }[];
  inputs: Record<string, string>;
  messages: { id: string; role: string; content: string }[];
  latest: Turn | null;
  summary: string;
  approved: boolean;
  canEdit: boolean;
  isDemoMode: boolean;
  isDemoGrant: boolean;
  saveInputs: (i: Record<string, string>) => Promise<Result>;
  turn: (msg: string | null) => Promise<Result<Turn>>;
  saveSummary: (s: string, approve: boolean) => Promise<Result>;
}) {
  const [vals, setVals] = useState(inputs);
  const [msg, setMsg] = useState("");
  const [sum, setSum] = useState(summary);
  const inputsA = useAction();
  const chatA = useAction();
  const sumA = useAction();

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section aria-labelledby="chat-h" className="flex flex-col rounded-2xl border border-line bg-white">
        <h2 id="chat-h" className="border-b border-line px-5 py-3 font-bold text-brand-900">المساعد</h2>
        <div className="max-h-[480px] min-h-[240px] flex-1 space-y-3 overflow-y-auto p-5" aria-live="polite">
          {messages.length === 0 && <p className="text-sm text-muted">ابدأ بالضغط على «اسأل المساعد» أو اكتب وصفًا لفكرتك. يمكنك دائمًا استخدام الحقول المنظمة بدلًا من المحادثة.</p>}
          {messages.map((m) => (
            <div key={m.id} className={`max-w-[90%] rounded-2xl px-4 py-2 text-sm whitespace-pre-line ${m.role === "user" ? "ms-auto bg-gold-100" : "me-auto bg-brand-50"}`}>
              <span className="sr-only">{m.role === "user" ? "أنت: " : "المساعد: "}</span>{m.content}
            </div>
          ))}
          {latest && latest.questions.length > 0 && (
            <div className="rounded-xl border border-line p-3 text-sm">
              <div className="mb-1 font-medium">أسئلة الدفعة الحالية:</div>
              <ul className="list-disc pe-5">{latest.questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </div>
          )}
          {latest && latest.understood.length > 0 && (
            <div className="rounded-xl border border-line p-3 text-sm">
              <div className="mb-1 font-medium">ما فهمناه (صحّحه في الحقول المنظمة):</div>
              <ul>{latest.understood.map((u) => <li key={u.key}><span className="text-muted">{u.label}:</span> {u.value}</li>)}</ul>
            </div>
          )}
        </div>
        {canEdit && (
          <div className="border-t border-line p-4">
            <label htmlFor="idea-msg" className="sr-only">رسالتك للمساعد</label>
            <textarea id="idea-msg" className={inputClass} rows={2} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={isDemoMode ? "في الوضع التجريبي يُحفظ نصك لكن لا يُحلل؛ استخدم الحقول المنظمة." : "اكتب ردك أو صف فكرتك…"} />
            <div className="mt-2 flex gap-2">
              <button type="button" className={btnClass("primary", "sm")} disabled={chatA.pending} onClick={() => chatA.exec(() => turn(msg || null), () => setMsg(""))}>
                {chatA.pending ? "المساعد يفكر…" : msg ? "إرسال" : "اسأل المساعد"}
              </button>
            </div>
            <Feedback error={chatA.error} message={null} />
          </div>
        )}
      </section>

      <div className="space-y-6">
        <section aria-labelledby="inputs-h" className="rounded-2xl border border-line bg-white p-5">
          <h2 id="inputs-h" className="mb-3 font-bold text-brand-900">إدخال منظم مباشر</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key} className={["problem", "need_evidence", "capabilities", "existing_project", "beneficiaries"].includes(f.key) ? "sm:col-span-2" : ""}>
                <label htmlFor={`ii-${f.key}`} className="mb-1 block text-sm">{f.label}</label>
                {["problem", "need_evidence", "capabilities", "existing_project", "beneficiaries"].includes(f.key) ? (
                  <textarea id={`ii-${f.key}`} rows={2} className={inputClass} value={vals[f.key] ?? ""} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} disabled={!canEdit} />
                ) : (
                  <input id={`ii-${f.key}`} className={inputClass} value={vals[f.key] ?? ""} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} disabled={!canEdit} />
                )}
              </div>
            ))}
          </div>
          {canEdit && <button type="button" className={`${btnClass("secondary", "sm")} mt-3`} disabled={inputsA.pending} onClick={() => inputsA.exec(() => saveInputs(vals))}>حفظ المدخلات</button>}
          <Feedback error={inputsA.error} message={inputsA.message} />
          <p className="mt-2 text-xs text-muted">لتحديث عدد المستفيدين والمدة والمنطقة المعتمدة في الطلب استخدم «ملخص المشروع» في الشريط الجانبي.</p>
        </section>

        {latest && latest.ideaOptions.length > 0 && (
          <section aria-labelledby="opts-h" className="rounded-2xl border border-line bg-white p-5">
            <h2 id="opts-h" className="mb-3 font-bold text-brand-900">مسارات مقترحة</h2>
            {latest.outOfScopeWarning && <p className="mb-3 rounded-lg bg-warn-50 p-2 text-sm text-warn-700">{latest.outOfScopeWarning}</p>}
            <div className="space-y-3">
              {latest.ideaOptions.map((o, i) => {
                const selectable = !isDemoMode || (isDemoGrant && i === 0);
                return (
                  <div key={i} className="rounded-xl border border-line p-3">
                    <div className="font-bold">{o.title}</div>
                    <p className="mt-1 text-sm">{o.rationale}</p>
                    <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                      <div><div className="font-medium">الافتراضات</div><ul className="list-disc pe-4 text-muted">{o.assumptions.map((a, j) => <li key={j}>{a}</li>)}</ul></div>
                      <div><div className="font-medium">المتطلبات</div><ul className="list-disc pe-4 text-muted">{o.requirements.map((a, j) => <li key={j}>{a}</li>)}</ul></div>
                    </div>
                    {canEdit && (selectable ? (
                      <button type="button" className={`${btnClass("secondary", "sm")} mt-2`} onClick={() => setSum(i === 0 && latest.ideaSummary ? latest.ideaSummary : `${o.title}. ${o.rationale}`)}>استخدم هذا المسار كملخص</button>
                    ) : <p className="mt-2 text-xs text-muted">تطوير هذا المسار يحتاج تفعيل مزود الذكاء الاصطناعي.</p>)}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section aria-labelledby="sum-h" className="rounded-2xl border border-line bg-white p-5">
          <h2 id="sum-h" className="mb-1 font-bold text-brand-900">ملخص الفكرة</h2>
          <p className="mb-2 text-xs text-muted">اعتمد الملخص قبل إنشاء تفاصيل المشروع. الأرقام فيه تقديرية حتى تعتمدها.</p>
          <label htmlFor="idea-sum" className="sr-only">ملخص الفكرة</label>
          <textarea id="idea-sum" rows={5} className={inputClass} value={sum} onChange={(e) => setSum(e.target.value)} disabled={!canEdit} />
          {canEdit && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className={btnClass("secondary", "sm")} disabled={sumA.pending} onClick={() => sumA.exec(() => saveSummary(sum, false))}>حفظ كمسودة</button>
              <button type="button" className={btnClass("primary", "sm")} disabled={sumA.pending || !sum.trim()} onClick={() => sumA.exec(() => saveSummary(sum, true))}>{approved && sum === summary ? "معتمد ✓" : "اعتماد الملخص"}</button>
            </div>
          )}
          <Feedback error={sumA.error} message={sumA.message} />
        </section>
      </div>
    </div>
  );
}
