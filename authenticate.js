import 'dotenv/config';
import psp from 'prompt-sync-plus';

import db from './db.js';
import {lastfm} from './lastfm.js';

(async function() {
  let token = await lastfm.getToken();
  if (!token) {
    console.log('Failed to get token.');
    process.exit(1);
  }
  let consentUrl = lastfm.getConsentUrl(token);
  console.log('Go to the following URL to authenticate:');
  console.log(consentUrl);
  console.log("\n\n");
  const prompt = psp();
  prompt.hide('After you\'ve authenticated, hit Enter key to continue.');
  let sessionKey = await lastfm.getSession(token);
  if (!sessionKey) {
    console.log('Failed to get session key.');
    process.exit(1);
  }

  db.writeValue(db.KEY_SESSION_KEY, sessionKey);
  console.log('Your session key is saved in ' + process.env.DB_FILE);
})();