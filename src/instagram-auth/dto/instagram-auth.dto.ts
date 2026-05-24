import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class InstagramEditorAuthDto {
  @IsString()
  login!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

export class RegisterInstagramEditorWithAccountDto extends InstagramEditorAuthDto {
  @IsString()
  @MinLength(2)
  username!: string;

  @IsUrl()
  accountUrl!: string;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}
