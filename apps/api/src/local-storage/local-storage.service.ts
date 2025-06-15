import { Injectable } from '@nestjs/common';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LocalStorageService {
  private uploadsDir: string;
  private baseUrl: string;

  constructor() {
    this.uploadsDir = join(process.cwd(), 'uploads');
    this.baseUrl =
      process.env.LOCAL_FILE_BASE_URL || 'http://localhost:8000/uploads';

    // Ensure uploads directory exists
    if (!existsSync(this.uploadsDir)) {
      mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async uploadFile(file: Express.Multer.File, folder: string = 'uploads') {
    const fileExtension = file.originalname.split('.').pop();
    const filename = `${uuidv4()}.${fileExtension}`;
    const key = `${folder}/${filename}`;

    const folderPath = join(this.uploadsDir, folder);
    if (!existsSync(folderPath)) {
      mkdirSync(folderPath, { recursive: true });
    }

    const filePath = join(folderPath, filename);
    writeFileSync(filePath, file.buffer);

    const url = `${this.baseUrl}/${key}`;

    return { key, url };
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    return `${this.baseUrl}/${key}`;
  }
}
