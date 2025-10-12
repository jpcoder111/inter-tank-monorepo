import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateConfirmationDto {
  @IsNotEmpty()
  @IsString()
  customerName: string;

  @IsNotEmpty()
  @IsString()
  customerPhone: string;

  @IsOptional()
  @IsString()
  shipper?: string;

  @IsOptional()
  @IsString()
  importer?: string;

  @IsOptional()
  @IsString()
  ref?: string;

  @IsOptional()
  @IsString()
  incoterm?: string;

  @IsNotEmpty()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  isInsulated: boolean;

  @IsNotEmpty()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  isFlexitank: boolean;
}
