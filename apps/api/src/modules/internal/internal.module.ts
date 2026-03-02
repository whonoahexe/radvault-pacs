import { Module } from '@nestjs/common';
import { OrthancCallbackController } from './orthanc-callback.controller';

@Module({
  controllers: [OrthancCallbackController],
  providers: [],
})
export class InternalModule {}
