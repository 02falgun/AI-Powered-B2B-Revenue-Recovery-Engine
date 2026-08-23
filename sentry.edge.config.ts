import * as Sentry from '@sentry/nextjs';
import { scrubPiiAndSecrets } from '@/lib/scrubber';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 1.0,
    debug: false,
    environment: process.env.NODE_ENV || 'development',
    beforeSend(event) {
      return scrubPiiAndSecrets(event);
    },
  });
}
