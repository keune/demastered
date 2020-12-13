require('dotenv').config();
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const adapter = new FileSync(process.env.DB_FILE);
const db = low(adapter);

module.exports = {
  KEY_LAST_FM_USER_NAME: 'lastFmUserName',
  KEY_SESSION_KEY: 'sessionKey',
  KEY_ENC_PASSWORD: 'encPassword',
  KEY_CSRF_TOKEN: 'csrfToken',
  KEY_SESSION_ID: 'sessionId',

  getValue: (key) => {
    return db.get(key).value();
  },

  writeValue: (key, value) => {
    return db.set(key, value).write();
  },
};
