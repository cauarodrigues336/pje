import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/pje";

export function StatusBadge({ status, className }: { status: keyof typeof STATUS_LABELS; className?: string }) {
  const map: Record<keyof typeof STATUS_LABELS, string> = {
    em_tramitacao: "bg-info/15 text-info border-info/30",
    arquivado: "bg-muted text-muted-foreground border-border",
    suspenso: "bg-warning/15 text-warning-foreground border-warning/40",
    baixado: "bg-muted text-muted-foreground border-border",
    julgado: "bg-success/15 text-success border-success/30",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded border", map[status], className)}>
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status]}
    </span>
  );
}
