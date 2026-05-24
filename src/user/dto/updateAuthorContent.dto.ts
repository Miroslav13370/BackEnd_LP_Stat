import { IsBoolean, IsString } from 'class-validator';

export class updateAuthorContentDto {
  @IsString({ message: 'tiktokUserId должен быть строкой' })
  tiktokUserId!: string;

  @IsBoolean({ message: 'isAuthorContent должен быть буллевым выражением' })
  isAuthorContent!: boolean;
}
