import * as Sentry from '@sentry/nextjs';
import { scrubPiiAndSecrets } from '@/lib/scrubber';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 1.0,
    debug: false,
    environment: process.env.NODE_ENV || 'development',
    beforeSend(event) {
      // Apply strict PII & secret scrubbing before dispatching to Sentry
      return scrubPiiAndSecrets(event);
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data) {
        breadcrumb.data = scrubPiiAndSecrets(breadcrumb.data);
      }
      if (breadcrumb.message) {
        breadcrumb.message = scrubPiiAndSecrets(breadcrumb.message);
      }
      return breadcrumb;
    },
  });
}
