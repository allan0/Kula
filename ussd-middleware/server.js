const express = require('express');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// --- AGGRESSIVE PRIVATE KEY CLEANING ---
const cleanPrivateKey = (key) => {
    if (!key) return null;
    // Remove quotes, spaces, and newlines that often get copied by mistake
    let sanitized = key.trim().replace(/["']/g, "");
    // Ensure it starts with 0x
    if (!sanitized.startsWith('0x')) {
        sanitized = `0x${sanitized}`;
    }
    return sanitized;
};

const RPC_URL = process.env.BASE_SEPOLIA_RPC;
const RAW_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDR = process.env.CONTRACT_ADDRESS;

const PRIV_KEY = cleanPrivateKey(RAW_KEY);

// Validation
if (!RPC_URL || !PRIV_KEY || PRIV_KEY.length < 64) {
    console.error("❌ INVALID CONFIGURATION:");
    if (!RPC_URL) console.error("- Missing BASE_SEPOLIA_RPC");
    if (!PRIV_KEY || PRIV_KEY.length < 64) console.error("- Missing or invalid PRIVATE_KEY (must be 64-66 chars)");
    process.exit(1);
}

// Setup Provider & Wallet
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIV_KEY, provider);

const abi = [
    "function createGroup(string memory _name, uint256 _amount, uint256 _interval) external",
    "function joinGroup(uint256 _groupId) external",
    "function groupCount() public view returns (uint256)"
];

const kulaContract = new ethers.Contract(CONTRACT_ADDR, abi, wallet);

app.post('/ussd', async (req, res) => {
    const { text } = req.body;
    let response = '';

    if (text === '') {
        response = `CON Welcome to KULA ROSCA\n1. Create Group\n2. Join Group\n3. My Payout Status`;
    } 
    else if (text === '1') {
        response = `CON Enter Group Name:`;
    } 
    else if (text.startsWith('1*')) {
        const groupName = text.split('*')[1];
        try {
            const amount = ethers.parseUnits("10", 6); 
            const interval = 604800; 
            const tx = await kulaContract.createGroup(groupName, amount, interval);
            response = `END Success! Group "${groupName}" created.\nTX: ${tx.hash.substring(0, 10)}`;
        } catch (err) {
            response = `END Error: Check balance/gas.`;
        }
    } 
    else if (text === '2') {
        response = `CON Enter Group ID:`;
    } 
    else if (text.startsWith('2*')) {
        const groupId = text.split('*')[1];
        try {
            const tx = await kulaContract.joinGroup(groupId);
            response = `END Joined group ${groupId}!\nTX: ${tx.hash.substring(0, 10)}`;
        } catch (err) {
            response = `END Error: Could not join.`;
        }
    } 
    else if (text === '3') {
        response = `END Payout: March 1st.\nPot: 500 USDC.`;
    } 
    else {
        response = `END Invalid entry.`;
    }

    res.set('Content-Type', 'text/plain');
    res.send(response);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ KULA USSD Live on port ${PORT}`);
    console.log(`📍 Using Contract: ${CONTRACT_ADDR}`);
});
