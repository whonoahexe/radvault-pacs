export default function ViewerPage({ params }: { params: { studyId: string } }) {
  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-bold text-white">DICOM Viewer</h1>
      <p className="text-sm text-gray-400">
        Study ID: {params.studyId}
      </p>
      <p className="mt-2 text-sm text-gray-400">
        Cornerstone3D viewer integration will be implemented in a later step.
      </p>
    </main>
  );
}
