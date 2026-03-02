export default function ReportPage({ params }: { params: { id: string } }) {
  return (
    <main className="p-8">
      <h1 className="mb-2 text-2xl font-bold text-white">Report</h1>
      <p className="text-sm text-gray-400">ID: {params.id}</p>
    </main>
  );
}
