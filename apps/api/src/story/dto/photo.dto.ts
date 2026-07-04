import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import type { Photo } from '@auto-stories/api-types';

/** One downscaled photo proxy. Mirrors components/schemas/Photo.yaml. */
export class PhotoDto implements Photo {
  @IsString()
  @Length(1, 64)
  id!: string;

  @IsString()
  @IsNotEmpty()
  b64!: string;

  @IsOptional()
  @IsISO8601()
  takenAt?: string;
}
