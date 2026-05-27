import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export function StatCard({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <Card className="p-5 transition duration-300 hover:-translate-y-1 hover:border-brand-primary/50">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-400">{label}</p>
          <strong className="mt-2 block text-2xl text-white">{value}</strong>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-md border border-brand-primary/30 bg-brand-primary/10 text-brand-primary">
          <Icon size={22} />
        </span>
      </div>
      <p className="mt-4 text-xs text-zinc-500">{detail}</p>
    </Card>
  );
}
