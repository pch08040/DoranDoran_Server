import { IsIn, IsNumber, IsOptional, IsString } from "class-validator";
import { BasePaginationDto } from "src/common/dto/base-pagination.dto";

export class PaginatePostDto extends BasePaginationDto {

    @IsString()
    @IsOptional()
    where__content__i_like: string;
}