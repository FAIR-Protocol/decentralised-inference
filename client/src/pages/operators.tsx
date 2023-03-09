import { DEFAULT_TAGS, REGISTER_OPERATION_TAG } from '@/constants';
import useArweave from '@/context/arweave';
import { IEdge } from '@/interfaces/arweave';
import { LIST_MODELS_QUERY, QUERY_REGISTERED_OPERATORS } from '@/queries/graphql';
import { useQuery } from '@apollo/client';
import { Container, Box, Stack, Card, CardActionArea, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Element {
  name: string;
  txid: string;
  uploader: string;
  avgFee: number;
  totalOperators: number;
}
const Operators = () => {
  const navigate = useNavigate();
  const [elements, setElements] = useState<Element[]>([]);
  const { arweave } = useArweave();

  const { data, loading, error } = useQuery(LIST_MODELS_QUERY);
  const tags = [
    ...DEFAULT_TAGS,
    REGISTER_OPERATION_TAG
  ];
  // get all operatorsRegistration
  const { data: operatorsData } = useQuery(QUERY_REGISTERED_OPERATORS, {
    variables: { tags },
    skip: !data
  });

  useEffect(() => {
    if (operatorsData) {
      setElements(data.map((el: IEdge) => {
        const uniqueOperators: IEdge[] = [];
        const modelOperators = operatorsData.filter(
          (op: IEdge) => op.node.tags.find(tag => tag.name === 'Model-Name')?.value === el.node.tags.find(tag => tag.name === 'Model-Name')?.value &&
            op.node.tags.find(tag => tag.name === 'Model-Creator')?.value === el.node.owner.address
        );
        // get only latest operators registrations
        modelOperators.map((op: IEdge) =>
          uniqueOperators.filter(
            (unique) => op.node.owner.address === unique.node.owner.address
          ).length > 0 ? undefined : uniqueOperators.push(op),
        );
        const opFees = uniqueOperators.map(op => {
          const fee = op.node.tags.find(el => el.name === 'Model-Fee')?.value;
          if (fee) return parseFloat(arweave.ar.winstonToAr(fee));
          else return 0;
        });
        const average = (arr: number[]) => arr.reduce( ( p, c ) => p + c, 0 ) / arr.length;
        const avgFee = average(opFees);

        return {
          name: el.node.tags.find(el => el.name === 'Model-Name')?.value || 'Name not Available',
          txid: el.node.id,
          uploader: el.node.owner.address,
          avgFee,
          totalOperators: uniqueOperators.length,
        };
      }));
    }
  }, [operatorsData]); // operatorsData changes

  if (loading) {
    return <h2>Loading...</h2>;
  } else if (error) {
    console.error(error);
    return null;
  }

  const handleCardClick = (idx: number) => {
    navigate(`/model/${encodeURIComponent(elements[idx].txid)}/register`, { state: data[idx] });
  };
  return (
    <>
      <Container sx={{ top: '64px', position: 'relative' }}>
        <Box>
          <Stack spacing={4} sx={{ margin: '16px' }}>
            {elements.map((el: Element, idx: number) => (
              <Card key={idx}>
                <Box>
                  <CardActionArea onClick={() => handleCardClick(idx)}>
                    <Typography>Name: {el.name}</Typography>
                    <Typography>Transaction id: {el.txid}</Typography>
                    <Typography>Creator: {el.uploader}</Typography>
                    <Typography>Average Fee: {Number.isNaN(el.avgFee) ? 'Not enough Operators for Fee' : el.avgFee}</Typography>
                    <Typography>Total Operators: {el.totalOperators}</Typography>
                  </CardActionArea>
                </Box>
              </Card>
            ))}
          </Stack>
        </Box>
      </Container>
    </>
  );
};

export default Operators;
