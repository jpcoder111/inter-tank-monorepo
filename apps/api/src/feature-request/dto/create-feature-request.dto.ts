import { IsString } from 'class-validator';

export class CreateFeatureRequestDto {
  @IsString()
  title: string;

  @IsString()
  description: string;
}
