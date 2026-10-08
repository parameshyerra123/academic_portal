import { StatCard } from "@/components/ui/StatCard";

type Props = {
  classesToday: number;
  periodsThisWeek: number;
  theory: number;
  lab: number;
};


export function TimetableSummary({
  classesToday,
  periodsThisWeek,
  theory,
  lab,
}: Props) {
  return (
    <div className="grid grid-cols-4 gap-1.5 sm:gap-3 xl:grid-cols-4">
      <StatCard compact label="Today" value={classesToday} tone="info" hint="Classes" />
      <StatCard compact label="Weekly" value={periodsThisWeek} hint="Periods" />
      <StatCard compact label="Theory" value={theory} hint="Classes" />
      <StatCard compact label="Lab" value={lab} hint="Classes" />
    </div>
  );
}
