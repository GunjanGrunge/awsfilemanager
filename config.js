const appConfig = {
    AWS_REGION: window.appConfig.AWS_REGION,
    AWS_ACCESS_KEY_ID: window.appConfig.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: window.appConfig.AWS_SECRET_ACCESS_KEY,
    AWS_BUCKET_NAME: window.appConfig.AWS_BUCKET_NAME,
    FIREBASE_CONFIG: {
      apiKey: window.appConfig.FIREBASE_CONFIG.apiKey,
      authDomain: window.appConfig.FIREBASE_CONFIG.authDomain,
      projectId: window.appConfig.FIREBASE_CONFIG.projectId,
      storageBucket: window.appConfig.FIREBASE_CONFIG.storageBucket,
      messagingSenderId: window.appConfig.FIREBASE_CONFIG.messagingSenderId,
      appId: window.appConfig.FIREBASE_CONFIG.appId,
    },
  };
  
  export default config;
