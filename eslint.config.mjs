import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default [
  ...coreWebVitals,
  ...nextTypescript,
  { ignores: [".next/**", "out/**", "node_modules/**", "next-env.d.ts"] },
];
