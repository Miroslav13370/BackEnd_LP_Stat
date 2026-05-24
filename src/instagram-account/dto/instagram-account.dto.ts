import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
} from 'class-validator';

export class CreateInstagramAccountDto {
  @IsString()
  username!: string;

  @IsUrl()
  accountUrl!: string;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}

export class ConnectInstagramEditorDto {
  @IsUUID()
  editorKey!: string;
}

export class UpdateInstagramAuthorContentDto {
  @IsBoolean()
  isAuthorContent!: boolean;
}

export class UpdateInstagramModeratorDto {
  @IsOptional()
  @IsUUID()
  moderatorId?: string | null;
}
