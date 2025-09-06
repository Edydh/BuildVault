const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const privateKeyPath = path.join(__dirname, '../secrets/AuthKey_VHU483DJ79.p8');

const teamId = 'U3KFL78946'; // Apple Team ID
const clientId = 'com.edyhdm.buildvault.auth'; // Your Services ID
const keyId = 'VHU483DJ79'; // Key ID from Apple

const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

const token = jwt.sign({}, privateKey, {
  algorithm: 'ES256',
  expiresIn: '180d',
  issuer: teamId,
  audience: 'https://appleid.apple.com',
  subject: clientId,
  keyid: keyId,
});

console.log('\nPaste this into Supabase as your Secret Key (for OAuth):\n');
console.log(token);