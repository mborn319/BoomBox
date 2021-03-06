#!/usr/bin/env node

/**
 * This file uses python-discid to check the CD-rom
 * to see if the songs are catalogued in musicbrainz.org.
 *
 * @cite: https://github.com/mborn319/python-discid2
 * @cite: https://pypi.python.org/pypi/musicbrainzngs/0.6
 * @cite: https://github.com/bmc0/musicbrainz_discid
 * @cite: https://www.npmjs.com/package/python-shell
 * @cite: http://xiph.org/paranoia/
 */

/**
 * the track object, collated from musicbrainz metadata
 * @typedef {Object} Track
 * @property {string} _id - primary key, this is the musicbrainz track id
 * @property {string} title - the musicbrainz track title
 * @property {string} filename - the relative pathname + unique filename + .cdda.wav extension
 * @property {string} recording_id - the musicbrainz recording.id property - currently not used
 * @property {string} albumid - foreign key for the musicbrainz album "release"
 * @property {string} artistid - foreign key for the musicbrainz artist
 */

/**
 * the Album object, collated from musicbrainz metadata and sent to Mongo
 * @typedef {Object} Album
 * @property {string} _id - primary key, this is the musicbrainz album id
 * @property {string} artistid - musicbrainz artist id
 * @property {string} title - musicbrainz release title
 * @property {string} date - musicbrainz release date
 * @property {number} track_count - musicbrainz release track count
 */

/**
 * the Artist object, collated from musicbrainz metadata and sent to Mongo
 * @typedef {Object} Artist
 * @property {string} _id - primary key, this is the musicbrainz artist id
 * @property {string} name - musicbrainz artist name
 */

var fs = require('fs'),
    path = require('path'),
    acoustid = require('acoustid'),
    db = require('../init-mongo.js'),
    pyShell = require('python-shell'),
    shell = require('child_process'),
    spawn = shell.spawn;

/**
 * do any special formatting before we save the data to Mongo
 * loop through each track, append albumid
 * @returns {Object} - artist, album, and tracks
 */
var collateResults = function(data) {
  var trackList = data["medium-list"][0]["track-list"],
      artist = {
        _id: data["artist-credit"][0].artist.id,
        name: data["artist-credit"][0].artist.name
      },
      album = {
        _id: data.id,
        artistid: data["artist-credit"][0].artist.id,
        title: data.title,
        date: data.date,
        track_count:data["medium-list"][0]["track-count"]
      };

  // add the foreign key ids 
  // note these IDs come all the way from musicbrainz.org!!
  // http://musicbrainz.org/artist/6e0ae159-8449-4262-bba5-18ec87fa529f
  for (var i=0;i<trackList.length;i++) {
    // first, we "guess" at the track filename.
    // it's an intelligent guess because we know the file extension
    // and the track number / order number.
    // hopefully this never breaks, but it could,
    // which would result in track X being associated with
    // the metadata for track X+-1.
    trackList[i].filename = getTrackFilename(trackList[i]);

    // "flatten" the recording object into the track
    trackList[i].title = trackList[i].recording.title;
    trackList[i].recording_id = trackList[i].recording.id;
    delete trackList[i].recording;

    // add album id foreign key for Mongo
    trackList[i].albumid = album._id;

    // add artist id foreign key for Mongo
    trackList[i].artistid = artist._id;

    // make sure we have a proper mongodb id
    trackList[i]._id = trackList[i].id;
    delete trackList[i].id;
  }

  return { artist: artist, album: album, tracks: trackList };
};
/**
 * given the track object with number property
 * return the cdparanoia-generated filename
 * @param {Track}
 * @return {string} the correct filename
 */
var getTrackFilename = function(track) {
  var typical = "track[number].cdda.mp3",
    trackNum = getTrackNumLeadingZero(track.number);
  return typical.replace(/\[number\]/,trackNum);
};
/**
 * given an artist name and album name
 * send back a pathname in the form audio/wav/artist/album
 * making sure to strip bad characters to avoid bad paths
 * Note that the returned pathname is
 * RELATIVE to the boombox root directory
 * @param {string} artist
 * @param {string} album
 * @return {string} relative pathname
 */
var getUniqueDirectory = function(artist, album) {
  var typical = "audio/mp3/[artist]/[album]/",
      artistName = getCleanFilename(artist),
      albumTitle = getCleanFilename(album);

  typical = typical.replace(/\[artist\]/,artistName);
  typical = typical.replace(/\[album\]/,albumTitle);

  return typical;
};
/**
 * given an integer track identifer
 * return zero plus the integer
 * UNLESS the integer is greater than 9
 * @param {number} track integer
 * @return {string} left-padded track integer
 */
var getTrackNumLeadingZero = function(num) {
  return num < 10 ? "0" + num : num;
};
/**
 * Given a particular filename (NOT full filepath!)
 * replace all non-alphanumeric characters with a dash
 * @param {string} filename
 * @return {string} clean filename
 */
var getCleanFilename = function(filename) {
  var tmp = filename.replace(/[^-a-zA-Z0-9]/g,"-");
  return tmp.replace(/--/g,'-');
};

/**
 * send the artist, album, and track info to Mongo.
 * Currently, if the document already exists, it is not updated.
 * @param {Track[]} tracks - array of disc tracks with artistid and albumid foreign keys
 * @param {Album} album
 * @param {Artist} artist 
 */
var saveToMongo = function(artist,album,tracks) {
  // save artist to mongo's "artists" collection
  db.artists.insert(artist);
  // save album to mongo's "albums" collection
  db.albums.insert(album);
  // duh
  db.tracks.insert(tracks);
};

/**
 * Begin the cd analyzing using libdiscid
 * and musicbrainz_discid.py.
 *
 * @cite: https://github.com/mborn319/python-discid2
 * @cite: https://pypi.python.org/pypi/musicbrainzngs/0.6
 * @cite: https://github.com/bmc0/musicbrainz_discid
 * @cite: https://www.npmjs.com/package/python-shell
 */
var useAudioMeta = function(err,results) {
  if (err) {
    if (err.exitCode === 1) {
      console.error("Can't find audio metadata. Please ensure there is an audio disc in the CD tray.");
    } else {
      console.error("Got error from musicbrainz_discid:",err);
    }
    return false;
  }  else {
    // success, start ripping the cd songs

    /**
     * begin the cd ripping process using cdparanoia
     * Note we can include an integer argument 
     * which signals that we only want a particular track number.
     * This is quite useful for debugging, as it speeds up wait times.
     *
     * @cite: http://xiph.org/paranoia/
     */
    cdripper = spawn("cdparanoia",["-B"]);
    
    // output to standard output -
    // this probably means a song has been successfully saved to disk
    cdripper.stdout.on("data",function(data) {
      console.log("cdparanoia stdout:",data);
    });

    // output to standard error
    cdripper.stderr.on("data",function(data) {
      //console.log("cdparanoia stderr:",data);
    });

    // cdparanoia is done!
    cdripper.on("close",function(code) {
      // properly organize the data before sending to Mongo
      var data = JSON.parse(results),
          script = [];

      // get the stuff we're interested in
      data = data.disc["release-list"][0];
      console.log(data["medium-list"]);

      // put it all into nice, Mongo-ready stuff
      mongoData = collateResults(data);
      // console.log("cdparanoia done, exit code ", code);

      // console.log("Got CD metadata: ",mongoData);
      
      // unique directory for this artist/album combo
      newDir = getUniqueDirectory(mongoData.artist.name,mongoData.album.title);
      console.log("saving files to:",newDir);

      // update track filenames with full pathname
      mongoData.tracks.map(function(item) {
        item.filename = newDir + item.filename;
        return item;
      });

      // send to mongo
      saveToMongo(mongoData.artist,mongoData.album,mongoData.tracks);

      // let bash take care of converting and moving the files
      var runCmd = "./convertwav.sh " + newDir;
      shell.exec(runCmd,{},function(err,stdout,stderr) {
        console.log(stdout);
        console.log(stderr);

        // We're done! exit with error code 1
        process.exit(1);
      });

    });
  }
};

// use the -j flag to return JSON
// (which, incidentally, I coded myself)
var discidOpts = {
  args: ["-j"]
};
pyShell.run('musicbrainz_discid/musicbrainz_discid.py', discidOpts, useAudioMeta);
