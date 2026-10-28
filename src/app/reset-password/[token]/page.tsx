import Link from "next/link";
import { ResetForm } from "@/components/client/auth-forms";
import { resetPasswordAction } from "../../actions/auth";

export const metadata = { title: "إعادة تعيين كلمة المرور" };

export default async function ResetPage(props: PageProps<"/reset-password/[token]">) {
  const { token } = await props.params;
  return (
    <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 py-16">
      <Link href="/" className="text-2xl font-bold text-brand-900">قدمها</Link>
      <h1 className="mt-6 text-xl font-bold">كلمة مرور جديدة</h1>
      <div className="mt-6 rounded-2xl border border-line bg-white p-6"><ResetForm action={resetPasswordAction} token={token} /></div>
    </main>
  );
}
