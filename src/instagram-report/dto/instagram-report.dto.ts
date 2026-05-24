import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum InstagramReportPeriodType {
  CUSTOM = 'CUSTOM',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  ALL_TIME = 'ALL_TIME',
}

export class InstagramViralVideoDto {
  @IsUrl()
  url!: string;

  @IsInt()
  @Min(1000)
  views!: number;

  @IsInt()
  @Min(0)
  likes!: number;

  @IsDateString()
  publishedAt!: string;

  @IsOptional()
  @IsString()
  title?: string;
}

export class CreateInstagramMetricsReportDto {
  @IsString()
  instagramAccountId!: string;

  @IsEnum(InstagramReportPeriodType)
  periodType!: InstagramReportPeriodType;

  @IsOptional()
  @IsDateString()
  weekStartDate?: string;

  @IsOptional()
  @IsDateString()
  weekEndDate?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsInt()
  @Min(0)
  currentTotalViews!: number;

  @IsInt()
  @Min(0)
  currentTotalLikes!: number;

  @IsInt()
  @Min(0)
  currentVideosCount!: number;
}

export class UpdateInstagramMetricsReportDto {
  @IsOptional()
  @IsEnum(InstagramReportPeriodType)
  periodType?: InstagramReportPeriodType;

  @IsOptional()
  @IsDateString()
  weekStartDate?: string;

  @IsOptional()
  @IsDateString()
  weekEndDate?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  currentTotalViews?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  currentTotalLikes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  currentVideosCount?: number;
}

export class CreateInstagramViralVideosReportDto {
  @IsString()
  instagramAccountId!: string;

  @IsEnum(InstagramReportPeriodType)
  periodType!: InstagramReportPeriodType;

  @IsOptional()
  @IsDateString()
  weekStartDate?: string;

  @IsOptional()
  @IsDateString()
  weekEndDate?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InstagramViralVideoDto)
  videos!: InstagramViralVideoDto[];
}

export class UpdateInstagramViralVideosReportDto {
  @IsOptional()
  @IsEnum(InstagramReportPeriodType)
  periodType?: InstagramReportPeriodType;

  @IsOptional()
  @IsDateString()
  weekStartDate?: string;

  @IsOptional()
  @IsDateString()
  weekEndDate?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InstagramViralVideoDto)
  videos?: InstagramViralVideoDto[];
}

export class RejectInstagramReportDto {
  @IsOptional()
  @IsString()
  rejectReason?: string;
}
