import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import type { GenerateRequest, Tone } from '@auto-stories/api-types';
import { PhotoDto } from './photo.dto';

/** Runtime list of the Tone union, for @IsIn validation. */
const TONES: readonly Tone[] = ['funny', 'heartfelt', 'hype', 'chill'];

/** The generate request. Mirrors components/schemas/GenerateRequest.yaml. */
export class GenerateRequestDto implements GenerateRequest {
  @IsString()
  @Length(1, 280)
  story!: string;

  @IsOptional()
  @IsIn(TONES)
  tone?: Tone;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  atmosphere?: string;

  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => PhotoDto)
  photos!: PhotoDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  mustInclude?: string[];
}
