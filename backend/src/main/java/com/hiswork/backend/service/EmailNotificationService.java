package com.hiswork.backend.service;

import com.hiswork.backend.domain.Document;
import com.hiswork.backend.domain.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailNotificationService {

    @Value("${app.frontend.base-url:http://localhost:5173}")
    private String frontendBaseUrl;

    public void sendReviewerAssignedEmail(Document document, User reviewer, User assignedBy) {
        String reviewLink = frontendBaseUrl + "/documents/" + document.getId() + "/review";
        String subject = "[HisWork] 문서 검토 요청: " + document.getTemplate().getName();
        String body = "안녕하세요, " + reviewer.getName() + "님.\n\n" +
                "다음 문서의 검토가 요청되었습니다.\n" +
                "문서 제목: " + document.getTemplate().getName() + "\n" +
                "요청자: " + assignedBy.getName() + " (" + assignedBy.getEmail() + ")\n\n" +
                "아래 링크에서 문서를 열어 지정된 위치에 서명 또는 작업을 진행해주세요.\n" +
                reviewLink + "\n\n감사합니다.";

        // 실제 메일 전송 시스템이 없다면 로그로 대체
        log.info("[메일전송-모의] 수신자: {}, 제목: {}, 링크: {}", reviewer.getEmail(), subject, reviewLink);
        log.debug("메일 본문:\n{}", body);
    }
}


