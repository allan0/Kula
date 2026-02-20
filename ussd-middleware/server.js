const express = require('express');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// 1. Blockchain Setup
const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contractAddress = process.env.CONTRACT_ADDRESS;

// 2. The ABI (Tells Ethers how to talk to your functions)
const abi = [
    "function createGroup(string memory _name, uint256 _amount, uint256 _interval) external",
    "function groupCount() public view returns (uint256)"
];

const kulaContract = new ethers.Contract(contractAddress, abi, wallet);

app.post('/ussd', async (req, res) => {
    const { sessionId, serviceCode, phoneNumber, text } = req.body;
    let response = '';

    if (text == '') {
        response = `CON Welcome to KULA ROSCA
1. Create Group
2. Join Group
3. My Payout Status`;
    } 
    else if (text == '1') {
        response = `CON Enter Group Name:`;
    } 
    else if (text.startsWith('1*')) {
        const groupName = text.split('*')[1];
        
        try {
            // 3. Trigger the Blockchain Transaction!
            // Parameters: Name, Amount (10 USDC in wei), Interval (604800 seconds = 1 week)
            const amount = ethers.parseUnits("10", 6); // USDC has 6 decimals
            const interval = 604800; 

            // This sends the real txn to Base
            const tx = await kulaContract.createGroup(groupName, amount, interval);
            
            response = `END Success! Group "${groupName}" is being created. 
TX Hash: ${tx.hash.substring(0, 10)}...`;

            console.log(`Transaction Sent: ${tx.hash}`);
        } catch (error) {
            console.error(error);
            response = `END Error: Could not connect to Base L2.`;
        }
    } 
    else if (text == '3') {
        response = `END Your next payout: March 1st. Pot: 500 USDC.`;
    }

    res.set('Content-Type', 'text/plain');
    res.send(response);
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`KULA USSD Server active at http://localhost:${PORT}`);
    console.log(`Linked to Contract: ${contractAddress}`);
});
