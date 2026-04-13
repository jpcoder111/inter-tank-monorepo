import { IsString } from 'class-validator';

export class CreatePromptVersionDto {
  @IsString()
  model: string;

  @IsString()
  prompt: string;
}
