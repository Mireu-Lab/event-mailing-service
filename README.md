# event-mailing-service

## 📖 프로젝트 소개

**ICT 행사 및 스터디 자동 알림이**는 수동으로 공유되던 오프라인 및 온라인 행사, 스터디, 대회 등의 정보를 자동화하여 Google Groups를 통해 메일링으로 알려주는 시스템입니다.

기존에 Discord를 통해 수기로 공지하던 방식을 개선하여, Google Form으로 새로운 행사 정보를 제출받고 Google Apps Script와 Gemini AI를 활용해 자동으로 내용을 분석 및 요약하여 전체 그룹원에게 이메일을 발송하고 구글 캘린더에 일정을 등록합니다.

이 프로젝트는 운영자의 군 입대로 인한 부재중에도 지속적인 정보 공유가 가능하도록 자동화에 초점을 맞추었으며, 참여자들이 유익한 정보를 통해 새로운 기회를 발견하고 성장하기를 바라는 마음으로 시작되었습니다.

## ✨ 주요 기능

*   **Google Form을 통한 간편한 정보 제출:** 누구나 새로운 행사, 스터디, 대회 정보를 URL 형태로 쉽게 제출할 수 있습니다.
*   **Gemini AI 기반 콘텐츠 분석 및 요약:** 제출된 URL의 내용을 AI가 자동으로 분석하여 행사 정보를 정확히 파악하고, 지정된 형식에 맞춰 한국어 이메일 본문을 생성합니다.
*   **콘텐츠 유효성 검사:** AI가 제출된 URL의 내용이 행사, 대회, 스터디와 관련이 있는지 판단하여 관련 없는 정보는 자동으로 필터링합니다.
*   **자동 이메일 발송:** 생성된 이메일 초안은 지정된 Google Group으로 자동 발송되어 모든 그룹원에게 공유됩니다.
*   **Google Calendar 자동 연동:** 이메일 본문에서 날짜와 시간 정보를 추출하여 Google Calendar에 자동으로 이벤트를 생성하고, 메일 본문에 '캘린더에 추가하기' 링크를 포함합니다.
*   **오류 알림 기능:** URL이 유효하지 않거나, 웹사이트에서 정보를 추출할 수 없거나, AI가 관련 없는 콘텐츠로 판단하는 등 오류 발생 시 관리자에게 즉시 이메일로 상황을 알립니다.

## ⚙️ 동작 방식

1.  **정보 제출:** 사용자가 Google Form을 통해 행사 정보가 담긴 URL을 제출합니다.
2.  **스크립트 트리거:** Google Form 제출 이벤트가 발생하면 Google Apps Script의 `onFormSubmit` 함수가 자동으로 실행됩니다.
3.  **콘텐츠 추출:** 스크립트가 제출된 URL의 웹 페이지에 접속하여 HTML에서 텍스트 콘텐츠를 추출합니다.
4.  **AI 분석 및 생성:** 추출된 텍스트를 Gemini AI API로 전송합니다. AI는 다음 작업을 수행합니다.
    *   콘텐츠가 행사, 대회, 스터디와 관련 있는지 판단합니다.
    *   관련이 있다면, 지정된 형식(제목, 내용, 일정 등)에 맞춰 한국어 이메일 초안을 작성합니다.
5.  **캘린더 연동:** 생성된 이메일 본문에서 일정 정보를 파싱하여 Google Calendar에 이벤트를 생성하고, 참석 링크를 만듭니다.
6.  **메일 발송:** 완성된 이메일 본문을 Google Groups 메일 주소로 발송하여 그룹원 전체에게 공지합니다.
7.  **예외 처리:** 과정 중 오류가 발생하면, 제출자의 이메일과 오류 내용을 포함한 알림을 관리자 이메일로 발송합니다.

## 🚀 시작하기

### 설정 방법

`Code.gs` 파일 상단의 설정 변수들을 자신의 환경에 맞게 수정해야 합니다.

```javascript
// ===============================================================
// ✨ 설정 변수 ✨
// 이 부분에 자신의 환경에 맞는 값을 정확히 입력해주세요.
// ===============================================================

// Google AI Studio (https://aistudio.google.com/)에서 발급받은 API 키를 입력하세요.
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";

// 사용할 모델에 맞춰 엔드포인트 URL을 설정하세요.
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent";

// 이메일을 발송할 대상 Google Group의 이메일 주소를 입력하세요.
const GOOGLE_GROUP_EMAIL = "your-group@googlegroups.com";

// 오류 발생 시 알림을 받을 관리자의 이메일 주소를 입력하세요.
const ADMIN_EMAIL = "your-admin-email@gmail.com";

// Google Calendar 이벤트를 생성할 캘린더의 ID를 입력하세요. (예: 'primary' 또는 '...@group.calendar.google.com')
const CALENDAR_ID = "your-calendar-id@group.calendar.google.com";
```

### 트리거 설정

이 스크립트를 Google Form과 연동하여 자동으로 실행되게 하려면 Apps Script 편집기에서 트리거를 설정해야 합니다.

1.  스크립트 편집기에서 **'트리거'** (시계 모양 아이콘) 메뉴로 이동합니다.
2.  **'+ 트리거 추가'** 버튼을 클릭합니다.
3.  다음과 같이 설정을 구성합니다.
    *   **실행할 함수 선택:** `onFormSubmit`
    *   **배포 선택:** `헤드`
    *   **이벤트 소스 선택:** `스프레드시트에서`
    *   **이벤트 유형 선택:** `양식 제출 시`
4.  **저장** 버튼을 클릭하고 필요한 권한을 승인합니다.

## 🔗 관련 링크

*   **메일링 그룹 가입:** [https://groups.google.com/g/ict-event](https://groups.google.com/g/ict-event)
*   **행사/스터디 정보 제출:** [https://forms.gle/kzbzqks6DF2T6uEZ9](https://forms.gle/kzbzqks6DF2T6uEZ9)