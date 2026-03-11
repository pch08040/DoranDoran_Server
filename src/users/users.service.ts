import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UsersModel } from './entities/users.entity';
import { Repository } from 'typeorm';
import { GenderEnum } from './const/gender.const';
import { CommonService } from 'src/common/common.service';
import { PaginateUserDto } from './dto/paginate-user.dto';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(UsersModel)
        private readonly userRepository: Repository<UsersModel>,
        private readonly commonService: CommonService,
    ) { }

    async getAllUsers() {
        const users = await this.userRepository.find({
            // relations: ['posts'],
        });

        return {
            data: users,
            count: users.length,
        }
    }

    // 데이터베이스에 유저가 이미 있는지 조회
    async getUserByPhoneNumber(phoneNumber: string) {
        // findOne: 조건에 맞는 데이터 1개만 찾기
        return await this.userRepository.findOne({
            where: {
                phoneNumber,
            }
        })
    }

    // 새로운 유저 생성
    // Partial 내가 원하는 변수들만 바꿀때 사용(전부 초기화시키지 않아도 됨)
    async createUser(userData: Partial<UsersModel>) {
        const newUser = this.userRepository.create(userData);
        return await this.userRepository.save(newUser);
    }

    async updateProfile(userId: number, userData: Partial<UsersModel>) {
        // 전화번호로 임시 유저를 찾음
        const existingUser = await this.userRepository.findOne({
            where: { id: userId }
        });
        // 유저 나머지 정보를 받고 넣으려는데 임시유저 정보가 서버에 없다고 주장하면
        if (!existingUser) {
            throw new NotFoundException('인증된 정보를 찾을 수 없습니다. 다시 인증해주세요.')
        }

        // 필수 유저 정보 확인
        const requiredFields = ['firstName', 'gender', 'age', 'area'];

        const isAllFieldsPresent = requiredFields.every(field =>
            userData[field] !== undefined && userData[field] !== null && userData[field] !== ''
        );

        if(!isAllFieldsPresent){
            throw new BadRequestException('가입 완료를 위해 모든 정보를 입력해주세요!')
        }

        const updateUser = Object.assign(existingUser, {
            ...userData,
            isProfileCompleted: true,
        });

        return await this.userRepository.save(updateUser);
    }


    // 더미 유저 생성
    async createDummyUsers() {
        const seed = Date.now();
        for (let i = 1; i <= 30; i++) {
            // 전화번호는 중복되면 안되므로 01000000001 ~ 01000000030 형식으로 생성
            const phoneNumber = `0${(seed + i).toString().slice(-10)}`;

            await this.userRepository.save({
                phoneNumber,
                firstName: `더미유저${i}`,
                lastName: '도란이',
                age: (20 + (i % 10)).toString(), // 20대 유저들
                area: i % 2 === 0 ? '서울' : '경기',
                gender: i % 2 === 0 ? GenderEnum.MALE : GenderEnum.FEMALE,
                isProfileCompleted: true, // 홈 화면에 보여야 하므로 true
                profileImages: ['/img/basicProfile.png'],
            });
        }
        return { message: '30명의 더미 유저가 생성되었습니다.' };
    }


    // 유저 페이지네이션 부분

    async paginateUsers(dto: PaginateUserDto) {
        return this.commonService.paginate(
            dto,
            this.userRepository,
            {},
            'users',
        )
    }
}