import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { GenderEnum } from "../const/gender.const";

// update-profile.dto.ts
export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty({ message: '이름은 반드시 입력해야 합니다.' })
  firstName: string;

  @IsString()
  @IsNotEmpty()
  age: string;

  @IsString()
  @IsNotEmpty()
  area: string;

  @IsEnum(GenderEnum)
  gender: GenderEnum;

  @IsOptional()
  profileImages?: string[] = ['/img/basicProfile.png'];
}