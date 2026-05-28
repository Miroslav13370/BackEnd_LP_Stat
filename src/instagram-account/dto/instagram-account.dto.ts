import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
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

export class AddInstagramAccountByModeratorDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  username!: string;
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
