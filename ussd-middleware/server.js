const express = require('express');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.post('/ussd', (req, res) => {
    // These variables are sent by Africa's Talking API
    const { sessionId, serviceCode, phoneNumber, text } = req.body;

    let response = '';

    if (text == '') {
        // Main Menu
        response = `CON Welcome to KULA ROSCA
1. Create Group
2. Join Group
3. Check My Balance`;
    } else if (text == '1') {
        response = `CON Enter Group Name:`;
    } else if (text == '3') {
        // Logic to query blockchain would go here
        response = `END Your KULA balance is 50.00 USDC`;
    } else {
        response = `END Invalid entry. Try again.`;
    }

    res.set('Content-Type', 'text/plain');
    res.send(response);
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`KULA USSD Server running on port ${PORT}`);
});
