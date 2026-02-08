// Main entry point
export {
  generateNewsletter,
  type NewsletterGeneratorDependencies,
  type PreviewNewsletterOptions,
} from './newsletter-generator';

// Dependency interfaces export
export type {
  ArticleRepository,
  NewsletterRepository,
  NewsletterTemplateOptions,
  TagRepository,
  TaskRepository,
} from './types/dependencies';

// Services export
export { DateService } from './services/date.service';
export { TaskService } from './services/task.service';

// Providers export
export { AnalysisProvider } from './providers/analysis.provider';
export { ContentGenerateProvider } from './providers/content-generate.provider';
export { CrawlingProvider } from './providers/crawling.provider';

// Configuration export
export * from './config';
