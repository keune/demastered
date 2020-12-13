# Demastered
This is a script designed to periodically check your recent scrobbles on last.fm, and do some meta-cleanup.

It turns this ugliness (caused by Spotify):

![](https://i.imgur.com/ka1wRAt.png?raw=true "Before")

<br>
to this:
<br>

![](https://i.imgur.com/sR5KHKP.png?raw=true "After")

## Why

If you're like me, you hate what Spotify is doing to last.fm stats since 2014 (or even earlier). I'm talking about stuff like Song Name - 2000 Remastered or Song Name [Remaster]. It has been discussed on Spotify and last.fm forums several times. In fact, officials from last.fm acknowledged this problem and stated that they were working on a fix. But unfortunately, after many years, this problem still exists, and it is likely that it will never be offically solved.

Fortunately, there are a few scrobblers out there that [lets you edit your recent scrobbles](https://play.google.com/store/apps/details?id=com.arn.scrobble) or [clean track metadata before scrobbling it](https://github.com/YodaEmbedding/scrobblez). While they work quite fine, they don't play well with Spotify's multi-device nature. Imagine using Spotify on both your mobile and desktop at the same time. Maybe you were using your computer at your desk, and you went to the kitchen to get a cup of coffee and used your mobile phone to skip a few songs. If you have scrobblers at both devices, you get duplicate scrobbles. If you don't have a scrobbler on your mobile and you quit the Spotify app on your desktop to continue on mobile, nothing gets scrobbled. For this exact reason, there's now an official scrobbler for Spotify, and it handles this multi-device scrobbling pretty well, you don't miss any scrobbles, also you don't get duplicates. But you're back to problem #1: ugly remastered metadata.

So what if we check our scrobbles every few hours or so, and fix them in place?

## How it works

There is no straight-forward way to update or fix a scrobble. For that reason, this script both consumes the last.fm API and scrapes the website, because the only way possible is making a request as an authenticated user to the website to delete the original scrobble, and then send a new scrobble to the API with the fixed metadata and the same timestamp. This two-step operation effectively 'updates' the same scrobble you see in your history. As long as the original scrobble is recent enough, this works.

## How to use
1. Create a last.fm **API account** [here](https://www.last.fm/api/account/create). You can leave callback URL empty.
If you have existing credentials, you can use them.
2. Copy `.env.example` file to `.env` and enter API key and API secret information.
3. Run `node authenticate.js` and follow the instructions. It'll ask you to allow access to your last.fm account for the API account you created.
4. Run `website-login.js` to log into last.fm. Your encrypted password will be saved to a local .json file. It is not sent anywhere except the last.fm website.
5. After that, you can run `node index.js`. It will pull your recent scrobbles and apply the necessary fixes.
6. You can periodically run `node index.js` with a cronjob or any other methods. If your credentials change, you can run `node authenticate.js` and/or `node website-login.js` again.

## Can I use this to do a full history cleanup?

last.fm ignores scrobbles with a very old date, so this script can't be used to do a full history cleanup. If you consider upgrading to [last.fm pro](https://www.last.fm/pro), bulk-editing all scrobbles of a single track is possible.