export enum UserRole {
  Admin = 'Admin',
  Radiologist = 'Radiologist',
  Technologist = 'Technologist',
  ReferringPhysician = 'ReferringPhysician',
}

export enum WorklistStatus {
  Scheduled = 'Scheduled',
  InProgress = 'InProgress',
  Preliminary = 'Preliminary',
  Final = 'Final',
  Amended = 'Amended',
}

export enum WorklistPriority {
  Stat = 'Stat',
  Urgent = 'Urgent',
  Routine = 'Routine',
}

export enum ReportStatus {
  Draft = 'Draft',
  Preliminary = 'Preliminary',
  Final = 'Final',
  Amended = 'Amended',
  Addended = 'Addended',
}

export enum AuditAction {
  LOGIN = 'LOGIN',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  STUDY_VIEW = 'STUDY_VIEW',
  STUDY_UPLOAD = 'STUDY_UPLOAD',
  REPORT_CREATE = 'REPORT_CREATE',
  REPORT_UPDATE = 'REPORT_UPDATE',
  REPORT_SIGN_PRELIMINARY = 'REPORT_SIGN_PRELIMINARY',
  REPORT_SIGN_FINAL = 'REPORT_SIGN_FINAL',
  REPORT_AMEND = 'REPORT_AMEND',
  WORKLIST_CLAIM = 'WORKLIST_CLAIM',
  WORKLIST_UNCLAIM = 'WORKLIST_UNCLAIM',
  WORKLIST_ASSIGN = 'WORKLIST_ASSIGN',
  TOKEN_REUSE_DETECTED = 'TOKEN_REUSE_DETECTED',
  USER_CREATE = 'USER_CREATE',
  USER_UPDATE = 'USER_UPDATE',
}

export interface DicomPatient {
  id: string;
  patientId: string;
  patientName: string;
  patientBirthDate: string | null;
  patientSex: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DicomStudy {
  id: string;
  patientId: string;
  studyInstanceUid: string;
  accessionNumber: string | null;
  studyDescription: string | null;
  studyDate: string | null;
  studyTime: string | null;
  modalitiesInStudy: string | null;
  referringPhysicianName: string | null;
  institutionName: string | null;
  numberOfSeries: number;
  numberOfInstances: number;
  orthancStudyId: string | null;
  thumbnailPath: string | null;
  dicomTags: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DicomSeries {
  id: string;
  studyId: string;
  seriesInstanceUid: string;
  seriesDescription: string | null;
  modality: string | null;
  seriesNumber: number | null;
  numberOfInstances: number;
  orthancSeriesId: string | null;
  dicomTags: Record<string, unknown> | null;
  createdAt: Date;
}

export interface DicomInstance {
  id: string;
  seriesId: string;
  sopInstanceUid: string;
  sopClassUid: string | null;
  instanceNumber: number | null;
  orthancInstanceId: string | null;
  createdAt: Date;
}

export interface WorklistItem {
  id: string;
  studyId: string;
  assignedTo: string | null;
  status: WorklistStatus;
  priority: WorklistPriority;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Report {
  id: string;
  studyId: string;
  authorId: string;
  status: ReportStatus;
  indication: string | null;
  technique: string | null;
  comparison: string | null;
  findings: string | null;
  impression: string | null;
  signedBy: string | null;
  signedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportVersion {
  id: string;
  reportId: string;
  versionNumber: number;
  indication: string | null;
  technique: string | null;
  comparison: string | null;
  findings: string | null;
  impression: string | null;
  authorId: string;
  statusAtVersion: string;
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  isRevoked: boolean;
  expiresAt: Date;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  action: AuditAction;
  resourceType: string | null;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: Record<string, unknown> | null;
  createdAt: Date;
}
