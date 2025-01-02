const config = {
    AWS_REGION: process.env.MYAPP_AWS_REGION,
    AWS_ACCESS_KEY_ID: process.env.MYAPP_AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.MYAPP_AWS_SECRET_ACCESS_KEY,
    AWS_BUCKET_NAME: process.env.MYAPP_AWS_BUCKET_NAME,
    FIREBASE_CONFIG: {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
    },
  };
  
  export default config;
  