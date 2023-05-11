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

import {
  APP_NAME,
  APP_VERSION,
  CONVERSATION_START,
  DEFAULT_TAGS,
  TAG_NAMES,
  secondInMS,
} from '@/constants';
import useOnScreen from '@/hooks/useOnScreen';
import { IEdge } from '@/interfaces/arweave';
import { ScriptNavigationState } from '@/interfaces/router';
import { QUERY_CONVERSATIONS } from '@/queries/graphql';
import arweave from '@/utils/arweave';
import { commonUpdateQuery, findTag } from '@/utils/common';
import { useQuery } from '@apollo/client';
import {
  Paper,
  Box,
  InputBase,
  Icon,
  Tooltip,
  IconButton,
  List,
  ListItemButton,
  Typography,
  useTheme,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import { LoadingContainer } from '@/styles/components';

const ConversationElement = ({
  cid,
  currentConversationId,
  setCurrentConversationId,
}: {
  cid: number;
  currentConversationId: number;
  setCurrentConversationId: Dispatch<SetStateAction<number>>;
}) => {
  const theme = useTheme();
  const handleListItemClick = useCallback(
    () => setCurrentConversationId(cid),
    [setCurrentConversationId],
  );

  return (
    <ListItemButton
      alignItems='center'
      selected={cid === currentConversationId}
      onClick={handleListItemClick}
      sx={{
        background: theme.palette.mode === 'dark' ? '#434343' : theme.palette.primary.main,
        borderRadius: '21px',
        width: '100%',
        justifyContent: 'center',
        height: '91px',
        color: theme.palette.secondary.contrastText,
        '&.Mui-selected, &.Mui-selected:hover': {
          opacity: 1,
          backdropFilter: 'brightness(0.5)',
          color: theme.palette.primary.contrastText,
        },
        '&:hover': {
          backdropFilter: 'brightness(0.5)',
        },
      }}
    >
      <Typography
        sx={{
          fontStyle: 'normal',
          fontWeight: 700,
          fontSize: '15px',
          lineHeight: '20px',
          display: 'flex',
          alignItems: 'center',
          textAlign: 'center',
          color: 'inherit',
        }}
      >
        Conversation {cid}
      </Typography>
    </ListItemButton>
  );
};

const Conversations = ({
  currentConversationId,
  setCurrentConversationId,
  state,
  userAddr,
}: {
  currentConversationId: number;
  setCurrentConversationId: Dispatch<SetStateAction<number>>;
  state: ScriptNavigationState;
  userAddr: string;
}) => {
  const [hasConversationNextPage, setHasConversationNextPage] = useState(false);
  const [conversationIds, setConversationIds] = useState<number[]>([]);
  const [filteredConversationIds, setFilteredConversationIds] = useState<number[]>([]);
  const [filterConversations, setFilterConversations] = useState('');
  const conversationsTarget = useRef<HTMLDivElement>(null);
  const isConversationOnScreen = useOnScreen(conversationsTarget);
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();

  const {
    data: conversationsData,
    loading: conversationsLoading,
    fetchMore: conversationsFetchMore,
  } = useQuery(QUERY_CONVERSATIONS, {
    variables: {
      address: userAddr,
      tags: [
        ...DEFAULT_TAGS,
        {
          name: TAG_NAMES.operationName,
          values: [CONVERSATION_START],
        },
        {
          name: TAG_NAMES.scriptTransaction,
          values: [state.scriptTransaction],
        },
        { name: TAG_NAMES.scriptName, values: [state.scriptName] },
        { name: TAG_NAMES.scriptCurator, values: [state.scriptCurator] },
      ],
    },
    skip: !userAddr || !state,
  });

  const createNewConversation = async (id: number) => {
    try {
      const tx = await arweave.createTransaction({ data: 'Conversation Start' });
      tx.addTag(TAG_NAMES.appName, APP_NAME);
      tx.addTag(TAG_NAMES.appVersion, APP_VERSION);
      tx.addTag(TAG_NAMES.operationName, CONVERSATION_START);
      tx.addTag(TAG_NAMES.scriptName, state.scriptName);
      tx.addTag(TAG_NAMES.scriptCurator, state.scriptCurator);
      tx.addTag(TAG_NAMES.scriptTransaction, state.scriptTransaction);
      tx.addTag(TAG_NAMES.unixTime, (Date.now() / secondInMS).toString());
      tx.addTag(TAG_NAMES.conversationIdentifier, `${id}`);
      await window.arweaveWallet.dispatch(tx);

      setConversationIds([id, ...conversationIds]);
      setFilteredConversationIds([id, ...conversationIds]);
      setCurrentConversationId(id);
    } catch (error) {
      enqueueSnackbar('Could not Start Conversation', { variant: 'error' });
    }
  };

  useEffect(() => {
    if (conversationsData && conversationsData.transactions.edges.length > 0) {
      setHasConversationNextPage(conversationsData.transactions.pageInfo.hasNextPage);
      const cids: number[] = conversationsData.transactions.edges.map((el: IEdge) =>
        parseFloat(findTag(el, 'conversationIdentifier') as string),
      );

      const sorted = [...cids].sort((a, b) => b - a);
      setConversationIds(Array.from(new Set(sorted)));
      setFilteredConversationIds(Array.from(new Set(sorted)));
      setCurrentConversationId(Array.from(new Set(sorted))[0]);
    } else if (conversationsData && conversationsData.transactions.edges.length === 0) {
      setHasConversationNextPage(false);
      // no conversations yet, create new
      (async () => {
        await createNewConversation(1);
        setCurrentConversationId(1);
      })();
    } else {
      // do nothing
    }
  }, [conversationsData]);

  useEffect(() => {
    if (isConversationOnScreen && hasConversationNextPage) {
      const conversations = conversationsData.transactions.edges;
      conversationsFetchMore({
        variables: {
          after:
            conversations.length > 0 ? conversations[conversations.length - 1].cursor : undefined,
        },
        updateQuery: commonUpdateQuery,
      });
    }
  }, [isConversationOnScreen, hasConversationNextPage, conversationsData]);

  useEffect(() => {
    if (conversationIds && conversationIds.length > 0) {
      setFilteredConversationIds(
        conversationIds.filter((el) => `${el}`.includes(filterConversations)),
      );
    }
  }, [filterConversations]);

  useEffect(() => {
    if (currentConversationId) {
      setCurrentConversationId(currentConversationId);
    }
  }, [currentConversationId]);

  const handleAddConversation = useCallback(async () => {
    const last = Math.max(...conversationIds);
    await createNewConversation(last + 1);
    setFilterConversations('');
    setCurrentConversationId(last + 1);
  }, [setFilterConversations, setCurrentConversationId, createNewConversation]);

  const handleFilterConversations = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setFilterConversations(e.target.value),
    [setFilterConversations],
  );

  return (
    <Paper
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        height: '100%',
        // background: 'rgba(21, 21, 21, 1)',
        gap: '16px',
        background: theme.palette.secondary.main,
        // opacity: '0.3',
        borderRadius: ' 0px 20px 20px 0px',
      }}
      elevation={4}
    >
      <Box marginTop={'16px'}>
        <Box
          sx={{
            background: theme.palette.common.white,
            borderRadius: '30px',
            margin: '0 20px',
            display: 'flex',
            justifyContent: 'space-between',
            padding: '3px 20px 3px 50px',
            alignItems: 'center',
          }}
        >
          <InputBase
            sx={{
              color: theme.palette.text.primary,
              fontStyle: 'normal',
              fontWeight: 400,
              fontSize: '12px',
              lineHeight: '16px',
            }}
            placeholder='Search Conversations...'
            value={filterConversations}
            onChange={handleFilterConversations}
          />
          <Icon
            sx={{
              height: '30px',
            }}
          >
            <img src='./search-icon.svg'></img>
          </Icon>
        </Box>
      </Box>
      <Tooltip title='Start a new Conversation'>
        <IconButton
          onClick={handleAddConversation}
          sx={{
            margin: '0 20px',
            borderRadius: '30px',
            color: theme.palette.primary.contrastText,
          }}
        >
          <AddIcon />
        </IconButton>
      </Tooltip>
      <List
        sx={{
          display: 'flex',
          gap: '16px',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          padding: '0 20px',
        }}
      >
        {conversationsLoading && <LoadingContainer theme={theme} className='dot-pulse' />}
        {filteredConversationIds.map((cid) => (
          <ConversationElement
            cid={cid}
            key={cid}
            currentConversationId={currentConversationId}
            setCurrentConversationId={setCurrentConversationId}
          />
        ))}
        <Box sx={{ paddingBottom: '8px' }} ref={conversationsTarget}></Box>
      </List>
      <Box flexGrow={1}></Box>
    </Paper>
  );
};

export default Conversations;
