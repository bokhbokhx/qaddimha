import { orgPageContext } from "@/lib/page-context";
import { Card, PageHeader } from "@/components/ui";
import { ChangePasswordForm } from "@/components/client/auth-forms";
import { changePasswordAction } from "../../actions/auth";

export const metadata = { title: "حسابي" };

export default async function AccountPage() {
  const ctx = await orgPageContext();
  return (
    <div className="space-y-6">
      <PageHeader title="حسابي" description={<span>{ctx.user.name} · <bdi dir="ltr">{ctx.user.email}</bdi></span>} />
      <Card>
        <h2 className="mb-3 font-bold text-brand-900">تغيير كلمة المرور</h2>
        <ChangePasswordForm action={changePasswordAction} />
      </Card>
    </div>
  );
}
