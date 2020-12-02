require('dotenv').config();
const MetadataFilter = require('metadata-filter');
const lastfm = require('./lastfm');

(async function() {
  if (!lastfm.checkCreds()) {
    process.exit(1);
  }
  let recentTracks = await lastfm.getRecentTracks(process.env.LAST_FM_USERNAME);
  if (recentTracks) {
    const filter = MetadataFilter.getSpotifyFilter();
    for (let i = 0; i < recentTracks.length; i++) {
      let track = recentTracks[i];
      if (!track.date) continue;
      let trackName = track.name;
      let albumName = track.album['#text'];

      let cleanTrackName = filter.filterField('track', trackName);
      let cleanAlbumName = filter.filterField('album', albumName);

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

//console.log(MetadataFilter.removeRemastered('Jane Doe (Remastered)'));
