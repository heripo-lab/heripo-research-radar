import juice from 'juice';

import type { WelcomeTemplateOptions } from '~/types/dependencies';

import {
  heripoLogoHtml,
  krasHeaderHtml,
  platformIntroHtml,
  poweredByFooterHtml,
  sanitizeText,
} from './shared';

/**
 * Generates a welcome email HTML string with CSS inlined via juice.
 *
 * API is designed to match the original heripo-web `generateWelcomeHTML(id, name)` usage,
 * with an optional third parameter for KRAS mode and site URL override.
 *
 * @param id - Subscriber ID (used for unsubscribe links in default mode)
 * @param name - Subscriber display name
 * @param options - Optional configuration for KRAS mode and site URL
 * @returns Complete HTML string with CSS inlined (ready to send as email)
 *
 * @example
 * ```typescript
 * // Default heripo branding (same as original heripo-web usage):
 * const html = generateWelcomeHTML('subscriber-123', '홍길동');
 *
 * // KRAS mode:
 * const krasHtml = generateWelcomeHTML('subscriber-123', '홍길동', {
 *   isKrasNewsletter: true,
 * });
 * ```
 */
export function generateWelcomeHTML(
  id: string,
  name: string,
  options?: WelcomeTemplateOptions,
): string {
  const isKras = options?.isKrasNewsletter ?? false;
  const siteUrl = options?.siteUrl ?? 'https://heripo.com';
  const safeName = sanitizeText(name);
  const unsubscribeUrl = isKras
    ? '{{{RESEND_UNSUBSCRIBE_URL}}}'
    : `${siteUrl}/research-radar/unsubscribe?id=${id}`;

  return juice(createWelcomeHtmlRaw(safeName, isKras, siteUrl, unsubscribeUrl));
}

function createWelcomeHtmlRaw(
  name: string,
  isKras: boolean,
  siteUrl: string,
  unsubscribeUrl: string,
) {
  const title = isKras
    ? '한국고고학회 뉴스레터 구독 완료'
    : 'heripo 리서치 레이더 구독 완료';

  const headerHtml = isKras
    ? `${krasHeaderHtml()}
            <h1 style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.2; margin: 0 0
            18px 0; letter-spacing: -0.5px; margin-top: 0; font-size: 32px; font-weight: bold; color: #111111; border-bottom: 3px solid #D2691E; padding-bottom: 8px;">${name}님, 한국고고학회 뉴스레터를 구독해주셔서 감사합니다.</h1>`
    : `${heripoLogoHtml('8px')}

            <h1 style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.2; margin: 0 0
            18px 0; letter-spacing: -0.5px; margin-top: 0; font-size: 32px; font-weight: bold; color: #111111; border-bottom: 3px solid #D2691E; padding-bottom: 8px;">${name}님, heripo 리서치 레이더에 오신 것을 환영합니다!</h1>`;

  const feedbackHeading = `${name}님의 목소리가 heripo의 미래를 만듭니다`;

  const feedbackText = 'heripo';

  const newsletterLine = isKras
    ? `<p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 18px 0;">뉴스레터(리서치 레이더)는 heripo의 초기 선행 기능 중 하나입니다. 뉴스레터 소스 추가 요청은 <a href="https://github.com/heripo-lab/heripo-research-radar/issues" target="_blank">GitHub 이슈</a>를 통해 언제든 환영합니다.</p>`
    : `<p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 18px 0;">뉴스레터(리서치 레이더)는 heripo의 초기 선행 기능 중 하나입니다. 뉴스레터 소스 추가 요청은 <a href="https://github.com/heripo-lab/heripo-research-radar/issues" target="_blank">GitHub 이슈</a>를 통해 언제든 환영합니다.</p>`;

  const warningHtml = isKras
    ? `
            <blockquote style="background-color: #fef2f2; border-left: 5px solid #dc2626; margin: 24px 0; padding: 20px; border-radius: 4px;">
              <h3 style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 18px; font-weight: bold; line-height: 1.3; color: #dc2626; margin: 0 0 10px 0; letter-spacing: -0.1px;">⚠️ 본인이 신청하지 않으셨다면</h3>
              <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 18px 0; margin-bottom: 10px;">만약 본인이 직접 구독 신청을 하지 않으셨다면, 다른 분이 실수로 이메일 주소를 입력했을 가능성이 있습니다. 이 경우 아래 링크를 통해 즉시 수신을 거부하실 수 있습니다.</p>
              <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0;"><a href="${unsubscribeUrl}" style="color: #dc2626; font-weight: bold;">🚫 수신 거부하기</a></p>
            </blockquote>`
    : `
            <blockquote style="background-color: #fef2f2; border-left: 5px solid #dc2626; margin: 24px 0; padding: 20px; border-radius: 4px;">
              <h3 style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 18px; font-weight: bold; line-height: 1.3; color: #dc2626; margin: 0 0 10px 0; letter-spacing: -0.1px;">⚠️ 본인이 신청하지 않으셨다면</h3>
              <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 18px 0; margin-bottom: 10px;">만약 본인이 직접 구독 신청을 하지 않으셨다면, 다른 분이 실수로 이메일 주소를 입력했을 가능성이 있습니다. 이 경우 아래 링크를 통해 즉시 수신을 거부하실 수 있습니다.</p>
              <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0;"><a href="${unsubscribeUrl}" style="color: #dc2626; font-weight: bold;">🚫 수신 거부하기</a></p>
            </blockquote>`;

  const footerDisclaimerText = isKras
    ? '이 이메일은 heripo.com에서 한국고고학회 뉴스레터를 구독하신 분들에게 발송됩니다.'
    : '이 이메일은 heripo.com에서 리서치 레이더를 구독하신 분들에게 발송됩니다.';

  const footerUnsubscribeHtml = isKras
    ? `<p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.7; color: #6b7280; margin: 0 0 18px 0; margin-bottom: 8px;">📱 구독 관리: <a href="${unsubscribeUrl}" class="footer-link">구독 해지</a></p>`
    : `<p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.7; color: #6b7280; margin: 0 0 18px 0; margin-bottom: 8px;">📱 구독 관리: <a href="${unsubscribeUrl}" class="footer-link">구독 해지</a></p>`;

  return `<!DOCTYPE html>
<html lang="ko" style="color-scheme: light dark; supported-color-schemes: light dark;">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${title}</title>
  <style type="text/css">
      a:hover {
          color: #D2691E;
      }
      .button-link {
          color: #fff !important;
          text-decoration: none !important;
          font-weight: bold;
          font-size: 16px;
          display: inline-block;
          padding: 10px 28px;
          border-radius: 4px;
          background: #D2691E;
          border: none;
      }
      .button-link:hover {
          background: #b85a1a;
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
              font-size: 24px !important;
          }

          h2 {
              font-size: 20px !important;
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

          h1,
          h2,
          h3,
          h4,
          h5,
          h6 {
              color: #FFFFFF !important;
          }

          h2,
          h3,
          h4 {
              background: #1e1e1e !important;
          }

          p,
          li {
              color: #FFFFFF !important;
          }

          a:not(.button-link) {
              color: #4da6ff !important;
              text-decoration: underline !important;
          }

          a.button-link {
              color: #fff !important;
          }

          blockquote {
              background-color: #2b2b2b !important;
          }

          blockquote p {
              color: #bbbbbb !important;
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

          .welcome-notice {
              background-color: #2b2b2b !important;
          }

          .header-dark-text {
              color: #eeeeee !important;
          }

          .dark-logo-inline {
              display: inline-block !important;
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
          <td bgcolor="#ffffff" align="left" class="content-cell dark-mode-content-bg" style="-webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; mso-table-lspace: 0pt; mso-table-rspace: 0pt; padding: 48px 44px 44px 44px; border-radius: 12px; box-shadow: 0 4px 18px rgba(0,0,0,0.07);">
${headerHtml}

            <h2 style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 24px; font-weight: bold; line-height: 1.3; color: #D2691E; margin: 0 0 15px 0; letter-spacing: -0.2px; border-left: 5px solid #D2691E; padding-left: 12px; background: #fff7f2;">💬 ${feedbackHeading}</h2>

            <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 18px 0;">가장 큰 응원은 ${feedbackText}를 직접 사용해보시고, 솔직한 피드백을 주시는 것입니다.</p>

            <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 18px 0;"><strong style="color: #D2691E; font-weight: bold;">"이런 기능이 있다면 좋겠다"</strong> 혹은 <strong style="color: #D2691E; font-weight: bold;">"이런 점은 불편하다"</strong>와 같은 의견을 언제든 보내주세요.</p>

            <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 18px 0;">여러분의 피드백 하나하나가 ${feedbackText}의 다음 발걸음을 결정합니다.</p>
${
  isKras
    ? `
            <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 18px 0;"><strong><a href="https://github.com/heripo-lab" target="_blank">heripo lab</a></strong>은 한국고고학회와 함께 뉴스레터 발행 및 고고학의 디지털 전환을 추진하고 있습니다. 앞으로도 연구 현장에 실질적으로 도움이 되는 정보와 기술을 제공해 드리겠습니다.</p>
`
    : ''
}
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 28px 0 20px;">

            <h2 style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 24px; font-weight: bold; line-height: 1.3; color: #D2691E; margin: 0 0 15px 0; letter-spacing: -0.2px; border-left: 5px solid #D2691E; padding-left: 12px; background: #fff7f2;">🔍 heripo(헤리포) 플랫폼 소개</h2>
${platformIntroHtml()}
            ${newsletterLine}
${warningHtml}

            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 32px 0;">

            <div style="color: #6b7280; font-size: 14px;" class="footer-text">
              <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.7; color: #6b7280; margin: 0 0 18px 0; margin-bottom: 8px;">📧 피드백 및 문의: <a href="${siteUrl}/contact" class="footer-link">문의하기</a></p>
              ${footerUnsubscribeHtml}

              <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.7; color: #6b7280; margin: 0 0 18px 0; margin-bottom: 15px;"><em>정보 검색에 쏟던 시간을 연구와 창의적 기획에 집중하는 시간으로 바꿔보세요.</em></p>

${poweredByFooterHtml()}

              <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.7; color: #9ca3af; margin: 0;">${footerDisclaimerText}<br>더 이상 이메일을 받고 싶지 않으시면 <a href="${unsubscribeUrl}" target="_blank" style="color: #888888; text-decoration: underline;" class="footer-link">여기에서 수신 거부</a>하세요.</p>
            </div>
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
}
