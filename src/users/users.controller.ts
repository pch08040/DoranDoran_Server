import { Controller, Get, Post, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { IsPublic } from 'src/common/decorator/is-public.decorator';
import { UsersModel } from './entities/users.entity';
import { User } from './decorator/user.decorator';
import { PaginateUserDto } from './dto/paginate-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  // @Get()
  // @IsPublic()
  // getUsers() {
  //   return this.usersService.getAllUsers();
  // }

  @Get()
  @IsPublic()
  getPaginateUser(
    @Query() query: PaginateUserDto,
  ) {
    return this.usersService.paginateUsers(query);
  }

  @Post('randomuser')
  @IsPublic()
  postCreateRandomUser() {
    return this.usersService.createDummyUsers();
  }


}
