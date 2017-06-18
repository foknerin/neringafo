"use strict";

var async = require('async');
var commandLineArgs = require('command-line-args');
var fs = require('fs');
var JSFtp = require("jsftp");
JSFtp = require('jsftp-rmr')(JSFtp); // decorate 'jsFtp' with a new method 'rmr'
var FtpDeploy = require('ftp-deploy');

// Runs the tasks array of functions in series, each passing their results to the next in the array.
// However, if any of the tasks pass an error to their own callback, the next function is not executed,
// and the main callback is immediately called with the error.
/*
    async.waterfall([
      function(callback) {
        callback(null, 'one', 'two');
      },
      function(arg1, arg2, callback) {
        // arg1 now equals 'one' and arg2 now equals 'two'
        callback(null, 'three');
      },
      function(arg1, callback) {
        // arg1 now equals 'three'
        callback(null, 'done');
      }
    ], function (err, result) {
      // result now equals 'done'
    });
*/

async.waterfall([
  getConfiguration,
  populateRemoteRoot,
  populatePassword,
  //clean,
  deploy
], function (err, result) {
  // result now equals 'done'
});

function getConfiguration(callback) {
  callback(null, {
    username: 'neringaf',
    password: null,
    passwordFilePath: '.ftp.password.pid',
    host: 'ftp.neringafo.com',
    port: 21,
    localRoot: null,
    remoteRoot: null,
    //include: ['buildScripts/version.txt'],
    exclude: ['.git', '.gitignore', 'LICENSE', 'README.md', '.editorconfig', '.eslintrc.json', '.ftp.password.pid', 'package.json', 'node_modules', 'buildScripts']
  });
}

function populateRemoteRoot(config, callback) {
  const optionDefinitions = [
    { name: 'local-root', alias: 'l', type: String, multiple: false },
    { name: 'remote-root', alias: 'r', type: String, multiple: false }
  ];

  var options = commandLineArgs(optionDefinitions);

  if (!options['local-root'] || !options['remote-root']) {
    console.log('Please provide the --local-root and --remote-root command line arguments.');
    callback('--local-root and --remote-root are required');
  } else {
    config.localRoot = options['local-root'];
    config.remoteRoot = options['remote-root'];
    callback(null, config);
  }
}

function populatePassword(config, callback) {
  fs.access(config.passwordFilePath, fs.constants.F_OK | fs.constants.R_OK, function(err) {
    if (err) {
      console.log('Please create a text file containing the ftp deployment password under \'' + config.passwordFilePath +'\' and make sure it is readable.\n' + err);
      callback(err);
    } else {
      fs.readFile(config.passwordFilePath, 'utf8', function(err, result) {
        if (err) {
          console.log('Some other error happened while trying to read the password file under \'' + config.passwordFilePath + '\'.\n' + err);
          callback(err);
        } else {
          console.log('The password was retrieved successfully from \'' + config.passwordFilePath + '\'.');
          config.password = result.trim();
          callback(null, config);
        }
      });
    }
  });
}

function clean(config, callback) {

  var jsFtp = new JSFtp({
      host: config.host,
      port: config.port,
      user: config.username,
      pass: config.password
    });

  jsFtp.rmr(config.remoteRoot, function (err) {

    jsFtp.raw("quit", function(err, data) {
      if (err) {
        console.error('Error occurred while trying to close the ftp connection.\n' + err);
      }
    });

    if (err) {
      console.log('Error occurred while removing the existing files from the target deployment directory \'' + config.remoteRoot + '\'.');
      callback(err);
    } else {
      console.log('Successfully removed the existing files from the target deployment directory \'' + config.remoteRoot + '\'.');
      callback(null, config);
    }
  });
}

function deploy(config, callback) {

  var ftpDeploy = new FtpDeploy();

  ftpDeploy.deploy(config, function (err) {
    if (err) {
      console.log('Deployment has failed.');
      callback(err);
    } else {
      console.log('100%\tDeployment completed successfully.');
      callback();
    }
  });

  ftpDeploy.on('upload-error', function (data) {
    console.log('An error happened during transfer of file \'' + data.relativePath + '\'.\n' + data.err);
  });

  ftpDeploy.on('uploaded', function(data) {
    console.log(data.percentComplete + '%\tUploaded file \'' +  data.filename + '\'. Remaining to upload: ' + (data.totalFileCount - data.transferredFileCount) + '.');
  });
}
