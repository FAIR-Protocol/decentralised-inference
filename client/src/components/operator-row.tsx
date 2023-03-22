import { DEFAULT_TAGS, INFERENCE_PERCENTAGE_FEE, MODEL_INFERENCE_RESULT_TAG } from '@/constants';
import { IEdge } from '@/interfaces/arweave';
import {
  QUERY_PAID_FEE_OPERATORS,
  QUERY_REQUESTS_FOR_OPERATOR,
  QUERY_RESPONSES_BY_OPERATOR,
} from '@/queries/graphql';
import { useLazyQuery, useQuery } from '@apollo/client';
import { IconButton, TableCell, TableRow, Tooltip, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import CopyIcon from '@mui/icons-material/ContentCopy';
import { parseWinston } from '@/utils/arweave';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import HistoryIcon from '@mui/icons-material/History';
import { useNavigate } from 'react-router-dom';

export interface RowData {
  quantityAR: string;
  address: string;
  fee: string;
  availability: number;
  stamps: number;
  registrationTimestamp: string;
  modelName: string;
  modelCreator: string;
  modelTransaction: string;
}

/**
 * @description React Function component to handle displaying a row for an operator
 * @param props { operatorTx, modelCreator, modelName, state }
 * @returns
 */
const OperatorRow = ({
  operatorTx,
  modelCreator,
  modelName,
  state,
}: {
  operatorTx: IEdge;
  modelCreator: string;
  modelName: string;
  state: IEdge;
}) => {
  const navigate = useNavigate();
  const [row, setRow] = useState<Partial<RowData> | undefined>(undefined);
  const requestTags = [
    ...DEFAULT_TAGS,
    {
      name: 'Model-Creator',
      values: [modelCreator],
    },
    {
      name: 'Model-Name',
      values: [modelName],
    },
    {
      name: 'Operation-Name',
      values: ['Inference Payment'],
    },
  ];
  const { data, /* loading, error,  */ fetchMore } = useQuery(QUERY_REQUESTS_FOR_OPERATOR, {
    skip: !operatorTx.node.owner.address && !modelCreator && !modelName,
    variables: {
      first: 10,
      recipient: operatorTx.node.owner.address,
      tags: requestTags,
    },
  });

  const [getOpResponses, opResponses] = useLazyQuery(QUERY_RESPONSES_BY_OPERATOR);
  const [getPaidFee, paidFeeResult] = useLazyQuery(QUERY_PAID_FEE_OPERATORS);

  /**
   * @description Effect that runs on `operatorTx` changes; it will create an easier to read object
   * with the necessary props for the row (except availability)
   */
  useEffect(() => {
    const address = operatorTx.node.owner.address;
    const quantityAR = operatorTx.node.quantity.ar;
    const stamps = Math.random() * 100;
    const fee = operatorTx.node.tags.find((tag) => tag.name === 'Operator-Fee')?.value;
    const registrationTimestamp = operatorTx.node.block
      ? new Date(operatorTx.node.block.timestamp * 1000).toLocaleString()
      : 'Pending';
    const modelTransaction = state.node.tags.find((tag) => tag.name === 'Model-Transaction')?.value;
    const modelName = state.node.tags.find((tag) => tag.name === 'Model-Name')?.value;
    const modelCreator = state.node.owner.address;
    setRow({
      address,
      quantityAR,
      stamps,
      fee,
      registrationTimestamp,
      modelTransaction,
      modelName,
      modelCreator,
    });
  }, [operatorTx]);

  /**
   * @description Effect that runs when data from `QUERY_REEQUEST_FOR_OPERATOR` changes;
   * It is responsible to fetch more data while `hasNextPage` is true, otherwise it will
   * execute `getOpResponses` to fetch the responses for all the received requests
   */
  useEffect(() => {
    if (data && data.transactions && data.transactions.pageInfo.hasNextPage) {
      fetchMore({
        variables: {
          after: data.transactions.edges[data.transactions.edges.length - 1].cursor,
        },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult) return prev;
          return Object.assign({}, prev, {
            transactions: {
              edges: [...prev.transactions.edges, ...fetchMoreResult.transactions.edges],
              pageInfo: fetchMoreResult.transactions.pageInfo,
            },
          });
        },
      });
    } else if (data && data.transactions) {
      const inferenceReqIds = (data.transactions.edges as IEdge[]).map((req) => {
        return req.node.tags.find((el) => el.name === 'Inference-Transaction')?.value;
      });
      const responseTags = [
        ...DEFAULT_TAGS,
        {
          name: 'Model-Creator',
          values: [modelCreator],
        },
        {
          name: 'Model-Name',
          values: [modelName],
        },
        MODEL_INFERENCE_RESULT_TAG,
        {
          name: 'Request-Transaction',
          values: inferenceReqIds,
        },
      ];
      getOpResponses({
        variables: {
          first: 10,
          owner: operatorTx.node.owner.address,
          tags: responseTags,
        },
      });
    }
  }, [data]);

  /**
   * @description Effect that runs when data from `QUERY_RESPONSES_BY_OPERATOR` changes;
   * It is responsible to fetch more responses while `hasNextPage` is true, otherwise it will
   * calculate operator availability (requests/ responses) and execute `getPaidFee` to check if there
   * is a payment transaction with the correct value for each response
   */
  useEffect(() => {
    if (
      opResponses.data &&
      opResponses.data.transactions &&
      opResponses.data.transactions.pageInfo.hasNextPage
    ) {
      opResponses.fetchMore({
        variables: {
          after:
            opResponses.data.transactions.edges[opResponses.data.transactions.edges.length - 1]
              .cursor,
        },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult) return prev;
          return Object.assign({}, prev, {
            transactions: {
              edges: [...prev.transactions.edges, ...fetchMoreResult.transactions.edges],
              pageInfo: fetchMoreResult.transactions.pageInfo,
            },
          });
        },
      });
    } else if (opResponses.data) {
      const tags = [
        ...DEFAULT_TAGS,
        {
          name: 'Operation-Name',
          values: ['Operator Fee Payment'],
        },
        {
          name: 'Response-Identifier',
          values: [...opResponses.data.transactions.edges.map((el: IEdge) => el.node.id)],
        },
      ];

      const asyncPaidFee = async () => {
        const blockHeights = opResponses.data.transactions.edges.map(
          (el: IEdge) => el.node.block.height,
        );
        // const currentBlockHeight = await arweave.blocks.getCurrent();
        getPaidFee({
          variables: {
            tags: tags,
            owner: operatorTx.node.owner.address,
            minBlockHeight: Math.min(...blockHeights),
            first: 10,
            // maxBlockHeight: currentBlockHeight.height - N_PREVIOUS_BLOCKS,
          },
        });
      };
      if (opResponses.data.transactions.edges.length > 0) asyncPaidFee();
      const reqs = data.transactions.edges;
      const responses = opResponses.data.transactions.edges;
      const availability = (reqs.length / responses.length) * 100;
      setRow({ ...row, availability });
    }
  }, [opResponses.data]);

  /**
   * @description Effect that runs when data from `QUERY_PAID_FEE_OPERATORS` changes;
   * It is responsible to fetch more transactions while `hasNextPage` is true, otherwise it will
   * check for all the transactions that it has and confirm that operator paid the correct value to
   * the marketplace
   */
  useEffect(() => {
    if (paidFeeResult.data && paidFeeResult.data.transactions.pageInfo.hasNextPage) {
      paidFeeResult.fetchMore({
        variables: {
          after:
            paidFeeResult.data.transactions.edges[paidFeeResult.data.transactions.edges.length - 1]
              .cursor,
        },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult) return prev;
          return Object.assign({}, prev, {
            transactions: {
              edges: [...prev.transactions.edges, ...fetchMoreResult.transactions.edges],
              pageInfo: fetchMoreResult.transactions.pageInfo,
            },
          });
        },
      });
    } else if (paidFeeResult.data) {
      if (paidFeeResult.data.transactions.edges.length <= 0) {
        // operator hasn't paid fees
      }
      paidFeeResult.data.transactions.edges.forEach((el: IEdge) => {
        if (
          parseFloat(el.node.quantity.winston) * INFERENCE_PERCENTAGE_FEE <=
          parseFloat(operatorTx.node.tags.find((tag) => tag.name === 'Operator-Fee')?.value || '0')
        ) {
          // handle case where operator did not pay request
          // can return and not proccess remaining txs
        }
      });
    }
  }, [paidFeeResult.data]);

  return (
    <>
      <TableRow sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
        <TableCell scope='row'>
          <Tooltip title={row?.address}>
            <Typography>
              {operatorTx.node.owner.address.slice(0, 10)}...
              {operatorTx.node.owner.address.slice(-2)}
              <IconButton
                size='small'
                onClick={() => {
                  row?.address && navigator.clipboard.writeText(row?.address);
                }}
              >
                <CopyIcon fontSize='inherit' />
              </IconButton>
            </Typography>
          </Tooltip>
        </TableCell>
        <TableCell align='right'>{row?.registrationTimestamp}</TableCell>
        <TableCell align='right'>{parseWinston(row?.fee)}</TableCell>
        <TableCell align='right'>
          <Tooltip
            title={
              row?.availability && row.availability > 90
                ? 'Online'
                : row?.availability && row.availability > 50
                ? 'Availability Issues'
                : row?.availability && row.availability > 0
                ? 'Dangerous'
                : 'Offline'
            }
          >
            {row?.availability && row.availability > 90 ? (
              <FiberManualRecordIcon color='success' />
            ) : row?.availability && row.availability > 50 ? (
              <FiberManualRecordIcon color='warning' />
            ) : row?.availability && row.availability > 0 ? (
              <FiberManualRecordIcon color='error' />
            ) : (
              <FiberManualRecordIcon color='disabled' />
            )}
          </Tooltip>
          {}
        </TableCell>
        <TableCell align='right'>{Math.random() * 100}</TableCell>
        <TableCell align='right'>
          <Tooltip title='History'>
            <IconButton
              onClick={() =>
                navigate(`/operators/details/${operatorTx.node.owner.address}`, {
                  state: {
                    modelName: modelName,
                    modelCreator: modelCreator,
                    operatorFee: row?.fee,
                  },
                })
              }
            >
              <HistoryIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title='Execute'>
            <IconButton
              onClick={() =>
                navigate(`../chat/${operatorTx.node.owner.address}`, {
                  state: {
                    modelName: modelName,
                    modelCreator: modelCreator,
                    fee: row?.fee,
                    modelTransaction: row?.modelTransaction,
                    fullState: state,
                  },
                })
              }
            >
              <PlayArrowIcon />
            </IconButton>
          </Tooltip>
        </TableCell>
      </TableRow>
    </>
  );
};

export default OperatorRow;