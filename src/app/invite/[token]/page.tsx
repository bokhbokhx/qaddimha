import Link from "next/link";
import { readSession } from "@/lib/auth/session";
import { findInvitation } from "@/lib/services/members";
import { btnClass } from "@/components/ui";
import { InviteSignupForm } from "@/components/client/auth-forms";
import { db } from "@/lib/db";
import { inviteSignupAction } from "../../actions/auth";
import { AcceptInvite } from "./accept";

export const metadata = { title: "دعوة للانضمام" };
const ROLE: Record<string, string> = { OWNER: "مالك", EDITOR: "محرر", VIEWER: "قارئ" };

export default async function InvitePage(props: PageProps<"/invite/[token]">) {
  const { token } = await props.params;
  const inv = await findInvitation(token);
  const session = await readSession();
  const hasAccount = inv ? !!(await db.user.findUnique({ where: { email: inv.email }, select: { id: true } })) : false;
  return (
    <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 py-16">
      <Link href="/" className="text-2xl font-bold text-brand-900">قدمها</Link>
      {!inv ? (
        <div className="mt-6 rounded-2xl border border-line bg-white p-6">
          <h1 className="text-xl font-bold">الدعوة غير صالحة</h1>
          <p className="mt-2 text-muted">قد تكون منتهية أو أُلغيت أو استُخدمت. اطلب دعوة جديدة من مالك الجمعية.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4 rounded-2xl border border-line bg-white p-6">
          <h1 className="text-xl font-bold">دعوة للانضمام إلى {inv.organizationName}</h1>
          <p className="text-sm text-muted">الدور: {ROLE[inv.role]} · البريد المدعو: <bdi dir="ltr">{inv.email}</bdi></p>
          {session ? (
            session.user.email === inv.email ? <AcceptInvite token={token} /> : (
              <p className="text-sm text-danger-700">أنت مسجل الدخول بـ <bdi dir="ltr">{session.user.email}</bdi>. سجّل الخروج وادخل بالبريد المدعو.</p>
            )
          ) : hasAccount ? (
            <Link href={`/login?next=/invite/${token}`} className={`${btnClass()} w-full`}>سجّل الدخول لقبول الدعوة</Link>
          ) : (
            <InviteSignupForm action={inviteSignupAction} token={token} email={inv.email} />
          )}
        </div>
      )}
    </main>
  );
}
