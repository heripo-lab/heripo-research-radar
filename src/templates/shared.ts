/**
 * Shared HTML fragments used by both newsletter and welcome email templates.
 *
 * These helpers extract identical HTML blocks to avoid duplication
 * while keeping template-specific styling separate.
 */
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const purify = DOMPurify(new JSDOM('').window);

/**
 * Sanitize user-supplied strings for safe HTML insertion.
 * Strips all HTML tags, leaving only plain text.
 */
export const sanitizeText = (str: string): string =>
  purify.sanitize(str, { ALLOWED_TAGS: [] });

/**
 * Heripo light/dark logo block.
 * @param imgMarginBottom - Margin below the logo image (e.g., '8px', '12px')
 */
export const heripoLogoHtml = (imgMarginBottom: string) => `
            <div style="margin-bottom: 32px;">
              <div style="text-align: left; display: block;" class="light-logo">
                <img src="https://heripo.app/heripo-logo.png" width="150" alt="로고" style="-ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; display: block; margin-bottom: ${imgMarginBottom};" height="auto">
              </div>
              <!--[if !mso]><!-->
              <div style="text-align: left; display: none;" class="dark-logo">
                <img src="https://heripo.app/heripo-logo-dark.png" width="150" alt="다크모드 로고" style="-ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; display: block; margin-bottom: ${imgMarginBottom};" height="auto">
              </div>
              <!--<![endif]-->
            </div>`;

/**
 * KRAS dual-logo header block.
 * Left: KRAS logo, Right: heripo lab logo (light/dark) + "제공" text.
 */
export const krasHeaderHtml = () => `
            <table cellpadding="0" cellspacing="0" width="100%" role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 18px 0; mso-table-lspace: 0pt; mso-table-rspace: 0pt; margin-bottom: 20px; border: none;">
              <tr>
                <td align="left" valign="middle" width="50%" style="text-align: left; font-size: 15px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 0; border: none;">
                  <img src="https://heripo.app/kras-logo.jpeg" width="200" alt="한국고고학회" style="-ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; display: block;" height="auto">
                </td>
                <td align="right" valign="middle" width="50%" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 0; border: none; text-align: right; font-size: 0; line-height: 0; white-space: nowrap;">
                  <div style="text-align: left; display: inline-block; vertical-align: middle; line-height: 0;" class="light-logo">
                    <img src="https://heripo.app/heripolab-logo.png" width="120" alt="heripo lab" style="-ms-interpolation-mode: bicubic; border: 0; height: auto; outline: none; text-decoration: none; display: inline-block; vertical-align: middle;" height="auto">
                  </div><!--[if !mso]><!--><div style="text-align: left; display: none; vertical-align: middle; line-height: 0;" class="dark-logo dark-logo-inline">
                    <img src="https://heripo.app/heripolab-logo-dark.png" width="120" alt="heripo lab" style="-ms-interpolation-mode: bicubic; border: 0; height: auto; outline: none; text-decoration: none; display: inline-block; vertical-align: middle;" height="auto">
                  </div><!--<![endif]--><span class="header-dark-text" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 20px; font-weight: normal; color: #666666; line-height: 1; vertical-align: middle; padding-left: 4px;">제공</span>
                </td>
              </tr>
            </table>`;

/**
 * Heripo project introduction section.
 * Shared between newsletter and welcome email templates.
 *
 */
export const platformIntroHtml = () => `
            <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 18px 0;">heripo는 발굴조사보고서의 기록을 데이터로 전환하고 출처와 변환 경로를 함께 보존하기 위한 연구 인프라 프로젝트입니다. 지금 받아보시는 뉴스레터는 그 출발점이며, 관련 오픈소스 프로젝트는 <strong><a href="https://github.com/heripo-lab" target="_blank">heripo lab</a></strong>에서 공개하고 있습니다.</p>
            <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 18px 0;">뉴스레터에 이어 오픈소스 <strong><a href="https://github.com/heripo-lab/heripo-engine" target="_blank">heripo engine</a></strong>을 바탕으로 발굴조사보고서의 기록을 데이터로 전환하고 이를 탐색하고 활용할 수 있는 연구 도구 <strong>heripo 베이스캠프</strong>를 준비 중입니다.</p>
            <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #444444; margin: 0 0 18px 0;">heripo 베이스캠프는 현재 초대 기반 비공개 알파 테스트 중입니다. 공개 테스터 모집 및 정식 출시 소식은 이 뉴스레터로 전해드리겠습니다.</p>`;

/**
 * "Powered by LLM Newsletter Kit · View Source" footer line.
 */
export const poweredByFooterHtml = () => `
              <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #999999; margin: 0 0 12px 0;" class="footer-text">
                Powered by <a href="https://github.com/heripo-lab/llm-newsletter-kit-core" target="_blank" style="-webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; transition: color 0.2s; color: #999999; text-decoration: underline;" class="footer-link">LLM Newsletter Kit</a> ·
                <a href="https://github.com/heripo-lab/heripo-research-radar" target="_blank" style="-webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; transition: color 0.2s; color: #999999; text-decoration: underline;" class="footer-link">View Source</a>
              </p>`;
