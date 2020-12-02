require('dotenv').config();
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const adapter = new FileSync(process.env.DB_FILE);
const db = low(adapter);

module.exports = {
  getValue: (key) => {
    return db.get(key).value();
  },
  writeValue: (key, value) => {
    return db.set(key, value).write();
  },
};
