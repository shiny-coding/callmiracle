import { GetServerSideProps } from 'next';
import clientPromise from '../lib/mongodb';

export const getServerSideProps: GetServerSideProps = async () => {
  const client = await clientPromise;
  const db = client.db('your-database-name');
  const data = await db.collection('your-collection-name').find({}).toArray();

  return {
    props: { data: JSON.parse(JSON.stringify(data)) },
  };
};

const Home = ({ data }) => {
  return (
    <div>
      <h1>Data from MongoDB</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};

export default Home; 