import { RecordForm } from "@/components/record-form";

export const metadata = { title: "Record an action — Carltine" };

export default function RecordPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Record an agent action</h2>
        <p className="mt-1 text-sm text-muted">
          Each record commits to the one before it. Write what an auditor would need to
          reconstruct the decision — authorization basis, scope, and who was watching.
        </p>
      </div>
      <RecordForm />
    </div>
  );
}
