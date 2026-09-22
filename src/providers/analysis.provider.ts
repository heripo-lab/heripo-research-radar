import type { OpenAIProvider } from '@ai-sdk/openai';
import type {
  ArticleForUpdateByAnalysis,
  AnalysisProvider as CoreAnalysisProvider,
  UnscoredArticle,
} from '@llm-newsletter-kit/core';

import type { ArticleRepository, TagRepository } from '../types/dependencies';

import { llmConfig, maximumImportanceScoreByDomain } from '../config';
import { toHeritageDomainTag } from '../prompts';

export interface AnalysisModels {
  classifyTags: ReturnType<OpenAIProvider>;
  analyzeImages: ReturnType<OpenAIProvider>;
  determineImportance: ReturnType<OpenAIProvider>;
}

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
    openai: OpenAIProvider,
    articleRepository: ArticleRepository,
    tagRepository: TagRepository,
  );
  constructor(
    models: AnalysisModels,
    articleRepository: ArticleRepository,
    tagRepository: TagRepository,
  );
  constructor(
    modelsOrOpenAI: AnalysisModels | OpenAIProvider,
    private readonly articleRepository: ArticleRepository,
    private readonly tagRepository: TagRepository,
  ) {
    const models =
      typeof modelsOrOpenAI === 'function'
        ? {
            classifyTags: modelsOrOpenAI(llmConfig.models.classifyTags),
            analyzeImages: modelsOrOpenAI(llmConfig.models.analyzeImages),
            determineImportance: modelsOrOpenAI(
              llmConfig.models.determineImportance,
            ),
          }
        : modelsOrOpenAI;

    this.classifyTagOptions = {
      model: models.classifyTags,
    };

    this.analyzeImagesOptions = {
      model: models.analyzeImages,
    };

    this.determineScoreOptions = {
      model: models.determineImportance,
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
        {
          targetUrl:
            'https://www.seamuse.go.kr/resources/academiccultural/list/1',
          minScore: 6,
        },
        {
          targetUrl:
            'https://www.seamuse.go.kr/resources/academicreport/list/1',
          minScore: 6,
        },
        {
          targetUrl:
            'https://www.seamuse.go.kr/resources/academicreport/list/1#tab2',
          minScore: 6,
        },
        {
          targetUrl:
            'https://www.seamuse.go.kr/resources/academicreport/list/1#tab3',
          minScore: 6,
        },
        {
          targetUrl:
            'https://www.seamuse.go.kr/resources/academicreport/list/1#tab4',
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
    await this.articleRepository.updateAnalysis({
      ...article,
      importanceScore: capScoreByHeritageDomain(article),
    });
  }
}

/**
 * Applies the per-domain score ceiling from `maximumImportanceScoreByDomain`.
 *
 * The domain comes from `tag1`, which the tag classification prompt pins to a
 * fixed vocabulary. An off-vocabulary value means the classification did not
 * hold, so the article is left uncapped rather than capped on a guess.
 */
function capScoreByHeritageDomain(article: ArticleForUpdateByAnalysis): number {
  const domain = toHeritageDomainTag(article.tag1);

  if (!domain) {
    return article.importanceScore;
  }

  const maximumScore = maximumImportanceScoreByDomain[domain];

  return maximumScore === undefined
    ? article.importanceScore
    : Math.min(article.importanceScore, maximumScore);
}
