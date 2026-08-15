import { Controller, Get, Param, StreamableFile, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InvoicesService } from './invoices.service';

// F-PAY-05. Binary response -- no @ZodResponse (that decorator documents a
// JSON body, this route never returns one).
@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get(':id/pdf')
  async downloadPdf(
    @CurrentUser() userId: string,
    @Param('id') id: string,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.invoicesService.downloadPdf(userId, id);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
