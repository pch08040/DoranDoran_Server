import { PickType } from "@nestjs/mapped-types";
import { UsersModel } from "src/users/entities/users.entity";

export class RegisterUserDto extends PickType(UsersModel, ["phoneNumber"]){}

// 가입에 필요한 정보는 전화번호
// 틀린 전화번호를 입력했으면 에러 메시지 뱉어내고 프론트에 null값을 보내면 될듯? 그럼 전화번호 인풋 비활성화 안되게하고

// 인증번호랑 전화번호 동시에 인증할땐 