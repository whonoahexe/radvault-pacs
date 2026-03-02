import { Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DicomService } from './dicom.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth-user.type';
import { UserRole } from '@radvault/types';
import type { Request, Response } from 'express';

@ApiTags('DICOMweb')
@Controller('api/dicom-web')
export class DicomController {
  constructor(private readonly dicomService: DicomService) {}

  @Post('studies')
  @Roles(UserRole.Technologist, UserRole.Admin)
  async stowStudies(
    @Req() req: Request,
    @Res() res: Response,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    const result = await this.dicomService.stowStudies(req, user);
    res.status(result.statusCode);
    res.setHeader('content-type', result.contentType);
    res.send(result.body);
  }

  @Get('studies')
  @Roles(UserRole.Admin, UserRole.Radiologist, UserRole.Technologist, UserRole.ReferringPhysician)
  async getStudies(
    @Query('PatientName') patientName: string | undefined,
    @Query('StudyDate') studyDate: string | undefined,
    @Query('ModalitiesInStudy') modalitiesInStudy: string | undefined,
    @Query('AccessionNumber') accessionNumber: string | undefined,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.dicomService.queryStudies(
      {
        patientName,
        studyDate,
        modalitiesInStudy,
        accessionNumber,
        page,
        limit,
      },
      user,
      req,
    );
    res.setHeader('content-type', 'application/dicom+json');
    res.status(200).send(result);
  }

  @Get('studies/:studyUID/series')
  @Roles(UserRole.Admin, UserRole.Radiologist, UserRole.Technologist, UserRole.ReferringPhysician)
  async getSeries(
    @Param('studyUID') studyUID: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.dicomService.querySeries(studyUID, user, req);
    res.setHeader('content-type', 'application/dicom+json');
    res.status(200).send(result);
  }

  @Get('studies/:studyUID/series/:seriesUID/instances')
  @Roles(UserRole.Admin, UserRole.Radiologist, UserRole.Technologist, UserRole.ReferringPhysician)
  async getInstances(
    @Param('studyUID') studyUID: string,
    @Param('seriesUID') seriesUID: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.dicomService.queryInstances(studyUID, seriesUID, user, req);
    res.setHeader('content-type', 'application/dicom+json');
    res.status(200).send(result);
  }
}
