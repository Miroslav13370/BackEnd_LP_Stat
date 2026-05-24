import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

export class createModeratorDTO {
  @IsNotEmpty({ message: 'login не должен быть пустым' })
  @IsString({ message: 'login должен быть строкой' })
  @MinLength(4, {
    message: 'Минимальное количество символов для логина 4 символа',
  })
  login!: string;

  @IsNotEmpty({ message: 'password не должен быть пустым' })
  @IsString({ message: 'password должен быть строкой' })
  @MinLength(6, { message: 'Минимальное количество символов для пароля 6' })
  password!: string;
}

export class connectconnectTikTokUserDTO {
  @IsString({ message: 'moderatorId должен быть строкой' })
  id!: string;

  @IsArray({ message: 'tikTokUsersIds должен быть массивом' })
  @ArrayNotEmpty({ message: 'tikTokUsersIds не должен быть пустым' })
  @IsString({
    each: true,
    message: 'Каждый tikTokUsersIds должен быть строкой',
  })
  tikTokUsersIds!: string[];
}
