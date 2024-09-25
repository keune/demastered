import 'dotenv/config';
import { LowSync } from 'lowdb'
import { JSONFileSync } from 'lowdb/node'

const db = new LowSync(new JSONFileSync(process.env.DB_FILE), {})

export default {
  KEY_LAST_FM_USER_NAME: 'lastFmUserName',
  KEY_SESSION_KEY: 'sessionKey',
  KEY_ENC_PASSWORD: 'encPassword',
  KEY_CSRF_TOKEN: 'csrfToken',
  KEY_SESSION_ID: 'sessionId',

  getValue: (key) => {
    db.read();
    return db.data[key];
  },

  writeValue: (key, value) => {
    db.read();
    db.data[key] = value;
    return db.write();
  },
};
