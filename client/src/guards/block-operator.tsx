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

import { EVMWalletContext } from '@/context/evm-wallet';
import { StyledMuiButton } from '@/styles/components';
import {
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  useTheme,
} from '@mui/material';
import { ReactElement, useCallback, useContext, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const BlockOperatorGuard = ({ children }: { children: ReactElement }) => {
  const navigate = useNavigate();
  const { currentAddress } = useContext(EVMWalletContext);
  const { state } = useLocation();
  const theme = useTheme();

  const handleGoBack = useCallback(() => navigate(-1), [navigate]);

  const operatorEvmWallet = useMemo(() => state?.defaultOperator?.evmWallet ?? '', [state]);

  return (
    <>
      <Dialog
        open={operatorEvmWallet === currentAddress}
        maxWidth={'md'}
        fullWidth
        sx={{
          '& .MuiPaper-root': {
            background:
              theme.palette.mode === 'dark'
                ? 'rgba(61, 61, 61, 0.9)'
                : theme.palette.background.default,
            borderRadius: '20px',
            backdropFilter: 'blur(10px)',
          },
        }}
      >
        <DialogTitle>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: '23px',
              lineHeight: '31px',
              display: 'flex',
              gap: 1,
              alignItems: 'center',
            }}
          >
            <img src='./error-icon.svg' style={{ width: '30px' }} />
            Error: Use a different wallet!
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Alert
            variant='outlined'
            severity='error'
            sx={{
              marginBottom: '16px',
              borderRadius: '10px',
              color: theme.palette.error.main,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              '& .MuiAlert-icon': {
                justifyContent: 'center',
                display: 'none',
              },
              borderColor: theme.palette.error.main,
            }}
            icon={''}
          >
            <Typography
              sx={{
                fontWeight: 400,
                fontSize: '30px',
                lineHeight: '41px',
                display: 'block',
                textAlign: 'center',
              }}
            >
              The chosen Operator or wallet is{' '}
              <u>
                <b>invalid.</b>
              </u>{' '}
              <br />
              It is not allowed to use inference with the same wallet as the registered Operator.
              <br /> <br />
              <u>
                <b>Please Choose another wallet or Operator and try again.</b>
              </u>
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ display: 'flex', justifyContent: 'center', paddingBottom: '20px' }}>
          <StyledMuiButton onClick={handleGoBack} className='primary'>
            I understand
          </StyledMuiButton>
        </DialogActions>
      </Dialog>
      {state && state.operatorEvmWallet !== currentAddress && children}
    </>
  );
};

export default BlockOperatorGuard;
