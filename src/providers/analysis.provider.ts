import type { OpenAIProvider } from '@ai-sdk/openai';
import type {
  ArticleForUpdateByAnalysis,
  AnalysisProvider as CoreAnalysisProvider,
  UnscoredArticle,
} from '@llm-newsletter-kit/core';

import type { ArticleRepository, TagRepository } from '../types/dependencies';

/**
 * Analysis provider implementation
 * - LLM-based article analysis
 * - Tag classification, image analysis, importance scoring
 */
export class AnalysisProvider implements CoreAnalysisProvider {
  classifyTagOptions: { model: ReturnType<OpenAIProvider> };
  analyzeImagesOptions: { model: ReturnType<OpenAIProvider> };
  determineScoreOptions: {
    model: ReturnType<OpenAIProvider>;
    minimumImportanceScoreRules: Array<{
      targetUrl: string;
      minScore: number;
    }>;
  };

  constructor(
    private readonly openai: OpenAIProvider,
    private readonly articleRepository: ArticleRepository,
    private readonly tagRepository: TagRepository,
  ) {
    this.classifyTagOptions = {
      model: this.openai('gpt-5-mini'),
    };

    this.analyzeImagesOptions = {
      model: this.openai('gpt-5.1'),
    };

    this.determineScoreOptions = {
      model: this.openai('gpt-5.1'),
      minimumImportanceScoreRules: [
        // Korean Archaeological Society news: minimum score 6
        {
          targetUrl: 'https://www.kras.or.kr/?r=kras&m=bbs&bid=notice',
          minScore: 6,
        },
        {
          targetUrl: 'https://www.kras.or.kr/?r=kras&m=bbs&bid=sympo',
          minScore: 6,
        },
        {
          targetUrl: 'https://www.kras.or.kr/?c=61/101/105',
          minScore: 6,
        },
        {
          targetUrl: 'https://www.kaah.kr/notice',
          minScore: 6,
        },
        {
          targetUrl: 'https://www.kaah.kr/news',
          minScore: 6,
        },
        {
          targetUrl: 'https://www.kaah.kr/mass',
          minScore: 6,
        },
        {
          targetUrl: 'https://www.kaah.kr/assnews',
          minScore: 6,
        },
        {
          targetUrl: 'https://www.kaah.kr/ralnews',
          minScore: 6,
        },
        {
          targetUrl: 'https://www.kaah.kr/notice',
          minScore: 6,
        },
        {
          targetUrl: 'https://www.kaah.kr/placeopen',
          minScore: 6,
        },
        {
          targetUrl: 'https://www.kaah.kr/bussopen',
          minScore: 6,
        },
        {
          targetUrl: 'https://www.kaah.kr/ipcopen',
          minScore: 6,
        },
        // Excavation report news: minimum score 2
        {
          targetUrl:
            'https://www.e-minwon.go.kr/ge/ee/getListEcexmPrmsnAply.do',
          minScore: 2,
        },
        {
          targetUrl: 'https://www.e-minwon.go.kr/ge/ee/getListEcexmRptp.do',
          minScore: 2,
        },
        {
          targetUrl: 'https://www.e-minwon.go.kr/ge/ee/getListLinkGrndsRls.do',
          minScore: 2,
        },
      ],
    };
  }

  /**
   * Fetch articles that haven't been scored yet
   * @returns Unscored articles awaiting analysis
   */
  async fetchUnscoredArticles(): Promise<UnscoredArticle[]> {
    return this.articleRepository.findUnscoredArticles();
  }

  /**
   * Fetch all existing tags for classification
   * @returns List of tag names
   */
  async fetchTags(): Promise<string[]> {
    return this.tagRepository.findAllTags();
  }

  /**
   * Update article with analysis results (tags, image analysis, importance score)
   * @param article - Article with analysis data
   */
  async update(article: ArticleForUpdateByAnalysis): Promise<void> {
    await this.articleRepository.updateAnalysis(article);
  }
}
