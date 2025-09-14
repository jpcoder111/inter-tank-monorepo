import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateConfirmationDto {
  @IsNotEmpty()
  @IsString()
  customerName: string;

  @IsNotEmpty()
  @IsString()
  customerPhone: string;

  @IsNotEmpty()
  @IsString()
  shipper: string;

  @IsNotEmpty()
  @IsString()
  importer: string;

  @IsNotEmpty()
  @IsString()
  ref: string;

  @IsNotEmpty()
  @IsString()
  incoterm: string;

  @IsNotEmpty()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  isInsulated: boolean;
}
