import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

export interface StudyIngestedEvent {
  studyUid: string;
  patientName: string;
  studyDate: string | null;
  modalitiesInStudy: string | null;
  numberOfInstances: number;
  uploadedBy: string;
  timestamp: string;
}

@Injectable()
export class EventsService {
  private readonly studyIngestedSubject = new Subject<StudyIngestedEvent>();

  emitStudyIngested(event: StudyIngestedEvent): void {
    this.studyIngestedSubject.next(event);
  }

  getStudyIngestedStream(): Observable<StudyIngestedEvent> {
    return this.studyIngestedSubject.asObservable();
  }
}
