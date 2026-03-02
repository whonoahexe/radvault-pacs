import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { Socket } from 'node:net';
import { PrismaService } from '../../common/prisma.service';

@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly prisma: PrismaService,
  ) {}

  private getRedisConnectionFromUrl(): { host: string; port: number } {
    const redisUrl = process.env.REDIS_URL ?? 'redis://redis:6379';

    try {
      const parsed = new URL(redisUrl);
      return {
        host: parsed.hostname || 'redis',
        port: parsed.port ? Number(parsed.port) : 6379,
      };
    } catch {
      return { host: 'redis', port: 6379 };
    }
  }

  private pingRedisRaw(): Promise<boolean> {
    const { host, port } = this.getRedisConnectionFromUrl();

    return new Promise((resolve) => {
      const socket = new Socket();
      let settled = false;

      const finish = (result: boolean): void => {
        if (!settled) {
          settled = true;
          socket.destroy();
          resolve(result);
        }
      };

      socket.setTimeout(2000);

      socket.on('connect', () => {
        socket.write('*1\r\n$4\r\nPING\r\n');
      });

      socket.on('data', (buffer: Buffer) => {
        const response = buffer.toString('utf8').trim();
        finish(response === '+PONG');
      });

      socket.on('error', () => finish(false));
      socket.on('timeout', () => finish(false));
      socket.on('close', () => finish(false));

      socket.connect(port, host);
    });
  }

  private async databaseIndicator() {
    const indicator = this.healthIndicatorService.check('database');

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return indicator.up();
    } catch {
      return indicator.down();
    }
  }

  private async redisIndicator() {
    const indicator = this.healthIndicatorService.check('redis');
    const ok = await this.pingRedisRaw();

    if (!ok) {
      return indicator.down();
    }

    return indicator.up();
  }

  @Get('health')
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([() => this.databaseIndicator(), () => this.redisIndicator()]);
  }

  @Get('ready')
  @HealthCheck()
  ready(): Promise<HealthCheckResult> {
    return this.health.check([() => this.databaseIndicator(), () => this.redisIndicator()]);
  }
}
