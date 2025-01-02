// filepath: /c:/Users/Gunjan Sarkar/OneDrive/Desktop/Applications/awscongitoui/replaceConfig.js
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Load environment variables from .env

const configPath = path.join(__dirname, 'config.js');
const distPath = path.join(__dirname, 'dist', 'config.js');

// Check if config.js exists
if (!fs.existsSync(configPath)) {
    console.error('Error: config.js file not found at', configPath);
    process.exit(1);
}

// Read the original config.js
let configContent = fs.readFileSync(configPath, 'utf8');

// Replace process.env variables with actual values
configContent = configContent
    .replace(/process\.env\.MYAPP_AWS_REGION/g, `"${process.env.MYAPP_AWS_REGION}"`)
    .replace(/process\.env\.MYAPP_AWS_ACCESS_KEY_ID/g, `"${process.env.MYAPP_AWS_ACCESS_KEY_ID}"`)
    .replace(/process\.env\.MYAPP_AWS_SECRET_ACCESS_KEY/g, `"${process.env.MYAPP_AWS_SECRET_ACCESS_KEY}"`)
    .replace(/process\.env\.MYAPP_AWS_BUCKET_NAME/g, `"${process.env.MYAPP_AWS_BUCKET_NAME}"`)
    .replace(/process\.env\.FIREBASE_API_KEY/g, `"${process.env.FIREBASE_API_KEY}"`)
    .replace(/process\.env\.FIREBASE_AUTH_DOMAIN/g, `"${process.env.FIREBASE_AUTH_DOMAIN}"`)
    .replace(/process\.env\.FIREBASE_PROJECT_ID/g, `"${process.env.FIREBASE_PROJECT_ID}"`)
    .replace(/process\.env\.FIREBASE_STORAGE_BUCKET/g, `"${process.env.FIREBASE_STORAGE_BUCKET}"`)
    .replace(/process\.env\.FIREBASE_MESSAGING_SENDER_ID/g, `"${process.env.FIREBASE_MESSAGING_SENDER_ID}"`)
    .replace(/process\.env\.FIREBASE_APP_ID/g, `"${process.env.FIREBASE_APP_ID}"`);

// Ensure the dist directory exists
if (!fs.existsSync(path.join(__dirname, 'dist'))) {
    fs.mkdirSync(path.join(__dirname, 'dist'));
}

// Write the updated config.js to the dist folder
fs.writeFileSync(distPath, configContent, 'utf8');

console.log('config.js has been successfully processed and saved to the dist folder.');
