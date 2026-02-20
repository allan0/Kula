const express = require('express');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Provider for Base Sepolia
const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC);
// Your Backend Wallet (The "Relayer" that pays gas for users)
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

app.post('/ussd', async (req, res) => {
    const { sessionId, serviceCode, phoneNumber, text } = req.body;

    let response = '';

    if (text == '') {
        // Main Menu
        response = `CON Welcome to KULA ROSCA
1. Create Group
2. Join Group
3. My Payout Status`;
    } 
    else if (text == '1') {
        // Create Group logic
        response = `CON Enter Group Name (e.g., Nairobi Chamas):`;
    } 
    else if (text.startsWith('1*')) {
        // Handle the group name input
        const groupName = text.split('*')[1];
        response = `END Group "${groupName}" is being created on-chain. You will receive an SMS confirmation.`;
        
        // ASYNC: Trigger blockchain transaction in background
        console.log(`Creating group ${groupName} for ${phoneNumber}...`);
        // Note: In production, we'd call the contract here
    }
    else if (text == '3') {
        response = `END Your next payout is scheduled for March 1st. Current pot: 500 USDC.`;
    }

    res.set('Content-Type', 'text/plain');
    res.send(response);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`KULA USSD Server running on port ${PORT}`);
});
