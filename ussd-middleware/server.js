const express = require('express');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.post('/ussd', async (req, res) => {
    const { sessionId, serviceCode, phoneNumber, text } = req.body;

    let response = '';

    if (text == '') {
        response = `CON Welcome to KULA ROSCA
1. Create Group
2. Join Group
3. My Payout Status`;
    } else if (text == '1') {
        response = `CON Enter Group Name:`;
    } else if (text.startsWith('1*')) {
        const groupName = text.split('*')[1];
        response = `END Group "${groupName}" is being created on Base L2!`;
    } else if (text == '3') {
        response = `END Your next payout: March 1st. Pot: 500 USDC.`;
    } else {
        response = `END Invalid choice.`;
    }

    res.set('Content-Type', 'text/plain');
    res.send(response);
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`KULA USSD Server running on http://localhost:${PORT}`);
});
