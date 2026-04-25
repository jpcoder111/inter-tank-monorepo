import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';

async function bootstrap() {
  try {
    // Disable default body parser so we can set a larger limit. The /ai/extract-rate
    // route accepts base64-encoded PDFs that easily exceed Express's 100kb default.
    const app = await NestFactory.create(AppModule, { bodyParser: false });

    app.use(json({ limit: '20mb' }));
    app.use(urlencoded({ limit: '20mb', extended: true }));

    // Enable CORS
    app.enableCors({
      origin: true,
      credentials: true,
    });

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    );

    const port = process.env.PORT || 8000;

    await app.listen(port, '0.0.0.0');

    console.log(`Application is running on port ${port}`);
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}
bootstrap();
