import type { CrawlingTarget } from '@llm-newsletter-kit/core';

import { newsletterConfig } from '~/config';

/**
 * Creates an HTML template for the newsletter email
 *
 * This function generates a responsive email template with:
 * - Light/dark mode support
 * - Mobile-friendly design
 * - Brand-specific styling
 * - List of crawling sources
 * - Publication policy information
 * - Platform introduction
 *
 * @param targets - Array of crawling targets to be listed in the newsletter footer
 * @returns Complete HTML string for the newsletter email
 *
 * @example
 * ```typescript
 * const html = createNewsletterHtmlTemplate([
 *   { id: '1', name: 'Source 1', url: 'https://example.com', ... }
 * ]);
 * ```
 */
export const createNewsletterHtmlTemplate = (
  targets: CrawlingTarget[],
) => `<!DOCTYPE html>
<html lang="ko" style="color-scheme: light dark; supported-color-schemes: light dark;">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style type="text/css">
      a:hover {
          color: #D2691E !important;
      }
      .button-link {
          color: #fff !important;
          background: #D2691E;
          padding: 10px 28px;
          border-radius: 5px;
          text-decoration: none !important;
          font-weight: bold;
          font-size: 16px;
          display: inline-block;
          letter-spacing: 0.5px;
      }
      .button-link:hover {
          background: #b85a1a !important;
      }

      html {
          color-scheme: light dark;
          supported-color-schemes: light dark;
      }

      body {
          -webkit-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          background-color: #f4f4f4;
          font-size: 16px;
          line-height: 1.7;
          letter-spacing: 0.01em;
          height: 100%;
          width: 100%;
          margin: 0;
          padding: 0;
      }

      .main-table {
          -webkit-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
          mso-table-lspace: 0pt;
          mso-table-rspace: 0pt;
      }

      .outer-cell {
          -webkit-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
          mso-table-lspace: 0pt;
          mso-table-rspace: 0pt;
          padding: 20px 0;
      }

      .container {
          -webkit-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
          mso-table-lspace: 0pt;
          mso-table-rspace: 0pt;
          max-width: 800px;
      }

      .content-cell {
          -webkit-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
          mso-table-lspace: 0pt;
          mso-table-rspace: 0pt;
          padding: 44px 44px 36px 44px;
          border-radius: 12px;
          box-shadow: 0 4px 18px rgba(0,0,0,0.07);
      }

      .logo-container {
          margin-bottom: 32px;
      }

      .light-logo {
          text-align: left;
          display: block;
      }

      .dark-logo {
          text-align: left;
          display: none;
      }

      .logo-img {
          -ms-interpolation-mode: bicubic;
          border: 0;
          height: auto;
          line-height: 100%;
          outline: none;
          text-decoration: none;
          display: block;
          margin-bottom: 12px;
      }

      h1 {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          line-height: 1.2;
          margin: 0 0 18px 0;
          letter-spacing: -0.5px;
          margin-top: 0;
          font-size: 28px;
          font-weight: bold;
          color: #111111;
          border-bottom: 3px solid #D2691E;
          padding-bottom: 8px;
          margin-bottom: 24px;
      }

      p {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          font-size: 16px;
          line-height: 1.7;
          color: #444444;
          margin: 0 0 18px 0;
      }

      .strong-text {
          color: #D2691E;
          font-weight: bold;
      }

      hr {
          border: 0;
          border-top: 2px solid #D2691E;
          margin: 32px 0;
      }

      h2 {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          font-size: 24px;
          font-weight: bold;
          line-height: 1.3;
          color: #D2691E;
          margin: 0 0 16px 0;
          letter-spacing: -0.2px;
          border-left: 5px solid #D2691E;
          padding-left: 12px;
          background: none;
      }

      ul {
          padding-left: 24px;
          margin: 0 0 18px 0;
      }

      ol {
          padding-left: 24px;
          margin: 0 0 18px 0;
      }

      li {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          font-size: 16px;
          line-height: 1.7;
          color: #444444;
          margin: 0 0 18px 0;
          margin-bottom: 8px;
      }

      h3 {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          font-size: 18px;
          font-weight: bold;
          line-height: 1.3;
          color: #D2691E;
          margin: 0 0 12px 0;
          letter-spacing: -0.1px;
      }

      .link-style {
          -webkit-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
          color: #0056b3;
          text-decoration: underline;
          font-weight: bold;
          transition: color 0.2s;
      }

      .data-table {
          -webkit-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
          mso-table-lspace: 0pt;
          mso-table-rspace: 0pt;
          width: 100%;
          border-collapse: collapse;
          margin: 0 0 18px 0;
      }

      .table-th {
          border: 1px solid #e5e5e5;
          padding: 12px 8px;
          text-align: left;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          font-size: 15px;
          background-color: #f2e6dd;
          font-weight: bold;
          color: #D2691E;
      }

      .content-cell table {
          width: 100%;
          border-collapse: collapse;
          margin: 0 0 18px 0;
      }
      .content-cell th,
      .content-cell td {
          border: 1px solid #e5e5e5;
          padding: 12px 8px;
          text-align: left;
          font-size: 15px;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      }
      .content-cell thead th {
          background-color: #f2e6dd;
          color: #D2691E;
          font-weight: bold;
      }
      .content-cell tbody tr:nth-child(even) td {
          background-color: #faf7f3;
      }

      @media screen and (max-width: 800px) {
          .container {
              width: 100% !important;
              max-width: 100% !important;
              padding: 0 !important;
          }

          .content-cell {
              padding: 20px !important;
          }
      }
      @media screen and (max-width: 600px) {
          h1 {
              font-size: 22px !important;
          }

          h2 {
              font-size: 18px !important;
          }

          .content-cell {
              padding: 12px !important;
          }
      }
      @media (prefers-color-scheme: dark) {
          body,
          .dark-mode-bg {
              background-color: #121212 !important;
          }

          .dark-mode-content-bg {
              background-color: #1e1e1e !important;
              box-shadow: 0 4px 10px rgba(0,0,0,0.25) !important;
          }

          h1 {
              color: #ffffff !important;
              border-bottom: 3px solid #E59866 !important;
          }

          h2,
          h3 {
              color: #E59866 !important;
              border-left-color: #E59866 !important;
          }

          p,
          li {
              color: #eeeeee !important;
          }

          a:not(.button-link) {
              color: #4da6ff !important;
              text-decoration: underline !important;
          }

          a.button-link {
              background: #E59866 !important;
              color: #222 !important;
          }

          strong {
              color: #E59866 !important;
          }

          hr,
          .section-divider {
              border-top-color: #E59866 !important;
              background: linear-gradient(90deg, #E59866 0%, #121212 100%) !important;
          }

          blockquote {
              background-color: #2b2b2b !important;
              border-left-color: #E59866 !important;
          }

          blockquote p {
              color: #E59866 !important;
          }

          code {
              background-color: #333333 !important;
              color: #E59866 !important;
          }

          pre {
              background-color: #2d2d2d !important;
              color: #f2f2f2 !important;
              border: 1px solid #444 !important;
          }

          .container table th,
          .container table td {
              border-color: #444444 !important;
          }

          .container table th {
              background-color: #333333 !important;
              color: #E59866 !important;
          }

          .container table td strong {
              color: #E59866 !important;
          }

          .container table tr:nth-child(even) td {
              background-color: #23201c !important;
          }

          .button-cell {
              background-color: #E59866 !important;
          }

          .button-link {
              color: #222 !important;
              background: #E59866 !important;
          }

          .footer-text {
              color: #999999 !important;
          }

          .footer-link {
              color: #999999 !important;
              text-decoration: underline !important;
          }

          .dark-logo {
              display: block !important;
          }

          .light-logo {
              display: none !important;
          }

          .content-cell th,
          .content-cell td {
              border-color: #444444 !important;
          }
          .content-cell thead th {
              background-color: #333333 !important;
              color: #E59866 !important;
          }
          .content-cell tbody tr:nth-child(even) td {
              background-color: #23201c !important;
          }

      }
  </style>
</head>
<body style="-webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; font-size: 16px; line-height: 1.7; letter-spacing: 0.01em; height: 100%; width: 100%; margin: 0; padding: 0;">
<table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="-webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
  <tr>
    <td bgcolor="#f4f4f4" align="center" style="-webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; mso-table-lspace: 0pt; mso-table-rspace: 0pt; padding: 20px 0;" class="dark-mode-bg">
      <!--[if (gte mso 9)|(IE)]>
      <table align="center" border="0" cellspacing="0" cellpadding="0" width="800">
        <tr>
          <td align="center" valign="top" width="800">
      <![endif]-->
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="-webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; mso-table-lspace: 0pt; mso-table-rspace: 0pt; max-width: 800px;" class="container" role="presentation">
        <tr>
          <td bgcolor="#ffffff" align="left" class="content-cell dark-mode-content-bg" style="-webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; mso-table-lspace: 0pt; mso-table-rspace: 0pt; padding: 44px 44px 36px 44px; border-radius: 12px; box-shadow: 0 4px 18px rgba(0,0,0,0.07);">
            <div style="margin-bottom: 32px;">
              <div style="text-align: left; display: block;" class="light-logo">
                <img src="https://heripo.com/heripo-logo.png" width="150" alt="로고" style="-ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; display: block; margin-bottom: 12px;" height="auto">
              </div>
              <!--[if !mso]><!-->
              <div style="text-align: left; display: none;" class="dark-logo">
                <img src="https://heripo.com/heripo-logo-dark.png" width="150" alt="다크모드 로고" style="-ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; display: block; margin-bottom: 12px;" height="auto">
              </div>
              <!--<![endif]-->
            </div>

            {{NEWSLETTER_CONTENT}}

            <hr style="border: 0; border-top: 2px solid #D2691E; margin: 32px 0;">
            <h2 style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 24px; font-weight: bold; line-height: 1.3; color: #D2691E; margin: 0 0 16px 0; letter-spacing: -0.2px; border-left: 5px solid #D2691E; padding-left: 12px; background: none;">🔍 뉴스레터 출처</h2>
            <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 18px 0;">모든 소식은 다음 출처에서 수집됩니다:</p>
            <ul style="padding-left: 24px; margin: 0 0 18px 0;">
              ${targets
                .map(
                  (target) => `
                <li style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 18px 0; margin-bottom: 8px;"><a href="${target.url}" target="_blank">${target.name}</a></li>
              `,
                )
                .join('\n')}
            </ul>
            <hr style="border: 0; border-top: 2px solid #D2691E; margin: 32px 0;">
            <h2 style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 24px; font-weight: bold; line-height: 1.3; color: #D2691E; margin: 0 0 16px 0; letter-spacing: -0.2px; border-left: 5px solid #D2691E; padding-left: 12px; background: none;">📅 발행 정책</h2>
            <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 18px 0;"><strong>heripo 리서치 레이더</strong>는 매일 발행을 원칙으로 하되, 독자분들께 의미 있는 정보를 제공하기 위해 다음과 같은 발행 기준을 적용합니다:</p>
            <ul style="padding-left: 24px; margin: 0 0 18px 0;">
              <li style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 18px 0; margin-bottom: 8px;"><strong>정상 발행</strong>: 새로운 소식이 ${newsletterConfig.publicationCriteria.minimumArticleCountForIssue + 1}개 이상이거나, ${newsletterConfig.publicationCriteria.minimumArticleCountForIssue}개 이하여도 중요도 ${newsletterConfig.publicationCriteria.priorityArticleScoreThreshold}점 이상의 핵심 소식이 포함된 경우</li>
              <li style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 18px 0; margin-bottom: 8px;"><strong>이월 발행</strong>: 새로운 소식이 ${newsletterConfig.publicationCriteria.minimumArticleCountForIssue}개 이하이면서 중요한 내용(${newsletterConfig.publicationCriteria.priorityArticleScoreThreshold}점 이상)이 없을 경우, 다음 호로 이월하여 더 풍성한 내용으로 제공</li>
              <li style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 18px 0; margin-bottom: 8px;"><strong>통합 발행</strong>: 이월된 소식과 새로운 소식을 함께 발행하여 보다 종합적인 업계 동향을 전달</li>
            </ul>
            <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 18px 0;">이러한 정책을 통해 매일 의미 없는 소식으로 독자분들의 시간을 낭비하지 않고, 정말 중요한 정보를 적절한 타이밍에 제공하고자 합니다.</p>
            <hr style="border: 0; border-top: 2px solid #D2691E; margin: 32px 0;">
            <h2 style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 24px; font-weight: bold; line-height: 1.3; color: #D2691E; margin: 0 0 16px 0; letter-spacing: -0.2px; border-left: 5px solid #D2691E; padding-left: 12px; background: none;">🔍 heripo(헤리포) 플랫폼 소개</h2>
            <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 18px 0;">지능형 고고학 연구 플랫폼 heripo는 <a href="https://poc.heripo.com" target="_blank">「대형 언어 모델(LLM)을 활용한 고고학 정보화 연구」 논문</a>에 기반한 후속 연구 프로젝트로, 김홍연(고고학 정보화 연구자, 소프트웨어 엔지니어) 개인이 개발·운영하고 있습니다.</p>
            <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 18px 0;">이 뉴스레터는 heripo의 선공개 버전으로 플랫폼의 일부 기능 중 하나입니다.</p>
            <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 18px 0;">2026년 중 플랫폼 출시를 목표로 개발 중이며, 핵심 로직 또한 오픈소스 프로젝트로 공개할 예정입니다.</p>
            <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 18px 0;">플랫폼 프로토타입 출시 시 구독자분들께 우선 안내해 드리겠습니다.</p>
            <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 18px 0;">뉴스레터 소스 추가를 원하시거나 기타 궁금한 점이 있다면 <a href="https://github.com/heripo-lab/heripo-research-radar/issues" target="_blank">GitHub 이슈</a>를 통해 요청해 주세요.</p>
            <hr style="border: 0; border-top: 2px solid #D2691E; margin: 32px 0;">
            <h2 style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 24px; font-weight: bold; line-height: 1.3; color: #D2691E; margin: 0 0 16px 0; letter-spacing: -0.2px; border-left: 5px solid #D2691E; padding-left: 12px; background: none;">⚠️ 중요 안내</h2>
            <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 18px 0;">본 뉴스레터는 국가유산청 공지사항, 관련 기관 입찰 정보 등 특정 웹 게시판의 모든 신규 소식을 빠짐없이 수집하여 제공합니다. 수집된 모든 정보는 정확한 크롤링 로직에 기반하므로 원본과 일치하여 신뢰할 수 있습니다.</p>
            <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 18px 0;">다만, 수집된 정보를 바탕으로 한 <strong>분류, 요약, 분석, 중요도 판단</strong>은 LLM에 의해 수행되었습니다. LLM은 고도로 발전된 기술이지만, 정보를 해석하고 판단하는 과정에서 오류가 발생할 수 있습니다.</p>
            <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 18px 0;">따라서 중요한 의사결정 시에는 <strong>반드시 원문 또는 원본 정보 출처를 직접 확인</strong>하시기를 권고합니다.</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="-webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; mso-table-lspace: 0pt; mso-table-rspace: 0pt; padding: 30px 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #888888;">
            <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 10px 0;" class="footer-text">김홍연(고고학 정보화 연구자) | kimhongyeon89@gmail.com</p>
            <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 10px 0;" class="footer-text">이 메일은 heripo.com에서 리서치 레이더를 구독하신 분들에게 발송됩니다.<br>
              더 이상 이메일을 받고 싶지 않으시면 <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" target="_blank" style="-webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; font-weight: bold; transition: color 0.2s; color: #888888; text-decoration: underline;" class="footer-link">여기에서 수신 거부</a>하세요.</p>
            <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #999999; margin: 0;" class="footer-text">
              Powered by <a href="https://github.com/heripo-lab/llm-newsletter-kit-core" target="_blank" style="-webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; transition: color 0.2s; color: #999999; text-decoration: underline;" class="footer-link">LLM Newsletter Kit</a> ·
              <a href="https://github.com/heripo-lab/heripo-research-radar" target="_blank" style="-webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; transition: color 0.2s; color: #999999; text-decoration: underline;" class="footer-link">View Source</a>
            </p>
          </td>
        </tr>
      </table>
      <!--[if (gte mso 9)|(IE)]>
      </td>
      </tr>
      </table>
      <![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;
