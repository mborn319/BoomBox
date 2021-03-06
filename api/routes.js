/*************************************************
 * ####             API docs          ###
 * See http://docs.boombox.apiary.io/
 *
*************************************************/

module.exports = function(app, db, devices) {
  var api = require("./api")(db),
      playlist = require("./playlist")(devices),
      playState;

  console.log("API");
  console.log("...... version: ", api.urlVersion);

  /*
   * ### Play songs/artists/albums ###
   * GET          /stream/track/:id
   * GET          /stream/album/:id
   * GET          /stream/artist/:id
   * GET          /stream/pause
   */
  app.get(api.urlVersion+"/stream/track/:id", function(req, res) {
    if (typeof req.params.id === "undefined") {
      res.status(400).json({error: "You must specify an ID."});
    } else {
      /**
       * play .mp3 files out to the speakers
       * @cite: https://github.com/turingou/player
       */
      var opts = {
        id: req.params.id,
        limit: 1,
      };
      api.getTracks(opts, function(err,result) {
        if (!result || err) {
          res.json({error:true,playing:false,"msg":"Track not found."});
          return;
        }
        // open the file and start playing
        // if it's a new song, stop the old song from playing
        // and start the new song

        // console.log("Now playing: ", result.title);
        playlist.play(result);

        // send it to the frontend
        res.json({error: false });
      });
    }
  });
  app.get(api.urlVersion+"/stream/album/:id", function(req, res) {
    console.log("okay, we're going to add an entire album to the playlist!");
    api.getAlbums(req.params, function(err, result) {
      if (!result) {
        res.status(404).json({error:true,playing:false,msg:"Album not found."});
        return;
      }
      if (err) {
        res.json({error:true,playing:false,msg:"Unexpected error searching for album"});
        return;
      }

      api.getTracksByAlbumId(result[0]._id, function(err, tracks) {
        if (err || !tracks) {
          console.warn("No tracks found for album:", req.params.id);
          return;
        }

        // let playlist.js take care of it.
        playlist.play(tracks);

        // respond nicely
        res.json({ error: false });
      });
    });
  });
  app.get(api.urlVersion+"/stream/artist/:id", function(req, res) {
    console.log("okay, we're going to add an entire artist to the playlist!");
    api.getArtists(req.params, function(err, result) {
      if (!result) {
        res.status(404).json({error:true,playing:false,msg:"Artist not found."});
        return;
      }
      if (err) {
        res.json({error:true,playing:false,msg:"Unexpected error searching for artist"});
        return;
      }

      // get all songs by this artist
      api.getTracksByArtistId(result[0]._id, function(err, tracks) {
        if (err || !tracks) {
          console.warn("No tracks found for artist:", req.params.id);
          res.status(404).json({error:true,playing:false,msg:"No tracks found for artist"});
          return;
        }

        // start playing the new playlist.
        playlist.play(tracks);

        // respond nicely, keep frontend informed
        res.json({ error: false });
      });
    });
  });
  app.get(api.urlVersion+"/stream/pause", function(req, res) {

    // pause the playlist / audio stream.
    playlist.pause();
    res.json({ error: false });
  });
  app.get(api.urlVersion+'/stream/next', function(req, res) {
    // play the next song in the playlist
    playlist.next();

    // respond nicely, keep frontend informed
    res.json({ error: false });
  });
  app.get(api.urlVersion+'/stream/prev', function(req, res) {
    // play the "previous" song in the playlist.
    playlist.prev();

    // somehow we have to maintain state on this
    // I'm not sure how the playlist array will work
    // after we've "advanced" to the next item.
    // here goes.
    // UPDATE: Too hard!! Leave this for further updates

    // respond nicely, keep frontend informed
    res.json({ error: false });
  });















  /*
   * ### Manage tracks ###
   * GET          /track
   * POST         /track/:id
   * PUT          /track/:id
   * DELETE       /track/:id
   *
   * http://docs.boombox.apiary.io/#reference/tracks/list-one-or-all-songs
   * Routes for getting, creating, updating, and deleting song tracks by ID.
   * ID is required for all except GET.
   */
  app.get(api.urlVersion+"/track(/:id)?", function(req, res) {
    // Return tracks searchable by name, sorted a-z by name, LIMIT 50
    var handleIt = function(err,results) {
      if (!results) {
        res.status(404).json({ error: "Track(s) not found" });
      } else {
        res.json(results);
      }
    };
  
    // actually get the data
    api.getTracks(req.query, handleIt);
  });
  app.post(api.urlVersion+"/track/:id", function(req, res) {
    if (typeof req.params.id === "undefined") {
      res.status(400).json({error: "You must specify an ID."});
    } else {
      //insert tracks!
      api.insertTracks(req.params, function() {
        res.status(201).json({error: "false"});
      });
    }
  });
  app.put(api.urlVersion+"/track/:id", function(req, res) {
    if (typeof req.params.id === "undefined") {
      res.status(400).json({error: "You must specify an ID."});
    } else {
      api.updateTracks(req.param.id, function() {
        res.json({success: "true"});
      });
    }
  });
  app.delete(api.urlVersion+"/track/:id", function(req, res) {
    if (typeof req.params.id === "undefined") {
      res.status(400).json({error: "You must specify an ID."});
    } else {
      //delete tracks!
      api.delTracks(req.params.id, function() {
        res.json({success: "true"});
      });
    }
  });








  /**
   * ### Manage artists ###
   * GET          /artist
   * POST         /artist/:id
   * PUT          /artist/:id
   * DELETE       /artist/:id
   *
   * Routes for getting, creating, updating, and deleting song artists by ID.
   * ID is required for all except GET.
   */
  app.get(api.urlVersion+"/artist(/:id)?", function(req, res) {
    if (typeof req.params.id === "undefined") {
      //then return all artists.
      api.getArtists(req.params, function(err, results) {
        res.json(results);
      });
    } else {
      //return max 1 artist by id
      api.getArtists({ id: req.params.id }, function(err, results) {
        res.json(results);
      });
    }
  });
  app.post(api.urlVersion+"/artist/:id", function(req, res) {
    console.log(req.params);
    if (typeof req.params.id === "undefined") {
      res.status(400).json({error: "You must specify an ID."});
    } else {
      //create artists!
      api.insertArtists(req.params, function() {
        res.json({success: "true"});
      });
    }
  });
  app.put(api.urlVersion+"/artist/:id", function(req, res) {
    console.log(req.params);
    if (typeof req.params.id === "undefined") {
      res.status(400).json({error: "You must specify an ID."});
    } else {
      //update artists!
      api.updateArtists(req.params.id, function() {
        res.json({success: "true"});
      });
    }
  });
  app.delete(api.urlVersion+"/artist/:id", function(req, res) {
    console.log(req.params);
    if (typeof req.params.id === "undefined") {
      res.status(400).json({error: "You must specify an ID."});
    } else {
      //delete artists!
      api.delArtists(req.params.id, function() {
        res.json({success: "true"});
      });
    }
  });






  /*
   * ### Manage albums ###
   * GET          /album
   * POST         /album/:id
   * PUT          /album/:id
   * DELETE       /album/:id
   *
   * Routes for getting, creating, updating, and deleting song albums by ID.
   * ID is required for all except GET.
   */
  app.get(api.urlVersion+"/album(/:id)?", function(req, res) {
    if (typeof req.params.id === "undefined") {
      //then return all albums.

      // get the albums by search phrase, etc.
      api.getAlbums(req.params, function(err, results) {
        if (!results) {
          res.status(404).json({ error: "Album(s) not found" });
        } else {
          res.json(results);
        }
      });
    } else {
      //get albums by id
      api.getAlbums(req.params, function(err, results) {
        if (!results) {
          res.status(404).json({ error: "Album(s) not found" });
        } else {
          res.json(results);
        }
      });
    }
  });
  app.post(api.urlVersion+"/album/:id", function(req, res) {
    console.log(req.params);
    if (typeof req.params.id === "undefined") {
      res.status(400).json({error: "You must specify an ID."});
    } else {
      //create albums!
      api.insertAlbums(req.params, function() {
        res.json({success: "true"});
      });
    }
  });
  app.put(api.urlVersion+"/album/:id", function(req, res) {
    console.log(req.params);

    if (typeof req.params.id === "undefined") {
      res.status(400).json({error: "You must specify an ID."});
    } else {
      //update albums!
      api.updateAlbums(req.params, function() {
        res.json({success: "true"});
      });
    }
  });
  app.delete(api.urlVersion+"/album/:id", function(req, res) {
    console.log(req.params);
    if (typeof req.params.id === "undefined") {
      res.status(400).json({error: "You must specify an ID."});
    } else {
      //delete albums!
      api.delAlbums(req.params.id, function() {
        res.json({success: "true"});
      });
    }
  });
  return api;
};
