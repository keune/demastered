require('dotenv').config();
const readlineSync = require('readline-sync');
const lastfm = require('./lastfm');

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
  readlineSync.question('After you\'ve authenticated, hit Enter key to continue.', {hideEchoBack: true, mask: ''});
  let sessionKey = await lastfm.getSession(token);
  if (!sessionKey) {
    console.log('Failed to get session key.');
    process.exit(1);
  }

  const db = require('./db');
  db.writeValue('sessionKey', sessionKey);
  console.log('Your session key is saved in ' + process.env.DB_FILE);
})();