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
  Backdrop,
  Box,
  CircularProgress,
  Drawer,
  Fab,
  FormControl,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Tooltip,
  Typography,
  Zoom,
  useTheme,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { NetworkStatus } from '@apollo/client';
import {
  ChangeEvent,
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  TAG_NAMES,
  N_PREVIOUS_BLOCKS,
  textContentType,
  MAX_MESSAGE_SIZE,
  WARP_ASSETS_EXPLORER,
  IRYS_TXS_EXPLORER,
  SCRIPT_INFERENCE_REQUEST,
} from '@/constants';
import { IEdge, ITag } from '@/interfaces/arweave';
import Transaction from 'arweave/node/lib/transaction';
import { useSnackbar } from 'notistack';
import { WalletContext } from '@/context/wallet';
import usePrevious from '@/hooks/usePrevious';
import arweave, { getData } from '@/utils/arweave';
import { addLicenseConfigTags, commonUpdateQuery, findTag, printSize } from '@/utils/common';
import useWindowDimensions from '@/hooks/useWindowDimensions';
import _ from 'lodash';
import '@/styles/main.css';
import Conversations from '@/components/conversations';
import { IConfiguration, IMessage } from '@/interfaces/common';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ClearIcon from '@mui/icons-material/Clear';
import ChatContent from '@/components/chat-content';
import DebounceIconButton from '@/components/debounce-icon-button';
import { parseUBalance } from '@/utils/u';
import SettingsIcon from '@mui/icons-material/Settings';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Configuration from '@/components/configuration';
import useComponentDimensions from '@/hooks/useComponentDimensions';
import useRequests from '@/hooks/useRequests';
import useResponses from '@/hooks/useResponses';
import FairSDKWeb from '@fair-protocol/sdk/web';
import useScroll from '@/hooks/useScroll';
import { useForm, useWatch } from 'react-hook-form';
import useOperatorBusy from '@/hooks/useOperatorBusy';
import { InfoOutlined } from '@mui/icons-material';
import { UserFeedbackContext } from '@/context/user-feedback';
import useRatingFeedback from '@/hooks/useRatingFeedback';

const errorMsg = 'An Error Occurred. Please try again later.';
const DEFAULT_N_IMAGES = 4;
const RADIX = 10;

const InputField = ({
  file,
  loading,
  disabled,
  currentConversationId,
  newMessage,
  inputRef,
  handleAdvanced,
  handleSendFile,
  handleSendText,
  handleRemoveFile,
  handleMessageChange,
  handleFileUpload,
}: {
  file?: File;
  loading: boolean;
  disabled: boolean;
  currentConversationId: number;
  newMessage: string;
  inputRef: RefObject<HTMLTextAreaElement>;
  handleAdvanced: () => void;
  handleSendFile: () => Promise<void>;
  handleSendText: () => Promise<void>;
  handleRemoveFile: () => void;
  handleMessageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleFileUpload: (event: ChangeEvent<HTMLInputElement>) => void;
}) => {
  const theme = useTheme();
  const { state } = useLocation();
  const { setOpen: setOpenRating } = useContext(UserFeedbackContext);
  const { currentAddress: userAddr } = useContext(WalletContext);
  const { showFeedback, setShowFeedback } = useRatingFeedback(userAddr);

  const allowFiles = useMemo(() => findTag(state.fullState, 'allowFiles') === 'true', [state]);
  const allowText = useMemo(
    () =>
      !findTag(state.fullState, 'allowText')
        ? true
        : findTag(state.fullState, 'allowText') === 'true',
    [state],
  );
  const uploadDisabled = useMemo(
    () => file instanceof File || loading || !allowFiles,
    [file, loading, allowFiles],
  );
  const [isSending, setIsSending] = useState(false);

  const sendDisabled = useMemo(() => {
    if (isSending) {
      return true;
    } else if (!currentConversationId || loading) {
      return true;
    } else {
      return (newMessage.length === 0 || newMessage.length >= MAX_MESSAGE_SIZE) && !file;
    }
  }, [newMessage, file, currentConversationId, loading, isSending]);

  const handleSendClick = useCallback(async () => {
    if (isSending) {
      return;
    } else {
      // continue
    }
    setIsSending(true);

    if (file) {
      // handle send file
      await handleSendFile();
    } else {
      await handleSendText();
    }

    setIsSending(false);
    // if user is active and has not submitted feedback, show feedback
    if (showFeedback) {
      setTimeout(() => {
        setOpenRating(true);
        setShowFeedback(false);
      }, 2000);
    }
  }, [handleSendFile, handleSendText, setOpenRating, file, isSending, showFeedback]);

  // avoid send duplicated messages and show the new line if it's only the Enter key
  const keyDownHandler = async (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.code === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!sendDisabled && !isSending) {
        setIsSending(true);
        if (file) {
          // handle send file
          await handleSendFile();
        } else {
          await handleSendText();
        }
        setIsSending(false);
      }
    }
  };

  const handleFileBlur = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.value === '') {
      handleRemoveFile();
    }
  }, []);

  if (loading || file) {
    return (
      <FormControl variant='outlined' fullWidth>
        {file && (
          <TextField
            value={file?.name}
            disabled={disabled}
            multiline
            minRows={1}
            maxRows={3}
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <IconButton
                    aria-label='Remove'
                    onClick={handleRemoveFile}
                    className='plausible-event-name=Remove+File+Click'
                  >
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ),
              endAdornment: (
                <>
                  <InputAdornment position='start'>{printSize(file)}</InputAdornment>
                  <DebounceIconButton
                    onClick={handleSendClick}
                    sx={{
                      color: theme.palette.neutral.contrastText,
                    }}
                    disabled={sendDisabled}
                    className='plausible-event-name=Send+File+Click'
                  >
                    <SendIcon />
                  </DebounceIconButton>
                </>
              ),
              sx: {
                background: theme.palette.background.default,
                fontStyle: 'normal',
                fontWeight: 400,
                fontSize: '20px',
                lineHeight: '16px',
                width: '100%',
                marginTop: '10px',
                borderRadius: '8px',
              },
              readOnly: true,
            }}
          />
        )}
        {loading && <CircularProgress variant='indeterminate' />}
      </FormControl>
    );
  } else {
    return (
      <>
        <TextField
          inputRef={inputRef}
          multiline
          minRows={1}
          maxRows={3}
          sx={{
            background: theme.palette.background.default,
            fontStyle: 'normal',
            fontWeight: 400,
            fontSize: '20px',
            lineHeight: '16px',
            width: '100%',
            marginTop: '10px',
            borderRadius: '8px',
          }}
          InputProps={{
            endAdornment: (
              <>
                <Tooltip title={'Advanced Input configuration'}>
                  <span>
                    <IconButton
                      component='label'
                      onClick={handleAdvanced}
                      className='plausible-event-name=Open+Configuration+Click'
                    >
                      <SettingsIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip
                  title={!allowFiles ? 'Script does not support Uploading files' : 'File Loaded'}
                >
                  <span>
                    <IconButton
                      component='label'
                      disabled={uploadDisabled}
                      className='plausible-event-name=Upload+File+Click'
                    >
                      <AttachFileIcon />
                      <input
                        type='file'
                        hidden
                        multiple={false}
                        onChange={handleFileUpload}
                        onBlur={handleFileBlur}
                      />
                    </IconButton>
                  </span>
                </Tooltip>

                <DebounceIconButton
                  onClick={handleSendClick}
                  sx={{
                    color: theme.palette.neutral.contrastText,
                  }}
                  disabled={sendDisabled}
                  className='plausible-event-name=Send+Text+Click'
                >
                  <SendIcon />
                </DebounceIconButton>
              </>
            ),
          }}
          error={newMessage.length >= MAX_MESSAGE_SIZE}
          onChange={handleMessageChange}
          onKeyDown={keyDownHandler}
          fullWidth
          disabled={isSending || disabled || !allowText}
          placeholder='Start Chatting...'
        />
      </>
    );
  }
};

const Chat = () => {
  const [currentConversationId, setCurrentConversationId] = useState(0);
  const { address } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const {
    currentAddress: userAddr,
    updateUBalance,
    currentUBalance,
    dispatchTx,
  } = useContext(WalletContext);
  const previousAddr = usePrevious<string>(userAddr);
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [pendingTxs] = useState<Transaction[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const { width, height } = useWindowDimensions();
  const { width: chatWidth } = useComponentDimensions(chatRef);
  const [chatMaxHeight, setChatMaxHeight] = useState('100%');
  const { enqueueSnackbar } = useSnackbar();
  const elementsPerPage = 2;
  const scrollableRef = useRef<HTMLDivElement>(null);
  const [isWaitingResponse, setIsWaitingResponse] = useState(false);
  const [responseTimeout, setResponseTimeout] = useState(false);
  const theme = useTheme();
  const target = useRef<HTMLDivElement>(null);
  const [previousResponses, setPreviousResponses] = useState<IEdge[]>([]);
  const [currentEl, setCurrentEl] = useState<HTMLDivElement | undefined>(undefined);
  const { isNearTop } = useScroll(scrollableRef);
  const { scrollHeight } = useComponentDimensions(scrollableRef);
  const [file, setFile] = useState<File | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [inputWidth, setInputWidth] = useState('');
  const [inputHeight, setInputHeight] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [configurationDrawerOpen, setConfigurationDrawerOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState('64px');
  const [requestIds] = useState<string[]>([]);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isStableDiffusion = useMemo(
    () => findTag(state.fullState, 'outputConfiguration') === 'stable-diffusion',
    [state],
  );
  const defaultConfigvalues: IConfiguration = {
    assetNames: '',
    generateAssets: 'fair-protocol',
    negativePrompt: '',
    description: '',
    customTags: [],
    width: 0,
    height: 0,
    nImages: DEFAULT_N_IMAGES,
    rareweaveConfig: {
      royalty: 0,
    },
    license: 'Default',
    licenseConfig: {
      derivations: '',
      commercialUse: '',
      licenseFeeInterval: '',
      currency: '$U',
      paymentMode: '',
    },
  };
  const {
    control: configControl,
    setValue: setConfigValue,
    reset: configReset,
  } = useForm<IConfiguration>({
    defaultValues: defaultConfigvalues,
  });

  const currentConfig = useWatch({ control: configControl });

  /**
   * If there is a save element (currentEl) scroll to it to mantain user in same place after load more
   */
  useEffect(() => {
    if (currentEl) {
      currentEl?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [scrollHeight, currentEl, messagesEndRef]);

  useEffect(() => {
    const previousConfig = localStorage.getItem(`config#${state.scriptTransaction}`);
    const useStableDiffusionConfig =
      findTag(state.fullState, 'outputConfiguration') === 'stable-diffusion';
    if (previousConfig) {
      configReset(JSON.parse(previousConfig), { keepDefaultValues: true });
    } else if (useStableDiffusionConfig) {
      const nonSDconfig = {
        ...defaultConfigvalues,
        nImages: undefined,
        negativePrompt: undefined,
      };
      configReset(nonSDconfig, { keepDefaultValues: true });
    } else {
      // ignore
    }
  }, [state, configReset]);

  useEffect(() => {
    if (!_.isEqual(currentConfig, defaultConfigvalues)) {
      localStorage.setItem(`config#${state.scriptTransaction}`, JSON.stringify(currentConfig));
    } else {
      localStorage.removeItem(`config#${state.scriptTransaction}`);
    }
  }, [currentConfig]);

  const [requestParams, setRequestParams] = useState({
    target,
    scrollableRef,
    userAddr,
    scriptName: state.scriptName,
    scriptCurator: state.scriptCurator,
    scriptOperator: state.scriptOperator,
    conversationId: currentConversationId,
    first: elementsPerPage,
  });
  const [responseParams, setResponseParams] = useState({
    userAddr,
    reqIds: requestIds,
    scriptName: state.scriptName,
    scriptCurator: state.scriptCurator,
    scriptOperators: [state.scriptOperator],
    conversationId: currentConversationId,
    lastRequestId: '',
  });

  const { requestsData, requestError, requestNetworkStatus, hasRequestNextPage, requestFetchMore } =
    useRequests(requestParams);

  const { responsesData, responseError, responseNetworkStatus, responsesPollingData } =
    useResponses(responseParams);

  const showOperatorBusy = useOperatorBusy(address as string, userAddr);

  const showError = useMemo(() => !!requestError || !!responseError, [requestError, responseError]);
  const showLoadMore = useMemo(
    () => isNearTop && hasRequestNextPage && !messagesLoading,
    [isNearTop, hasRequestNextPage, messagesLoading],
  );

  useEffect(() => {
    (async () => FairSDKWeb.use('script', state.fullState))();
  }, [state]);

  useEffect(() => {
    const currHeaderHeight = document.querySelector('header')?.clientHeight as number;
    setChatMaxHeight(`${height - currHeaderHeight}px`);
  }, [height]);

  useEffect(() => {
    if (previousAddr && previousAddr !== userAddr) {
      navigate(0);
    } else if (!localStorage.getItem('wallet') && !userAddr) {
      navigate('/');
    } else if (userAddr) {
      setRequestParams((previousParams) => ({
        ...previousParams,
        userAddr,
      }));
    } else {
      // ignore
    }
  }, [previousAddr, userAddr]);

  useEffect(() => {
    if (requestsData && requestNetworkStatus === NetworkStatus.ready) {
      //
      const reqIds = requestsData.transactions.edges.map((el: IEdge) => el.node.id);

      if (reqIds.length > 0) {
        const scriptOperators = Array.from(
          new Set(
            requestsData.transactions.edges.map((el: IEdge) => findTag(el, 'scriptOperator')),
          ),
        );
        (async () => reqData())();
        setResponseParams({
          ...responseParams,
          scriptOperators,
          reqIds,
        });
      } else {
        setResponseParams({
          ...responseParams,
          reqIds,
          lastRequestId: '',
        });
        setMessagesLoading(false);
        setMessages([]);
      }
    }
  }, [requestsData, requestNetworkStatus]);

  useEffect(() => {
    // only update messages after getting all responses
    const hasResponsesNextPage = responsesData?.transactions.pageInfo.hasNextPage;
    if (responsesData && responseNetworkStatus === NetworkStatus.ready && !hasResponsesNextPage) {
      const newResponses = responsesData.transactions.edges.filter(
        (previous: IEdge) =>
          !previousResponses.find((current: IEdge) => current.node.id === previous.node.id),
      );
      if (newResponses.length > 0) {
        setPreviousResponses((prev) => [...prev, ...newResponses]);
        (async () => {
          await reqData([...previousResponses, ...newResponses]);
          setMessagesLoading(false);
        })();
      } else {
        setMessagesLoading(false);
      }
    }
  }, [responsesData, responseNetworkStatus]);

  useEffect(() => {
    if (currentConversationId) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setCurrentEl(undefined);
      setPreviousResponses([]); // clear previous responses
      setIsWaitingResponse(false);
      setRequestParams({
        ...requestParams,
        conversationId: currentConversationId,
      });
      setMessagesLoading(true);
    }
  }, [currentConversationId]);

  useEffect(() => {
    if (!responsesPollingData) {
      return;
    }

    const responses = responsesPollingData?.transactions?.edges || [];
    const currentRespones = previousResponses;
    const newValidResponses = responses.filter(
      (res: IEdge) => !currentRespones.find((el: IEdge) => el.node.id === res.node.id),
    );
    (async () => {
      if (newValidResponses.length > 0) {
        setPreviousResponses([...currentRespones, ...newValidResponses]);
        await asyncMap(newValidResponses);
      } else {
        await emptyPolling();
      }
    })();
  }, [responsesPollingData]);

  const mapTransactionsToMessages = async (el: IEdge) => {
    const msgIdx = messages.findIndex((m) => m.id === el.node.id);

    const contentType = findTag(el, 'contentType');
    const data =
      msgIdx <= 0 ? await getData(el.node.id, findTag(el, 'fileName')) : messages[msgIdx].msg;
    const timestamp =
      parseInt(findTag(el, 'unixTime') || '', 10) || el.node.block?.timestamp || Date.now() / 1000;
    const cid = findTag(el, 'conversationIdentifier') as string;
    const currentHeight = (await arweave.blocks.getCurrent()).height;
    const isRequest = findTag(el, 'operationName') === SCRIPT_INFERENCE_REQUEST;

    const msg: IMessage = {
      id: el.node.id,
      msg: data,
      type: isRequest ? 'request' : 'response',
      cid: parseInt(cid?.split('-')?.length > 1 ? cid?.split('-')[1] : cid, 10),
      height: el.node.block ? el.node.block.height : currentHeight,
      to: isRequest ? (findTag(el, 'scriptOperator') as string) : userAddr,
      from: isRequest ? userAddr : el.node.owner.address,
      tags: el.node.tags,
      contentType,
      timestamp,
    };

    return msg;
  };

  const asyncMap = async (newData: IEdge[]) => {
    const temp: IMessage[] = [];

    const filteredData = newData.filter((el: IEdge) => {
      const cid = findTag(el, 'conversationIdentifier');
      if (cid && cid.split('-').length > 1) {
        return parseInt(cid.split('-')[1], 10) === currentConversationId;
      } else if (cid) {
        return parseInt(cid, 10) === currentConversationId;
      } else {
        return false;
      }
    });

    await Promise.all(
      filteredData.map(async (el) => temp.push(await mapTransactionsToMessages(el))),
    );

    const allnewMessages = [...temp, ...messages];
    setMessages((prev) => {
      const uniqueNewMsgs = _.uniqBy([...prev, ...allnewMessages], 'id').filter(
        (el) => el.cid === currentConversationId,
      );
      sortMessages(uniqueNewMsgs);

      checkIsWaitingResponse(uniqueNewMsgs);
      return uniqueNewMsgs;
    });
  };

  const checkCanSend = (dataSize: number, isFile = false) => {
    try {
      if (!currentConversationId) {
        enqueueSnackbar('Missing COnversation Id', { variant: 'error' });
        return false;
      }

      if (!isFile && dataSize > MAX_MESSAGE_SIZE) {
        enqueueSnackbar('Message Too Long', { variant: 'error' });
        return false;
      }

      const actualFee =
        currentConfig.nImages && isStableDiffusion ? state.fee * currentConfig.nImages : state.fee;
      if (currentUBalance < parseUBalance(actualFee)) {
        enqueueSnackbar('Not Enough $U tokens to pay Operator', { variant: 'error' });
        return false;
      }

      return true;
    } catch (error) {
      enqueueSnackbar('Something went wrong', { variant: 'error' });
      return false;
    }
  };

  const copySettings = useCallback(
    (promptTags: ITag[]) => {
      const settingsTags = [
        TAG_NAMES.generateAssets,
        TAG_NAMES.assetNames,
        TAG_NAMES.negativePrompt,
        TAG_NAMES.description,
        TAG_NAMES.userCustomTags,
        TAG_NAMES.nImages,
        TAG_NAMES.rareweaveConfig,
      ];
      const tags = promptTags.filter((tag) => settingsTags.includes(tag.name));
      const configuration: IConfiguration = {};

      tags.reduce((acc, tag) => {
        switch (tag.name) {
          case TAG_NAMES.generateAssets:
            acc.generateAssets = tag.value as 'fair-protocol' | 'rareweave' | 'none';
            break;
          case TAG_NAMES.assetNames:
            acc.assetNames = JSON.parse(tag.value);
            break;
          case TAG_NAMES.negativePrompt:
            acc.negativePrompt = tag.value;
            break;
          case TAG_NAMES.description:
            acc.description = tag.value;
            break;
          case TAG_NAMES.userCustomTags:
            acc.customTags = JSON.parse(tag.value);
            break;
          case TAG_NAMES.nImages:
            acc.nImages = parseInt(tag.value, RADIX);
            break;
          case TAG_NAMES.rareweaveConfig:
            acc.rareweaveConfig = JSON.parse(tag.value);
            break;
          case TAG_NAMES.licenseConfig:
            acc.licenseConfig = JSON.parse(tag.value);
            acc.license = JSON.parse(tag.value).license;
            break;
          default:
            break;
        }
        return acc;
      }, configuration);

      configReset(configuration, { keepDefaultValues: true });
    },
    [configReset],
  );

  const getConfigValues = useCallback(() => {
    const { generateAssets, description, negativePrompt, nImages } = currentConfig;
    const assetNames = currentConfig.assetNames
      ? currentConfig.assetNames.split(';').map((el) => el.trim())
      : undefined;
    const customTags = (currentConfig.customTags as { name: string; value: string }[]) ?? [];
    const royalty = currentConfig.rareweaveConfig?.royalty;
    const { width: configWidth, height: configHeight } = currentConfig;

    return {
      generateAssets,
      assetNames,
      negativePrompt,
      description,
      customTags,
      nImages,
      width: configWidth,
      height: configHeight,
      ...(royalty && {
        rareweaveConfig: {
          royalty: royalty / 100,
        },
      }),
    };
  }, [currentConfig]);

  const updateMessages = async (
    txid: string,
    content: string | File,
    contentType: string,
    tags: ITag[],
  ) => {
    setNewMessage('');
    if (inputRef?.current) {
      inputRef.current.value = '';
    }
    setFile(undefined);
    setIsWaitingResponse(true);
    setResponseTimeout(false);
    let url;
    if (tags.find((tag) => tag.name === TAG_NAMES.contractSrc)?.value !== undefined) {
      url = `${WARP_ASSETS_EXPLORER}/${txid}`;
    } else {
      url = `${IRYS_TXS_EXPLORER}/${txid}`;
    }

    enqueueSnackbar(
      <>
        Inference Request
        <br></br>
        <a href={url} target={'_blank'} rel='noreferrer'>
          <u>View Transaction in Explorer</u>
        </a>
      </>,
      {
        variant: 'success',
      },
    );
    const temp = messages.length > 0 ? [...messages] : [];
    const currentHeight = (await arweave.blocks.getCurrent()).height;

    temp.push({
      msg: content,
      type: 'request',
      timestamp: parseFloat(tags.find((tag) => tag.name === TAG_NAMES.unixTime)?.value as string),
      id: txid,
      cid: currentConversationId,
      height: currentHeight,
      to: address as string,
      from: userAddr,
      contentType,
      tags,
    });
    setMessages(temp);
    setResponseParams({
      ...responseParams,
      conversationId: currentConversationId,
      lastRequestId: txid,
      reqIds: [],
      scriptOperators: [address as string],
    });
  };

  const handleSendFile = async () => {
    if (!file) {
      return;
    }

    const dataSize = file.size;

    if (!checkCanSend(dataSize, true)) {
      return;
    }

    const contentType = file.type;
    const content = file;

    try {
      const tags: ITag[] = FairSDKWeb.utils.getUploadTags(
        FairSDKWeb.script,
        address as string,
        userAddr,
        currentConversationId,
        contentType,
        getConfigValues(),
        'web',
        content.name,
      );
      // add licenseConfig Tags
      if (currentConfig.licenseConfig) {
        addLicenseConfigTags(tags, currentConfig.licenseConfig, currentConfig.license);
      }
      // upload with dispatch
      const data = await content.arrayBuffer(); // it's safe to convert to arrayBuffer bc max size is 100kb
      const tx = await arweave.createTransaction({ data });
      tags.forEach((tag) => tx.addTag(tag.name, tag.value));

      const { id: txid } = await dispatchTx(tx);

      if (!txid) {
        enqueueSnackbar(errorMsg, { variant: 'error' });
        return;
      }
      await updateMessages(txid, content, contentType, tags);
      /* await warp.register(txid, 'arweave'); */
      const { totalUCost, totalUsdCost } = await FairSDKWeb.utils.handlePayment(
        txid,
        state.fee,
        contentType,
        FairSDKWeb.script,
        currentConversationId,
        state.modelCreator,
        address as string,
        currentConfig.nImages,
        'web',
      );
      // update balance after payments
      await updateUBalance();
      enqueueSnackbar(
        <Typography>{`Paid Inference costs: ${totalUsdCost}$ (${totalUCost} $U)`}</Typography>,
        {
          variant: 'success',
        },
      );
    } catch (error) {
      if (error instanceof Object) {
        enqueueSnackbar(JSON.stringify(error), { variant: 'error' });
      } else if (error instanceof String) {
        enqueueSnackbar(error, { variant: 'error' });
      } else {
        enqueueSnackbar(errorMsg, { variant: 'error' });
      }
    }
  };

  const handleSendText = async () => {
    if (!newMessage) {
      return;
    }

    const dataSize = new TextEncoder().encode(newMessage).length;

    if (!checkCanSend(dataSize)) {
      return;
    }

    const contentType = textContentType;

    try {
      const tags: ITag[] = FairSDKWeb.utils.getUploadTags(
        FairSDKWeb.script,
        address as string,
        userAddr,
        currentConversationId,
        contentType,
        getConfigValues(),
        'web',
      );
      // add licenseConfig Tags
      if (currentConfig.licenseConfig) {
        addLicenseConfigTags(tags, currentConfig.licenseConfig, currentConfig.license);
      }
      // upload with dispatch
      const tx = await arweave.createTransaction({ data: newMessage });
      tags.forEach((tag) => tx.addTag(tag.name, tag.value));

      const { id: txid } = await dispatchTx(tx);
      if (!txid) {
        enqueueSnackbar(errorMsg, { variant: 'error' });
        return;
      }
      await updateMessages(txid, newMessage, contentType, tags);
      /* await warp.register(txid, 'arweave'); */
      const { totalUCost, totalUsdCost } = await FairSDKWeb.utils.handlePayment(
        txid,
        state.fee,
        contentType,
        FairSDKWeb.script,
        currentConversationId,
        state.modelCreator,
        address as string,
        currentConfig.nImages,
        'web',
      );
      // update balance after payments
      await updateUBalance();
      enqueueSnackbar(
        <Typography>{`Paid Inference costs: ${totalUsdCost}$ (${totalUCost} $U)`}</Typography>,
        {
          variant: 'success',
        },
      );
    } catch (error) {
      if (error instanceof Object) {
        enqueueSnackbar(JSON.stringify(error), { variant: 'error' });
      } else if (error instanceof String) {
        enqueueSnackbar(error, { variant: 'error' });
      } else {
        enqueueSnackbar(errorMsg, { variant: 'error' });
      }
    }
  };

  const sortMessages = (messages: IMessage[]) => {
    messages.sort((a, b) => {
      if (a.timestamp === b.timestamp && a.type !== b.type) {
        return a.type === 'request' ? -1 : 1;
      } else if (a.timestamp === b.timestamp) {
        return a.id < b.id ? -1 : 1;
      }
      return a.timestamp - b.timestamp;
    });
  };

  const checkIsWaitingResponse = (filteredNewMsgs: IMessage[]) => {
    const lastRequest = filteredNewMsgs.findLast((el) => el.type === 'request');
    if (lastRequest) {
      const responses = filteredNewMsgs.filter(
        (el) =>
          el.type === 'response' &&
          el.tags.find((tag) => tag.name === TAG_NAMES.requestTransaction)?.value ===
            lastRequest.id,
      );
      const nImages = lastRequest.tags.find((tag) => tag.name === TAG_NAMES.nImages)?.value;
      if (nImages && isStableDiffusion) {
        setIsWaitingResponse(responses.length < parseInt(nImages, 10));
        setResponseTimeout(false);
      } else if (isStableDiffusion) {
        setIsWaitingResponse(responses.length < DEFAULT_N_IMAGES);
        setResponseTimeout(false);
      } else {
        setIsWaitingResponse(responses.length < 1);
        setResponseTimeout(false);
      }
    }
  };

  const reqData = async (allResponses?: IEdge[]) => {
    const previousRequest = requestsData?.transactions?.edges ?? [];
    let allData = [...previousRequest];
    if (allResponses && allResponses.length > 0) {
      allData = allData.concat(allResponses);
    }

    const filteredData = allData.filter((el: IEdge) => {
      const cid = findTag(el, 'conversationIdentifier');
      if (cid && cid.split('-').length > 1) {
        return parseInt(cid.split('-')[1], 10) === currentConversationId;
      } else if (cid) {
        return parseInt(cid, 10) === currentConversationId;
      } else {
        return false;
      }
    });

    const temp: IMessage[] = [];
    await Promise.all(
      filteredData.map(async (el: IEdge) => temp.push(await mapTransactionsToMessages(el))),
    );

    const allnewMessages = [...temp, ...messages];

    setMessages((prev) => {
      const uniqueNewMsgs = _.uniqBy([...prev, ...allnewMessages], 'id').filter(
        (el) => el.cid === currentConversationId,
      );
      sortMessages(uniqueNewMsgs);

      checkIsWaitingResponse(uniqueNewMsgs);
      return uniqueNewMsgs;
    });
  };

  const emptyPolling = async () => {
    const currentBlockHeight = (await arweave.blocks.getCurrent()).height;
    const lastMessage = [...messages.filter((el) => el.cid === currentConversationId)].pop();
    if (lastMessage && lastMessage.type === 'request') {
      if (currentBlockHeight - lastMessage.height > N_PREVIOUS_BLOCKS) {
        setIsWaitingResponse(false);
        setResponseTimeout(true);
      } else {
        setIsWaitingResponse(true);
        setResponseTimeout(false);
      }
    }
  };

  const onFileLoad = (fr: FileReader, newFile: File) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return () => {
      setLoading(false);
      fr.removeEventListener('error', onFileError(fr, newFile));
      fr.removeEventListener('load', onFileLoad(fr, newFile));
    };
  };

  const onFileError = (fr: FileReader, newFile: File) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return (_event: ProgressEvent) => {
      setFile(undefined);
      setLoading(false);
      fr.removeEventListener('error', onFileError(fr, newFile));
      fr.removeEventListener('load', onFileLoad(fr, newFile));
    };
  };

  const handleFileUpload = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (event.target.files && event.target.files.length > 0) {
        const newFile = event.target.files[0];
        const fr = new FileReader();
        setFile(newFile);
        setLoading(true);
        fr.addEventListener('load', onFileLoad(fr, newFile));
        fr.addEventListener('error', onFileError(fr, newFile));
        fr.readAsArrayBuffer(newFile);
      } else {
        setFile(undefined);
        setLoading(false);
      }
    },
    [file, setFile, setLoading, onFileError, onFileLoad],
  );

  const handleRemoveFile = useCallback(() => {
    setFile(undefined);
  }, [setFile]);

  const handleMessageChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setNewMessage(event.target.value),
    [setNewMessage],
  );

  useLayoutEffect(() => {
    setInputWidth(`calc(${chatWidth}px - 16px)`);
  }, [chatWidth]);

  useLayoutEffect(() => {
    const currInputHeight = document.querySelector('#chat-input')?.clientHeight;
    if (currInputHeight) {
      const margins = 16; // 8px on each side
      setInputHeight(currInputHeight + margins);
    }

    const currHeaderHeight = document.querySelector('header')?.clientHeight;
    if (currHeaderHeight) {
      setHeaderHeight(`${currHeaderHeight}px`);
    }
  }, [width, height]);

  const handleAdvanced = useCallback(() => {
    setConfigurationDrawerOpen((previousValue) => {
      if (!previousValue) {
        setDrawerOpen(false);
      }

      return !previousValue;
    });
  }, [setDrawerOpen, setConfigurationDrawerOpen]);

  const handleAdvancedClose = useCallback(() => {
    setConfigurationDrawerOpen(false);
  }, [setConfigurationDrawerOpen]);

  const handleShowConversations = useCallback(() => {
    setConfigurationDrawerOpen(false);
    setDrawerOpen(true);
  }, [setConfigurationDrawerOpen, setDrawerOpen]);

  const handleLoadMore = useCallback(() => {
    requestFetchMore({
      variables: {
        after:
          requestsData.transactions.edges.length > 0
            ? requestsData.transactions.edges[requestsData.transactions.edges.length - 1].cursor
            : undefined,
      },
      updateQuery: commonUpdateQuery,
    });
    setMessagesLoading(true);
    const oldestMessage = document.querySelectorAll('.message-container')[0]; // first message on html is the oldest

    setCurrentEl(oldestMessage as HTMLDivElement);
  }, [requestFetchMore, requestsData]);

  return (
    <>
      <Drawer
        variant='persistent'
        anchor='right'
        open={configurationDrawerOpen}
        sx={{
          '& .MuiDrawer-paper': {
            width: '30%',
            boxSizing: 'border-box',
            top: headerHeight,
            height: `calc(100% - ${headerHeight})`,
          },
        }}
        PaperProps={{
          elevation: 24,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
              paddingTop: '16px',
            },
          }}
        >
          <Configuration
            control={configControl}
            setConfigValue={setConfigValue}
            reset={configReset}
            handleClose={handleAdvancedClose}
          />
        </Box>
      </Drawer>
      <Box sx={{ height: '100%', display: 'flex' }}>
        <Drawer
          variant='persistent'
          anchor='left'
          open={drawerOpen}
          sx={{
            width: '240px',
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: '240px',
              boxSizing: 'border-box',
              top: headerHeight,
              height: '100%',
              border: 'none',
              position: 'static',
            },
          }}
        >
          <Conversations
            currentConversationId={currentConversationId}
            setCurrentConversationId={setCurrentConversationId}
            state={state}
            userAddr={userAddr}
            drawerOpen={drawerOpen}
            setDrawerOpen={setDrawerOpen}
          />
        </Drawer>
        <Box
          id='chat'
          sx={{
            width: '100%',
            height: '100%',
            bgcolor: 'background.paper',
            display: 'flex',
            flexGrow: 1,
            background: theme.palette.background.default,
            transition: theme.transitions.create('margin', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
            marginLeft: '-240px',
            ...(drawerOpen && {
              transition: theme.transitions.create('margin', {
                easing: theme.transitions.easing.easeOut,
                duration: theme.transitions.duration.enteringScreen,
              }),
              marginLeft: 0,
            }),
            marginRight: '0',
            ...(configurationDrawerOpen && {
              transition: theme.transitions.create('margin', {
                easing: theme.transitions.easing.easeOut,
                duration: theme.transitions.duration.enteringScreen,
              }),
              marginRight: '30%',
            }),
            alignItems: 'center',
          }}
        >
          {!drawerOpen && (
            <Paper
              sx={{
                borderRight: '8px',
                border: '0.5px solid',
                borderTopLeftRadius: '0px',
                borderBottomLeftRadius: '0px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <Box>
                <IconButton
                  onClick={handleShowConversations}
                  disableRipple={true}
                  className='plausible-event-name=Show+Conversations+Click'
                >
                  <ChevronRightIcon />
                </IconButton>
              </Box>
            </Paper>
          )}
          <Box
            ref={chatRef}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              width: '100%',
              height: '100%',
            }}
          >
            {messagesLoading && (
              <Backdrop
                sx={{
                  position: 'absolute',
                  zIndex: theme.zIndex.drawer + 1,
                  backdropFilter: 'blur(50px)',
                  display: 'flex',
                  flexDirection: 'column',
                  left: drawerOpen ? '240px' : '0px',
                  right: configurationDrawerOpen ? '30%' : '0px',
                }}
                open={true}
              >
                <Typography variant='h1' fontWeight={500} color={theme.palette.background.default}>
                  Loading Messages...
                </Typography>
                <CircularProgress sx={{ color: theme.palette.background.default }} size='6rem' />
              </Backdrop>
            )}
            <Box flexGrow={1}>
              <Paper
                elevation={1}
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  background: theme.palette.background.default,
                  boxShadow: 'none',
                }}
              >
                <Zoom in={showLoadMore} timeout={100} mountOnEnter unmountOnExit>
                  <Box
                    zIndex={'100'}
                    display={'flex'}
                    justifyContent={'center'}
                    padding={'8px'}
                    width={'100%'}
                    sx={{
                      position: 'absolute',
                      top: '40px',
                      width: inputWidth,
                    }}
                  >
                    <Fab
                      variant='extended'
                      size='medium'
                      color='primary'
                      aria-label='Load More'
                      onClick={handleLoadMore}
                    >
                      <Typography>Load More</Typography>
                    </Fab>
                  </Box>
                </Zoom>
                <Box
                  sx={{
                    overflow: messagesLoading ? 'hidden' : 'auto',
                    maxHeight: chatMaxHeight,
                    pt: '50px',
                    paddingBottom: `${inputHeight}px`,
                  }}
                  ref={scrollableRef}
                >
                  <Box ref={target} sx={{ padding: '8px' }} />
                  <ChatContent
                    messages={messages}
                    showError={showError}
                    isWaitingResponse={isWaitingResponse}
                    responseTimeout={responseTimeout}
                    pendingTxs={pendingTxs}
                    copySettings={copySettings}
                  />
                  <Box ref={messagesEndRef} sx={{ padding: '1px' }} />
                </Box>
              </Paper>
            </Box>
            <Box
              id={'chat-input'}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '8px',
                justifyContent: 'flex-start',
                position: 'absolute',
                margin: '8px 0px',
                width: inputWidth,
                paddingRight: '8px',
                paddingLeft: '8px',
              }}
            >
              {showOperatorBusy && (
                <Box sx={{ display: 'flex', gap: '8px' }}>
                  <InfoOutlined color='warning' />
                  <Typography color={theme.palette.warning.main}>
                    Operator is currently working on other requests. Waiting time may be
                    increased...
                  </Typography>
                </Box>
              )}
              <InputField
                file={file}
                loading={loading}
                disabled={isWaitingResponse}
                currentConversationId={currentConversationId}
                newMessage={newMessage}
                inputRef={inputRef}
                handleAdvanced={handleAdvanced}
                handleFileUpload={handleFileUpload}
                handleRemoveFile={handleRemoveFile}
                handleSendFile={handleSendFile}
                handleSendText={handleSendText}
                handleMessageChange={handleMessageChange}
              />
              {newMessage.length >= MAX_MESSAGE_SIZE && (
                <Typography
                  variant='subtitle1'
                  sx={{ color: theme.palette.error.main, fontWeight: 500, paddingLeft: '20px' }}
                >
                  Message Too Long
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
      <Outlet />
    </>
  );
};

export default Chat;
