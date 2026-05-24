import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export enum StatisticsPeriodType {
  DAY = 'day',
  MONTH = 'month',
  ALL = 'all',
  CUSTOM = 'custom',
}

export class StatisticsPeriodDto {
  @IsEnum(StatisticsPeriodType)
  periodType: StatisticsPeriodType = StatisticsPeriodType.MONTH;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  forceRefresh?: boolean;
}
