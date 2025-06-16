import { IsBooleanString, IsNotEmpty, IsString } from 'class-validator';

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
  @IsBooleanString()
  isInsulated: boolean;
}
