import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WorklistStatus } from '@prisma/client';
import { UserRole } from '@radvault/types';
import { WorklistService } from './worklist.service';

describe('WorklistService', () => {
  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const prisma = {
    worklistItem: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  } as any;

  const service = new WorklistService(prisma, auditService as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Scheduled -> InProgress succeeds and sets assignedTo/startedAt', async () => {
    prisma.worklistItem.findUnique.mockResolvedValue({
      id: 'wl-1',
      status: WorklistStatus.Scheduled,
      assignedTo: null,
      startedAt: null,
    });

    prisma.worklistItem.update.mockImplementation(async ({ where, data }: any) => ({
      id: where.id,
      status: data.status,
      assignedTo: data.assignedTo,
      startedAt: data.startedAt,
    }));

    const result = await service.transition('wl-1', WorklistStatus.InProgress, 'user-1');

    expect(result.status).toBe(WorklistStatus.InProgress);
    expect(result.assignedTo).toBe('user-1');
    expect(result.startedAt).toBeInstanceOf(Date);
  });

  it('InProgress -> Scheduled succeeds and clears assignedTo/startedAt', async () => {
    prisma.worklistItem.findUnique.mockResolvedValue({
      id: 'wl-1',
      status: WorklistStatus.InProgress,
      assignedTo: 'user-1',
      startedAt: new Date(),
    });

    prisma.worklistItem.update.mockImplementation(async ({ where, data }: any) => ({
      id: where.id,
      status: data.status,
      assignedTo: data.assignedTo,
      startedAt: data.startedAt,
    }));

    const result = await service.transition('wl-1', WorklistStatus.Scheduled, 'user-1');

    expect(result.status).toBe(WorklistStatus.Scheduled);
    expect(result.assignedTo).toBeNull();
    expect(result.startedAt).toBeNull();
  });

  it('InProgress -> Preliminary succeeds', async () => {
    prisma.worklistItem.findUnique.mockResolvedValue({
      id: 'wl-1',
      status: WorklistStatus.InProgress,
    });
    prisma.worklistItem.update.mockResolvedValue({
      id: 'wl-1',
      status: WorklistStatus.Preliminary,
    });

    const result = await service.transition('wl-1', WorklistStatus.Preliminary, 'user-1');
    expect(result.status).toBe(WorklistStatus.Preliminary);
  });

  it('Preliminary -> Final succeeds', async () => {
    prisma.worklistItem.findUnique.mockResolvedValue({
      id: 'wl-1',
      status: WorklistStatus.Preliminary,
    });
    prisma.worklistItem.update.mockResolvedValue({
      id: 'wl-1',
      status: WorklistStatus.Final,
      completedAt: new Date(),
    });

    const result = await service.transition('wl-1', WorklistStatus.Final, 'user-1');
    expect(result.status).toBe(WorklistStatus.Final);
    expect(result.completedAt).toBeInstanceOf(Date);
  });

  it('Final -> Amended succeeds', async () => {
    prisma.worklistItem.findUnique.mockResolvedValue({
      id: 'wl-1',
      status: WorklistStatus.Final,
    });
    prisma.worklistItem.update.mockResolvedValue({
      id: 'wl-1',
      status: WorklistStatus.Amended,
      completedAt: new Date(),
    });

    const result = await service.transition('wl-1', WorklistStatus.Amended, 'user-1');
    expect(result.status).toBe(WorklistStatus.Amended);
  });

  it('Scheduled -> Final throws BadRequestException', async () => {
    prisma.worklistItem.findUnique.mockResolvedValue({
      id: 'wl-1',
      status: WorklistStatus.Scheduled,
    });

    await expect(service.transition('wl-1', WorklistStatus.Final, 'user-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('Final -> InProgress throws BadRequestException', async () => {
    prisma.worklistItem.findUnique.mockResolvedValue({
      id: 'wl-1',
      status: WorklistStatus.Final,
    });

    await expect(
      service.transition('wl-1', WorklistStatus.InProgress, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('Controller-source transition to Preliminary throws BadRequestException', async () => {
    prisma.worklistItem.findUnique.mockResolvedValue({
      id: 'wl-1',
      status: WorklistStatus.InProgress,
    });

    await expect(
      service.transition('wl-1', WorklistStatus.Preliminary, 'user-1', {
        source: 'controller',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('Item not found throws NotFoundException', async () => {
    prisma.worklistItem.findUnique.mockResolvedValue(null);

    await expect(
      service.transition('missing', WorklistStatus.InProgress, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getWorklist() sorts by priority then scheduledAt and returns pagination', async () => {
    prisma.worklistItem.findMany.mockResolvedValue([
      {
        id: 'wl-routine',
        priority: 'Routine',
        scheduledAt: new Date('2026-03-01T10:00:00Z'),
      },
      {
        id: 'wl-stat',
        priority: 'Stat',
        scheduledAt: new Date('2026-03-01T12:00:00Z'),
      },
      {
        id: 'wl-urgent',
        priority: 'Urgent',
        scheduledAt: new Date('2026-03-01T08:00:00Z'),
      },
    ]);

    const result = await service.getWorklist({ page: 1, limit: 20 } as any);

    expect(result.pagination.total).toBe(3);
    expect(result.data.map((item) => item.id)).toEqual(['wl-stat', 'wl-urgent', 'wl-routine']);
  });

  it('getWorklistItem() throws NotFoundException when item is missing', async () => {
    prisma.worklistItem.findUnique.mockResolvedValue(null);

    await expect(service.getWorklistItem('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('assign() updates assignedTo and writes audit log', async () => {
    prisma.worklistItem.findUnique.mockResolvedValue({
      id: 'wl-1',
      assignedTo: null,
    });
    prisma.worklistItem.update.mockResolvedValue({
      id: 'wl-1',
      assignedTo: 'rad-2',
    });

    const req = {
      header: jest.fn().mockReturnValue(null),
      ip: '127.0.0.1',
    } as any;

    const updated = await service.assign('wl-1', 'rad-2', 'admin-1', req);

    expect(updated.assignedTo).toBe('rad-2');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'WORKLIST_ASSIGN', resourceId: 'wl-1' }),
    );
  });

  it('unclaim() throws when radiologist is not the assigned user', async () => {
    prisma.worklistItem.findUnique.mockResolvedValue({
      id: 'wl-1',
      assignedTo: 'rad-2',
    });

    await expect(
      service.unclaim(
        'wl-1',
        {
          sub: 'rad-1',
          role: UserRole.Radiologist,
        } as any,
        { header: jest.fn(), ip: '127.0.0.1' } as any,
      ),
    ).rejects.toThrow('Only assigned radiologist can unclaim this worklist item');
  });

  it('unclaim() delegates transition to Scheduled', async () => {
    prisma.worklistItem.findUnique
      .mockResolvedValueOnce({
        id: 'wl-1',
        assignedTo: 'rad-1',
      })
      .mockResolvedValueOnce({
        id: 'wl-1',
        status: WorklistStatus.InProgress,
        assignedTo: 'rad-1',
        startedAt: new Date(),
      });
    prisma.worklistItem.update.mockResolvedValue({
      id: 'wl-1',
      status: WorklistStatus.Scheduled,
      assignedTo: null,
      startedAt: null,
    });

    const result = await service.unclaim(
      'wl-1',
      {
        sub: 'rad-1',
        role: UserRole.Radiologist,
      } as any,
      { header: jest.fn().mockReturnValue(null), ip: '127.0.0.1' } as any,
    );

    expect(result.status).toBe(WorklistStatus.Scheduled);
  });

  it('rejectUnsupportedControllerTransition() throws BadRequestException', () => {
    expect(() => service.rejectUnsupportedControllerTransition()).toThrow(BadRequestException);
  });
});
