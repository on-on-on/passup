// 패스업 설정 — 여기 값만 바꾸면 됩니다.
window.PASSUP_CONFIG = {
  // 입장 코드(기수가 바뀌면 변경). 공지방 링크: https://<주소>/?code=202001
  accessCode: "202001",

  // 오류 신고 구글폼 미리 채우기 링크. {id}, {subject} 자리에 문항 ID와 종목이 들어갑니다.
  reportFormUrl: "https://docs.google.com/forms/d/e/1FAIpQLScgemGekuV-ERba8aguxN9aSpHBjxv4EF7F-M0p9g7L9brsfg/viewform?usp=pp_url&entry.2113545540={id}&entry.1531356175={subject}",

  // 사이트 안에서 바로 보내는 오류 신고(같은 구글폼으로 접수). 폼 질문을 바꾸면 여기 번호도 바꿔야 합니다.
  reportPost: {
    action: "https://docs.google.com/forms/d/e/1FAIpQLScgemGekuV-ERba8aguxN9aSpHBjxv4EF7F-M0p9g7L9brsfg/formResponse",
    id: "entry.2113545540", subject: "entry.1531356175", type: "entry.1713876080", memo: "entry.717769787",
    types: ["정답이 틀린 것 같음", "해설이 이상함", "문제 오타", "화면이 깨짐", "기타"]
  },

  // 시험 일정(한국세무사회 공고 기준). 지난 날짜는 자동으로 건너뜁니다.
  exams: [
    { round: 129, date: "2026-12-05" }
  ],

  logoUrl: "https://on-on-on.github.io/oncoding-courses/logo.png"
};
