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

      const tempDir = path.join(process.cwd(), 'temp');

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFilePath = path.join(
        tempDir,
        `${Date.now()}-${file.originalname}`,
      );

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

        // Convert all pages
        const imagePaths: string[] = [];
        let pageNum = 1;
        let hasMorePages = true;

        // Convert each page until we run out of pages
        while (hasMorePages) {
          try {
            const result = await convert(pageNum, { responseType: 'image' });
            if (result && result.path) {
              imagePaths.push(result.path);
              this.logger.log(`Converted page ${pageNum}`);
              pageNum++;
            } else {
              hasMorePages = false;
            }
          } catch (error) {
            // No more pages to convert
            hasMorePages = false;
          }
        }

        if (imagePaths.length === 0) {
          throw new Error('Failed to convert PDF to images');
        }

        this.logger.log(`Converted ${imagePaths.length} pages`);

        // Perform OCR on all converted images
        const worker = await createWorker('eng');
        const allText: string[] = [];

        for (let i = 0; i < imagePaths.length; i++) {
          this.logger.log(`Performing OCR on page ${i + 1}...`);
          const {
            data: { text },
          } = await worker.recognize(imagePaths[i]);
          allText.push(text.trim());
        }

        await worker.terminate();

        this.cleanupTempFiles([tempFilePath, ...imagePaths]);

        const cleanedText = allText.join('\n\n--- Page Break ---\n\n');

        this.logger.log(
          `OCR completed. Extracted ${cleanedText.length} characters from ${imagePaths.length} pages`,
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
