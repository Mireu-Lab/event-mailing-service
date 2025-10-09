// ===============================================================
// ✨ 설정 변수 ✨
// 이 값들은 GitHub Actions의 Secrets를 통해 자동으로 설정됩니다.
// ===============================================================

// 스크립트 속성에서 환경 변수 로드
const scriptProperties = PropertiesService.getScriptProperties();
const GEMINI_API_KEY = scriptProperties.getProperty('GEMINI_API_KEY');
const GOOGLE_GROUP_EMAIL = scriptProperties.getProperty('GOOGLE_GROUP_EMAIL');
const ADMIN_EMAIL = scriptProperties.getProperty('ADMIN_EMAIL');
const CALENDAR_ID = scriptProperties.getProperty('CALENDAR_ID');
const GEMINI_API_URL = scriptProperties.getProperty('GEMINI_API_URL');

// 사용할 모델에 맞춰 엔드포인트 URL을 설정하세요.
// const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent";




// ===============================================================
// 🧪 테스트를 위한 함수
// 스크립트 편집기에서 직접 실행하여 권한 부여 및 기능 테스트를 할 때 사용합니다.
// ===============================================================
function testOnFormSubmit() {
  const mockEvent = {
    response: {
      getItemResponses: function() {
        return [{
          // 여기에 테스트하고 싶은 실제 행사 URL을 입력하세요.
          getResponse: function() { return "https://community.cncf.io/events/details/cncf-virtual-project-events-hosted-by-cncf-presents-kubevirt-summit-2025/"; }
        }];
      },
      getRespondentEmail: function() { return "tester@example.com"; }
    }
  };
  // 실제 메인 로직을 가상 데이터로 실행합니다.
  onFormSubmit(mockEvent);
}


/**
 * 🚀 Google Form 제출 시 자동으로 실행되는 메인 함수입니다.
 * @param {Object} e 폼 제출 시 Google이 자동으로 전달하는 이벤트 객체
 */
function onFormSubmit(e) {
  const respondentEmail = e.response ? e.response.getRespondentEmail() : '알 수 없음';
  let url = "";


  try {
    // 1. URL 가져오기 및 유효성 검사
    url = e.response.getItemResponses()[0].getResponse().trim();
    Logger.log("입력된 URL: '" + url + "'");
    if (!isValidUrl(url)) {
      throw new Error("제출된 URL 형식이 올바르지 않습니다.");
    }


    // 2. 웹 페이지 텍스트 추출
    const rawText = fetchAndParseURL(url);
    if (!rawText || rawText.trim().length < 50) {
      throw new Error("URL에서 유의미한 텍스트 콘텐츠를 추출할 수 없었습니다.");
    }


    // 3. Gemini AI를 호출하여 콘텐츠 검증 및 한국어 이메일 생성
    const generatedContent = callGeminiAPI(rawText);
   
    // 4. AI가 콘텐츠가 관련 없다고 판단한 경우 예외 처리
    if (!generatedContent.isRelevant) {
      throw new Error(`AI가 판단한 관련 없는 콘텐츠입니다. (사유: ${generatedContent.reason})`);
    }


    const emailSubject = generatedContent.title;
    const emailBody = generatedContent.content;
    Logger.log("AI가 생성한 제목: " + emailSubject);


    // 5. 이메일 본문에서 일정 정보 파싱 및 캘린더 작업
    const scheduleInfo = parseScheduleFromText(emailBody);
    let eventLink = "";


    if (scheduleInfo.start) {
      eventLink = generateGoogleCalendarLink(emailSubject, scheduleInfo.start, scheduleInfo.end, emailBody);
      createCalendarEvent(emailSubject, scheduleInfo.start, scheduleInfo.end, emailBody);
      Logger.log("캘린더 이벤트 생성 및 링크 생성을 완료했습니다.");
    } else {
      Logger.log("본문에서 일정을 찾지 못해 캘린더 관련 작업을 건너뜁니다.");
    }
   
    const finalEmailBody = eventLink
      ? `${emailBody}<br/><br/><b>🗓️ <a href="${eventLink}">Google Calendar에 추가하기</a></b>`
      : emailBody;


    // 7. Google Group으로 이메일 발송
    MailApp.sendEmail({
      to: GOOGLE_GROUP_EMAIL, subject: emailSubject, htmlBody: finalEmailBody
    });
    Logger.log(`'${GOOGLE_GROUP_EMAIL}'으로 이메일을 성공적으로 발송했습니다.`);


  } catch (error) {
    const errorMessage = `${error.message}\n\n오류 발생 URL: ${url}`;
    Logger.log(errorMessage);
    notifyAdmin(errorMessage, respondentEmail);
  }
}


/**
 * 🤖 Generative Language API (Gemini)를 호출하고 콘텐츠 검증 및 요약을 수행하는 함수.
 * @param {string} text 분석할 텍스트
 * @return {Object} AI의 분석 결과 JSON 객체
 */
function callGeminiAPI(text) {
  // 사용자가 제공한 스크립트를 프롬프트로 구성
  const gemmaPrompt = `
# 지시문
**목적 :** 우리는 행사 웹사이트를 보고 상세한 검토을 통해 행사를 홍보하는 자원봉사 마케터이다.
**목표 :** 주어진 텍스트가 '행사, 대회, 스터디 모집'과 관련이 있는지 먼저 판단하고, 관련이 있을 경우에만 지정된 형식으로 여러 사용자들에게 정보를 **한국어로** 제공하는 이메일 초안을 작성한다.


# 1단계: 콘텐츠 관련성 판단
주어진 텍스트가 '오프라인/온라인 행사, 대회, 컨퍼런스, 스터디, 연사자 모집' 중 하나와 명확하게 관련이 있는지 판단한다.
- 관련이 있다면: isRelevant 값을 true로 설정한다.
- 관련이 없다면 (예: 일반 뉴스, 블로그, 상품 판매 페이지): isRelevant 값을 false로 설정하고, 관련 없는 이유를 'reason'에 한국어로 간략히 작성한다.


# 2단계: 이메일 작성 (콘텐츠가 관련 있는 경우에만)
아래 형식과 우선순위를 반드시 지켜서 이메일 초안을 **한국어로** 작성한다.


## 제목 작성 형식
|형식|설명|예시|
|---|:---:|---|
|ʻ[오프라인 행사]ʻ|외부활동 컨퍼런스 인경우 (장소가 마련되어있거나 또는 계획중인 경우)|ʻ[오프라인 행사] - 미르 서버 오프라인 컨퍼런스ʻ|
|ʻ[온라인 행사]ʻ|온라인 컨퍼런스 인경우 (장소가 마련되어있지 않고 영상 또는 라이브를 통해 시청해야하는 경우)|ʻ[온라인 행사] - 미르 서버 온라인 컨퍼런스ʻ|
|ʻ[오프라인 대회]ʻ|오프라인 대회 인경우 (장소가 마련되어있거나 또는 계획중인 경우)|ʻ[오프라인 대회] - 미르 서버 온라인 경진대회ʻ|
|ʻ[온라인 대회]ʻ|온라인 대회 인경우 (장소가 마련되어있지 않고 영상 또는 라이브를 통해 시청해야하는 경우)|ʻ[온라인 대회] - 미르 서버 온라인 경진대회ʻ|
|ʻ[연사자 모집]ʻ|컨퍼런스 준비위원회에서 진행하는 연사자 모집인경우|ʻ[연사자 모집] - 미르 서버 온라인 컨퍼런스 연사자 모집ʻ|
|ʻ[스터티 공지]ʻ|행사가 특정 분야를 교육하는 것 인경우 (예시로 구글 스터디잼)|ʻ[스터티 공지] - 2025 구글 스터디잼 ML/DL 연구 스터티 공지ʻ|


## 내용 작성 우선순위 및 주의사항
1.  **주제:** 여러 세션이 있는 경우, 공통 주제를 함축하여 정리한다.
2.  **일정:** **"일정: YYYY-MM-DD HH:MM (UTC+0)"** 형식으로 한 줄에 정확히 작성한다. 또한 **"안내된 시간은 UTC+0 기준이므로, 참여자의 위치에 따라 시간대를 직접 변환해야 합니다."** 라는 문구를 반드시 포함한다.
3.  **지원 방법:** 운영측에서 제공하는 공식 웹사이트, 이메일 등의 지원 수단을 명시한다.
4.  **운영자 연락망:** 운영측의 이메일 또는 소셜 네트워크 서비스 정보를 제공한다.


## 작성 예시 (이와 같은 스타일로 작성)
\`\`\`
KubeVirt Summit Virtual 2025는 10월 16일 (목) 12:00 PM – 4:00 PM (UTC+0)에 개최되는 온라인 컨퍼런스입니다.


KubeVirt Summit은 KubeVirt의 모든 것을 선보이는 연례 온라인 컨퍼런스로, 새로운 기능 소개, 프로덕션 배포, 아키텍처 변경 제안, 심층 튜토리얼 등을 다룹니다.


일정: 2025-10-16 12:00 (UTC+0)
(안내된 시간은 UTC+0 기준이므로, 참여자의 위치에 따라 시간대를 직접 변환해야 합니다.)


주요 토픽:
- KubeVirt를 사용하여 자체 클라우드 구축
- 프로덕션 규모의 KubeVirt 사용
- 보안 및 워크로드 격리


참가 링크:
https://events.cncf.io/kubevirt-summit-virtual-2025/
\`\`\`


# 최종 출력 형식
모든 결과를 아래 JSON 형식에 맞춰 단 하나의 JSON 객체로만 출력해야 한다.
- 관련 있을 때: {"isRelevant": true, "title": "생성된 제목", "content": "HTML 줄바꿈(<br/>)을 포함한 생성된 내용"}
- 관련 없을 때: {"isRelevant": false, "reason": "관련 없는 이유"}


# 분석할 웹사이트 내용:
---
${text}
  `;


  const payload = { "contents": [{ "parts": [{"text": gemmaPrompt}] }] };
  const options = {
    'method': 'post', 'contentType': 'application/json', 'payload': JSON.stringify(payload),
    'headers': { 'X-goog-api-key': GEMINI_API_KEY }, 'muteHttpExceptions': true
  };
 
  const response = UrlFetchApp.fetch(GEMINI_API_URL, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();


  if (responseCode !== 200) {
    throw new Error(`Gemini API 호출 실패. 응답 코드: ${responseCode}, 메시지: ${responseText}`);
  }


  try {
    const responseJson = JSON.parse(responseText);
    const contentText = responseJson.candidates[0].content.parts[0].text;
    const innerJsonString = contentText.match(/```json\n([\s\S]*?)\n```/)[1];
    return JSON.parse(innerJsonString.trim());
  } catch(e) {
    throw new Error(`Gemini API 응답 파싱 실패: ${e.message}. 원본 응답: ${responseText}`);
  }
}


// --- 이하 헬퍼 함수들 ---


function generateGoogleCalendarLink(title, startTime, endTime, description) {
  const formatDateForUrl = (date) => date.toISOString().replace(/-|:|\.\d{3}/g, '');
  const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatDateForUrl(startTime)}/${formatDateForUrl(endTime)}&details=${encodeURIComponent(description.replace(/<br\s*\/?>/gi, '\n'))}`;
  return url;
}


function createCalendarEvent(title, startTime, endTime, description) {
  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
  calendar.createEvent(title, startTime, endTime, {
    description: description.replace(/<br\s*\/?>/gi, '\n')
  });
}


function fetchAndParseURL(url) {
  const response = UrlFetchApp.fetch(url, {'muteHttpExceptions': true});
  const html = response.getContentText();
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim();
}


function parseScheduleFromText(text) {
  // "HH:MM PM/AM" 또는 "HH:MM" 24시간제 형식을 모두 처리
  const match = text.match(/일정:\s*(\d{4}-\d{2}-\d{2})\s*(\d{1,2}:\d{2})\s*([AP]M)?/);
  if (match) {
    let hour = parseInt(match[2].split(':')[0], 10);
    const minute = match[2].split(':')[1];
    const ampm = match[3];


    if (ampm === 'PM' && hour < 12) {
      hour += 12;
    }
    if (ampm === 'AM' && hour === 12) { // 12 AM is 00 hours
      hour = 0;
    }
   
    // ISO 8601 형식(YYYY-MM-DDTHH:mm:ssZ)으로 날짜 문자열 생성. 'Z'는 UTC를 의미.
    const dateString = `${match[1]}T${hour.toString().padStart(2, '0')}:${minute}:00Z`;
    const startDate = new Date(dateString);
   
    if (isNaN(startDate.getTime())) { return { start: null, end: null }; } // 유효하지 않은 날짜인 경우


    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    return { start: startDate, end: endDate };
  }
  return { start: null, end: null };
}


function isValidUrl(urlString) {
  if (!urlString) return false;
  const urlRegex = new RegExp('^(https?:\\/\\/)?'+'((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+'((\\d{1,3}\\.){3}\\d{1,3}))'+'(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+'(\\?[;&a-z\\d%_.~+=-]*)?'+'(\\#[-a-z\\d_]*)?$','i');
  return !!urlRegex.test(urlString);
}


function notifyAdmin(errorMessage, submitterEmail) {
  const subject = "⚠️ Google Form 자동화 스크립트 오류 발생";
  const body = `Google Form 자동화 처리 중 오류가 발생했습니다.<br/><br/><b>오류 내용:</b><pre style="background-color:#f5f5f5; padding:10px; border-radius:5px; white-space:pre-wrap;">${errorMessage}</pre><br/><b>정보 제출자:</b> ${submitterEmail}<br/><br/>확인 후 조치가 필요할 수 있습니다.`;
  MailApp.sendEmail(ADMIN_EMAIL, subject, "", {htmlBody: body});
}

