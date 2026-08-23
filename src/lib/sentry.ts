import * as Sentry from '@sentry/nextjs';
import { scrubPiiAndSecrets } from './scrubber';

/**
 * Captures an exception to Sentry with mandatory PII & Secret Scrubbing.
 * Operates gracefully as a no-op if Sentry is unconfigured.
 */
export function captureScrubbedException(
  error: unknown,
  context?: {
    readonly invoiceId?: string;
    readonly companyId?: string;
    readonly errorType?: string;
    readonly extra?: Readonly<Record<string, unknown>>;
  },
): string | undefined {
  try {
    const scrubbedError = scrubPiiAndSecrets(error);
    const scrubbedContext = context ? scrubPiiAndSecrets(context) : undefined;

    return Sentry.captureException(scrubbedError, {
      tags: {
        invoiceId: context?.invoiceId,
        companyId: context?.companyId,
        errorType: context?.errorType,
      },
      extra: scrubbedContext?.extra,
    });
  } catch (sentryErr) {
    console.warn('[Sentry Capture Warning]:', sentryErr);
    return undefined;
  }
}
