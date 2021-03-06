#!/usr/bin/env node
/**
 * creates a new serverside API object
 * @classedesc does all of the work for the api,
 *  including getting and setting albums, artists and tracks.
 * @constructor
 */
function Api(db) {
  var self = this;

  /**
   * turn on debugging console.log statements
   * which are handled in {@link log}
   * @type {boolean}
   */
  this.debug = true;

  /**
   * the api version
   * @type {string}
   */
  this.version =  "1.0.0";

  /**
   * the api version string used in API calls
   * @type {string}
   */
  this.urlVersion =  "/api/v1";

  /**
   * send arg1,arg2 to the database IF debugmode is on
   * this is meant to be an internal function only
   * @param {Object|string|number|array[]} arg1
   * @param {Object|string|number|array[]} arg2
   */
  this.log = function(arg1, arg2) {
    if (this.debug) {
      if (arg1 && arg2) {
        console.log(arg1, arg2);
      } else if (arg1) {
        console.log(arg1);
      }
    }
  };

  /**
   * get all albums by a given id
   * @param {searchOpts} params - an object of relevant items from url.params
   * @param {mongoAlbum} callback - return mongo results for albums
   */
  this.getAlbums =  function(params, callback) {
    this.log("albums.get():", arguments);
    var searchOpts = {};
    if (typeof params.id !== "undefined") {
      searchOpts._id = params.id
    }
    if (typeof params.limit !== "number") {
      params.limit = 50; // notice default is 50
    }
    // Return tracks searchable by name, sorted a-z by name, LIMIT 50
    data = db.albums.find(searchOpts).sort({ title: 1 }).limit(params.limit, callback);
  };

  /**
   * add an artist document to the mongo artists collection
   * does NOT handle batch results!
   * @todo finish building and testing this implementation
   * @params {Artist} artist - the document to insert
   * @params {albumInsertResponse} callback - calls this function with the result
   */
  this.insertAlbums =  function(params, callback) {
    this.log("albums.insert():", arguments);
    if (typeof params._id !== "string") { throw "ID is required."; }
    if (typeof params.artistid !== "string") { throw "Artistid is required."; }
    if (typeof params.title!== "string") { throw "Title is required."; }
    if (typeof params.track_count !== "string") { throw "Track_count is required."; }

    var doc = {
      _id: params.id,
      artistid: params.artistid,
      title: params.title,
      track_count: params.track_count
    };

    db.albums.insert(doc, callback);
  };
  /**
   * update a given item in the mongo album collection
   * @todo finish building and testing this implementation
   * @param {string} id - the unique musicbrainz id of the album we wish to update
   * @param {Object} album - all key/value pairs we wish to update
   * @param {albumUpdateResponse} callback - gets called with the response
   */
  this.updateAlbums =  function(id, album, callback) {
    this.log("albums.update():", arguments);
  };

  /**
   * REMOVE a given album from the mongo album collection
   * @todo finish building and testing this implementation
   * @param {string} id - delete THIS album
   * @param {albumDelResponse} callback - gets called with the response
   */
  this.delAlbums =  function(id) {
    this.log("albums.del():", arguments);
    if (!id) { throw "albums.del(): id is required"; }

    // in order to maintain referential integrity, delete the tracks first.
    this.delTracksByAlbum(id);

    // now, delete the artist by id.
    db.albums.deleteOne({_id: id});
  };

  /**
   * query mongo for artists with the given parameters
   * @param {searchOpts} params - an object of relevant items from url.params
   * @param {mongoArtists} callback - return mongo results for artists
   */
  this.getArtists =  function(params, callback) {
    this.log("artists.get():", arguments);
    var searchOpts = {};
    if (typeof params.id !== "undefined") {
      searchOpts._id = params.id
    }
    if (typeof params.limit !== "number") {
      params.limit = 50; // notice default is 50
    }
    // debugging
    console.log("searching for artists by",params);

    // Return tracks searchable by name, sorted a-z by name, LIMIT 50
    db.artists.find(searchOpts).sort({ name: 1 }).limit(params.limit, callback);
  };

  /**
   * add an artist document to the mongo artists collection
   * does NOT handle batch results!
   * @todo finish building and testing this implementation
   * @params {Artist} artist - the document to insert
   * @params {albumInsertResponse} callback - calls this function with the result
   */
  this.insertArtists =  function(params, callback) {
    this.log("artists.insert():", arguments);
    if (typeof params._id !== "string") { throw "ID is required."; }
    if (typeof params.name !== "string") { throw "Name is required."; }

    var doc = {
      _id: params.id,
      name: params.name
    };

    db.artists.insert(doc, callback);
  };

  /**
   * update a given item in the mongo artist collection
   * @todo finish building and testing this implementation
   * @param {string} id - the unique musicbrainz id of the artist we wish to update
   * @param {Object} album - all key/value pairs we wish to update
   * @param {trackUpdateResponse} callback - gets called with the response
   */
  this.updateArtists = function(id, album, callback) {
    this.log("artists.update():", arguments);
  };

  /**
   * REMOVE a given artist from the mongo artist collection
   * @param {string} id - delete THIS artist
   * @param {artistDelResponse} callback - gets called with the response
   */
  this.delArtists = function(id) {
    this.log("artists.del():", arguments);
    if (!id) { throw "artists.del(): id is required"; }

    // in order to maintain referential integrity, delete the tracks first.
    this.delTracksByArtist(id);

    // now, delete the artist by id.
    db.artists.deleteOne({_id: id});
  };

  /**
   * query mongo for all tracks with a given artistid
   * @param {string} artistid - the unique musicbrainz ID of an artist
   * @param {mongoArtist} callback - return mongo results for artists
   */
  this.getTracksByArtistId = function(artistid, callback) {
    this.log("getTracksByArtistId():", arguments);
    // Return tracks searchable by name, sorted a-z by name, LIMIT 50
    db.tracks.find({ artistid: artistid }).sort({ number: 1 }, callback);
  };

  /**
   * query mongo for all tracks with a given albumid
   * @param {string} albumid - the unique musicbrainz ID of an album
   * @param {mongoAlbum} callback - return mongo results for albums
   */
  this.getTracksByAlbumId = function(albumid, callback) {
    this.log("tracks.getByAlbumId():", arguments);
    // Return tracks searchable by name, sorted a-z by name, LIMIT 50
    db.tracks.find({ albumid: albumid }).sort({ number: 1 }, callback);
  };

  /**
   * query mongo for tracks with the given parameters
   * @param {searchOpts} params - an object of relevant items from url.params
   * @param {mongoTrack} callback - return mongo results for tracks
   */
  this.getTracks = function(params, callback) {
    this.log("tracks.get():", arguments);
    var searchOpts = {};

    if (typeof params.id !== "undefined") {
      searchOpts._id = params.id
    }
    if (typeof params.artistid !== "undefined") {
      // get all tracks by artist
      searchOpts.artistid = params.artistid;
    }
    if (typeof params.albumid !== "undefined") {
      // get all tracks from album
      searchOpts.albumid = params.albumid;
      // Then sort by track number
      // params.sortBy = { number: 1 };
    }
    if (typeof params.limit !== "number") {
      // notice default is 50
      params.limit = 50;
    }
    if (typeof params.sortBy === "undefined") {
      // default sort order is the track title
      params.sortBy = { number: 1 };
    }

    this.log("Search parameters:", searchOpts);
    this.log("Sorting by:", params.sortBy);

    // Return tracks searchable by name, sorted a-z by name, LIMIT 50
    db.tracks.find(searchOpts).sort(params.sortBy).limit(params.limit, function(err, result) {
      callback(err, result);
    });
  };
  
  /**
   * add a track document to the mongo database.
   * does NOT handle batch results!
   * @todo finish building and testing this implementation
   * @params {Track} track - the document to insert into the tracks collection
   * @params {trackInsertResponse} callback - calls this function with the result
   */
  this.insertTracks = function(track, callback) {
    this.log("tracks.insert():", arguments);
    if (typeof track._id !== "string") { throw "ID is required."; }
    if (typeof track.number !== "number") { throw "Number must be an integer."; }
    if (typeof track.length !== "string") { throw "Length must be a number."; }
    if (typeof track.filename !== "string") { throw "Filename is required."; }
    if (typeof track.title !== "string") { throw "Title is required."; }
    if (typeof track.albumid !== "string") { throw "Albumid is required."; }
    if (typeof track.artistid !== "string") { throw "Artistid is required."; }

    var doc = {
      _id: track.id,
      title: track.title,
      number: track.number,
      length: track.length,
      position: track.number,
      filename: track.filename,
      title: track.title,
      albumid: track.albumid,
      artistid: track.artistid
    };

    db.tracks.insert(doc, callback);
  };

  /**
   * update a given item in the mongo tracks collection
   * @todo finish building and testing this implementation
   * @param {string} id - the unique musicbrainz id of the track we wish to update
   * @param {Object} track - all key/value pairs we wish to update
   * @param {trackUpdateResponse} callback - gets called with the response
   */
  this.updateTracks = function(id, track) {
    this.log("tracks.update():", arguments);

    // db.tracks.update({ _id: id }, track);
  };

  /**
   * REMOVE a given track from the mongo track collection
   * @todo finish building and testing this implementation
   * @param {string} id - delete THIS track
   * @param {trackDelResponse} callback - gets called with the response
   */
  this.delTracks = function(id, callback) {
    this.log("tracks.del():", arguments);
    if (!id) { throw "tracks.del(): id is required"; }
    db.tracks.deleteOne({ _id: id }, {}, callback);
  };

  /**
   * remove all tracks from the mongo track collection
   * where artistid == the given artistid
   * @todo finish building and testing this implementation
   * @param {string} artistid - delete tracks by this artist
   * @param {trackDelResponse} callback - gets called with the response
   */
  this.delTracksByArtist = function(artistid, callback) {
    this.log("tracks.delByArtist():", arguments);
    if (!artistid) { throw "delByArtist(): artistid is required"; }
    db.tracks.remove({artistid: artistid}, callback);
  };

  /**
   * remove all tracks from the mongo track collection
   * where albumid == the given albumid
   * @todo finish building and testing this implementation
   * @param {string} albumid - delete tracks from this album
   * @param {trackDelResponse} - gets called with the response
   */
  this.delTracksByAlbum = function(albumid, callback) {
    if (!albumid) { throw "delByAlbum(): albumid is required"; }
    db.tracks.remove({ albumid: albumid }, callback);
  };

  return this;
};
module.exports = function(db) {
  return new Api(db);
};
