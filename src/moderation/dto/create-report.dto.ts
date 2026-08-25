import { IsEnum } from "class-validator";
import { ReportReason } from "../const/report-reason.const";

export class CreateReportDto {
    /**
     * 신고 사유. 앱은 화면에 한글을 보여주고 **영문 코드**를 보낸다.
     * (문구는 나중에 다듬어질 수 있으므로 DB 에는 코드를 남긴다)
     */
    @IsEnum(ReportReason, { message: '신고 사유를 선택해주세요.' })
    reason: ReportReason;
}
