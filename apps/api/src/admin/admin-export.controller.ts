import { Controller, Get, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ExportDateRangeQueryDto } from './admin-export.dto';
import { AdminExportService } from './admin-export.service';

// F-ADM-08. ADMIN/STAFF only, same guard stack as the rest of the
// back-office. Binary/text response -- no @ZodResponse, that decorator
// documents a JSON body, these routes never return one.
@Controller('admin/export')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'STAFF')
export class AdminExportController {
  constructor(private readonly adminExportService: AdminExportService) {}

  @Get('orders')
  async orders(@Query() query: ExportDateRangeQueryDto): Promise<StreamableFile> {
    const csv = await this.adminExportService.ordersCsv(query.from, query.to);
    return new StreamableFile(Buffer.from(csv, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="commandes-${query.from}-${query.to}.csv"`,
    });
  }

  @Get('payments')
  async payments(@Query() query: ExportDateRangeQueryDto): Promise<StreamableFile> {
    const csv = await this.adminExportService.paymentsCsv(query.from, query.to);
    return new StreamableFile(Buffer.from(csv, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="paiements-${query.from}-${query.to}.csv"`,
    });
  }
}
