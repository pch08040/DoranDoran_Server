import { Injectable } from '@nestjs/common';
import { DomainException } from 'src/common/exception/domain.exception';
import { InjectRepository } from '@nestjs/typeorm';
import { UsersModel } from './entities/users.entity';
import { Between, FindOptionsWhere, Not, Repository } from 'typeorm';
import { GenderEnum } from './const/gender.const';
import { CommonService } from 'src/common/common.service';
import { PaginateUserDto } from './dto/paginate-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UserSettingsModel } from './entities/user-settings.entity';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(UsersModel)
        private readonly userRepository: Repository<UsersModel>,
        @InjectRepository(UserSettingsModel)
        private readonly settingsRepository: Repository<UserSettingsModel>,
        private readonly commonService: CommonService,
    ) { }

    async getAllUsers() {
        const users = await this.userRepository.find({
            where:{
                isProfileCompleted: true,
            },
            relations: ['images'],
        });

        return {
            data: users,
            count: users.length,
        }
    }

    async getUserById(userId: number) {
        const user = await this.userRepository.findOne({
            where: {
                id: userId,
            },
            relations: ['images']
        });

        return user;
    }

    /**
     * 다른 사람의 프로필. (기획서 FE-Profile-001)
     *
     * getUserById 와 나눈 이유
     *   getUserById 는 '내 정보'라 전화번호까지 그대로 내려준다.
     *   남의 프로필에 전화번호가 실리면 **익명 서비스의 전제가 깨진다.**
     *   그래서 보여줄 항목만 골라서 담는다.
     */
    async getUserDetail(userId: number) {
        const user = await this.userRepository.findOne({
            where: {
                id: userId,
                // 가입을 끝내지 않은 사람은 프로필이 비어 있으므로 없는 것으로 친다.
                isProfileCompleted: true,
            },
            relations: ['images'],
        });

        if (!user) {
            throw new DomainException('USER_NOT_FOUND');
        }

        return {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            gender: user.gender,
            age: user.age,
            area: user.area,
            bio: user.bio,
            images: user.images,
            // phoneNumber, role, isProfileCompleted 는 일부러 뺐다.
        };
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

    async updateProfile(userId: number, userData: UpdateProfileDto) {
        // 전화번호로 임시 유저를 찾음
        const existingUser = await this.userRepository.findOne({
            where: { id: userId }
        });
        // 유저 나머지 정보를 받고 넣으려는데 임시유저 정보가 서버에 없다고 주장하면
        if (!existingUser) {
            throw new DomainException('USER_NOT_FOUND');
        }

        // 필수 유저 정보 확인
        const requiredFields = ['firstName', 'gender', 'age', 'area'];

        // 각 필수 필드를 돌면서 모든 데이터가 있는지 확인 
        const isAllFieldsPresent = requiredFields.every(field =>
            userData[field] !== undefined && userData[field] !== null && userData[field] !== ''
        );

        if (!isAllFieldsPresent) {
            throw new DomainException('PROFILE_INCOMPLETE');
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
                age: 20 + (i % 10), // 20대 유저들. age 는 숫자 컬럼이다
                // 최신 접속순 정렬을 눈으로 확인하려고 시각을 조금씩 어긋나게 둔다.
                // (전부 같은 시각이면 정렬이 되는지 안 되는지 알 수 없다)
                lastActiveAt: new Date(seed - i * 60_000),
                area: i % 2 === 0 ? '서울' : '경기',
                gender: i % 2 === 0 ? GenderEnum.MALE : GenderEnum.FEMALE,
                isProfileCompleted: true, // 홈 화면에 보여야 하므로 true
                // profileImages 라는 컬럼은 UsersModel에 존재하지 않는다.
                // (TypeORM이 조용히 무시해서 그동안 아무 일도 일어나지 않았음)
                // 프로필 사진은 ImageModel 관계로 따로 저장되며,
                // 사진이 없으면 UsersModel의 @Transform이 기본 프로필을 대신 내려준다.
            });
        }
        return { message: '30명의 더미 유저가 생성되었습니다.' };
    }


    // 유저 페이지네이션 부분

    async paginateUsers(dto: PaginateUserDto) {
        return this.commonService.paginate(
            dto,
            this.userRepository,
            {
                relations: ['images'],
            },
            'users',
        )
    }

    // ── 만날 친구 설정 ────────────────────────────────────────────

    /**
     * 내 설정을 읽는다. 아직 없으면 기본값으로 만들어서 돌려준다.
     *
     * '없으면 만든다'로 한 이유
     *   가입 시점에 설정을 같이 만들면, 나중에 설정 항목이 늘어날 때
     *   이미 가입한 사람들에게는 그 항목이 없는 상태가 된다.
     *   읽을 때 만들면 항상 최신 기본값이 채워진다.
     */
    async getSettings(userId: number) {
        const existing = await this.settingsRepository.findOne({
            where: { user: { id: userId } },
        });

        if (existing) return existing;

        return await this.settingsRepository.save(
            this.settingsRepository.create({ user: { id: userId } }),
        );
    }

    /** 만날 친구 설정을 저장한다. (기획서 FE-Setting-001~004) */
    async updateSettings(userId: number, dto: UpdateSettingsDto) {
        const settings = await this.getSettings(userId);

        // 보내온 항목만 바꾼다.
        //   · 아예 안 보냄(undefined) → 그대로 둔다
        //   · null 을 보냄           → '전체'로 바꾼다
        // 둘을 같게 취급하면 "전체로 바꿔줘"가 "안 바꿈"이 돼버린다.
        if (dto.area !== undefined) settings.area = dto.area;
        if (dto.gender !== undefined) settings.gender = dto.gender;
        if (dto.minAge !== undefined) settings.minAge = dto.minAge;
        if (dto.maxAge !== undefined) settings.maxAge = dto.maxAge;

        // 화면에서 슬라이더를 거꾸로 잡으면 최소가 최대보다 커질 수 있다.
        // 그대로 두면 조건에 맞는 사람이 한 명도 없어서 '아무도 없음'만 보인다.
        if (settings.minAge > settings.maxAge) {
            throw new DomainException(
                'VALIDATION_FAILED',
                '나이 범위를 다시 확인해주세요.',
            );
        }

        return await this.settingsRepository.save(settings);
    }

    // ── 홈 화면 친구 목록 ──────────────────────────────────────────

    /**
     * 내 설정에 맞는 친구 목록. (기획서 BE-Setting-001 / BE-Setting-003)
     *
     * 정렬은 **최신 접속순**이다. 가입일순으로 두면 오래된 회원이 영원히
     * 아래에 깔려서, 지금 실제로 쓰고 있는 사람이 안 보인다.
     */
    async getRecommendations(userId: number, dto: PaginateUserDto) {
        const settings = await this.getSettings(userId);

        const where: FindOptionsWhere<UsersModel> = {
            // 가입을 끝낸 사람만. 전화번호 인증만 하고 만 사람은 프로필이 비어 있다.
            isProfileCompleted: true,
            // 나 자신은 뺀다.
            id: Not(userId),
            // 나이 범위. age 가 숫자 컬럼이라 범위 비교가 제대로 동작한다.
            age: Between(settings.minAge, settings.maxAge),
        };

        // null 은 '전체'라는 뜻이므로 조건을 아예 걸지 않는다.
        if (settings.area) where.area = settings.area;
        if (settings.gender) where.gender = settings.gender;

        return this.commonService.paginate(
            dto,
            this.userRepository,
            {
                where,
                relations: ['images'],
                /**
                 * 최신 접속순.
                 *
                 * ⚠️ nulls: 'LAST' 를 빼면 안 된다.
                 *   PostgreSQL 은 DESC 정렬에서 NULL 을 가장 큰 값으로 취급한다.
                 *   그래서 그냥 두면 **한 번도 접속한 적 없는 유저가 맨 위에** 온다.
                 *   기획 의도(활동 중인 사람을 먼저)와 정반대가 된다.
                 */
                order: { lastActiveAt: { direction: 'DESC', nulls: 'LAST' } },
            },
            'users/recommendations',
        );
    }

    /**
     * 마지막 접속 시각을 지금으로 갱신한다.
     *
     * 매 요청마다 DB 를 쓰면 부담이 크므로, 홈 목록을 부를 때만 갱신한다.
     * (앱을 켜면 홈을 한 번은 부르게 되어 있다)
     */
    async touchLastActive(userId: number) {
        await this.userRepository.update(userId, { lastActiveAt: new Date() });
    }
}