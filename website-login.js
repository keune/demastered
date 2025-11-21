import 'dotenv/config';
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import * as tough from 'tough-cookie';
import * as url from "node:url";

import db from './db.js';
import { lastfm } from './lastfm.js';
import quickCrypto from './quick-crypto.js';
const loginUrl = 'https://www.last.fm/login';

const cookieJar = new tough.CookieJar();
const axiosClient = wrapper(axios.create({ cookieJar }));

let csrfToken;

(async () => {
  let lastFmUserName = lastfm.askAndUpdateUserName();
  let encPassword = lastfm.askAndUpdatePassword();
  let password = quickCrypto.decryptText(encPassword);

  let response;
  try {
    response = await axiosClient.get(loginUrl, { jar: cookieJar });
  } catch (error) {
    console.log(error);
  }
  if (!response) {
    console.log('Login failed, HTTP error.');
    process.exit(1);
  }

  csrfToken = response.data.match(/<input[^>]+name='csrfmiddlewaretoken'[^>]+>/g)[0].match(/value='([^']+)'/)[1];
  console.log('Initial CSRF Token extracted: ' + csrfToken);

  let cookies = await cookieJar.getCookies(loginUrl);
  console.log('Initial session id: ' + cookies.filter(c => c.key == 'sessionid')[0].value);

  const paramStr = new url.URLSearchParams({
    username_or_email: lastFmUserName,
    password: password,
    csrfmiddlewaretoken: csrfToken
  }).toString();
  try {
    response = await axiosClient.post(loginUrl, paramStr, {
      jar: cookieJar,
      withCredentials: true,
      gzip: true,
      maxRedirects: 0,
      timeout: 8000,
      validateStatus: (status) => {
        return status <= 302;
      },
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        Referer: loginUrl
      }
    });
  } catch (error) {
    console.log('Error logging in', error);
    process.exit();
  }

  if (response.status == 302) {
    let cookies = await cookieJar.getCookies(loginUrl);
    let csrfCookie = cookies.filter(c => c.key == 'csrftoken')[0] || null;
    let sessionCookie = cookies.filter(c => c.key == 'sessionid')[0] || null;
    if (!csrfCookie) throw new Error('no csrf token found');
    if (!sessionCookie) throw new Error('no session id token found');

    //console.log('Login CSRF Token extracted:       ' + csrfCookie.value);
    //console.log('Login Session ID Token extracted: ' + sessionCookie.value);
    db.writeValue(db.KEY_CSRF_TOKEN, csrfCookie.value);
    db.writeValue(db.KEY_SESSION_ID, sessionCookie.value);
    console.log(`Login successful, session saved to ${process.env.DB_FILE} file.`);
  } else {
    console.log('Login Failed');
    console.log('Response code: ' + response.statusCode);
    console.log(response.body.match(/<div[^>]+class=['"]alert[^>]+>([^<]+)<\/div>/g).map(html => 'Message: ' + html.match(/>[\\n\W]*([^\\<]+)[^<]*</)[1].trim()));
  }
})();