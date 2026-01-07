import type { CrawlingTargetGroup } from '@llm-newsletter-kit/core';

import {
  parseBuyeoMuseumDetail,
  parseBuyeoMuseumList,
} from '~/parsers/buyeo-museum.parser';
import {
  parseExcavationReportDetail,
  parseExcavationReportList,
  parseExcavationSiteDetail,
  parseExcavationSiteList,
} from '~/parsers/excavation.parser';
import { parseGogungDetail, parseGogungList } from '~/parsers/gogung.parser';
import {
  parseHeritageAgencyDetail,
  parseHeritageAgencyList,
} from '~/parsers/heritage-agency.parser';
import { parseHsasDetail, parseHsasList } from '~/parsers/hsas.parser';
import { parseJbgogoDetail, parseJbgogoList } from '~/parsers/jbgogo.parser';
import {
  parseJeonjuMuseumDetail,
  parseJeonjuMuseumList,
  parseJeonjuMuseumRecruitList,
} from '~/parsers/jeonju-museum.parser';
import {
  parseJinjuMuseumDetail,
  parseJinjuMuseumList,
} from '~/parsers/jinju-museum.parser';
import {
  parseKaahDetail,
  parseKaahList,
  parseKaahPlaceDetail,
  parseKaahPlaceList,
} from '~/parsers/kaah.parser';
import {
  parseKhsDetail,
  parseKhsGalleryList,
  parseKhsLawList,
  parseKhsList,
} from '~/parsers/khs.parser';
import { parseKrasDetail, parseKrasList } from '~/parsers/kras.parser';
import {
  parseMuseumDetail,
  parseMuseumList,
  parseMuseumPressList,
  parseMuseumRecruitList,
} from '~/parsers/museum.parser';
import {
  parseNrichJournalDetail,
  parseNrichJournalList,
  parseNrichMajorEventDetail,
  parseNrichMajorEventList,
  parseNrichNoticeDetail,
  parseNrichNoticeList,
  parseNrichPortalDetail,
  parseNrichPortalList,
} from '~/parsers/nrich.parser';
import {
  extractNttSeq,
  parseYngogoDetail,
  parseYngogoList,
} from '~/parsers/yngogo.parser';

export const crawlingTargetGroups: CrawlingTargetGroup[] = [
  {
    id: 'news',
    name: 'News',
    targets: [
      {
        id: '국가유산청_공지사항',
        name: '국가유산청 공지사항',
        url: 'https://www.khs.go.kr/multiBbz/selectMultiBbzList.do?bbzId=newpublic&mn=NS_01_01',
        parseList: parseKhsList,
        parseDetail: parseKhsDetail,
      },
      {
        id: '국가유산청_보도설명',
        name: '국가유산청 보도/설명',
        url: 'https://www.khs.go.kr/newsBbz/selectNewsBbzList.do?sectionId=all_sec_1&mn=NS_01_02',
        parseList: parseKhsList,
        parseDetail: parseKhsDetail,
      },
      {
        id: '국가유산청_사진뉴스',
        name: '국가유산청 사진뉴스',
        url: 'https://www.khs.go.kr/cop/bbs/selectBoardList.do?bbsId=BBSMSTR_1002&mn=NS_01_03',
        parseList: parseKhsGalleryList,
        parseDetail: parseKhsDetail,
      },
      {
        id: '국가유산청_입법예고',
        name: '국가유산청 입법예고',
        url: 'https://www.khs.go.kr/lawBbz/selectLawBbzList.do?mn=NS_03_01_01',
        parseList: parseKhsLawList,
        parseDetail: parseKhsDetail,
      },
      // NOTE: Parsing logic is implemented, but too much fragmented data with little value for newsletter
      // {
      //   id: '국가유산청_발굴조사_현황공개',
      //   name: '국가유산청 발굴조사 현황공개',
      //   url: 'https://www.e-minwon.go.kr/ge/ee/getListEcexmPrmsnAply.do',
      //   parseList: parseExcavationStatusList,
      //   parseDetail: parseExcavationStatusDetail,
      // },
      {
        id: '국가유산청_발굴조사_보고서',
        name: '국가유산청 발굴조사 보고서',
        url: 'https://www.e-minwon.go.kr/ge/ee/getListEcexmRptp.do',
        parseList: parseExcavationReportList,
        parseDetail: parseExcavationReportDetail,
      },
      {
        id: '국가유산청_발굴조사_현장공개',
        name: '국가유산청 발굴조사 현장공개',
        url: 'https://www.e-minwon.go.kr/ge/ee/getListLinkGrndsRls.do',
        parseList: parseExcavationSiteList,
        parseDetail: parseExcavationSiteDetail,
      },
      {
        id: '국립문화유산연구원_공지사항',
        name: '국립문화유산연구원 공지사항',
        url: 'https://www.nrich.go.kr/kor/boardList.do?menuIdx=282&bbscd=32',
        parseList: parseNrichNoticeList,
        parseDetail: parseNrichNoticeDetail,
      },
      {
        id: '국립문화유산연구원_주요행사',
        name: '국립문화유산연구원 주요행사',
        url: 'https://www.nrich.go.kr/kor/majorList.do?menuIdx=286',
        parseList: parseNrichMajorEventList,
        parseDetail: parseNrichMajorEventDetail,
      },
      {
        id: '국립문화유산연구원_학술지_헤리티지',
        name: '국립문화유산연구원 헤리티지:역사와 과학 학술지',
        url: 'https://www.nrich.go.kr/kor/subscriptionDataUsrList.do?menuIdx=1651&gubun=J',
        parseList: parseNrichJournalList,
        parseDetail: parseNrichJournalDetail,
      },
      {
        id: '국립문화유산연구원_학술지_보존과학연구',
        name: '국립문화유산연구원 보존과학연구 학술지',
        url: 'https://www.nrich.go.kr/kor/subscriptionDataUsrList.do?menuIdx=2065&gubun=K',
        parseList: parseNrichJournalList,
        parseDetail: parseNrichJournalDetail,
      },
      {
        id: '국가유산지식이음_공지사항',
        name: '국가유산 지식이음 공지사항',
        url: 'https://portal.nrich.go.kr/kor/boardList.do?menuIdx=1058&bbscd=9',
        parseList: parseNrichPortalList,
        parseDetail: parseNrichPortalDetail,
      },
      {
        id: '국립고궁박물관_공지사항',
        name: '국립고궁박물관 공지사항',
        url: 'https://www.gogung.go.kr/gogung/bbs/BMSR00022/list.do?gubunCd=B22_001&menuNo=800088',
        parseList: parseGogungList,
        parseDetail: parseGogungDetail,
      },
      {
        id: '국가유산진흥원_공지사항',
        name: '국가유산진흥원 공지사항',
        url: 'https://www.kh.or.kr/brd/board/644/L/SITES/100/menu/371',
        parseList: parseHeritageAgencyList,
        parseDetail: parseHeritageAgencyDetail,
      },
      {
        id: '국가유산진흥원_보도자료',
        name: '국가유산진흥원 보도자료',
        url: 'https://www.kh.or.kr/brd/board/715/L/menu/373',
        parseList: parseHeritageAgencyList,
        parseDetail: parseHeritageAgencyDetail,
      },
      {
        id: '국가유산진흥원_매장유산국비발굴단_공지사항',
        name: '국가유산진흥원 매장유산국비발굴단 공지사항',
        url: 'https://www.kh.or.kr/brd/board/644/L/SITES/201/menu/506',
        parseList: parseHeritageAgencyList,
        parseDetail: parseHeritageAgencyDetail,
      },
      {
        id: '국가유산진흥원_매장유산국비발굴단_현장설명회',
        name: '국가유산진흥원 매장유산국비발굴단 현장설명회',
        url: 'https://www.kh.or.kr/brd/board/631/L/menu/504',
        parseList: parseHeritageAgencyList,
        parseDetail: parseHeritageAgencyDetail,
      },
      {
        id: '한국문화유산협회_공지사항',
        name: '한국문화유산협회 공지사항',
        url: 'https://www.kaah.kr/notice',
        parseList: parseKaahList,
        parseDetail: parseKaahDetail,
      },
      {
        id: '한국문화유산협회_협회소식',
        name: '한국문화유산협회 협회소식',
        url: 'https://www.kaah.kr/news',
        parseList: parseKaahList,
        parseDetail: parseKaahDetail,
      },
      {
        id: '한국문화유산협회_보도자료',
        name: '한국문화유산협회 보도자료',
        url: 'https://www.kaah.kr/mass',
        parseList: parseKaahList,
        parseDetail: parseKaahDetail,
      },
      {
        id: '한국문화유산협회_회원기관소식',
        name: '한국문화유산협회 회원기관소식',
        url: 'https://www.kaah.kr/assnews',
        parseList: parseKaahList,
        parseDetail: parseKaahDetail,
      },
      {
        id: '한국문화유산협회_유관기관소식',
        name: '한국문화유산협회 유관기관소식',
        url: 'https://www.kaah.kr/ralnews',
        parseList: parseKaahList,
        parseDetail: parseKaahDetail,
      },
      {
        id: '한국문화유산협회_발굴현장공개',
        name: '한국문화유산협회 발굴현장공개',
        url: 'https://www.kaah.kr/placeopen',
        parseList: parseKaahPlaceList,
        parseDetail: parseKaahPlaceDetail,
      },
      {
        id: '한국고고학회_공지사항',
        name: '한국고고학회 공지사항',
        url: 'https://www.kras.or.kr/?r=kras&m=bbs&bid=notice',
        parseList: parseKrasList,
        parseDetail: parseKrasDetail,
      },
      {
        id: '한국고고학회_학술대회및행사',
        name: '한국고고학회 학술대회 및 행사',
        url: 'https://www.kras.or.kr/?r=kras&m=bbs&bid=sympo',
        parseList: parseKrasList,
        parseDetail: parseKrasDetail,
      },
      {
        id: '한국고고학회_신간안내_단행본',
        name: '한국고고학회 신간안내 - 단행본',
        url: 'https://www.kras.or.kr/?c=61/101/105',
        parseList: parseKrasList,
        parseDetail: parseKrasDetail,
      },
      {
        id: '한국고고학회_현장소식',
        name: '한국고고학회 현장소식',
        url: 'https://www.kras.or.kr/?c=61/73',
        parseList: parseKrasList,
        parseDetail: parseKrasDetail,
      },
      {
        id: '중부고고학회_공지사항',
        name: '중부고고학회 공지사항',
        url: 'https://www.jbgogo.or.kr/bbs/notice',
        parseList: parseJbgogoList,
        parseDetail: parseJbgogoDetail,
      },
      {
        id: '중부고고학회_학계소식',
        name: '중부고고학회 학계소식',
        url: 'https://www.jbgogo.or.kr/bbs/news',
        parseList: parseJbgogoList,
        parseDetail: parseJbgogoDetail,
      },
      {
        id: '중부고고학회_발굴현장소식',
        name: '중부고고학회 발굴현장소식',
        url: 'https://www.jbgogo.or.kr/bbs/spotnews',
        parseList: parseJbgogoList,
        parseDetail: parseJbgogoDetail,
      },
      {
        id: '호서고고학회_공지사항',
        name: '호서고고학회 공지사항',
        url: 'http://www.hsas.or.kr/flow/?ref=board/board.emt&menu_table=m2_00&bbs_table=notice&menu_idx=010000',
        parseList: parseHsasList,
        parseDetail: parseHsasDetail,
      },
      {
        id: '호서고고학회_학회소식',
        name: '호서고고학회 학회소식',
        url: 'http://www.hsas.or.kr/flow/?ref=board/board.emt&menu_table=m2_00&bbs_table=m2_01&menu_idx=020000',
        parseList: parseHsasList,
        parseDetail: parseHsasDetail,
      },
      {
        id: '영남고고학회_공지사항',
        name: '영남고고학회 공지사항',
        url: 'http://www.yngogo.or.kr/subList/32000001120',
        parseList: (html) =>
          parseYngogoList(html, '32000001120', '32000001157', '32000001711'),
        parseDetail: (html) =>
          parseYngogoDetail(
            html,
            '32000001120',
            '32000001157',
            extractNttSeq(html),
            '32000001711',
          ),
      },
      {
        id: '영남고고학회_학계소식',
        name: '영남고고학회 학계소식',
        url: 'http://www.yngogo.or.kr/subList/32000001133',
        parseList: (html) =>
          parseYngogoList(html, '32000001133', '32000001161', '32000001715'),
        parseDetail: (html) =>
          parseYngogoDetail(
            html,
            '32000001133',
            '32000001161',
            extractNttSeq(html),
            '32000001715',
          ),
      },
      {
        id: '영남고고학회_현장소식',
        name: '영남고고학회 현장소식',
        url: 'http://www.yngogo.or.kr/subList/32000001135',
        parseList: (html) =>
          parseYngogoList(html, '32000001135', '32000001163', '32000001717'),
        parseDetail: (html) =>
          parseYngogoDetail(
            html,
            '32000001135',
            '32000001163',
            extractNttSeq(html),
            '32000001717',
          ),
      },
      {
        id: '국립중앙박물관_알림',
        name: '국립중앙박물관 알림',
        url: 'https://www.museum.go.kr/MUSEUM/contents/M0701010000.do?catCustomType=united&catId=128',
        parseList: (html) =>
          parseMuseumList(html, '/MUSEUM/contents/M0701010000.do'),
        parseDetail: parseMuseumDetail,
      },
      {
        id: '국립중앙박물관_고시공고',
        name: '국립중앙박물관 고시/공고',
        url: 'https://www.museum.go.kr/MUSEUM/contents/M0701020000.do',
        parseList: (html) =>
          parseMuseumList(html, '/MUSEUM/contents/M0701020000.do'),
        parseDetail: parseMuseumDetail,
      },
      {
        id: '국립중앙박물관_보도자료',
        name: '국립중앙박물관 보도 자료',
        url: 'https://www.museum.go.kr/MUSEUM/contents/M0701040000.do?catCustomType=post&catId=93',
        parseList: parseMuseumPressList,
        parseDetail: parseMuseumDetail,
      },
      {
        id: '국립전주박물관_새소식',
        name: '국립전주박물관 새소식',
        url: 'https://jeonju.museum.go.kr/board.es?mid=a10105010000&bid=0001',
        parseList: parseJeonjuMuseumList,
        parseDetail: parseJeonjuMuseumDetail,
      },
      {
        id: '국립전주박물관_보도자료',
        name: '국립전주박물관 보도자료',
        url: 'https://jeonju.museum.go.kr/board.es?mid=a10105050000&bid=0004',
        parseList: parseJeonjuMuseumList,
        parseDetail: parseJeonjuMuseumDetail,
      },
      {
        id: '국립부여박물관_공지사항',
        name: '국립부여박물관 공지사항',
        url: 'https://buyeo.museum.go.kr/bbs/list.do?key=2301250005',
        parseList: (html) => parseBuyeoMuseumList(html, '2301250005'),
        parseDetail: parseBuyeoMuseumDetail,
      },
      {
        id: '국립부여박물관_보도자료',
        name: '국립부여박물관 보도자료',
        url: 'https://buyeo.museum.go.kr/bbs/list.do?key=2302150024',
        parseList: (html) => parseBuyeoMuseumList(html, '2302150024'),
        parseDetail: parseBuyeoMuseumDetail,
      },
      {
        id: '국립진주박물관_새소식',
        name: '국립진주박물관 새소식',
        url: 'https://jinju.museum.go.kr/kor/html/sub06/0601.html',
        parseList: parseJinjuMuseumList,
        parseDetail: parseJinjuMuseumDetail,
      },
      // NOTE: Parsing logic is implemented, but crawling is restricted by robots.txt policy
      // {
      //   id: '국립경주박물관_새소식',
      //   name: '국립경주박물관 새소식',
      //   url: 'https://gyeongju.museum.go.kr/kor/html/sub07/0701.html',
      //   parseList: (html) =>
      //     parseGyeongjuMuseumList(html, '/kor/html/sub07/0701.html'),
      //   parseDetail: parseGyeongjuMuseumDetail,
      // },
      // {
      //   id: '국립경주박물관_고시공고',
      //   name: '국립경주박물관 고시/공고',
      //   url: 'https://gyeongju.museum.go.kr/kor/html/sub07/0703.html',
      //   parseList: parseGyeongjuMuseumNoticeList,
      //   parseDetail: parseGyeongjuMuseumDetail,
      // },
      // {
      //   id: '국립경주박물관_보도자료',
      //   name: '국립경주박물관 보도자료',
      //   url: 'https://gyeongju.museum.go.kr/kor/html/sub07/0705.html',
      //   parseList: (html) =>
      //     parseGyeongjuMuseumList(html, '/kor/html/sub07/0705.html'),
      //   parseDetail: parseGyeongjuMuseumDetail,
      // },
      // {
      //   id: '국립청주박물관_새소식',
      //   name: '국립청주박물관 새소식',
      //   url: 'https://cheongju.museum.go.kr/www/selectBbsNttList.do?bbsNo=1&key=482&nbar=s',
      //   parseList: parseCheongjuMuseumList,
      //   parseDetail: parseCheongjuMuseumDetail,
      // },
      // {
      //   id: '국립청주박물관_언론보도자료',
      //   name: '국립청주박물관 언론보도자료',
      //   url: 'https://cheongju.museum.go.kr/www/selectBbsNttList.do?bbsNo=20&key=31&nbar=s',
      //   parseList: parseCheongjuMuseumList,
      //   parseDetail: parseCheongjuMuseumDetail,
      // },
      // {
      //   id: '국립김해박물관_새소식',
      //   name: '국립김해박물관 새소식',
      //   url: 'https://gimhae.museum.go.kr/kr/html/sub04/0401.html',
      //   parseList: (html) =>
      //     parseGimhaeMuseumList(html, '/kr/html/sub04/0401.html'),
      //   parseDetail: parseGimhaeMuseumDetail,
      // },
      // {
      //   id: '국립김해박물관_보도자료',
      //   name: '국립김해박물관 언론보도자료',
      //   url: 'https://gimhae.museum.go.kr/kr/html/sub04/0402.html',
      //   parseList: (html) =>
      //     parseGimhaeMuseumList(html, '/kr/html/sub04/0402.html'),
      //   parseDetail: parseGimhaeMuseumDetail,
      // },
      // {
      //   id: '국립제주박물관_새소식',
      //   name: '국립제주박물관 새소식',
      //   url: 'https://jeju.museum.go.kr/_prog/_board/?code=sub02_0201&site_dvs_cd=kr&menu_dvs_cd=050101&ntt_tag=1',
      //   parseList: parseJejuMuseumList,
      //   parseDetail: parseJejuMuseumDetail,
      // },
      // {
      //   id: '국립익산박물관_공지사항',
      //   name: '국립익산박물관 공지사항',
      //   url: 'https://iksan.museum.go.kr/kor/html/sub05/0501.html',
      //   parseList: parseIksanMuseumList,
      //   parseDetail: parseIksanMuseumDetail,
      // },
    ],
  },
  {
    id: 'business',
    name: 'Business',
    targets: [
      {
        id: '국가유산청_입찰정보',
        name: '국가유산청 입찰정보',
        url: 'https://www.khs.go.kr/tenderBbz/selectTenderBbzList.do?mn=NS_01_05',
        parseList: parseKhsList,
        parseDetail: parseKhsDetail,
      },
      {
        id: '국가유산진흥원_입찰정보',
        name: '국가유산진흥원 입찰정보',
        url: 'https://www.kh.or.kr/brd/board/717/L/menu/375',
        parseList: parseHeritageAgencyList,
        parseDetail: parseHeritageAgencyDetail,
      },
      {
        id: '한국문화유산협회_사업공고',
        name: '한국문화유산협회 사업공고',
        url: 'https://www.kaah.kr/bussopen',
        parseList: parseKaahList,
        parseDetail: parseKaahDetail,
      },
      {
        id: '한국문화유산협회_입찰공고',
        name: '한국문화유산협회 입찰공고',
        url: 'https://www.kaah.kr/ipcopen',
        parseList: parseKaahList,
        parseDetail: parseKaahDetail,
      },
    ],
  },
  {
    id: 'employment',
    name: 'Employment',
    targets: [
      {
        id: '국가유산청_시험채용',
        name: '국가유산청 시험/채용',
        url: 'https://www.khs.go.kr/multiBbz/selectMultiBbzList.do?bbzId=newexam&mn=NS_01_06',
        parseList: parseKhsList,
        parseDetail: parseKhsDetail,
      },
      {
        id: '국가유산진흥원_인재채용',
        name: '국가유산진흥원 인재채용',
        url: 'https://www.kh.or.kr/brd/board/721/L/CATEGORY/719/menu/377',
        parseList: parseHeritageAgencyList,
        parseDetail: parseHeritageAgencyDetail,
      },
      {
        id: '한국문화유산협회_채용공고',
        name: '한국문화유산협회 채용공고',
        url: 'https://www.kaah.kr/reqopen',
        parseList: parseKaahList,
        parseDetail: parseKaahDetail,
      },
      {
        id: '영남고고학회_채용공고',
        name: '영남고고학회 채용공고',
        url: 'http://www.yngogo.or.kr/subList/32000001136',
        parseList: (html) =>
          parseYngogoList(html, '32000001136', '32000001164', '32000001718'),
        parseDetail: (html) =>
          parseYngogoDetail(
            html,
            '32000001136',
            '32000001164',
            extractNttSeq(html),
            '32000001718',
          ),
      },
      {
        id: '국립중앙박물관_채용안내',
        name: '국립중앙박물관 채용 안내',
        url: 'https://www.museum.go.kr/MUSEUM/contents/M0701030000.do?catCustomType=post&catId=54&recruitYn=Y',
        parseList: parseMuseumRecruitList,
        parseDetail: parseMuseumDetail,
      },
      {
        id: '국립전주박물관_채용',
        name: '국립전주박물관 채용',
        url: 'https://jeonju.museum.go.kr/board.es?mid=a10105020000&bid=0002',
        parseList: parseJeonjuMuseumRecruitList,
        parseDetail: parseJeonjuMuseumDetail,
      },
      {
        id: '국립부여박물관_채용공고',
        name: '국립부여박물관 채용공고',
        url: 'https://buyeo.museum.go.kr/bbs/list.do?key=2301270001',
        parseList: (html) => parseBuyeoMuseumList(html, '2301270001'),
        parseDetail: parseBuyeoMuseumDetail,
      },
      // NOTE: Parsing logic is implemented, but crawling is restricted by robots.txt policy
      // {
      //   id: '국립경주박물관_채용안내',
      //   name: '국립경주박물관 채용안내',
      //   url: 'https://gyeongju.museum.go.kr/kor/html/sub07/0704.html',
      //   parseList: (html) =>
      //     parseGyeongjuMuseumList(html, '/kor/html/sub07/0704.html'),
      //   parseDetail: parseGyeongjuMuseumDetail,
      // },
      // {
      //   id: '국립청주박물관_채용및공고',
      //   name: '국립청주박물관 채용 및 공고',
      //   url: 'https://cheongju.museum.go.kr/www/selectBbsNttList.do?bbsNo=29&key=476&nbar=s',
      //   parseList: parseCheongjuMuseumList,
      //   parseDetail: parseCheongjuMuseumDetail,
      // },
      // {
      //   id: '국립제주박물관_채용정보',
      //   name: '국립제주박물관 채용정보',
      //   url: 'https://jeju.museum.go.kr/_prog/_board/?code=sub02_0201&site_dvs_cd=kr&menu_dvs_cd=050102&ntt_tag=2',
      //   parseList: parseJejuMuseumList,
      //   parseDetail: parseJejuMuseumDetail,
      // },
    ],
  },
];
