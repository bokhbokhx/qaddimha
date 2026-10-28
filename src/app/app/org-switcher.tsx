"use client";
import { switchOrgAction } from "../actions/auth";

export function OrgSwitcher({ current, orgs }: { current: string; orgs: { id: string; name: string }[] }) {
  if (orgs.length < 2) return <span className="font-medium text-brand-900">{orgs[0]?.name}</span>;
  return (
    <label className="flex items-center gap-1">
      <span className="sr-only">الجمعية النشطة</span>
      <select defaultValue={current} onChange={(e) => switchOrgAction(e.target.value)} className="rounded-lg border border-line bg-white px-2 py-1">
        {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </label>
  );
}
