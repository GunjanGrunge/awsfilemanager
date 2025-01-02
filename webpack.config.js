const webpack = require('webpack');
const path = require('path');

module.exports = {
  entry: './app.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [
    new webpack.DefinePlugin({
      'window.appConfig': {
        AWS_REGION: JSON.stringify(process.env.AWS_REGION),
        AWS_ACCESS_KEY_ID: JSON.stringify(process.env.AWS_ACCESS_KEY_ID),
        AWS_SECRET_ACCESS_KEY: JSON.stringify(process.env.AWS_SECRET_ACCESS_KEY),
        AWS_BUCKET_NAME: JSON.stringify(process.env.AWS_BUCKET_NAME),
        FIREBASE_CONFIG: {
          apiKey: JSON.stringify(process.env.FIREBASE_API_KEY),
          authDomain: JSON.stringify(process.env.FIREBASE_AUTH_DOMAIN),
          projectId: JSON.stringify(process.env.FIREBASE_PROJECT_ID),
          storageBucket: JSON.stringify(process.env.FIREBASE_STORAGE_BUCKET),
          messagingSenderId: JSON.stringify(process.env.FIREBASE_MESSAGING_SENDER_ID),
          appId: JSON.stringify(process.env.FIREBASE_APP_ID)
        }
      }
    })
  ]
};