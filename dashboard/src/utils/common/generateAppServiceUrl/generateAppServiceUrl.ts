import {
  getAuthServiceUrl,
  getFunctionsServiceUrl,
  getGraphqlServiceUrl,
  getHasuraApiUrl,
  getStorageServiceUrl,
  isPlatform,
} from '@/utils/env';

export type NhostService =
  | 'auth'
  | 'graphql'
  | 'functions'
  | 'storage'
  | 'hasura';

/**
 * The default slugs that are used when running the dashboard locally. These
 * values are used both in local mode and when running the dashboard locally
 * against the remote (either staging or production) backend.
 */
export const defaultLocalBackendSlugs: Record<NhostService, string> = {
  auth: '/v1/auth',
  graphql: '/v1/graphql',
  functions: '/v1/functions',
  storage: '/v1/files',
  hasura: '',
};

/**
 * The default slugs that are used when running the dashboard against the
 * remote (either staging or production) backend in a cloud environment.
 */
export const defaultRemoteBackendSlugs: Record<NhostService, string> = {
  auth: '/v1',
  graphql: '/v1',
  functions: '/v1',
  storage: '/v1',
  hasura: '',
};

/**
 * Generates a service specific URL for a project. Provided `subdomain` is
 * omitted if the dashboard is running in local mode.
 *
 * @param subdomain - The project's subdomain
 * @param region - The project's region
 * @param service - The service to generate the URL for
 * @param localBackendSlugs - Custom slugs to be used when running the dashboard locally
 * @param localBackendSlugs - Custom slugs to be used when running the dashboard in a cloud environment
 * @returns The service specific URL for the project
 */
export default function generateAppServiceUrl(
  subdomain: string,
  region: string,
  service: 'auth' | 'graphql' | 'functions' | 'storage' | 'hasura',
  localBackendSlugs = defaultLocalBackendSlugs,
  remoteBackendSlugs = defaultRemoteBackendSlugs,
) {
  const IS_PLATFORM = isPlatform();

  if (!IS_PLATFORM) {
    const serviceUrls: Record<typeof service, string> = {
      auth: getAuthServiceUrl(),
      graphql: getGraphqlServiceUrl(),
      storage: getStorageServiceUrl(),
      functions: getFunctionsServiceUrl(),
      hasura: getHasuraApiUrl(),
    };

    if (!serviceUrls[service]) {
      throw new Error(
        `Service URL for "${service}" is not defined. Please check your .env file.`,
      );
    }

    return serviceUrls[service];
  }

  // This is only used when running the dashboard locally against its own
  // backend.
  if (process.env.NEXT_PUBLIC_ENV === 'dev') {
    return `${process.env.NEXT_PUBLIC_NHOST_BACKEND_URL}${localBackendSlugs[service]}`;
  }

  if (process.env.NEXT_PUBLIC_ENV === 'staging') {
    return `https://${subdomain}.${service}.${region}.staging.nhost.run${remoteBackendSlugs[service]}`;
  }

  return `https://${subdomain}.${service}.${region}.nhost.run${remoteBackendSlugs[service]}`;
}
