const crypto = require('crypto');

const ALGO = 'aes-192-cbc';
const SALT = 'scrobblescrobble';
const IV = 'hereshecomesnow.';
const KEY = crypto.scryptSync(SALT, 'salt', 24);

const QuickCrypto = {
  encryptText: (text) => {
    const cipher = crypto.createCipheriv(ALGO, KEY, IV);
    return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
  },

  decryptText: (text) => {
    const decipher = crypto.createDecipheriv(ALGO, KEY, IV);
    return decipher.update(text, 'hex', 'utf8') + decipher.final('utf8');
  }
};

module.exports = QuickCrypto;