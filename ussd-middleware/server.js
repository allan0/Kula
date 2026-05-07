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
    let sanitized = key.trim().replace(/["']/g, "");
    if (!sanitized.startsWith('0x')) sanitized = `0x${sanitized}`;
    return sanitized;
};

const RPC_URL = process.env.BASE_SEPOLIA_RPC;
const RAW_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDR = process.env.CONTRACT_ADDRESS;
const PRIV_KEY = cleanPrivateKey(RAW_KEY);

// Root Route - FIXES THE 404 ERROR
app.get('/', (req, res) => {
    res.status(200).send("✅ KULA USSD Middleware is Online. Configured for Africa's Talking.");
});

// Validation and Blockchain setup
if (!RPC_URL || !PRIV_KEY || PRIV_KEY.length < 64) {
    console.error("❌ INVALID CONFIGURATION: Check Render Environment Variables.");
} else {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(PRIV_KEY, provider);
        const abi = [
            "function createGroup(string memory _name, uint256 _amount, uint256 _interval) external",
            "function joinGroup(uint256 _groupId) external",
            "function groupCount() public view returns (uint256)"
        ];
        const kulaContract = new ethers.Contract(CONTRACT_ADDR, abi, wallet);

        // USSD POST Route
        app.post('/ussd', async (req, res) => {
            const { text } = req.body;
            let response = '';

            if (text === '' || text === undefined) {
                response = `CON Welcome to KULA ROSCA\n1. Create Group\n2. Join Group\n3. My Payout Status`;
            } else if (text === '1') {
                response = `CON Enter Group Name:`;
            } else if (text.startsWith('1*')) {
                const groupName = text.split('*')[1];
                try {
                    const tx = await kulaContract.createGroup(groupName, ethers.parseUnits("10", 6), 604800);
                    response = `END Creating "${groupName}"...\nTX: ${tx.hash.substring(0, 10)}`;
                } catch (err) { response = `END Error: Transaction failed.`; }
            } else if (text === '2') {
                response = `CON Enter Group ID:`;
            } else if (text.startsWith('2*')) {
                const groupId = text.split('*')[1];
                try {
                    const tx = await kulaContract.joinGroup(groupId);
                    response = `END Joined group ${groupId}!\nTX: ${tx.hash.substring(0, 10)}`;
                } catch (err) { response = `END Error: Group not found.`; }
            } else if (text === '3') {
                response = `END Payout: March 1st.\nPot: 500 USDC.`;
            } else {
                response = `END Invalid entry.`;
            }
            res.set('Content-Type', 'text/plain');
            res.send(response);
        });
        console.log("✅ Blockchain Logic Loaded");
    } catch (e) {
        console.error("❌ Wallet initialization failed:", e.message);
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 KULA Server live on port ${PORT}`);
});
