require('dotenv').config();
const crypto = require('crypto');
const axios = require('axios').default;
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');
const url = require('url');
const db = require('./db');

const API_ROOT = 'http://ws.audioscrobbler.com/2.0/';
const API_KEY = process.env.LAST_FM_API_KEY;
const API_SECRET = process.env.LAST_FM_API_SECRET;
const USERNAME = process.env.LAST_FM_USERNAME;
const WEBSITE_ROOT = 'https://www.last.fm/';

axiosCookieJarSupport(axios);

const getJSON = async (url) => {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    throw error;
  }
};

const LastFM = {
  checkCreds: () => {
    if (!API_KEY || !API_SECRET) {
      console.log('Enter your API credentials in .env file');
      return false;
    }
    if (!db.getValue('sessionKey')) {
      console.log('Run authenticate.js to authenticate with last.fm api.');
      return false;
    }
    if (!db.getValue('encPassword') || 
      !db.getValue('csrfToken')|| 
      !db.getValue('sessionId')) {
      console.log('Run website-login.js to log into last.fm website.');
      return false;
    }
    return true;
  },

  getConsentUrl: (token) => `${WEBSITE_ROOT}api/auth/?api_key=${API_KEY}&token=${token}`,

  getSessionKey: () => {
    let sk = db.getValue('sessionKey');
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

  getRecentTracks: async (userName) => {
    let params = {
      method: 'user.getrecenttracks',
      user: userName,
      api_key: API_KEY,
      'limit': 200
    };
    let url = LastFM.getUrl(params);
    let response = await getJSON(url);
    if (response.recenttracks && response.recenttracks.track) {
      return response.recenttracks.track;
    }
    return false;
  },

  fixScrobble: async (track, cleanTrackName, cleanAlbumName) => {
    let sk = LastFM.getSessionKey();
    let deleteRes = await LastFM.deleteScrobble(track);
    if (deleteRes !== true) return false;
    let params = {
      method: 'track.scrobble',
      artist: track.artist['#text'],
      track: cleanTrackName,
      timestamp: track.date.uts,
      album: cleanAlbumName,
      mbid: track.mbid,
      api_key: API_KEY,
      sk: sk,
    };
    params['api_sig'] = LastFM.getApiSig(params);
    params['format'] = 'json';
    try {
      let paramStr = new url.URLSearchParams(params).toString();
      let response = await axios.post(API_ROOT, paramStr);
      let newScrobbleRes = false;
      if (response.data && response.data.scrobbles && response.data.scrobbles['@attr']) {
        if (response.data.scrobbles['@attr'].accepted == 1) {
          newScrobbleRes = true;
        }
      }
      return newScrobbleRes;
    } catch (error) {
      console.log(error.message);
      return false;
    }
  },

  deleteScrobble: async (track) => {
    let response;
    const paramStr = new url.URLSearchParams({
      csrfmiddlewaretoken: db.getValue('csrfToken'),
      artist_name: track.artist['#text'],
      track_name: track.name,
      timestamp: track.date.uts,
      ajax: 1
    }).toString();

    try {
      let csrfToken = db.getValue('csrfToken');
      let sessionId = db.getValue('sessionId');

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