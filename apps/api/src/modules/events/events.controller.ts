import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Observable, map } from 'rxjs';
import { EventsService, StudyIngestedEvent } from './events.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@radvault/types';

@ApiTags('Events')
@Controller('api/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  /**
   * Server-Sent Events stream for DICOM ingestion notifications.
   * Emits a `study.ingested` event each time a study is successfully stored.
   *
   * Client usage:
   *   const es = new EventSource('/api/events/ingest');
   *   es.addEventListener('study.ingested', (e) => console.log(JSON.parse(e.data)));
   *
   * Note: EventSource does not support custom request headers in all browsers.
   * Pass the JWT token as the `token` query parameter when connecting from the UI.
   */
  @Sse('ingest')
  @Roles(UserRole.Admin, UserRole.Radiologist, UserRole.Technologist, UserRole.ReferringPhysician)
  studyIngested(): Observable<MessageEvent> {
    return this.eventsService.getStudyIngestedStream().pipe(
      map(
        (event: StudyIngestedEvent): MessageEvent => ({
          data: event,
          type: 'study.ingested',
        }),
      ),
    );
  }
}
