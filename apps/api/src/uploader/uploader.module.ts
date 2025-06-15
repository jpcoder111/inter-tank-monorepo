import { Module } from '@nestjs/common';
import { UploaderController } from './uploader.controller';
import { FileModule } from 'src/file/file.module';

@Module({
  imports: [FileModule],
  controllers: [UploaderController],
})
export class UploaderModule {}
