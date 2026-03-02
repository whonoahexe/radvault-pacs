import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  OnModuleDestroy,
} from '@nestjs/common';
import { Prisma, WorklistPriority, WorklistStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { Request } from 'express';
import { AuditAction, UserRole } from '@radvault/types';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/types/auth-user.type';

interface DicomQueryParams {
  patientName?: string;
  studyDate?: string;
  modalitiesInStudy?: string;
  accessionNumber?: string;
  page?: string;
  limit?: string;
}

interface DicomTagValue {
  vr: string;
  Value?: unknown[];
}

type DicomDataset = Record<string, DicomTagValue>;

interface StowResult {
  statusCode: number;
  contentType: string;
  body: string;
}

function parseRedisUrl(redisUrl: string): { host: string; port: number } {
  try {
    const parsed = new URL(redisUrl);
    return {
      host: parsed.hostname || 'redis',
      port: Number(parsed.port || '6379'),
    };
  } catch {
    return { host: 'redis', port: 6379 };
  }
}

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

function formatDateForDicom(date: Date | null): string | null {
  if (!date) {
    return null;
  }

  const year = date.getUTCFullYear().toString().padStart(4, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
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

@Injectable()
export class DicomService implements OnModuleDestroy {
  private readonly orthancBaseUrl = process.env.ORTHANC_URL ?? 'http://orthanc:8042';
  private readonly queue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {
    const redisConnection = parseRedisUrl(process.env.REDIS_URL ?? 'redis://redis:6379');
    this.queue = new Queue('thumbnail-generation', {
      connection: {
        host: redisConnection.host,
        port: redisConnection.port,
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }

  private normalizeIp(req: Request): string | null {
    const forwardedFor = req.header('x-forwarded-for');
    if (!forwardedFor) {
      return req.ip ?? null;
    }

    return forwardedFor.split(',')[0]?.trim() ?? null;
  }

  private getDicomValue(dataset: DicomDataset, tag: string): unknown {
    return dataset[tag]?.Value?.[0];
  }

  private dicomStudyFromRow(row: {
    patientName: string;
    studyInstanceUid: string;
    studyDate: Date | null;
    modalitiesInStudy: string | null;
    accessionNumber: string | null;
    studyDescription: string | null;
    referringPhysicianName: string | null;
    institutionName: string | null;
    numberOfSeries: number;
    numberOfInstances: number;
  }): Record<string, unknown> {
    return {
      '00100010': { vr: 'PN', Value: [{ Alphabetic: row.patientName }] },
      '0020000D': { vr: 'UI', Value: [row.studyInstanceUid] },
      '00080020': {
        vr: 'DA',
        Value: row.studyDate ? [formatDateForDicom(row.studyDate)] : [],
      },
      '00080061': { vr: 'CS', Value: row.modalitiesInStudy ? [row.modalitiesInStudy] : [] },
      '00080050': { vr: 'SH', Value: row.accessionNumber ? [row.accessionNumber] : [] },
      '00081030': { vr: 'LO', Value: row.studyDescription ? [row.studyDescription] : [] },
      '00080090': {
        vr: 'PN',
        Value: row.referringPhysicianName ? [{ Alphabetic: row.referringPhysicianName }] : [],
      },
      '00080080': { vr: 'LO', Value: row.institutionName ? [row.institutionName] : [] },
      '00201206': { vr: 'IS', Value: [String(row.numberOfSeries)] },
      '00201208': { vr: 'IS', Value: [String(row.numberOfInstances)] },
    };
  }

  private dicomSeriesFromRow(row: {
    seriesInstanceUid: string;
    modality: string | null;
    seriesDescription: string | null;
    seriesNumber: number | null;
    numberOfInstances: number;
  }): Record<string, unknown> {
    return {
      '0020000E': { vr: 'UI', Value: [row.seriesInstanceUid] },
      '00080060': { vr: 'CS', Value: row.modality ? [row.modality] : [] },
      '0008103E': { vr: 'LO', Value: row.seriesDescription ? [row.seriesDescription] : [] },
      '00200011': { vr: 'IS', Value: row.seriesNumber !== null ? [String(row.seriesNumber)] : [] },
      '00201209': { vr: 'IS', Value: [String(row.numberOfInstances)] },
    };
  }

  private dicomInstanceFromRow(row: {
    sopInstanceUid: string;
    sopClassUid: string | null;
    instanceNumber: number | null;
  }): Record<string, unknown> {
    return {
      '00080018': { vr: 'UI', Value: [row.sopInstanceUid] },
      '00080016': { vr: 'UI', Value: row.sopClassUid ? [row.sopClassUid] : [] },
      '00200013': {
        vr: 'IS',
        Value: row.instanceNumber !== null ? [String(row.instanceNumber)] : [],
      },
    };
  }

  private parseStudyUidFromStowResponse(stowResponse: string): string {
    const payload = JSON.parse(stowResponse) as DicomDataset;
    const uri = this.getDicomValue(payload, '00081190');

    if (typeof uri !== 'string') {
      throw new BadGatewayException('Orthanc STOW response missing study URI');
    }

    const studyUid = uri.split('studies/')[1]?.split('/')[0] ?? null;
    if (!studyUid) {
      throw new BadGatewayException('Orthanc STOW response contains invalid study URI');
    }

    return studyUid;
  }

  private async fetchOrthancMetadata(
    studyUid: string,
    authorizationHeader?: string,
  ): Promise<DicomDataset[]> {
    const response = await fetch(`${this.orthancBaseUrl}/dicom-web/studies/${studyUid}/metadata`, {
      method: 'GET',
      headers: authorizationHeader ? { Authorization: authorizationHeader } : undefined,
    });

    if (!response.ok) {
      throw new BadGatewayException('Failed to fetch metadata from Orthanc');
    }

    const data = (await response.json()) as unknown;
    if (!Array.isArray(data)) {
      throw new BadGatewayException('Orthanc metadata response is malformed');
    }

    return data as DicomDataset[];
  }

  private parseDateRange(studyDate: string): { gte?: Date; lte?: Date } {
    const [start, end] = studyDate.split('-');
    if (!start || !end) {
      throw new BadRequestException('StudyDate must be in YYYYMMDD-YYYYMMDD format');
    }

    const startDate = parseDateTag(start);
    const endDate = parseDateTag(end);
    if (!startDate || !endDate) {
      throw new BadRequestException('StudyDate must be in YYYYMMDD-YYYYMMDD format');
    }

    return { gte: startDate, lte: endDate };
  }

  async stowStudies(req: Request, user: AuthenticatedUser): Promise<StowResult> {
    const contentType = req.header('content-type');
    if (!contentType?.toLowerCase().startsWith('multipart/related')) {
      throw new BadRequestException('STOW-RS requires multipart/related content type');
    }

    const orthancUrl = new URL(`${this.orthancBaseUrl}/dicom-web/studies`);
    const client = orthancUrl.protocol === 'https:' ? httpsRequest : httpRequest;

    const responseBody = await new Promise<string>((resolve, reject) => {
      const outbound = client(
        {
          protocol: orthancUrl.protocol,
          hostname: orthancUrl.hostname,
          port: orthancUrl.port,
          method: 'POST',
          path: orthancUrl.pathname,
          headers: {
            'content-type': contentType,
            authorization: req.header('authorization') ?? '',
          },
        },
        (orthancResponse) => {
          const chunks: Buffer[] = [];

          orthancResponse.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });

          orthancResponse.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            if ((orthancResponse.statusCode ?? 500) !== 200) {
              reject(new BadGatewayException(body || 'Orthanc STOW-RS failed'));
              return;
            }

            resolve(body);
          });
        },
      );

      outbound.on('error', (error: Error) => reject(new BadGatewayException(error.message)));
      req.pipe(outbound);
    });

    const studyUid = this.parseStudyUidFromStowResponse(responseBody);
    const metadata = await this.fetchOrthancMetadata(studyUid, req.header('authorization'));

    if (metadata.length === 0) {
      throw new BadGatewayException('Orthanc metadata response is empty');
    }

    const firstDataset = metadata[0];
    const patientId = String(this.getDicomValue(firstDataset, '00100020') ?? '').trim();
    const studyInstanceUid = String(this.getDicomValue(firstDataset, '0020000D') ?? '').trim();

    if (!patientId || !studyInstanceUid) {
      throw new BadGatewayException('Required DICOM tags are missing in metadata');
    }

    const patientName =
      normalizePersonName(this.getDicomValue(firstDataset, '00100010')) ?? 'UNKNOWN';
    const referringPhysicianName = normalizePersonName(
      this.getDicomValue(firstDataset, '00080090'),
    );
    const modalityValues = firstDataset['00080061']?.Value;
    const modalitiesInStudy = Array.isArray(modalityValues)
      ? modalityValues.filter((value): value is string => typeof value === 'string').join('\\')
      : null;

    const firstSopInstanceUid =
      String(this.getDicomValue(firstDataset, '00080018') ?? '').trim() || null;

    await this.prisma.$transaction(async (tx) => {
      const patient = await tx.patient.upsert({
        where: { patientId },
        update: {
          patientName,
          patientBirthDate: parseDateTag(
            String(this.getDicomValue(firstDataset, '00100030') ?? ''),
          ),
          patientSex: String(this.getDicomValue(firstDataset, '00100040') ?? '') || null,
        },
        create: {
          patientId,
          patientName,
          patientBirthDate: parseDateTag(
            String(this.getDicomValue(firstDataset, '00100030') ?? ''),
          ),
          patientSex: String(this.getDicomValue(firstDataset, '00100040') ?? '') || null,
        },
      });

      const study = await tx.study.upsert({
        where: { studyInstanceUid },
        update: {
          patientId: patient.id,
          accessionNumber: String(this.getDicomValue(firstDataset, '00080050') ?? '') || null,
          studyDescription: String(this.getDicomValue(firstDataset, '00081030') ?? '') || null,
          studyDate: parseDateTag(String(this.getDicomValue(firstDataset, '00080020') ?? '')),
          studyTime: String(this.getDicomValue(firstDataset, '00080030') ?? '') || null,
          modalitiesInStudy,
          referringPhysicianName,
          institutionName: String(this.getDicomValue(firstDataset, '00080080') ?? '') || null,
          numberOfSeries: new Set(
            metadata
              .map((dataset) => String(this.getDicomValue(dataset, '0020000E') ?? ''))
              .filter(Boolean),
          ).size,
          numberOfInstances: metadata.length,
          orthancStudyId: studyUid,
          dicomTags: firstDataset as unknown as Prisma.InputJsonValue,
        },
        create: {
          patientId: patient.id,
          studyInstanceUid,
          accessionNumber: String(this.getDicomValue(firstDataset, '00080050') ?? '') || null,
          studyDescription: String(this.getDicomValue(firstDataset, '00081030') ?? '') || null,
          studyDate: parseDateTag(String(this.getDicomValue(firstDataset, '00080020') ?? '')),
          studyTime: String(this.getDicomValue(firstDataset, '00080030') ?? '') || null,
          modalitiesInStudy,
          referringPhysicianName,
          institutionName: String(this.getDicomValue(firstDataset, '00080080') ?? '') || null,
          numberOfSeries: new Set(
            metadata
              .map((dataset) => String(this.getDicomValue(dataset, '0020000E') ?? ''))
              .filter(Boolean),
          ).size,
          numberOfInstances: metadata.length,
          orthancStudyId: studyUid,
          dicomTags: firstDataset as unknown as Prisma.InputJsonValue,
        },
      });

      for (const dataset of metadata) {
        const seriesInstanceUid = String(this.getDicomValue(dataset, '0020000E') ?? '').trim();
        const sopInstanceUid = String(this.getDicomValue(dataset, '00080018') ?? '').trim();

        if (!seriesInstanceUid || !sopInstanceUid) {
          continue;
        }

        const series = await tx.series.upsert({
          where: { seriesInstanceUid },
          update: {
            studyId: study.id,
            seriesDescription: String(this.getDicomValue(dataset, '0008103E') ?? '') || null,
            modality: String(this.getDicomValue(dataset, '00080060') ?? '') || null,
            seriesNumber: Number(this.getDicomValue(dataset, '00200011') ?? 0) || null,
            numberOfInstances: Number(this.getDicomValue(dataset, '00201209') ?? 0) || 1,
            dicomTags: dataset as unknown as Prisma.InputJsonValue,
          },
          create: {
            studyId: study.id,
            seriesInstanceUid,
            seriesDescription: String(this.getDicomValue(dataset, '0008103E') ?? '') || null,
            modality: String(this.getDicomValue(dataset, '00080060') ?? '') || null,
            seriesNumber: Number(this.getDicomValue(dataset, '00200011') ?? 0) || null,
            numberOfInstances: Number(this.getDicomValue(dataset, '00201209') ?? 0) || 1,
            dicomTags: dataset as unknown as Prisma.InputJsonValue,
          },
        });

        await tx.instance.upsert({
          where: { sopInstanceUid },
          update: {
            seriesId: series.id,
            sopClassUid: String(this.getDicomValue(dataset, '00080016') ?? '') || null,
            instanceNumber: Number(this.getDicomValue(dataset, '00200013') ?? 0) || null,
          },
          create: {
            seriesId: series.id,
            sopInstanceUid,
            sopClassUid: String(this.getDicomValue(dataset, '00080016') ?? '') || null,
            instanceNumber: Number(this.getDicomValue(dataset, '00200013') ?? 0) || null,
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
    });

    await this.queue.add('thumbnail-generation', {
      studyId: studyUid,
      instanceId: firstSopInstanceUid,
    });

    void this.auditService.log({
      userId: user.sub,
      action: AuditAction.STUDY_UPLOAD,
      resourceType: 'Study',
      resourceId: null,
      ipAddress: this.normalizeIp(req),
      userAgent: req.header('user-agent') ?? null,
      details: {
        studyUid,
      },
    });

    return {
      statusCode: 200,
      contentType: 'application/dicom+json',
      body: responseBody,
    };
  }

  async queryStudies(
    query: DicomQueryParams,
    user: AuthenticatedUser,
    req: Request,
  ): Promise<Record<string, unknown>[]> {
    const pageNumber = Math.max(Number(query.page ?? 1), 1);
    const limitNumber = Math.min(Math.max(Number(query.limit ?? 20), 1), 100);

    const where: Prisma.StudyWhereInput = {};

    if (query.patientName) {
      where.patient = {
        patientName: {
          contains: query.patientName,
          mode: 'insensitive',
        },
      };
    }

    if (query.studyDate) {
      where.studyDate = this.parseDateRange(query.studyDate);
    }

    if (query.modalitiesInStudy) {
      where.modalitiesInStudy = {
        contains: query.modalitiesInStudy,
        mode: 'insensitive',
      };
    }

    if (query.accessionNumber) {
      where.accessionNumber = {
        contains: query.accessionNumber,
        mode: 'insensitive',
      };
    }

    if (user.role === UserRole.ReferringPhysician) {
      where.referringPhysicianName = user.fullName;
    }

    const studies = await this.prisma.study.findMany({
      where,
      include: {
        patient: {
          select: {
            patientName: true,
          },
        },
      },
      orderBy: [{ studyDate: 'desc' }, { createdAt: 'desc' }],
      skip: (pageNumber - 1) * limitNumber,
      take: limitNumber,
    });

    void this.auditService.log({
      userId: user.sub,
      action: AuditAction.STUDY_VIEW,
      resourceType: 'Study',
      resourceId: null,
      ipAddress: this.normalizeIp(req),
      userAgent: req.header('user-agent') ?? null,
      details: {
        query: JSON.parse(JSON.stringify(query)) as Prisma.InputJsonValue,
      } as Prisma.InputJsonValue,
    });

    return studies.map((study) =>
      this.dicomStudyFromRow({
        patientName: study.patient.patientName,
        studyInstanceUid: study.studyInstanceUid,
        studyDate: study.studyDate,
        modalitiesInStudy: study.modalitiesInStudy,
        accessionNumber: study.accessionNumber,
        studyDescription: study.studyDescription,
        referringPhysicianName: study.referringPhysicianName,
        institutionName: study.institutionName,
        numberOfSeries: study.numberOfSeries,
        numberOfInstances: study.numberOfInstances,
      }),
    );
  }

  async querySeries(
    studyUid: string,
    user: AuthenticatedUser,
    req: Request,
  ): Promise<Record<string, unknown>[]> {
    const study = await this.prisma.study.findUnique({
      where: { studyInstanceUid: studyUid },
      select: {
        id: true,
        referringPhysicianName: true,
      },
    });

    if (!study) {
      throw new BadRequestException('Study not found');
    }

    if (
      user.role === UserRole.ReferringPhysician &&
      study.referringPhysicianName !== user.fullName
    ) {
      throw new BadRequestException('Study not found');
    }

    const series = await this.prisma.series.findMany({
      where: { studyId: study.id },
      orderBy: [{ seriesNumber: 'asc' }, { createdAt: 'asc' }],
    });

    void this.auditService.log({
      userId: user.sub,
      action: AuditAction.STUDY_VIEW,
      resourceType: 'Study',
      resourceId: study.id,
      ipAddress: this.normalizeIp(req),
      userAgent: req.header('user-agent') ?? null,
    });

    return series.map((item) =>
      this.dicomSeriesFromRow({
        seriesInstanceUid: item.seriesInstanceUid,
        modality: item.modality,
        seriesDescription: item.seriesDescription,
        seriesNumber: item.seriesNumber,
        numberOfInstances: item.numberOfInstances,
      }),
    );
  }

  async queryInstances(
    studyUid: string,
    seriesUid: string,
    user: AuthenticatedUser,
    req: Request,
  ): Promise<Record<string, unknown>[]> {
    const study = await this.prisma.study.findUnique({
      where: { studyInstanceUid: studyUid },
      select: {
        id: true,
        referringPhysicianName: true,
      },
    });

    if (!study) {
      throw new BadRequestException('Study not found');
    }

    if (
      user.role === UserRole.ReferringPhysician &&
      study.referringPhysicianName !== user.fullName
    ) {
      throw new BadRequestException('Study not found');
    }

    const series = await this.prisma.series.findUnique({
      where: { seriesInstanceUid: seriesUid },
      select: {
        id: true,
        studyId: true,
      },
    });

    if (!series || series.studyId !== study.id) {
      throw new BadRequestException('Series not found');
    }

    const instances = await this.prisma.instance.findMany({
      where: { seriesId: series.id },
      orderBy: [{ instanceNumber: 'asc' }, { createdAt: 'asc' }],
    });

    void this.auditService.log({
      userId: user.sub,
      action: AuditAction.STUDY_VIEW,
      resourceType: 'Study',
      resourceId: study.id,
      ipAddress: this.normalizeIp(req),
      userAgent: req.header('user-agent') ?? null,
    });

    return instances.map((item) =>
      this.dicomInstanceFromRow({
        sopInstanceUid: item.sopInstanceUid,
        sopClassUid: item.sopClassUid,
        instanceNumber: item.instanceNumber,
      }),
    );
  }
}
