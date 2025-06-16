import {
  Body,
  Controller,
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseInterceptors,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Public } from '../auth/decorators/plublic.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfirmationService } from './confirmation.service';
import { CreateConfirmationDto } from './dto';
import { Response } from 'express';

@Controller('confirmation')
export class ConfirmationController {
  constructor(private readonly confirmationService: ConfirmationService) {}

  @Public()
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async createConfirmation(
    @Body() createConfirmationDto: CreateConfirmationDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1000000 }),
          new FileTypeValidator({ fileType: 'application/pdf' }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.confirmationService.createConfirmation(
      createConfirmationDto,
      file,
    );

    // Set response headers for file download
    res.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });

    // Return the file buffer as a streamable file
    return new StreamableFile(result.file.buffer);
  }
}
