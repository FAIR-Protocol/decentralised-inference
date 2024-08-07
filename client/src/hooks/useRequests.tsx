/*
 * Fair Protocol, open source decentralised inference marketplace for artificial intelligence.
 * Copyright (C) 2023 Fair Protocol
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 */

import { INFERENCE_REQUEST, PROTOCOL_NAME, PROTOCOL_VERSION, TAG_NAMES } from '@/constants';
import { commonUpdateQuery } from '@/utils/common';
import { NetworkStatus, gql, useLazyQuery } from '@apollo/client';
import { useEffect, useState } from 'react';

const useRequests = ({
  userAddrs,
  solutionTx,
  conversationId,
  first,
}: {
  userAddrs: string[];
  solutionTx?: string;
  conversationId?: number;
  first?: number;
}) => {
  const [hasRequestNextPage, setHasRequestNextPage] = useState(false);
  const irysQuery = gql`
    query requestsOnIrys($tags: [TagFilter!], $owners: [String!], $first: Int, $after: String) {
      transactions(tags: $tags, owners: $owners, first: $first, after: $after, order: DESC) {
        edges {
          cursor
          node {
            id
            tags {
              name
              value
            }
            address
          }
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  `;

  const [
    getChatRequests,
    {
      data: requestsData,
      loading: requestsLoading,
      error: requestError,
      networkStatus: requestNetworkStatus,
      fetchMore: requestFetchMore,
    },
  ] = useLazyQuery(irysQuery);
  useEffect(() => {
    if (!userAddrs || userAddrs.length === 0) {
      // skip fetching while user address is not loaded
      return;
    }
    const tags = [
      { name: TAG_NAMES.protocolName, values: [PROTOCOL_NAME] },
      { name: TAG_NAMES.protocolVersion, values: [PROTOCOL_VERSION] },
      { name: TAG_NAMES.operationName, values: [INFERENCE_REQUEST] },
    ];
    if (solutionTx) {
      tags.push({ name: TAG_NAMES.solutionTransaction, values: [solutionTx] });
    }

    if (conversationId) {
      tags.push({ name: TAG_NAMES.conversationIdentifier, values: [conversationId.toString()] });
    }

    getChatRequests({
      variables: {
        tags,
        owners: userAddrs,
        first: first ?? 10,
      },
      context: {
        clientName: 'irys',
      },
      fetchPolicy: 'network-only',
      nextFetchPolicy: 'network-only',
    });
  }, [userAddrs, conversationId, first]);

  useEffect(() => {
    if (requestsData && requestNetworkStatus === NetworkStatus.ready) {
      setHasRequestNextPage(requestsData.transactions.pageInfo.hasNextPage);
    }
  }, [requestsData, requestNetworkStatus, setHasRequestNextPage]);

  const fetchMore = () => {
    const lastTx =
      requestsData.transactions.edges[requestsData.transactions.edges.length - 1].cursor;
    requestFetchMore({
      variables: {
        after: lastTx,
      },
      updateQuery: commonUpdateQuery,
    });
  };

  return {
    requestsData,
    requestsLoading,
    requestError,
    requestNetworkStatus,
    hasRequestNextPage,
    fetchMore,
  };
};

export default useRequests;
