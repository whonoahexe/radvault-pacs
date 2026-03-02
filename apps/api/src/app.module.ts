import { DynamicModule, Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { PrismaModule } from './common/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { DicomModule } from './modules/dicom/dicom.module';
import { WorklistModule } from './modules/worklist/worklist.module';
import { ReportModule } from './modules/report/report.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { InternalModule } from './modules/internal/internal.module';

@Module({
  imports: [
    PrismaModule,
    PrometheusModule.register({
      defaultMetrics: { enabled: true },
    }) as unknown as DynamicModule,
    HealthModule,
    DicomModule,
    WorklistModule,
    ReportModule,
    AuthModule,
    AuditModule,
    InternalModule,
  ],
})
export class AppModule {}
