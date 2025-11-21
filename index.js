import * as MetadataFilter from '@web-scrobbler/metadata-filter';
import XLSX from 'xlsx';

import db from './db.js';
import { lastfm } from './lastfm.js';

(async function () {
  if (!lastfm.checkCreds()) {
    process.exit(1);
  }
  let userName = db.getValue(db.KEY_LAST_FM_USER_NAME);
  let recentTracks = await lastfm.getRecentTracks(userName);
  if (recentTracks) {
    const filter = MetadataFilter.createSpotifyFilter();
    filter.extend(MetadataFilter.createAmazonFilter());

    let trackReplacements = [];
    let albumReplacements = [];

    try {
      let replacements = XLSX.readFile('./replacements.xlsx');
      const tracksReplacementSheet = replacements.Sheets['tracks'];
      trackReplacements = XLSX.utils.sheet_to_json(tracksReplacementSheet);
      const albumsReplacementSheet = replacements.Sheets['albums'];
      albumReplacements = XLSX.utils.sheet_to_json(albumsReplacementSheet);
    } catch (error) {
      console.error(error.message);
    }

    for (let i = 0; i < recentTracks.length; i++) {
      let track = recentTracks[i];
      if (!track.date) continue;
      let trackName = track.name;
      let albumName = track.album['#text'];

      let cleanTrackName = filter.filterField('track', trackName);
      let cleanAlbumName = filter.filterField('album', albumName);

      for (let j = 0; j < trackReplacements.length; j++) {
        let replacement = trackReplacements[j];
        if (trackName == replacement.from) {
          cleanTrackName = replacement.to;
          break;
        }
      }
      for (let j = 0; j < albumReplacements.length; j++) {
        let replacement = albumReplacements[j];
        if (albumName == replacement.from) {
          cleanAlbumName = replacement.to;
          break;
        }
      }

      if (trackName != cleanTrackName || albumName != cleanAlbumName) {
        console.log(trackName, ' ---> ', cleanTrackName);
        console.log(albumName, ' ---> ', cleanAlbumName);
        let res = await lastfm.fixScrobble(track, cleanTrackName, cleanAlbumName);
        if (res) {
          console.log('Fixed.');
        } else {
          console.log('Failed to fix.');
        }
      }
    }
  }
})();
