import { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: './src/schema/schema.graphql', // Use local schema file instead of HTTP endpoint
//   documents: 'src/**/*.tsx',
  generates: {
    'src/generated/graphql.tsx': {
      plugins: ['typescript', 'typescript-operations'],
    },
  },
};

export default config;
