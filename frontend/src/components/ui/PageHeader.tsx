import { cn } from "@/lib/cn";

type Props = {
  title: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
};


export function PageHeader({ title, description, actions, className }: Props) {
  if (!actions) {
    // When there are no actions, PageHeader is completely omitted from screen view
    // (Title is already shown in the top navbar breadcrumbs). Preserved for print.
    return (
      <div className={cn("hidden print:block print:mb-2 print:w-full print:text-center", className)}>
        <div className="text-[20px] font-bold text-center text-navy-900">{title}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mb-2 sm:mb-4 flex flex-wrap items-center justify-between gap-2 print:mb-2 print:block print:w-full print:text-center",
        className,
      )}
    >
      {/* Section title & introductory matter removed on screen; preserved for print */}
      <div className="hidden print:block print:w-full print:text-center">
        <div className="text-[20px] font-bold text-center text-navy-900">{title}</div>
      </div>
      <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-2 print:hidden ml-auto">
        {actions}
      </div>
    </div>
  );
}
