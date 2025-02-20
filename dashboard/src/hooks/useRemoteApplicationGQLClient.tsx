import { useCurrentWorkspaceAndProject } from '@/hooks/v2/useCurrentWorkspaceAndProject';
import generateAppServiceUrl from '@/utils/common/generateAppServiceUrl';
import { getHasuraAdminSecret } from '@/utils/env';
import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { useMemo } from 'react';

/**
 * It creates a new Apollo Client instance that connects to the remote application's GraphQL endpoint
 * @returns A function that returns a new ApolloClient instance.
 */
export function useRemoteApplicationGQLClient() {
  const { currentProject } = useCurrentWorkspaceAndProject();

  const userApplicationClient = useMemo(() => {
    if (!currentProject) {
      return new ApolloClient({ cache: new InMemoryCache() });
    }

    return new ApolloClient({
      cache: new InMemoryCache(),
      link: new HttpLink({
        uri: generateAppServiceUrl(
          currentProject?.subdomain,
          currentProject?.region.awsName,
          'graphql',
        ),
        headers: {
          'x-hasura-admin-secret':
            process.env.NEXT_PUBLIC_ENV === 'dev'
              ? getHasuraAdminSecret()
              : currentProject?.config?.hasura.adminSecret,
        },
      }),
    });
  }, [currentProject]);

  return userApplicationClient;
}

export default useRemoteApplicationGQLClient;
