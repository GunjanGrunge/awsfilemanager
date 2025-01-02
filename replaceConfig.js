const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.js');
const distPath = path.join(__dirname, 'dist', 'config.js');

// Read the original config.js
let configContent = fs.readFileSync(configPath, 'utf8');

// Replace process.env variables with actual values
configContent = configContent
    .replace('process.env.MYAPP_AWS_REGION', `"${process.env.MYAPP_AWS_REGION}"`)
    .replace('process.env.MYAPP_AWS_ACCESS_KEY_ID', `"${process.env.MYAPP_AWS_ACCESS_KEY_ID}"`)
    .replace('process.env.MYAPP_AWS_SECRET_ACCESS_KEY', `"${process.env.MYAPP_AWS_SECRET_ACCESS_KEY}"`)
    .replace('process.env.MYAPP_AWS_BUCKET_NAME', `"${process.env.MYAPP_AWS_BUCKET_NAME}"`)
    .replace('process.env.FIREBASE_API_KEY', `"${process.env.FIREBASE_API_KEY}"`)
    .replace('process.env.FIREBASE_AUTH_DOMAIN', `"${process.env.FIREBASE_AUTH_DOMAIN}"`)
    .replace('process.env.FIREBASE_PROJECT_ID', `"${process.env.FIREBASE_PROJECT_ID}"`)
    .replace('process.env.FIREBASE_STORAGE_BUCKET', `"${process.env.FIREBASE_STORAGE_BUCKET}"`)
    .replace('process.env.FIREBASE_MESSAGING_SENDER_ID', `"${process.env.FIREBASE_MESSAGING_SENDER_ID}"`)
    .replace('process.env.FIREBASE_APP_ID', `"${process.env.FIREBASE_APP_ID}"`);

// Ensure the dist directory exists
if (!fs.existsSync(path.join(__dirname, 'dist'))) {
    fs.mkdirSync(path.join(__dirname, 'dist'));
}

// Write the updated config.js to the dist folder
fs.writeFileSync(distPath, configContent, 'utf8');
