import PageShell, { ComingSoon } from "@/components/page-shell";

export default function ExamsPage() {
  return (
    <PageShell
      title="הכנות למבחנים"
      subtitle="תרגולים וחזרות לקראת מבחן א ומבחן ב"
    >
      <ComingSoon note="התרגולים יעלו לכאן על ידי המורה לקראת כל מבחן." />
    </PageShell>
  );
}
