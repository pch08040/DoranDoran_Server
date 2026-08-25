/**
 * 신고 사유. 시안(신고하기-1.png)의 10가지.
 *
 * 값을 한글이 아니라 영문 코드로 둔 이유
 *   DB(데이터베이스 — 데이터를 보관하는 창고)에는 **바뀌지 않는 값**이 들어가야 한다.
 *   "불건전 대화, 사진, 욕설" 같은 문구는 나중에 다듬어질 가능성이 높은데,
 *   그때마다 이미 쌓인 신고 기록의 값과 안 맞게 된다.
 *   화면에 보여줄 문구는 아래 LABELS 에서 꺼내 쓴다.
 *
 *   같은 이유로 에러 코드도 영문으로 두고 있다. → 부록 F
 */
export enum ReportReason {
    PRIVACY_LEAK = 'PRIVACY_LEAK',
    SEXUAL_EXPLOITATION = 'SEXUAL_EXPLOITATION',
    DRUG_TRADE = 'DRUG_TRADE',
    INAPPROPRIATE_MEETING = 'INAPPROPRIATE_MEETING',
    MONEY_REQUEST = 'MONEY_REQUEST',
    PROFILE_THEFT = 'PROFILE_THEFT',
    OFFENSIVE_CONTENT = 'OFFENSIVE_CONTENT',
    PHISHING = 'PHISHING',
    ROMANCE_SCAM = 'ROMANCE_SCAM',
    SEXTORTION = 'SEXTORTION',
}

/** 화면과 로그에 보여줄 문구. 시안 순서 그대로. */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
    [ReportReason.PRIVACY_LEAK]: '개인정보 유출 및 유포',
    [ReportReason.SEXUAL_EXPLOITATION]: '성착취 및 그루밍',
    [ReportReason.DRUG_TRADE]: '마약류 매매',
    [ReportReason.INAPPROPRIATE_MEETING]: '불건전 만남 요구',
    [ReportReason.MONEY_REQUEST]: '금전 요구',
    [ReportReason.PROFILE_THEFT]: '프로필 도용',
    [ReportReason.OFFENSIVE_CONTENT]: '불건전 대화, 사진, 욕설',
    [ReportReason.PHISHING]: '피싱사기 의심',
    [ReportReason.ROMANCE_SCAM]: '로맨스 스캠 의심',
    [ReportReason.SEXTORTION]: '몸캠 피싱 의심',
};

/**
 * 검토가 필요해지는 누적 신고 횟수. (기획서 BE-Report-001)
 *
 * ⚠️ 이 횟수를 넘어도 **자동으로 계정을 막지 않는다.** (2026-08-25 결정)
 *   자동 제재는 악용된다. 세 명이 담합하면 무고한 사람을 쫓아낼 수 있고,
 *   되돌릴 창구도 없다. 지금은 '검토 필요' 표시만 남긴다.
 */
export const REPORT_REVIEW_THRESHOLD = 3;

/** 경고 안내를 보내기 시작하는 누적 횟수. 실제 발송은 Phase 8(알림)에서 붙인다. */
export const REPORT_WARNING_THRESHOLD = 1;
