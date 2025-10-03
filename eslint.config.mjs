import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off', // Allow Function type
      '@typescript-eslint/no-wrapper-object-types': 'off', // Allow Object type
      '@typescript-eslint/no-empty-object-type': 'off', // Allow {} type
      '@typescript-eslint/no-require-imports': 'off', // Allow require
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "react-hooks/rules-of-hooks": "off  ",
      // or to keep warnings but ignore specific patterns:
      // '@typescript-eslint/no-unused-vars': ['warn', { 
      //   argsIgnorePattern: '^_',
      //   varsIgnorePattern: '^_'
      // }]
    }
  }
];

export default eslintConfig;
