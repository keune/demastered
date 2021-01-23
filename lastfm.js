require('dotenv').config();
const crypto = require('crypto');
const axios = require('axios').default;
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');
const readlineSync = require('readline-sync');
const url = require('url');

const quickCrypto = require('./quick-crypto');
const db = require('./db');

const API_ROOT = 'http://ws.audioscrobbler.com/2.0/';
const API_KEY = process.env.LAST_FM_API_KEY;
const API_SECRET = process.env.LAST_FM_API_SECRET;
const WEBSITE_ROOT = 'https://www.last.fm/';
const USERNAME = db.getValue(db.KEY_LAST_FM_USER_NAME);

axiosCookieJarSupport(axios);

const getJSON = async (url) => {
  const response = await axios.get(url);
  return response.data;
};

const LastFM = {
  checkCreds: () => {
    if (!API_KEY || !API_SECRET) {
      console.log('Enter your API credentials in .env file');
      return false;
    }
    if (!db.getValue(db.KEY_SESSION_KEY)) {
      console.log('Run authenticate.js to authenticate with last.fm api.');
      return false;
    }
    if (!db.getValue(db.KEY_ENC_PASSWORD) || 
      !db.getValue(db.KEY_CSRF_TOKEN)|| 
      !db.getValue(db.KEY_SESSION_ID)) {
      console.log('Run website-login.js to log into last.fm website.');
      return false;
    }
    return true;
  },

  askAndUpdateUserName: () => {
    let lastFmUserName = db.getValue(db.KEY_LAST_FM_USER_NAME) || '';
    let question = 'Your last.fm username: ';
    if (lastFmUserName)
      question += `(${lastFmUserName}) `;
    do {
      let newLastFmUserName = readlineSync.question(question) || lastFmUserName;
      if (newLastFmUserName) {
        lastFmUserName = newLastFmUserName;
      }
    } while (!lastFmUserName);
    db.writeValue(db.KEY_LAST_FM_USER_NAME, lastFmUserName);
    console.log(`Your last.fm username (${lastFmUserName}) is saved in ` + process.env.DB_FILE);
    return lastFmUserName;
  },

  askAndUpdatePassword: () => {
    let encPassword = db.getValue(db.KEY_ENC_PASSWORD);
    let password;
    if (encPassword) {
      password = quickCrypto.decryptText(encPassword);
    }
    let question = 'Your last.fm password: ';
    if (password) {
      question += '(Hit Enter to keep using the same password.) ';
    }
    do {
      let newPassword = readlineSync.question(question, {hideEchoBack: true}) || password;
      if (newPassword) {
        password = newPassword;
      }
    } while (!password);

    encPassword = quickCrypto.encryptText(password);
    db.writeValue(db.KEY_ENC_PASSWORD, encPassword);
    console.log(`Your encrypted last.fm password is saved in ` + process.env.DB_FILE);
    return encPassword;
  },

  getConsentUrl: (token) => `${WEBSITE_ROOT}api/auth/?api_key=${API_KEY}&token=${token}`,

  getSessionKey: () => {
    let sk = db.getValue(db.KEY_SESSION_KEY);
    if (typeof sk === 'string' && sk.length === 32) {
      return sk;
    }
    return false;
  },

  getApiSig: (params) => {
    let paramKeys = Object.keys(params).sort(),
      str = '';
    for (let i = 0; i < paramKeys.length; i++) {
      str += paramKeys[i] + params[paramKeys[i]];
    }
    str += API_SECRET;

    return crypto.createHash('md5').update(str).digest('hex');
  },

  getUrl: (params) => {
    let paramKeys = Object.keys(params).sort();
    let queryStr = [];
    for (let i = 0; i < paramKeys.length; i++) {
      queryStr.push(paramKeys[i] + '=' + params[paramKeys[i]]);
    }
    queryStr = queryStr.join('&');

    return `${API_ROOT}?${queryStr}&format=json`;
  },

  getToken: async () => {
    let params = {
      'api_key': API_KEY,
      'method': 'auth.getToken',
    };
    
    params['api_sig'] = LastFM.getApiSig(params);
    
    let url = LastFM.getUrl(params);
    let response = await getJSON(url);
    if (response.token) {
      return response.token;
    }
    return false;
  },

  getSession: async (token) => {
    let params = {
      'api_key': API_KEY,
      'method': 'auth.getSession',
      'token': token
    };
    params['api_sig'] = LastFM.getApiSig(params);
    
    let url = LastFM.getUrl(params);
    let response = await getJSON(url);
    if (response.session && response.session.key) {
      return response.session.key;
    }
    return false;
  },

  getRecentTracks: async (userName, limit = 200) => {
    let params = {
      method: 'user.getrecenttracks',
      user: userName,
      api_key: API_KEY,
      limit: limit
    };
    let url = LastFM.getUrl(params);
    let response = await getJSON(url);
    if (response.recenttracks && response.recenttracks.track) {
      return response.recenttracks.track;
    }
    return false;
  },

  fixScrobble: async (track, cleanTrackName, cleanAlbumName) => {
    let deleteRes = await LastFM.deleteScrobble(track);
    if (deleteRes !== true) return false;
    let addRes = await LastFM.scrobble(cleanTrackName, 
      track.artist['#text'], 
      cleanAlbumName, 
      track.date.uts, 
      track.mbid
    );
    return addRes;
  },

  scrobble: async (trackName, artistName, albumName, timestamp, mbid = '') => {
    let params = {
      method: 'track.scrobble',
      artist: artistName,
      track: trackName,
      timestamp: timestamp,
      album: albumName,
      mbid: mbid,
      api_key: API_KEY,
      sk: LastFM.getSessionKey(),
    };
    params['api_sig'] = LastFM.getApiSig(params);
    params['format'] = 'json';
    try {
      let paramStr = new url.URLSearchParams(params).toString();
      let response = await axios.post(API_ROOT, paramStr);
      let res = false;
      if (response.data && response.data.scrobbles && response.data.scrobbles['@attr']) {
        if (response.data.scrobbles['@attr'].accepted == 1) {
          res = true;
        } else {
          console.log('Unexpected response', response.data);
        }
      }
      return res;
    } catch (error) {
      console.log(error.message);
      return false;
    }
  },

  deleteScrobble: async (track) => {
    let response;
    const paramStr = new url.URLSearchParams({
      csrfmiddlewaretoken: db.getValue(db.KEY_CSRF_TOKEN),
      artist_name: track.artist['#text'],
      track_name: track.name,
      timestamp: track.date.uts,
      ajax: 1
    }).toString();

    try {
      let csrfToken = db.getValue(db.KEY_CSRF_TOKEN);
      let sessionId = db.getValue(db.KEY_SESSION_ID);

      let csrfTokenCookie = new tough.Cookie();
      csrfTokenCookie.key = 'csrftoken';
      csrfTokenCookie.value = csrfToken;

      let sessionIdCookie = new tough.Cookie();
      sessionIdCookie.key = 'sessionid';
      sessionIdCookie.value = sessionId;

      let cookieJar = new tough.CookieJar();
      await cookieJar.setCookie(csrfTokenCookie, WEBSITE_ROOT);
      await cookieJar.setCookie(sessionIdCookie, WEBSITE_ROOT);

      response = await axios.post(`${WEBSITE_ROOT}user/${USERNAME}/library/delete`, paramStr, {
        jar: cookieJar,
        withCredentials: true,
        gzip: true,
        maxRedirects: 0,
        validateStatus: (status) => {
          return status <= 302;
        },
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          Referer: `${WEBSITE_ROOT}user/${USERNAME}`
        }
      });
    } catch (error) {
      console.log(error);
      response = false;
    }

    if (response && response.data.result === true) {
      return true;
    } else {
      console.log('Error deleting ' + JSON.stringify(track) + ' body:' + response.data);
      return false;
    }
  }
};

module.exports = LastFM;