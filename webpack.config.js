const webpack = require('webpack');
const path = require('path');

module.exports = {
  entry: './src/app.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [
    new webpack.DefinePlugin({
      'window.appConfig': JSON.stringify({
        AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME,
        AWS_REGION: process.env.AWS_REGION,
        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
        FIREBASE_CONFIG: {
          apiKey: process.env.FIREBASE_API_KEY,
          authDomain: process.env.FIREBASE_AUTH_DOMAIN,
          projectId: process.env.FIREBASE_PROJECT_ID,
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.FIREBASE_APP_ID
        }
      })
    })
  ]
};
