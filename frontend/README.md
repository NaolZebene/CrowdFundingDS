# React + TypeScript + Vite

## Environment setup

RainbowKit requires a WalletConnect Cloud project ID.

1. Copy `.env.example` to `.env`.
2. Set `VITE_WALLETCONNECT_PROJECT_ID` with your WalletConnect Cloud project ID.
3. Set `VITE_SUBGRAPH_URL` with your GraphQL endpoint for the CrowdVault subgraph.

## Funding on Sepolia

Project funding uses real Sepolia USDC at `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`. Testers need both Sepolia ETH for gas and Sepolia USDC for the investment amount; Sepolia ETH alone cannot fund a project.

## Real module wiring

The frontend reads the deployed `CrowdVault`, `CommitmentAMM`, `RevenueRouter`, and lender addresses from `src/config/contracts.ts`. For Sepolia, make sure the vault's on-chain `lender`, `AMM`, and revenue router match those configured addresses. The admin dashboard shows mismatches and includes buttons to connect the configured modules.

Example:

```bash
cp .env.example .env
```

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default tseslint.config({
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

- Replace `tseslint.configs.recommended` to `tseslint.configs.recommendedTypeChecked` or `tseslint.configs.strictTypeChecked`
- Optionally add `...tseslint.configs.stylisticTypeChecked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and update the config:

```js
// eslint.config.js
import react from 'eslint-plugin-react'

export default tseslint.config({
  // Set the react version
  settings: { react: { version: '18.3' } },
  plugins: {
    // Add the react plugin
    react,
  },
  rules: {
    // other rules...
    // Enable its recommended rules
    ...react.configs.recommended.rules,
    ...react.configs['jsx-runtime'].rules,
  },
})
```
