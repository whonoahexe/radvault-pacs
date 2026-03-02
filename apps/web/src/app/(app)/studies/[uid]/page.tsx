export default function StudyDetailPage({ params }: { params: { uid: string } }) {
  return (
    <main className="p-8">
      <h1 className="mb-2 text-2xl font-bold text-white">Study</h1>
      <p className="text-sm text-gray-400">UID: {params.uid}</p>
    </main>
  );
}
