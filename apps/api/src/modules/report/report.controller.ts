import { Body, Controller, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReportService } from './report.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/auth-user.type';
import { UserRole } from '@radvault/types';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { SignReportDto } from './dto/sign-report.dto';
import { AmendReportDto } from './dto/amend-report.dto';
import type { Request } from 'express';

@ApiTags('Reports')
@Controller('api/reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post()
  @Roles(UserRole.Radiologist)
  create(
    @Body() body: CreateReportDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.reportService.create(body, user, req);
  }

  @Put(':id')
  @Roles(UserRole.Radiologist)
  update(
    @Param('id') id: string,
    @Body() body: UpdateReportDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.reportService.update(id, body, user, req);
  }

  @Post(':id/sign')
  @Roles(UserRole.Radiologist)
  sign(
    @Param('id') id: string,
    @Body() body: SignReportDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.reportService.sign(id, body, user, req);
  }

  @Post(':id/amend')
  @Roles(UserRole.Radiologist)
  amend(
    @Param('id') id: string,
    @Body() body: AmendReportDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.reportService.amend(id, body, user, req);
  }

  @Get()
  @Roles(UserRole.Admin, UserRole.Radiologist, UserRole.ReferringPhysician)
  list(
    @Query('studyId') studyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.reportService.list(studyId, user, req);
  }

  @Get(':id')
  @Roles(UserRole.Admin, UserRole.Radiologist, UserRole.ReferringPhysician)
  getById(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.reportService.getById(id, user, req);
  }
}
