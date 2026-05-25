/**
 * Lightweight source metadata for public display (e.g., sources page).
 * Derives directly from crawling-targets.ts — single source of truth.
 * Groups all targets by organization across all crawling groups (news/business/employment).
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

/**
 * Extracts org display name and page name from target id + name.
 * id convention: "기관명_페이지명" — first "_" splits org key from page.
 * The org display name is derived from the target name by matching
 * characters against the org key (skipping spaces).
 *
 * e.g. id "국가유산청_공지사항", name "국가유산청 공지사항"
 *      → org: "국가유산청", page: "공지사항"
 *      id "국가유산지식이음_공지사항", name "국가유산 지식이음 공지사항"
 *      → org: "국가유산 지식이음", page: "공지사항"
 */
function parseOrgAndPage(
  id: string,
  name: string,
): { orgKey: string; orgDisplay: string; pageName: string } {
  const sepIdx = id.indexOf('_');
  const orgKey = sepIdx > 0 ? id.slice(0, sepIdx) : id;

  let matchLen = 0;
  let keyIdx = 0;
  for (let i = 0; i < name.length && keyIdx < orgKey.length; i++) {
    if (name[i] === ' ') {
      matchLen = i;
      continue;
    }
    if (name[i] === orgKey[keyIdx]) {
      keyIdx++;
      matchLen = i + 1;
    } else {
      break;
    }
  }

  const matched = keyIdx === orgKey.length;
  return {
    orgKey,
    orgDisplay: matched ? name.slice(0, matchLen).trim() : orgKey,
    pageName: matched ? name.slice(matchLen).trim() || name : name,
  };
}

/**
 * Returns the source list grouped by organization.
 * Merges all crawling groups (news/business/employment) into a flat
 * organization-based structure.
 */
export function getSourceList(): SourceOrganization[] {
  const groups = createCrawlingTargetGroups();
  const orgMap = new Map<
    string,
    { displayName: string; sources: SourceItem[] }
  >();

  for (const group of groups) {
    for (const target of group.targets) {
      const { orgKey, orgDisplay, pageName } = parseOrgAndPage(
        target.id,
        target.name,
      );

      if (!orgMap.has(orgKey)) {
        orgMap.set(orgKey, { displayName: orgDisplay, sources: [] });
      }
      orgMap.get(orgKey)!.sources.push({ name: pageName, url: target.url });
    }
  }

  return Array.from(orgMap.values()).map(({ displayName, sources }) => ({
    organization: displayName,
    sources,
  }));
}
