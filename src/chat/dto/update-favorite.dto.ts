import { IsBoolean } from 'class-validator';

/** 즐겨찾기 켜기/끄기. (시안: 이야기 목록을 옆으로 밀면 나오는 하트) */
export class UpdateFavoriteDto {
    /**
     * 켤 건지 끌 건지를 **앱이 정해서 보낸다.** '토글'이 아니다.
     *
     * 토글(서버가 알아서 뒤집기)로 하면, 통신이 느려 버튼을 두 번 눌렀을 때
     * 두 요청이 다 도착해 원래대로 돌아온다. 화면은 켜져 있는데 서버는 꺼져 있게 된다.
     * 원하는 상태를 그대로 보내면 몇 번을 보내든 결과가 같다.
     */
    @IsBoolean({ message: '즐겨찾기 값이 올바르지 않아요.' })
    isFavorite: boolean;
}
