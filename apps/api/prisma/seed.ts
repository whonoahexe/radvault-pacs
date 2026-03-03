import { access, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createSign } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import dcmjs from 'dcmjs';
import {
  Prisma,
  PrismaClient,
  ReportStatus,
  UserRole,
  WorklistPriority,
  WorklistStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

type DicomTagValue = {
  vr?: string;
  Value?: unknown[];
};

type DicomDataset = Record<string, DicomTagValue>;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required for seed execution');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const ORTHANC_BASE_URL = process.env.ORTHANC_URL ?? 'http://orthanc:8042';
const API_HEALTH_URL = 'http://localhost:3000/health';

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createServiceJwt(): string {
  const privateKey = process.env.JWT_SIGNING_KEY?.replace(/\\n/g, '\n');
  if (!privateKey) {
    throw new Error('JWT_SIGNING_KEY is required for Orthanc seed authorization');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresInSeconds = 60 * 10;
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    sub: 'seed',
    email: 'seed@radvault.local',
    role: 'Admin',
    iat: nowSeconds,
    exp: nowSeconds + expiresInSeconds,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = createSign('RSA-SHA256').update(data).end().sign(privateKey);

  return `${data}.${base64url(signature)}`;
}

const ORTHANC_AUTHORIZATION_HEADER = `Bearer ${createServiceJwt()}`;

const DEMO_USERS = [
  {
    email: 'admin@radvault.local',
    password: 'Admin1234!',
    fullName: 'System Admin',
    role: UserRole.Admin,
  },
  {
    email: 'radiologist@radvault.local',
    password: 'Rad1234!',
    fullName: 'Dr. Sarah Chen',
    role: UserRole.Radiologist,
  },
  {
    email: 'tech@radvault.local',
    password: 'Tech1234!',
    fullName: 'James Wright',
    role: UserRole.Technologist,
  },
  {
    email: 'referring@radvault.local',
    password: 'Ref1234!',
    fullName: 'Dr. Marcus Reid',
    role: UserRole.ReferringPhysician,
  },
] as const;

function parseDateTag(value: string | null): Date | null {
  if (!value || value.length !== 8) {
    return null;
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  if (!year || !month || !day) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day));
}

function normalizePersonName(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof value === 'object' && 'Alphabetic' in value) {
    const alphabeticValue = (value as { Alphabetic?: unknown }).Alphabetic;
    return typeof alphabeticValue === 'string' ? alphabeticValue : null;
  }

  return null;
}

function getDicomValue(dataset: DicomDataset, tag: string): unknown {
  return dataset[tag]?.Value?.[0];
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function resolveSeedDataDir(): Promise<string> {
  const candidates = [
    resolve(process.cwd(), 'apps/api/prisma/seed-data'),
    resolve(process.cwd(), 'prisma/seed-data'),
  ];

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  throw new Error('Unable to locate prisma seed-data directory');
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function readStudyInstanceUid(filePath: string): Promise<string> {
  const dicomBuffer = await readFile(filePath);
  const arrayBuffer = bufferToArrayBuffer(dicomBuffer);
  const dicomDict = dcmjs.data.DicomMessage.readFile(arrayBuffer, {
    ignoreErrors: false,
    untilTag: null,
    includeUntilTagValue: false,
    noCopy: false,
  });

  const studyUid =
    (dicomDict.dict['0020000D']?.Value?.[0] as string | undefined) ??
    (dicomDict.dict['0020000d']?.Value?.[0] as string | undefined);

  if (!studyUid || typeof studyUid !== 'string') {
    throw new Error(`StudyInstanceUID missing in file: ${filePath}`);
  }

  return studyUid.trim();
}

async function waitForApiHealth(): Promise<void> {
  const maxAttempts = 30;
  const delayMs = 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(API_HEALTH_URL, { method: 'GET' });
      if (response.ok) {
        console.log('API health is ready for seed uploads');
        return;
      }
    } catch {
      // Retry until timeout.
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
  }

  throw new Error('API health check timed out after 60 seconds');
}

async function orthancStudyExists(studyInstanceUid: string): Promise<boolean> {
  const response = await fetch(
    `${ORTHANC_BASE_URL}/dicom-web/studies?StudyInstanceUID=${encodeURIComponent(studyInstanceUid)}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/dicom+json',
        Authorization: ORTHANC_AUTHORIZATION_HEADER,
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Orthanc study existence check failed: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as unknown;
  return Array.isArray(payload) && payload.length > 0;
}

async function uploadDicomToOrthanc(filePath: string, fileBuffer: Buffer): Promise<void> {
  const boundary = `seed-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const header = Buffer.from(`--${boundary}\r\nContent-Type: application/dicom\r\n\r\n`, 'utf8');
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  const body = Buffer.concat([header, fileBuffer, footer]);

  const response = await fetch(`${ORTHANC_BASE_URL}/dicom-web/studies`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/related; type="application/dicom"; boundary=${boundary}`,
      Accept: 'application/dicom+json',
      Authorization: ORTHANC_AUTHORIZATION_HEADER,
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Orthanc STOW-RS upload failed for ${filePath}: ${response.status} ${errorText}`,
    );
  }
}

async function fetchOrthancStudyIdByUid(studyInstanceUid: string): Promise<string | null> {
  const response = await fetch(`${ORTHANC_BASE_URL}/tools/lookup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      Accept: 'application/json',
      Authorization: ORTHANC_AUTHORIZATION_HEADER,
    },
    body: studyInstanceUid,
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    return null;
  }

  const studyItem = payload.find(
    (item) =>
      item &&
      typeof item === 'object' &&
      'Type' in item &&
      'ID' in item &&
      (item as { Type?: unknown }).Type === 'Study' &&
      typeof (item as { ID?: unknown }).ID === 'string',
  ) as { ID?: string } | undefined;

  return studyItem?.ID ?? null;
}

async function syncStudyFromDicomFileToDb(filePath: string): Promise<string> {
  const dicomBuffer = await readFile(filePath);
  const arrayBuffer = bufferToArrayBuffer(dicomBuffer);
  const dicomDict = dcmjs.data.DicomMessage.readFile(arrayBuffer, {
    ignoreErrors: false,
    untilTag: null,
    includeUntilTagValue: false,
    noCopy: false,
  });

  const firstDataset = dicomDict.dict as unknown as DicomDataset;
  const datasets = [firstDataset];
  const patientDicomId = String(getDicomValue(firstDataset, '00100020') ?? '').trim();
  const persistedStudyUid = String(getDicomValue(firstDataset, '0020000D') ?? '').trim();

  if (!patientDicomId || !persistedStudyUid) {
    throw new Error(`Missing required DICOM tags for study in ${filePath}`);
  }

  const patientName = normalizePersonName(getDicomValue(firstDataset, '00100010')) ?? 'UNKNOWN';
  const referringPhysicianName = normalizePersonName(getDicomValue(firstDataset, '00080090'));
  const modalityValues = firstDataset['00080061']?.Value;
  const modalitiesInStudy = Array.isArray(modalityValues)
    ? modalityValues.filter((value): value is string => typeof value === 'string').join('\\')
    : null;

  const orthancStudyId = await fetchOrthancStudyIdByUid(persistedStudyUid);

  const syncedStudy = await prisma.$transaction(async (tx) => {
    const patient = await tx.patient.upsert({
      where: { patientId: patientDicomId },
      update: {
        patientName,
        patientBirthDate: parseDateTag(String(getDicomValue(firstDataset, '00100030') ?? '')),
        patientSex: String(getDicomValue(firstDataset, '00100040') ?? '') || null,
      },
      create: {
        patientId: patientDicomId,
        patientName,
        patientBirthDate: parseDateTag(String(getDicomValue(firstDataset, '00100030') ?? '')),
        patientSex: String(getDicomValue(firstDataset, '00100040') ?? '') || null,
      },
    });

    const study = await tx.study.upsert({
      where: { studyInstanceUid: persistedStudyUid },
      update: {
        patientId: patient.id,
        accessionNumber: String(getDicomValue(firstDataset, '00080050') ?? '') || null,
        studyDescription: String(getDicomValue(firstDataset, '00081030') ?? '') || null,
        studyDate: parseDateTag(String(getDicomValue(firstDataset, '00080020') ?? '')),
        studyTime: String(getDicomValue(firstDataset, '00080030') ?? '') || null,
        modalitiesInStudy,
        referringPhysicianName,
        institutionName: String(getDicomValue(firstDataset, '00080080') ?? '') || null,
        numberOfSeries: 1,
        numberOfInstances: datasets.length,
        orthancStudyId,
        dicomTags: firstDataset as unknown as Prisma.InputJsonValue,
      },
      create: {
        patientId: patient.id,
        studyInstanceUid: persistedStudyUid,
        accessionNumber: String(getDicomValue(firstDataset, '00080050') ?? '') || null,
        studyDescription: String(getDicomValue(firstDataset, '00081030') ?? '') || null,
        studyDate: parseDateTag(String(getDicomValue(firstDataset, '00080020') ?? '')),
        studyTime: String(getDicomValue(firstDataset, '00080030') ?? '') || null,
        modalitiesInStudy,
        referringPhysicianName,
        institutionName: String(getDicomValue(firstDataset, '00080080') ?? '') || null,
        numberOfSeries: 1,
        numberOfInstances: datasets.length,
        orthancStudyId,
        dicomTags: firstDataset as unknown as Prisma.InputJsonValue,
      },
    });

    for (const dataset of datasets) {
      const seriesInstanceUid = String(getDicomValue(dataset, '0020000E') ?? '').trim();
      const sopInstanceUid = String(getDicomValue(dataset, '00080018') ?? '').trim();

      if (!seriesInstanceUid || !sopInstanceUid) {
        continue;
      }

      const series = await tx.series.upsert({
        where: { seriesInstanceUid },
        update: {
          studyId: study.id,
          seriesDescription: String(getDicomValue(dataset, '0008103E') ?? '') || null,
          modality: String(getDicomValue(dataset, '00080060') ?? '') || null,
          seriesNumber: Number(getDicomValue(dataset, '00200011') ?? 0) || null,
          numberOfInstances: Number(getDicomValue(dataset, '00201209') ?? 0) || 1,
          dicomTags: dataset as unknown as Prisma.InputJsonValue,
        },
        create: {
          studyId: study.id,
          seriesInstanceUid,
          seriesDescription: String(getDicomValue(dataset, '0008103E') ?? '') || null,
          modality: String(getDicomValue(dataset, '00080060') ?? '') || null,
          seriesNumber: Number(getDicomValue(dataset, '00200011') ?? 0) || null,
          numberOfInstances: Number(getDicomValue(dataset, '00201209') ?? 0) || 1,
          dicomTags: dataset as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.instance.upsert({
        where: { sopInstanceUid },
        update: {
          seriesId: series.id,
          sopClassUid: String(getDicomValue(dataset, '00080016') ?? '') || null,
          instanceNumber: Number(getDicomValue(dataset, '00200013') ?? 0) || null,
        },
        create: {
          seriesId: series.id,
          sopInstanceUid,
          sopClassUid: String(getDicomValue(dataset, '00080016') ?? '') || null,
          instanceNumber: Number(getDicomValue(dataset, '00200013') ?? 0) || null,
        },
      });
    }

    await tx.worklistItem.upsert({
      where: { studyId: study.id },
      update: {},
      create: {
        studyId: study.id,
        status: WorklistStatus.Scheduled,
        priority: WorklistPriority.Routine,
        scheduledAt: new Date(),
      },
    });

    return study;
  });

  return syncedStudy.id;
}

async function seedUsers() {
  const usersByEmail = new Map<string, { id: string; email: string }>();

  for (const user of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(user.password, 12);

    const persisted = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        fullName: user.fullName,
        role: user.role,
        passwordHash,
        isActive: true,
      },
      create: {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        passwordHash,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
      },
    });

    usersByEmail.set(persisted.email, persisted);
  }

  return usersByEmail;
}

async function seedDicomStudies(seedDataDir: string): Promise<{
  ctStudyUid: string;
  mrStudyUid: string;
  xrStudyUid: string;
}> {
  const xrCandidates = ['chest_xray.dcm', 'SC_rgb_dcmtk_+eb+cr.dcm', 'SC_rgb_small_odd.dcm'];

  let xrFileName: string | null = null;
  for (const candidate of xrCandidates) {
    if (await fileExists(join(seedDataDir, candidate))) {
      xrFileName = candidate;
      break;
    }
  }

  if (!xrFileName) {
    throw new Error('No XR fallback DICOM file found in seed-data directory');
  }

  const seedFiles = [
    { label: 'CT', fileName: 'CT_small.dcm' },
    { label: 'MR', fileName: 'MR_small.dcm' },
    { label: 'XR', fileName: xrFileName },
  ];

  const studyUids = new Map<string, string>();

  for (const seedFile of seedFiles) {
    const absolutePath = join(seedDataDir, seedFile.fileName);
    const fileBuffer = await readFile(absolutePath);
    const studyUid = await readStudyInstanceUid(absolutePath);

    const existsInOrthanc = await orthancStudyExists(studyUid);
    if (!existsInOrthanc) {
      await uploadDicomToOrthanc(seedFile.fileName, fileBuffer);
      console.log(`Uploaded ${seedFile.fileName} to Orthanc`);
    } else {
      console.log(`Skipped upload for ${seedFile.fileName}; already in Orthanc`);
    }

    await syncStudyFromDicomFileToDb(absolutePath);
    studyUids.set(seedFile.label, studyUid);
  }

  const ctStudyUid = studyUids.get('CT');
  const mrStudyUid = studyUids.get('MR');
  const xrStudyUid = studyUids.get('XR');

  if (!ctStudyUid || !mrStudyUid || !xrStudyUid) {
    throw new Error('Failed to resolve all seeded study UIDs');
  }

  return { ctStudyUid, mrStudyUid, xrStudyUid };
}

async function seedSyntheticPatients(): Promise<void> {
  const syntheticData = [
    {
      patient: {
        patientId: 'PAT-SYN-004',
        patientName: 'GARCIA^MARIA',
        patientBirthDate: new Date(Date.UTC(1978, 6, 22)),
        patientSex: 'F',
      },
      study: {
        studyInstanceUid: '1.2.840.113619.2.55.3.9.20260215.100004',
        accessionNumber: 'ACC-20260215-004',
        studyDescription: 'US ABDOMEN COMPLETE',
        studyDate: new Date(Date.UTC(2026, 1, 15)),
        studyTime: '143000',
        modalitiesInStudy: 'US',
        referringPhysicianName: 'Dr. Marcus Reid',
        institutionName: 'RadVault Medical Center',
        numberOfSeries: 2,
        numberOfInstances: 24,
      },
      series: {
        seriesInstanceUid: '1.2.840.113619.2.55.3.9.20260215.100004.1',
        seriesDescription: 'ABDOMEN SAGITTAL',
        modality: 'US',
        seriesNumber: 1,
        numberOfInstances: 24,
      },
      instance: {
        sopInstanceUid: '1.2.840.113619.2.55.3.9.20260215.100004.1.1',
        sopClassUid: '1.2.840.10008.5.1.4.1.1.6.1',
        instanceNumber: 1,
      },
      worklist: {
        status: WorklistStatus.Preliminary,
        priority: WorklistPriority.Urgent,
      },
    },
    {
      patient: {
        patientId: 'PAT-SYN-005',
        patientName: 'JOHNSON^ROBERT^W',
        patientBirthDate: new Date(Date.UTC(1955, 10, 3)),
        patientSex: 'M',
      },
      study: {
        studyInstanceUid: '1.2.840.113619.2.55.3.9.20260228.100005',
        accessionNumber: 'ACC-20260228-005',
        studyDescription: 'CT HEAD WITHOUT CONTRAST',
        studyDate: new Date(Date.UTC(2026, 1, 28)),
        studyTime: '091500',
        modalitiesInStudy: 'CT',
        referringPhysicianName: 'Dr. Marcus Reid',
        institutionName: 'RadVault Medical Center',
        numberOfSeries: 1,
        numberOfInstances: 36,
      },
      series: {
        seriesInstanceUid: '1.2.840.113619.2.55.3.9.20260228.100005.1',
        seriesDescription: 'AXIAL 5MM',
        modality: 'CT',
        seriesNumber: 1,
        numberOfInstances: 36,
      },
      instance: {
        sopInstanceUid: '1.2.840.113619.2.55.3.9.20260228.100005.1.1',
        sopClassUid: '1.2.840.10008.5.1.4.1.1.2',
        instanceNumber: 1,
      },
      worklist: {
        status: WorklistStatus.Scheduled,
        priority: WorklistPriority.Stat,
      },
    },
  ];

  const radiologist = await prisma.user.findFirst({
    where: { role: UserRole.Radiologist },
    select: { id: true },
  });

  for (const entry of syntheticData) {
    const patient = await prisma.patient.upsert({
      where: { patientId: entry.patient.patientId },
      update: entry.patient,
      create: entry.patient,
    });

    const study = await prisma.study.upsert({
      where: { studyInstanceUid: entry.study.studyInstanceUid },
      update: { ...entry.study, patientId: patient.id },
      create: { ...entry.study, patientId: patient.id },
    });

    const series = await prisma.series.upsert({
      where: { seriesInstanceUid: entry.series.seriesInstanceUid },
      update: { ...entry.series, studyId: study.id },
      create: { ...entry.series, studyId: study.id },
    });

    await prisma.instance.upsert({
      where: { sopInstanceUid: entry.instance.sopInstanceUid },
      update: { ...entry.instance, seriesId: series.id },
      create: { ...entry.instance, seriesId: series.id },
    });

    const assignedTo =
      entry.worklist.status === WorklistStatus.Preliminary && radiologist ? radiologist.id : null;

    await prisma.worklistItem.upsert({
      where: { studyId: study.id },
      update: {
        status: entry.worklist.status,
        priority: entry.worklist.priority,
        assignedTo,
      },
      create: {
        studyId: study.id,
        status: entry.worklist.status,
        priority: entry.worklist.priority,
        assignedTo,
        scheduledAt: new Date(),
        startedAt: assignedTo ? new Date() : null,
      },
    });
  }
}

async function seedWorklistAndReport(args: {
  ctStudyUid: string;
  mrStudyUid: string;
  xrStudyUid: string;
  usersByEmail: Map<string, { id: string; email: string }>;
}) {
  const radiologist = args.usersByEmail.get('radiologist@radvault.local');
  if (!radiologist) {
    throw new Error('Radiologist demo user missing after user seed');
  }

  const studies = await prisma.study.findMany({
    where: {
      studyInstanceUid: {
        in: [args.ctStudyUid, args.mrStudyUid, args.xrStudyUid],
      },
    },
    select: {
      id: true,
      studyInstanceUid: true,
    },
  });

  const studyByUid = new Map(studies.map((study) => [study.studyInstanceUid, study]));

  const ctStudy = studyByUid.get(args.ctStudyUid);
  const mrStudy = studyByUid.get(args.mrStudyUid);
  const xrStudy = studyByUid.get(args.xrStudyUid);

  if (!ctStudy || !mrStudy || !xrStudy) {
    throw new Error('One or more seeded studies are missing from PostgreSQL');
  }

  await prisma.worklistItem.upsert({
    where: { studyId: ctStudy.id },
    update: {
      status: WorklistStatus.Scheduled,
      priority: WorklistPriority.Stat,
      assignedTo: null,
      startedAt: null,
      completedAt: null,
    },
    create: {
      studyId: ctStudy.id,
      status: WorklistStatus.Scheduled,
      priority: WorklistPriority.Stat,
      assignedTo: null,
      scheduledAt: new Date(),
    },
  });

  await prisma.worklistItem.upsert({
    where: { studyId: mrStudy.id },
    update: {
      status: WorklistStatus.InProgress,
      priority: WorklistPriority.Urgent,
      assignedTo: radiologist.id,
      startedAt: new Date(),
      completedAt: null,
    },
    create: {
      studyId: mrStudy.id,
      status: WorklistStatus.InProgress,
      priority: WorklistPriority.Urgent,
      assignedTo: radiologist.id,
      scheduledAt: new Date(),
      startedAt: new Date(),
    },
  });

  await prisma.worklistItem.upsert({
    where: { studyId: xrStudy.id },
    update: {
      status: WorklistStatus.Final,
      priority: WorklistPriority.Routine,
      completedAt: new Date(),
    },
    create: {
      studyId: xrStudy.id,
      status: WorklistStatus.Final,
      priority: WorklistPriority.Routine,
      scheduledAt: new Date(),
      completedAt: new Date(),
    },
  });

  const existingReport = await prisma.report.findFirst({
    where: {
      studyId: xrStudy.id,
    },
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      id: true,
      version: true,
    },
  });

  const reportData = {
    studyId: xrStudy.id,
    authorId: radiologist.id,
    status: ReportStatus.Final,
    indication: 'Cough and fever',
    technique: 'PA and lateral chest radiograph',
    comparison: 'None available',
    findings:
      'Lungs are clear bilaterally. No pleural effusion or pneumothorax. Cardiac silhouette is normal in size. Mediastinum is unremarkable.',
    impression: 'No acute cardiopulmonary process.',
    signedBy: radiologist.id,
    signedAt: new Date(),
  } as const;

  const report = existingReport
    ? await prisma.report.update({
        where: { id: existingReport.id },
        data: reportData,
      })
    : await prisma.report.create({
        data: {
          ...reportData,
          version: 1,
        },
      });

  await prisma.reportVersion.deleteMany({
    where: {
      reportId: report.id,
    },
  });

  await prisma.reportVersion.create({
    data: {
      reportId: report.id,
      versionNumber: report.version,
      indication: report.indication,
      technique: report.technique,
      comparison: report.comparison,
      findings: report.findings,
      impression: report.impression,
      authorId: radiologist.id,
      statusAtVersion: ReportStatus.Final,
    },
  });
}

async function main() {
  const seedDataDir = await resolveSeedDataDir();

  const usersByEmail = await seedUsers();
  console.log('Demo users seeded');

  await waitForApiHealth();

  const studyUids = await seedDicomStudies(seedDataDir);
  console.log('DICOM studies seeded and synced');

  await seedWorklistAndReport({
    ...studyUids,
    usersByEmail,
  });
  console.log('Worklist states and report seeded');

  await seedSyntheticPatients();
  console.log('Synthetic patients seeded (2 additional)');
}

main()
  .catch((error) => {
    console.error('Seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
