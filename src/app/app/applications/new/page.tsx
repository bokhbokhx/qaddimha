import { redirect } from "next/navigation";
import { orgPageContext } from "@/lib/page-context";
import { Card, PageHeader } from "@/components/ui";
import { NewApplicationWizard } from "./wizard";

export const metadata = { title: "طلب جديد" };

export default async function NewApplication() {
  const ctx = await orgPageContext();
  if (!ctx.canEdit) redirect("/app");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="ابدأ طلبًا جديدًا" description="طلب واحد = مشروع واحد لدى جهة مانحة واحدة لفرصة تمويل محددة." />
      <Card><NewApplicationWizard isDemoOrg={ctx.org.isDemo} orgName={ctx.org.displayName} /></Card>
    </div>
  );
}
