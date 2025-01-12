import { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'http://localhost:3000/api/graphql',
//   documents: 'src/**/*.tsx',
  generates: {
    'src/generated/graphql.tsx': {
      plugins: ['typescript', 'typescript-operations'],
    },
  },
};

export default config;
