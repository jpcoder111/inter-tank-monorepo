import { Injectable } from '@nestjs/common';
import { AiService } from 'src/ai/ai.service';
import { FileService } from 'src/file/file.service';
import {
  CONFIRMATION_SYSTEM_PROMPT,
  CONFIRMATION_SCHEMA,
} from './confirmatino.constants';

@Injectable()
export class ConfirmationService {
  constructor(
    private readonly aiService: AiService,
    private readonly fileService: FileService,
  ) {}

  async createConfirmation(file: Express.Multer.File) {
    const { createdFile, ocrResult } = await this.fileService.uploadFile(file);

    const confirmation = await this.aiService.createMessage(
      ocrResult.text,
      CONFIRMATION_SYSTEM_PROMPT,
      CONFIRMATION_SCHEMA,
    );

    return {
      createdFile,
      confirmation,
    };
  }

  async createConfirmationFile(
    file: Express.Multer.File,
    confirmation: object,
  ) {}
}
