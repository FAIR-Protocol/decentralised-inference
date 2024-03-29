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

import Logo from '@/components/logo';
import {
  BUY_AR_LINK,
  BUY_AR_LINK_US,
  BUY_U_LINK,
  CREATE_WALLET_LINK,
  MIN_U_BALANCE,
  U_LOGO_SRC,
} from '@/constants';
import { ChooseWalletContext } from '@/context/choose-wallet';
import { WalletContext } from '@/context/wallet';
import { IEdge } from '@/interfaces/arweave';
import { QUERY_TXS_BY_RECIPIENT } from '@/queries/graphql';
import { displayShortTxOrAddr, findTag } from '@/utils/common';
import { useQuery } from '@apollo/client';
import {
  Box,
  Button,
  Container,
  Divider,
  FormHelperTextProps,
  IconButton,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { NumericFormat } from 'react-number-format';
import { useLocation, useNavigate } from 'react-router-dom';
import { Close, InfoOutlined } from '@mui/icons-material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { isTxConfirmed } from '@/utils/arweave';
import AiCard from '@/components/ai-card';
import useModels from '@/hooks/useModels';

type EdgeWithStatus = IEdge & { status: string };

const justifyContent = 'space-between';

const WalletnotConnectedContent = () => {
  const { setOpen: setChooseWalletOpen } = useContext(ChooseWalletContext);
  const handleClick = useCallback(() => setChooseWalletOpen(true), [setChooseWalletOpen]);

  return (
    <>
      <Box display={'flex'}>
        <Logo />
      </Box>
      <Box>
        <Typography
          sx={{ color: '#1F1F26' }}
          fontWeight={300}
          fontSize={'30px'}
          lineHeight={'40.5px'}
          align='center'
        >
          First, Lets get connected!
        </Typography>
      </Box>
      <Button
        sx={{ borderRadius: '8px', gap: '10px', background: '#FFF' }}
        onClick={handleClick}
        className='plausible-event-name=Onboarding+Connect+Wallet+Click'
      >
        <Typography
          sx={{ color: '#1F1F26' }}
          fontWeight={700}
          fontSize={'18px'}
          lineHeight={'24.3px'}
        >
          Connect Wallet
        </Typography>
      </Button>
      <Box display={'flex'} gap={'8px'}>
        <Typography display={'flex'} gap={'8px'} alignItems={'center'} fontWeight={'500'} noWrap>
          <InfoOutlined /* sx={{ fontSize: '12px' }}  */ />
          Don&apos;t have a wallet yet?
        </Typography>
        <Typography display={'flex'} gap={'8px'} alignItems={'center'} noWrap>
          <a
            href={CREATE_WALLET_LINK}
            target='_blank'
            rel='noreferrer'
            className='plausible-event-name=Wallet+Create+Learn+Click'
          >
            <u>Learn how to create one.</u>
          </a>
        </Typography>
      </Box>
    </>
  );
};

const WalletNoFundsContent = () => {
  const theme = useTheme();
  const { currentAddress, currentBalance, currentUBalance } = useContext(WalletContext);
  const [lastTx, setLastTx] = useState<EdgeWithStatus | null>(null);
  const [activeStep, setActiveStep] = useState(1);
  const navigate = useNavigate();

  const handleNext = useCallback(
    () => setActiveStep((prevActiveStep) => prevActiveStep + 1),
    [setActiveStep],
  );

  const handleBack = useCallback(
    () => setActiveStep((prevActiveStep) => prevActiveStep - 1),
    [setActiveStep],
  );

  const handleSkip = useCallback(() => navigate('/'), [navigate]);

  const { data: receivedData } = useQuery(QUERY_TXS_BY_RECIPIENT, {
    variables: {
      recipients: [currentAddress],
      first: 1,
    },
  });

  useEffect(() => {
    if (receivedData) {
      const latestReceivedTx = receivedData.transactions.edges[0];
      if (!latestReceivedTx) {
        return;
      }

      (async () => {
        const confirmed = await isTxConfirmed(latestReceivedTx.node.id);
        setLastTx({ ...latestReceivedTx, status: confirmed ? 'confirmed' : 'pending' });
      })();
    }
  }, [receivedData]);

  return (
    <>
      <Stepper
        activeStep={activeStep}
        orientation='vertical'
        sx={{ width: '60%', ml: '50%', /*  */ mr: '50%' }}
      >
        <Step sx={{ width: '100%' }}>
          <StepLabel>
            <Typography fontWeight={'700'}>Top Up AR Balance</Typography>
          </StepLabel>
          <StepContent sx={{ width: '100%' }}>
            <Box display={'flex'} width={'100%'} justifyContent={justifyContent} mt={'16px'}>
              <NumericFormat
                label='Available AR Balance'
                placeholder='Available AR Balance'
                value={currentBalance}
                thousandSeparator={true}
                customInput={TextField}
                variant='outlined'
                allowNegative={false}
                disabled={true}
                sx={{
                  width: '85%',
                }}
                InputProps={{
                  endAdornment: (
                    <img width='20px' height='20px' src='./arweave-logo-for-light.png' />
                  ),
                }}
                FormHelperTextProps={{ component: 'div' } as Partial<FormHelperTextProps>}
                helperText={
                  <>
                    <Box display={'flex'} gap={'8px'} mt={'8px'}>
                      <Typography
                        display={'flex'}
                        gap={'8px'}
                        alignItems={'center'}
                        fontWeight={'500'}
                        color={'primary'}
                        noWrap
                      >
                        <InfoOutlined />
                        Looking for a way to buy AR?
                      </Typography>
                      <Typography alignItems={'center'} color='primary' noWrap>
                        <a href={BUY_AR_LINK} target='_blank' rel='noreferrer'>
                          <u>Find out How.</u>
                        </a>
                      </Typography>
                    </Box>
                    <Box display={'flex'} gap={'8px'}>
                      <Typography
                        display={'flex'}
                        gap={'8px'}
                        alignItems={'center'}
                        fontWeight={'500'}
                        color={'primary'}
                        noWrap
                      >
                        <InfoOutlined />
                        Are You in the U.S?
                      </Typography>
                      <Typography alignItems={'center'} color='primary' noWrap>
                        <a href={BUY_AR_LINK_US} target='_blank' rel='noreferrer'>
                          <u>Check this guide instead.</u>
                        </a>
                      </Typography>
                    </Box>
                  </>
                }
              />
              {currentBalance > 0 ? (
                <CheckCircleOutlineIcon color='success' fontSize='large' sx={{ mt: '8px' }} />
              ) : (
                <InfoOutlinedIcon color='warning' fontSize='large' sx={{ mt: '8px' }} />
              )}
            </Box>
            {lastTx && (
              <Box mt={'16px'}>
                <Divider textAlign='left'>
                  <Typography>Last Pending Transaction</Typography>
                </Divider>
                <Box display={'flex'} justifyContent={justifyContent} mt={'16px'}>
                  <Box sx={{ display: 'flex', fontWeight: 500, gap: '8px' }}>
                    <Typography>ID:</Typography>
                    <Typography>
                      <u>{displayShortTxOrAddr(lastTx.node.id)}</u>
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', fontWeight: 500, gap: '8px' }}>
                    <Typography>Status:</Typography>
                    <Typography
                      color={
                        lastTx.status === 'confirmed'
                          ? theme.palette.success.main
                          : theme.palette.warning.main
                      }
                    >
                      {lastTx.status}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}
            <Box display={'flex'} justifyContent={'flex-end'} mt={'48px'}>
              <Button
                variant='contained'
                onClick={handleNext}
                sx={{ mt: 1, mr: 1 }}
                className='plausible-event-name=Onboarding+Top+Up+U+Click'
              >
                Top Up $U
              </Button>
            </Box>
          </StepContent>
        </Step>
        <Step>
          <StepLabel>
            <Typography fontWeight={'700'}>Top Up $U Balance</Typography>
          </StepLabel>
          <StepContent sx={{ width: '100%' }}>
            <Box display={'flex'} width={'100%'} justifyContent={justifyContent} mt={'16px'}>
              <NumericFormat
                label='Available $U Balance'
                placeholder='Available $U Balance'
                value={currentUBalance}
                thousandSeparator={true}
                customInput={TextField}
                variant='outlined'
                allowNegative={false}
                disabled={true}
                sx={{
                  width: '85%',
                }}
                InputProps={{
                  endAdornment: <img width='20px' height='20px' src={U_LOGO_SRC} />,
                }}
                FormHelperTextProps={{ component: 'div' } as Partial<FormHelperTextProps>}
                helperText={
                  <>
                    <Box display={'flex'} gap={'8px'} mt={'8px'}>
                      <Typography
                        display={'flex'}
                        gap={'8px'}
                        alignItems={'center'}
                        fontWeight={'500'}
                        color={'primary'}
                        noWrap
                      >
                        <InfoOutlined />
                        Looking for a way to get $U?
                      </Typography>
                      <Typography alignItems={'center'} color='primary' noWrap>
                        <a href={BUY_U_LINK} target='_blank' rel='noreferrer'>
                          <u>Learn How.</u>
                        </a>
                      </Typography>
                    </Box>
                  </>
                }
              />
              {currentUBalance >= MIN_U_BALANCE ? (
                <CheckCircleOutlineIcon color='success' fontSize='large' sx={{ mt: '8px' }} />
              ) : (
                <InfoOutlinedIcon color='warning' fontSize='large' sx={{ mt: '8px' }} />
              )}
            </Box>
            <Box display={'flex'} justifyContent={justifyContent} mt={'48px'}>
              <Button
                sx={{ mt: 1, mr: 1 }}
                onClick={handleBack}
                variant='outlined'
                className='plausible-event-name=Onboarding+Top+Up+AR+Click'
              >
                Top Up AR
              </Button>
              <Button
                sx={{ mt: 1, mr: 1 }}
                variant='contained'
                onClick={handleSkip}
                className='plausible-event-name=Explore+Marketplace'
              >
                Explore marketplace
              </Button>
            </Box>
          </StepContent>
        </Step>
      </Stepper>
    </>
  );
};

const SinginWithFunds = () => {
  const singinFeatureElements = 4;
  const { featuredTxs } = useModels(undefined, singinFeatureElements);

  return (
    <>
      <Box display={'flex'}>
        <Logo />
      </Box>
      <Box>
        <Typography
          sx={{ color: '#1F1F26' }}
          fontWeight={300}
          fontSize={'30px'}
          lineHeight={'40.5px'}
          align='center'
        >
          Choose A model to get started!
        </Typography>
      </Box>
      <Box className={'feature-cards-row'} justifyContent={'flex-end'}>
        {featuredTxs.map((el) => (
          <Box key={el.node.id} display={'flex'} flexDirection={'column'} gap={'30px'}>
            <AiCard model={el} key={el.node.id} useModel={true} />
            <Typography maxWidth={'317px'}>{findTag(el, 'description')}</Typography>
          </Box>
        ))}
      </Box>
    </>
  );
};

const SignIn = () => {
  const { pathname } = useLocation();
  const { currentAddress, currentUBalance } = useContext(WalletContext);
  const isConnected = useMemo(() => !!currentAddress, [currentAddress]);

  const navigate = useNavigate();

  const handleSkip = useCallback(() => navigate('/'), [navigate]);

  const isSwap = useMemo(() => pathname === '/swap', [pathname]);
  return (
    <Container
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '21px',
      }}
    >
      {!isConnected && <WalletnotConnectedContent />}

      {isConnected && (currentUBalance < MIN_U_BALANCE || isSwap) && <WalletNoFundsContent />}

      {!isSwap && isConnected && currentUBalance >= MIN_U_BALANCE && <SinginWithFunds />}

      <IconButton
        sx={{
          top: '40px',
          right: '40px',
          position: 'fixed',
          borderRadius: '8px',
          background: '#FFF',
          border: '0.5px solid',
        }}
        onClick={handleSkip}
        className='plausible-event-name=Close+Onboarding+Click'
      >
        <Close />
      </IconButton>
    </Container>
  );
};

export default SignIn;
