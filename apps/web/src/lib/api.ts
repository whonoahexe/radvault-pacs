import {
  AuditAction,
  type AuditLog,
  type DicomInstance,
  type DicomPatient,
  type DicomSeries,
  type DicomStudy,
  ReportStatus,
  type Report,
  type ReportVersion,
  UserRole,
  type User,
  WorklistPriority,
  WorklistStatus,
  type WorklistItem,
} from '@radvault/types';

export type { DicomStudy, DicomSeries, DicomInstance } from '@radvault/types';

export interface AuthenticatedUser extends Pick<User, 'id' | 'email' | 'fullName' | 'role'> {}

export interface AuthTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

interface AuthBridge {
  getTokens: () => AuthTokens;
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  clearAuth: () => void;
}

let authBridge: AuthBridge | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function configureApiAuth(bridge: AuthBridge): void {
  authBridge = bridge;
}

export interface DicomTagEntry {
  vr: string;
  Value?: unknown[];
}

export type DicomDataset = Record<string, DicomTagEntry>;

export interface WorklistItemWithStudy extends WorklistItem {
  study: DicomStudy & {
    patient: DicomPatient;
    series?: DicomSeries[];
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface ReportWithContext extends Report {
  author?: {
    id: string;
    fullName: string;
  };
  study?: {
    id: string;
    studyInstanceUid?: string;
    referringPhysicianName?: string | null;
  };
  versions?: ReportVersion[];
}

export interface CreateReportPayload {
  studyId: string;
  indication?: string;
  technique?: string;
  comparison?: string;
  findings?: string;
  impression?: string;
}

export interface UpdateReportPayload {
  indication?: string;
  technique?: string;
  comparison?: string;
  findings?: string;
  impression?: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
}

export interface UpdateUserPayload {
  fullName?: string;
  role?: UserRole;
  isActive?: boolean;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: BodyInit | object;
  headers?: HeadersInit;
  auth?: boolean;
  retryOn401?: boolean;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function resolveApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) {
    return configured;
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }
  }

  return '';
}

const API_BASE_URL = resolveApiBaseUrl();

function toAbsoluteUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  if (!API_BASE_URL) {
    return path;
  }

  const normalizedBase = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

async function parseErrorMessage(response: Response): Promise<string> {
  const fallback = 'Request failed. Please try again.';
  const contentType = response.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(payload.message)) {
        return payload.message.join(', ');
      }
      if (typeof payload.message === 'string') {
        return payload.message;
      }
    }

    const text = await response.text();
    if (text) {
      return text;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function toBody(body: BodyInit | object | undefined): BodyInit | undefined {
  if (!body) {
    return undefined;
  }

  if (body instanceof FormData || body instanceof Blob || typeof body === 'string') {
    return body;
  }

  return JSON.stringify(body);
}

async function refreshAccessToken(): Promise<string | null> {
  if (!authBridge) {
    return null;
  }

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const tokens = authBridge?.getTokens();
      if (!tokens?.refreshToken) {
        return null;
      }

      const refreshResponse = await fetch(toAbsoluteUrl('/api/auth/refresh'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });

      if (!refreshResponse.ok) {
        authBridge?.clearAuth();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return null;
      }

      const refreshed = (await refreshResponse.json()) as {
        accessToken: string;
        refreshToken: string;
      };

      authBridge?.setTokens({
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
      });

      return refreshed.accessToken;
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers, auth = true, retryOn401 = true } = options;

  const requestHeaders = new Headers(headers);
  const payload = toBody(body);

  if (
    !requestHeaders.has('content-type') &&
    payload &&
    !(payload instanceof FormData) &&
    !(payload instanceof Blob)
  ) {
    requestHeaders.set('content-type', 'application/json');
  }

  const accessToken = authBridge?.getTokens().accessToken;
  if (auth && accessToken) {
    requestHeaders.set('authorization', `Bearer ${accessToken}`);
  }

  let response = await fetch(toAbsoluteUrl(path), {
    method,
    headers: requestHeaders,
    body: payload,
  });

  if (response.status === 401 && auth && retryOn401 && path !== '/api/auth/refresh') {
    const refreshedToken = await refreshAccessToken();

    if (refreshedToken) {
      requestHeaders.set('authorization', `Bearer ${refreshedToken}`);
      response = await fetch(toAbsoluteUrl(path), {
        method,
        headers: requestHeaders,
        body: payload,
      });
    }

    if (response.status === 401) {
      authBridge?.clearAuth();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new ApiError('Your session has expired. Please sign in again.', 401);
    }
  }

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json') || contentType.includes('application/dicom+json')) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}

function createMultipartRelatedBody(file: File): { body: Blob; contentType: string } {
  const boundary = `radvault-${crypto.randomUUID()}`;
  const preamble = `--${boundary}\r\nContent-Type: application/dicom\r\n\r\n`;
  const closing = `\r\n--${boundary}--\r\n`;

  return {
    body: new Blob([preamble, file, closing]),
    contentType: `multipart/related; type="application/dicom"; boundary=${boundary}`,
  };
}

export const api = {
  auth: {
    login: (payload: { email: string; password: string }) =>
      request<{ accessToken: string; refreshToken: string; user: AuthenticatedUser }>(
        '/api/auth/login',
        {
          method: 'POST',
          auth: false,
          retryOn401: false,
          body: payload,
        },
      ),
    refresh: (refreshToken: string) =>
      request<{ accessToken: string; refreshToken: string }>('/api/auth/refresh', {
        method: 'POST',
        auth: false,
        retryOn401: false,
        body: { refreshToken },
      }),
    logout: (refreshToken: string) =>
      request<void>('/api/auth/logout', {
        method: 'POST',
        body: { refreshToken },
      }),
    me: () => request<AuthenticatedUser>('/api/auth/me'),
  },

  studies: {
    query: (params: {
      PatientName?: string;
      StudyDate?: string;
      ModalitiesInStudy?: string;
      page?: number;
      limit?: number;
      AccessionNumber?: string;
    }) => {
      const searchParams = new URLSearchParams();
      if (params.PatientName) searchParams.set('PatientName', params.PatientName);
      if (params.StudyDate) searchParams.set('StudyDate', params.StudyDate);
      if (params.ModalitiesInStudy) searchParams.set('ModalitiesInStudy', params.ModalitiesInStudy);
      if (params.AccessionNumber) searchParams.set('AccessionNumber', params.AccessionNumber);
      if (params.page) searchParams.set('page', String(params.page));
      if (params.limit) searchParams.set('limit', String(params.limit));

      return request<DicomDataset[]>(`/api/dicom-web/studies?${searchParams.toString()}`);
    },
    series: (studyUid: string) =>
      request<DicomDataset[]>(`/api/dicom-web/studies/${studyUid}/series`),
    instances: (studyUid: string, seriesUid: string) =>
      request<DicomDataset[]>(`/api/dicom-web/studies/${studyUid}/series/${seriesUid}/instances`),
    stow: async (file: File) => {
      const multipart = createMultipartRelatedBody(file);
      return request<DicomDataset>('/api/dicom-web/studies', {
        method: 'POST',
        headers: {
          'content-type': multipart.contentType,
        },
        body: multipart.body,
      });
    },
  },

  worklist: {
    list: (params: {
      status?: WorklistStatus;
      assignedTo?: string;
      priority?: WorklistPriority;
      page?: number;
      limit?: number;
      sort?: 'date_asc' | 'date_desc' | 'priority_desc';
    }) => {
      const searchParams = new URLSearchParams();
      if (params.status) searchParams.set('status', params.status);
      if (params.assignedTo) searchParams.set('assignedTo', params.assignedTo);
      if (params.priority) searchParams.set('priority', params.priority);
      if (params.page) searchParams.set('page', String(params.page));
      if (params.limit) searchParams.set('limit', String(params.limit));
      if (params.sort) searchParams.set('sort', params.sort);
      return request<PaginatedResponse<WorklistItemWithStudy>>(
        `/api/worklist?${searchParams.toString()}`,
      );
    },
    get: (id: string) => request<WorklistItemWithStudy>(`/api/worklist/${id}`),
    status: (id: string, status: WorklistStatus) =>
      request<WorklistItem>(`/api/worklist/${id}/status`, {
        method: 'PATCH',
        body: { status },
      }),
    assign: (id: string, assignedTo: string) =>
      request<WorklistItem>(`/api/worklist/${id}/assign`, {
        method: 'PATCH',
        body: { assignedTo },
      }),
    unclaim: (id: string) =>
      request<WorklistItem>(`/api/worklist/${id}/unclaim`, { method: 'PATCH' }),
  },

  reports: {
    list: (studyId?: string) => {
      const query = studyId ? `?studyId=${encodeURIComponent(studyId)}` : '';
      return request<ReportWithContext[]>(`/api/reports${query}`);
    },
    get: (id: string) => request<ReportWithContext>(`/api/reports/${id}`),
    create: (payload: CreateReportPayload) =>
      request<ReportWithContext>('/api/reports', {
        method: 'POST',
        body: payload,
      }),
    update: (id: string, payload: UpdateReportPayload) =>
      request<ReportWithContext>(`/api/reports/${id}`, {
        method: 'PUT',
        body: payload,
      }),
    sign: (id: string, status: ReportStatus.Preliminary | ReportStatus.Final) =>
      request<ReportWithContext>(`/api/reports/${id}/sign`, {
        method: 'POST',
        body: { status },
      }),
    amend: (id: string, payload: { findings?: string; impression?: string }) =>
      request<ReportWithContext>(`/api/reports/${id}/amend`, {
        method: 'POST',
        body: payload,
      }),
  },

  admin: {
    users: (params?: { role?: UserRole; page?: number; limit?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.role) searchParams.set('role', params.role);
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.limit) searchParams.set('limit', String(params.limit));
      const query = searchParams.toString();
      return request<PaginatedResponse<User>>(`/api/users${query ? `?${query}` : ''}`);
    },
    createUser: (payload: CreateUserPayload) =>
      request<User>('/api/users', {
        method: 'POST',
        body: payload,
      }),
    updateUser: (id: string, payload: UpdateUserPayload) =>
      request<User>(`/api/users/${id}`, {
        method: 'PATCH',
        body: payload,
      }),
    auditLogs: (params?: {
      userId?: string;
      action?: AuditAction;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.userId) searchParams.set('userId', params.userId);
      if (params?.action) searchParams.set('action', params.action);
      if (params?.from) searchParams.set('from', params.from);
      if (params?.to) searchParams.set('to', params.to);
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.limit) searchParams.set('limit', String(params.limit));
      const query = searchParams.toString();
      return request<PaginatedResponse<AuditLog>>(`/api/audit-logs${query ? `?${query}` : ''}`);
    },
  },

  dicom: {
    toStudy(dataset: DicomDataset): DicomStudy {
      const patientNameObj = dataset['00100010']?.Value?.[0] as
        | { Alphabetic?: string }
        | string
        | undefined;
      const patientName =
        typeof patientNameObj === 'string'
          ? patientNameObj
          : (patientNameObj?.Alphabetic ?? 'Unknown');
      const studyDate = (dataset['00080020']?.Value?.[0] as string | undefined) ?? null;
      const modalities = (dataset['00080061']?.Value?.[0] as string | undefined) ?? null;
      const accession = (dataset['00080050']?.Value?.[0] as string | undefined) ?? null;
      const description = (dataset['00081030']?.Value?.[0] as string | undefined) ?? null;
      const studyInstanceUid = (dataset['0020000D']?.Value?.[0] as string | undefined) ?? '';
      const numberOfSeries = Number((dataset['00201206']?.Value?.[0] as string | undefined) ?? 0);
      const numberOfInstances = Number(
        (dataset['00201208']?.Value?.[0] as string | undefined) ?? 0,
      );

      return {
        id: studyInstanceUid,
        patientId: '',
        studyInstanceUid,
        accessionNumber: accession,
        studyDescription: description,
        studyDate,
        studyTime: null,
        modalitiesInStudy: modalities,
        referringPhysicianName: null,
        institutionName: null,
        numberOfSeries,
        numberOfInstances,
        orthancStudyId: null,
        thumbnailPath: (dataset['thumbnailPath']?.Value?.[0] as string | undefined) ?? null,
        dicomTags: dataset,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as DicomStudy;
    },

    toSeries(dataset: DicomDataset, studyId: string): DicomSeries {
      return {
        id: (dataset['0020000E']?.Value?.[0] as string | undefined) ?? '',
        studyId,
        seriesInstanceUid: (dataset['0020000E']?.Value?.[0] as string | undefined) ?? '',
        seriesDescription: (dataset['0008103E']?.Value?.[0] as string | undefined) ?? null,
        modality: (dataset['00080060']?.Value?.[0] as string | undefined) ?? null,
        seriesNumber: Number((dataset['00200011']?.Value?.[0] as string | undefined) ?? 0) || null,
        numberOfInstances: Number((dataset['00201209']?.Value?.[0] as string | undefined) ?? 0),
        orthancSeriesId: null,
        dicomTags: dataset,
        createdAt: new Date(),
      };
    },

    toInstance(dataset: DicomDataset, seriesId: string): DicomInstance {
      return {
        id: (dataset['00080018']?.Value?.[0] as string | undefined) ?? '',
        seriesId,
        sopInstanceUid: (dataset['00080018']?.Value?.[0] as string | undefined) ?? '',
        sopClassUid: (dataset['00080016']?.Value?.[0] as string | undefined) ?? null,
        instanceNumber:
          Number((dataset['00200013']?.Value?.[0] as string | undefined) ?? 0) || null,
        orthancInstanceId: null,
        createdAt: new Date(),
      };
    },
  },
};
