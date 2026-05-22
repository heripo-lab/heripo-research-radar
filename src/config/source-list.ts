/**
 * Lightweight source metadata for public display (e.g., sources page).
 * Derives directly from crawling-targets.ts — single source of truth.
 */
import { createCrawlingTargetGroups } from './crawling-targets';

export interface SourceItem {
  name: string;
  url: string;
}

export interface SourceOrganization {
  organization: string;
  sources: SourceItem[];
}

export interface SourceGroup {
  id: string;
  name: string;
  organizations: SourceOrganization[];
}

/**
 * Groups targets by organization using the target id.
 * id convention: "기관명_페이지명" — first "_" splits org from page.
 * e.g. "국가유산청_공지사항" → org key: "국가유산청"
 *      "국립해양유산연구소_학술보고서_수중유산조사" → org key: "국립해양유산연구소"
 *
 * Display name for the organization is extracted from the target name
 * by removing the page-specific suffix (everything after the org prefix).
 * e.g. name "국가유산 지식이음 공지사항", id org "국가유산지식이음"
 *      → display org: "국가유산 지식이음", page: "공지사항"
 */
function groupByOrganization(
  targets: { id: string; name: string; url: string }[],
): SourceOrganization[] {
  const orgMap = new Map<string, { displayName: string; sources: SourceItem[] }>();

  for (const target of targets) {
    const sepIdx = target.id.indexOf('_');
    const orgKey = sepIdx > 0 ? target.id.slice(0, sepIdx) : target.id;

    // name에서 공백을 제거하며 orgKey와 일치하는 접두사 길이를 찾아 기관명/페이지명 분리
    let matchLen = 0;
    let keyIdx = 0;
    for (let i = 0; i < target.name.length && keyIdx < orgKey.length; i++) {
      if (target.name[i] === ' ') {
        matchLen = i;
        continue;
      }
      if (target.name[i] === orgKey[keyIdx]) {
        keyIdx++;
        matchLen = i + 1;
      } else {
        break;
      }
    }

    const orgDisplay = keyIdx === orgKey.length
      ? target.name.slice(0, matchLen).trim()
      : orgKey;
    const pageName = keyIdx === orgKey.length
      ? target.name.slice(matchLen).trim()
      : target.name;

    if (!orgMap.has(orgKey)) {
      orgMap.set(orgKey, { displayName: orgDisplay, sources: [] });
    }
    orgMap.get(orgKey)!.sources.push({
      name: pageName || target.name,
      url: target.url,
    });
  }

  return Array.from(orgMap.values()).map(({ displayName, sources }) => ({
    organization: displayName,
    sources,
  }));
}

/**
 * Returns the source list grouped by category and organization.
 * Data is derived from createCrawlingTargetGroups() — no duplication.
 */
export function getSourceList(): SourceGroup[] {
  const groups = createCrawlingTargetGroups();

  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    organizations: groupByOrganization(
      group.targets.map((t) => ({ id: t.id, name: t.name, url: t.url })),
    ),
  }));
}
