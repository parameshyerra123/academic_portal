import { MySubjectsView } from "@/features/subjects/MySubjectsView";

export const metadata = {
  title: "My Subjects | Academic Portal",
  description: "Assigned teaching subjects, enrolled students, weekly load, and progress.",
};

export default function MySubjectsPage() {
  return <MySubjectsView />;
}
