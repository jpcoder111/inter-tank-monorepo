import {
  Body,
  Controller,
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Public } from '../auth/decorators/plublic.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfirmationService } from './confirmation.service';

@Controller('confirmation')
export class ConfirmationController {
  constructor(private readonly confirmationService: ConfirmationService) {}

  @Public()
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  createConfirmation(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1000000 }),
          new FileTypeValidator({ fileType: 'application/pdf' }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.confirmationService.createConfirmation(file);
  }
}
