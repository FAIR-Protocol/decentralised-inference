// components/layout.js
import FilterContext from '@/context/filter';
import {
  Alert,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  useTheme,
} from '@mui/material';
import { ReactElement, useContext, useEffect, useState } from 'react';
import Navbar from './navbar';
import { WalletContext } from '@/context/wallet';
import { BundlrContext } from '@/context/bundlr';
import arweave from '@/utils/arweave';
import { FundContext } from '@/context/fund';

export default function Layout({ children }: { children: ReactElement }) {
  const [showBanner, setShowBanner] = useState(true);
  const [open, setOpen] = useState(false);
  const [filterValue, setFilterValue] = useState('');
  const { isWalletLoaded, currentAddress } = useContext(WalletContext);
  const { nodeBalance } = useContext(BundlrContext);
  const theme = useTheme();
  const { setOpen: setFundOpen } = useContext(FundContext);

  useEffect(() => {
    // opens if wallet is not loaded
    setOpen(!isWalletLoaded);
  }, [isWalletLoaded]);

  useEffect(() => {
    setOpen(!currentAddress || currentAddress === '');
  }, [currentAddress]);

  useEffect(() => {
    const arBalance = parseFloat(arweave.ar.winstonToAr(nodeBalance.toString()));
    if (currentAddress && arBalance < 0.5) {
      setOpen(true);
    }
  }, [ nodeBalance ]);

  const handleFundNow = () => {
    setOpen(false);
    setFundOpen(true);
  };

  return (
    <>
      <Navbar
        showBanner={showBanner}
        setShowBanner={setShowBanner}
        setFilterValue={setFilterValue}
      />
      <Container
        disableGutters
        sx={{ width: '100%', height: showBanner ? 'calc(100% - 88px)' : 'calc(100% - 64px)' }}
        maxWidth={false}
      >
        <Box height='100%'>
          <FilterContext.Provider value={filterValue}>
            <main style={{ height: '100%' }}>{children}</main>
            <Dialog
              open={open}
              maxWidth={'md'}
              fullWidth
              sx={{
                '& .MuiPaper-root': {
                  background:
                    theme.palette.mode === 'dark'
                      ? 'rgba(61, 61, 61, 0.9)'
                      : theme.palette.background.default,
                  borderRadius: '30px',
                },
              }}
            >
              <DialogTitle>
                <Typography
                  sx={{
                    color: theme.palette.warning.light,
                    fontWeight: 700,
                    fontSize: '23px',
                    lineHeight: '31px',
                  }}
                >
                  {
                    !isWalletLoaded ?
                      'Browser Wallet Not Detected' :
                        !currentAddress ? 'Wallet Not Connected' :
                          'Missing bundlr Funds'
                  }
                </Typography>
              </DialogTitle>
              <DialogContent>
                <Alert
                  /* onClose={() => setOpen(false)} */
                  variant='outlined'
                  severity='warning'
                  sx={{
                    marginBottom: '16px',
                    borderRadius: '23px',
                    color: theme.palette.warning.light,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    backdropFilter: 'blur(4px)',
                    '& .MuiAlert-icon': {
                      justifyContent: 'center',
                    },
                    '& .MuiAlert-message': {
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                    },
                  }}
                  icon={<img src='./warning-icon.svg'></img>}
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
                    {
                      !isWalletLoaded
                        ? 'Browser Wallet Not Detected! App Functionalities will be limited, please consider installing a browser wallet.' :
                          !currentAddress ? 'Wallet Not Connected! Please Connect Wallet to access All App Features.' :
                            'Current Bundlr Node Has no Loaded Funds. Please Fund Bundlr Node in order to utilize App'
                    }
                  </Typography>
                </Alert>
              </DialogContent>
              <DialogActions
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '30px',
                  paddingBottom: '20px',
                }}
              >
                {
                  !isWalletLoaded || !currentAddress ?
                    <Button
                      onClick={() => setOpen(false)}
                      variant='contained'
                      color='warning'
                      sx={{ width: 'fit-content' }}
                    >
                      <Typography color={theme.palette.primary.contrastText}>I Understand</Typography>
                    </Button> :
                      <>
                        <Button
                          onClick={() => setOpen(false)}
                          variant='outlined'
                          color='warning'
                          sx={{ width: 'fit-content' }}
                        >
                          <Typography color={theme.palette.warning.main}>Fund Later</Typography>
                        </Button>
                        <Button
                          onClick={handleFundNow}
                          variant='contained'
                          color='warning'
                          sx={{ width: 'fit-content' }}
                        >
                          <Typography color={theme.palette.primary.contrastText}>Fund Now</Typography>
                        </Button>
                      </>
                }
              </DialogActions>
            </Dialog>
          </FilterContext.Provider>
        </Box>
      </Container>
    </>
  );
}
