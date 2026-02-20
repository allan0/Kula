const express = require('express');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Blockchain Configuration
const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contractAddress = process.env.CONTRACT_ADDRESS;

const abi = [
    "function createGroup(string memory _name, uint256 _amount, uint256 _interval) external",
    "function joinGroup(uint256 _groupId) external",
    "function groupCount() public view returns (uint256)"
];

const kulaContract = new ethers.Contract(contractAddress, abi, wallet);

app.post('/ussd', async (req, res) => {
    const { sessionId, serviceCode, phoneNumber, text } = req.body;
    let response = '';

    if (text === '') {
        // Main Menu
        response = `CON Welcome to KULA ROSCA
1. Create Group
2. Join Group
3. My Payout Status`;
    } 
    else if (text === '1') {
        // Option 1 selected
        response = `CON Enter Group Name:`;
    } 
    else if (text.startsWith('1*')) {
        // User entered a name (e.g., 1*MyGroup)
        const groupName = text.split('*')[1];
        try {
            const amount = ethers.parseUnits("10", 6); 
            const interval = 604800; 
            const tx = await kulaContract.createGroup(groupName, amount, interval);
            response = `END Success! Group "${groupName}" created. TX: ${tx.hash.substring(0, 10)}`;
        } catch (err) {
            response = `END Error creating group. Check your gas balance.`;
        }
    } 
    else if (text === '2') {
        // Option 2 selected
        response = `CON Enter Group ID to Join:`;
    } 
    else if (text.startsWith('2*')) {
        // User entered an ID (e.g., 2*1)
        const groupId = text.split('*')[1];
        try {
            const tx = await kulaContract.joinGroup(groupId);
            response = `END You have joined group ${groupId}! TX: ${tx.hash.substring(0, 10)}`;
        } catch (err) {
            response = `END Error: Could not join group. Ensure ID ${groupId} exists.`;
        }
    } 
    else if (text === '3') {
        response = `END Next payout: March 1st. Current Pot: 500 USDC.`;
    } 
    else {
        response = `END Invalid entry.`;
    }

    res.set('Content-Type', 'text/plain');
    res.send(response);
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`KULA USSD Server active at http://localhost:${PORT}`);
    console.log(`Linked to Contract: ${contractAddress}`);
});
