# 🏦 KULA | The Sovereign Vault

[![Live Demo](https://img.shields.io/badge/Live_App-kula--six.vercel.app-D4AF37?style=for-the-badge)](https://kula-six.vercel.app)
[![Base L2](https://img.shields.io/badge/Network-Base_Sepolia-0052FF?style=for-the-badge&logo=base&logoColor=white)](https://base.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-85%25-3178C6?style=for-the-badge&logo=typescript&logoColor=white)]()

> A decentralized ROSCA (Rotating Savings and Credit Association) and collective wealth protocol deployed on **Base L2**. KULA bridges traditional community finance (Chamas) with on-chain trust execution, Real World Asset (RWA) tokenization, and offline accessibility.

## 📖 Overview

KULA modernizes group economics by replacing off-chain trust with immutable smart contracts. We utilize **EIP-4337 Account Abstraction** to provide gasless, seedless experiences, allowing users to interact via **Telegram Mini Apps (TMA)** and **USSD** gateways. This ensures complete financial inclusion across emerging markets, regardless of internet connectivity or Web3 knowledge.

## ✨ Core Innovations

*   📱 **Telegram OS & Mini App Integration:** Native group management inside Telegram. Users can propose assets, vote, and contribute funds directly in their existing chat groups via the Kula Telegram Bot and inline TMA.
*   ⛽ **Gasless & Seedless (EIP-4337):** Powered by Privy and Smart Accounts (Paymasters), users interact with Base L2 without ever holding ETH or seeing a seed phrase.
*   📡 **Offline USSD Gateway:** Seamless integration with Africa's Talking API, allowing feature-phone users to join groups and manage on-chain liquidity using standard dial codes (e.g., `*384*KULA#`).
*   🏢 **RWA Tokenization & Governance:** Groups can securely upload Real World Assets (Deeds, Logbooks) to IPFS. Once verified via quorum voting, KULA mints fractionalized Trust Equity NFTs representing shared ownership.
*   📈 **Automated Yield Engine:** Idle group treasury funds are automatically routed to Aave V3/Morpho to generate compounding interest, secured by a self-healing insurance reserve.

## 🏗️ Architecture & Tech Stack

KULA is built as a highly modular monorepo:

*   **Smart Contracts:** Solidity `^0.8.24`, Hardhat, OpenZeppelin.
*   **Web / TMA Frontend:** Next.js 14, TypeScript, Tailwind CSS, Framer Motion.
*   **Web3 Integration:** Wagmi, Viem, Privy (Social Login & Embedded Wallets).
*   **Mobile App:** Expo, React Native, NativeWind v4.
*   **Backend Middleware:** Node.js, Express, Telegraf (TG Bot), ethers.js, Africa's Talking API.

## 📂 Repository Structure

```text
kula/
├── contracts/            # Core Solidity contracts (RotaryGroup, YieldEngine, Governance)
├── frontend/             # Next.js Telegram Mini App & Web Dashboard
├── mobile/               # Expo React Native App (iOS/Android)
├── ussd-middleware/      # Express server handling offline USSD & Telegram Bot Webhooks
├── scripts/              # Hardhat deployment scripts
└── hardhat.config.js     # Base Sepolia network configurations
