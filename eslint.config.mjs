import tseslint from "typescript-eslint";

export default tseslint.config(...tseslint.configs.recommended, {
  files: ["extensions/structured-return/src/**/*.ts"],
  rules: {
    "@typescript-eslint/no-explicit-any": "warn",
  },
});
