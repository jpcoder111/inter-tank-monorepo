import { Injectable, Logger } from '@nestjs/common';
import { OcrResponseDto } from './dto/ocr-response.dto';
import * as fs from 'fs';
import * as path from 'path';
import { createWorker } from 'tesseract.js';
import { fromPath } from 'pdf2pic';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  async extractTextFromPdf(file: Express.Multer.File): Promise<OcrResponseDto> {
    try {
      // Validate file
      if (!file || !file.buffer) {
        return {
          success: false,
          text: 'No file provided or file is empty',
        };
      }

      if (file.mimetype !== 'application/pdf') {
        return {
          success: false,
          text: 'File must be a PDF',
        };
      }

      this.logger.log(`Processing PDF file: ${file.originalname}`);

      // Create temporary file for pdf2pic processing
      const tempDir = path.join(process.cwd(), 'temp');

      console.log(tempDir);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFilePath = path.join(
        tempDir,
        `${Date.now()}-${file.originalname}`,
      );

      console.log(tempFilePath);
      fs.writeFileSync(tempFilePath, file.buffer);

      try {
        // Convert PDF to images
        const convert = fromPath(tempFilePath, {
          density: 300, // Higher density for better OCR accuracy
          saveFilename: 'page',
          savePath: tempDir,
          format: 'png',
          width: 2048,
          height: 2048,
        });

        // Convert first page (you can modify this to convert all pages)
        const result = await convert(1, { responseType: 'image' });

        if (!result || !result.path) {
          throw new Error('Failed to convert PDF to image');
        }

        // Perform OCR on the converted image
        const worker = await createWorker('eng');

        this.logger.log('Performing OCR on converted image...');
        const {
          data: { text },
        } = await worker.recognize(result.path);

        await worker.terminate();

        this.cleanupTempFiles([tempFilePath, result.path]);

        const cleanedText = text.trim();

        console.log(cleanedText);

        this.logger.log(
          `OCR completed. Extracted ${cleanedText.length} characters`,
        );

        return {
          success: true,
          text: cleanedText,
        };
      } catch (conversionError) {
        this.logger.error('Error during PDF processing:', conversionError);

        this.cleanupTempFiles([tempFilePath]);

        return {
          success: false,
          text: `Failed to process PDF: ${conversionError.message}`,
        };
      }
    } catch (error) {
      this.logger.error('Error in extractTextFromPdf:', error);
      return {
        success: false,
        text: `OCR processing failed: ${error.message}`,
      };
    }
  }

  private cleanupTempFiles(filePaths: string[]): void {
    filePaths.forEach((filePath) => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        this.logger.warn(`Failed to cleanup temp file ${filePath}:`, error);
      }
    });
  }
}
