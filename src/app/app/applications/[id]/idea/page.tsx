import { db } from "@/lib/db";
import { appPageContext } from "@/lib/page-context";
import { isDemoAI } from "@/lib/env";
import { IDEA_INPUT_FIELDS } from "@/lib/services/assistant";
import { LinkButton, PageHeader } from "@/components/ui";
import { IdeaWorkspace } from "@/components/client/idea";
import { ideaTurnAction, saveIdeaInputsAction, saveIdeaSummaryAction } from "../../../../actions/app";

export default async function IdeaPage(props: PageProps<"/app/applications/[id]/idea">) {
  const { id } = await props.params;
  const ctx = await appPageContext(id);
  const conv = await db.conversation.findFirst({ where: { applicationId: id, purpose: "IDEA" }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  const msgs = conv?.messages ?? [];
  const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant" && m.structured);
  return (
    <div className="space-y-6">
      <PageHeader title="طوّر فكرة المشروع" description="أسئلة قصيرة على دفعات، مع إدخال منظم مباشر بجانب المحادثة. لا نقترح مشروعًا خارج اختصاص الجمعية لمجرد توفر التمويل." actions={ctx.app.ideaApproved && <LinkButton href={`/app/applications/${id}/project`}>التالي: محرر المشروع</LinkButton>} />
      <IdeaWorkspace
        fields={IDEA_INPUT_FIELDS.map((f) => ({ key: f.key, label: f.label }))}
        inputs={(ctx.app.ideaInputs as Record<string, string> | null) ?? {}}
        messages={msgs.map((m) => ({ id: m.id, role: m.role, content: m.content }))}
        latest={(lastAssistant?.structured as never) ?? null}
        summary={ctx.app.ideaSummary ?? ""}
        approved={ctx.app.ideaApproved}
        canEdit={ctx.canEdit}
        isDemoMode={isDemoAI()}
        isDemoGrant={ctx.app.opportunity.isDemo}
        saveInputs={saveIdeaInputsAction.bind(null, id)}
        turn={ideaTurnAction.bind(null, id)}
        saveSummary={saveIdeaSummaryAction.bind(null, id)}
      />
    </div>
  );
}
