import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);

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
