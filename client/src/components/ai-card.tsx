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

import { Box, Icon, Tooltip, Typography, useTheme } from '@mui/material';
import { FiCard, FiCardActionArea, FiCardContent, FicardMedia } from './full-image-card';
import { IContractEdge } from '@/interfaces/arweave';
import { toSvg } from 'jdenticon';
import { useNavigate } from 'react-router-dom';
import { MouseEvent, useCallback, useEffect, useMemo } from 'react';
import { displayShortTxOrAddr, findTag } from '@/utils/common';
import { useLazyQuery } from '@apollo/client';
import { GET_LATEST_MODEL_ATTACHMENTS } from '@/queries/graphql';
import {
  AVATAR_ATTACHMENT,
  MODEL_ATTACHMENT,
  TAG_NAMES,
  NET_ARWEAVE_URL,
  DEFAULT_TAGS,
  secondInMS,
} from '@/constants';
import { ModelNavigationState } from '@/interfaces/router';

const AiCard = ({ model, useModel = false }: { model: IContractEdge; useModel?: boolean }) => {
  const theme = useTheme();
  const navigate = useNavigate();

  const [getAvatar, { data, loading: avatarLoading }] = useLazyQuery(GET_LATEST_MODEL_ATTACHMENTS);

  const imgUrl = useMemo(() => {
    if (data) {
      const avatarTxId = data?.transactions?.edges[0]
        ? data.transactions.edges[0].node.id
        : undefined;
      if (avatarTxId) {
        return `${NET_ARWEAVE_URL}/${avatarTxId}`;
      }
      const modelId = findTag(model, 'modelTransaction');
      const img = toSvg(modelId, 100);
      const svg = new Blob([img], { type: 'image/svg+xml' });
      return URL.createObjectURL(svg);
    } else {
      return '';
    }
  }, [data]);

  const owner = useMemo(
    () => findTag(model, 'sequencerOwner') ?? model.node.owner.address,
    [model],
  );
  const modelId = useMemo(() => findTag(model, 'modelTransaction'), [model]);
  const modelName = useMemo(() => findTag(model, 'modelName'), [model]);

  useEffect(() => {
    const modelId = findTag(model, 'modelTransaction');
    const attachmentAvatarTags = [
      ...DEFAULT_TAGS, // allow avatars from previous versions
      { name: TAG_NAMES.operationName, values: [MODEL_ATTACHMENT] },
      { name: TAG_NAMES.attachmentRole, values: [AVATAR_ATTACHMENT] },
      { name: TAG_NAMES.modelTransaction, values: [modelId] },
    ];

    getAvatar({
      variables: {
        tags: attachmentAvatarTags,
        owner,
      },
      fetchPolicy: 'no-cache',
    });
  }, []);

  const getTimePassed = () => {
    const timestamp = findTag(model, 'unixTime');
    if (!timestamp) return 'Pending';
    const currentTimestamp = Date.now();

    const dateA = parseInt(timestamp, 10) * secondInMS;
    const dateB = currentTimestamp;

    const timeDiff = dateB - dateA;

    // 1 day = 1000 * 60 * 60
    const day = 1000 * 60 * 60 * 24;
    const nDaysDiff = Math.round(timeDiff / day);

    if (nDaysDiff <= 0) {
      return 'Today';
    } else if (nDaysDiff > 7 && nDaysDiff <= 28) {
      const nWeeks = Math.round(nDaysDiff / 7);
      return `${nWeeks} Week(s) Ago`;
    } else if (nDaysDiff > 14 && nDaysDiff <= 28) {
      const nMonths = Math.round(nDaysDiff / 30);
      return `${nMonths} Month(s) Ago`;
    } else {
      return `${nDaysDiff} Day(s) ago`;
    }
  };

  const handleCardClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (!modelId) return;
      localStorage.setItem('hasSignedIn', 'true');
      const url = useModel
        ? `/model/${encodeURIComponent(modelId)}/detail?useModel=true`
        : `/model/${encodeURIComponent(modelId)}/detail`;
      navigate(url, {
        state: {
          modelName: findTag(model, 'modelName'),
          modelCreator: owner,
          modelTransaction: modelId,
          fullState: model,
        },
      } as { state: ModelNavigationState });
    },
    [modelId],
  );

  return (
    <FiCard
      sx={{
        flexGrow: 0,
      }}
    >
      <FiCardActionArea
        onClick={handleCardClick}
        className={`plausible-event-name=Featured+Model+Click plausible-event-transaction=${modelId}+${modelName}`}
      >
        {!imgUrl || avatarLoading ? (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '317px',
              height: '352px',
              background: `linear-gradient(180deg, rgba(71, 71, 71, 0) 0%, ${theme.palette.background.default} 100%)`,
              // backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: 'cover' /* <------ */,
              backgroundPosition: 'center center',
            }}
          />
        ) : (
          <FicardMedia
            src={avatarLoading ? '' : imgUrl}
            sx={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '317px',
              height: '352px',
              background: `linear-gradient(180deg, rgba(71, 71, 71, 0) 40%, ${
                theme.palette.background.default
              } 100%), url(${avatarLoading ? '' : imgUrl})`,
              // backgroundPosition: 'center',s
              backgroundRepeat: 'no-repeat',
              backgroundSize: 'cover' /* <------ */,
              backgroundPosition: 'center center',
            }}
          />
        )}

        <FiCardContent>
          <Tooltip title={findTag(model, 'modelName') ?? 'Untitled'} placement={'top-start'}>
            <Typography variant='h2' noWrap>
              {findTag(model, 'modelName') ?? 'Untitled'}
            </Typography>
          </Tooltip>
          <Tooltip title={owner} placement={'bottom-start'}>
            <Typography variant='h6'>{displayShortTxOrAddr(owner ?? 'Unknown')}</Typography>
          </Tooltip>

          <Typography variant='h6'>{getTimePassed()}</Typography>
          <Icon
            sx={{
              position: 'relative',
              bottom: '48px',
              left: '265px',
            }}
          >
            <img src='./thumbs-up.svg' />
          </Icon>
        </FiCardContent>
      </FiCardActionArea>
    </FiCard>
  );
};

export default AiCard;
