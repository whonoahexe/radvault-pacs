import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WorklistService } from './worklist.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth-user.type';
import { UserRole, WorklistStatus } from '@radvault/types';
import { WorklistQueryDto } from './dto/worklist-query.dto';
import { TransitionWorklistDto } from './dto/transition-worklist.dto';
import { AssignWorklistDto } from './dto/assign-worklist.dto';
import type { Request } from 'express';

@ApiTags('Worklist')
@Controller('api/worklist')
export class WorklistController {
  constructor(private readonly worklistService: WorklistService) {}

  @Get()
  getWorklist(@Query() query: WorklistQueryDto) {
    return this.worklistService.getWorklist(query);
  }

  @Get(':id')
  getWorklistItem(@Param('id') id: string) {
    return this.worklistService.getWorklistItem(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.Radiologist, UserRole.Admin)
  transitionStatus(
    @Param('id') id: string,
    @Body() body: TransitionWorklistDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    if (
      body.status === WorklistStatus.Preliminary ||
      body.status === WorklistStatus.Final ||
      body.status === WorklistStatus.Amended
    ) {
      return this.worklistService.rejectUnsupportedControllerTransition();
    }

    return this.worklistService.transition(id, body.status, user.sub, {
      actorRole: user.role,
      req,
      source: 'controller',
    });
  }

  @Patch(':id/assign')
  @Roles(UserRole.Admin)
  assign(
    @Param('id') id: string,
    @Body() body: AssignWorklistDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.worklistService.assign(id, body.assignedTo, user.sub, req);
  }

  @Patch(':id/unclaim')
  @Roles(UserRole.Radiologist, UserRole.Admin)
  unclaim(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.worklistService.unclaim(id, user, req);
  }
}
