"use strict";

var async = require('async');
var commandLineArgs = require('command-line-args');
var fs = require('fs');
var FtpClient = require('ftp');
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
  clean,
  deploy
], function (err, isSuccess) {
  if (err) {
    console.log(err);
  }
  if (isSuccess) {
    console.log('100%\tDeployment complete.');
  } else {
    console.log('Deployment failed.');
  }
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
    callback('The --local-root and --remote-root command line parameters are required');
  } else {
    config.localRoot = options['local-root'];
    config.remoteRoot = options['remote-root'];
    callback(null, config);
  }
}

function populatePassword(config, callback) {
  console.log('Checking for the ftp password file at \'' + config.passwordFilePath + '\'.');
  fs.access(config.passwordFilePath, fs.constants.F_OK | fs.constants.R_OK, function(err) {
    if (err) {
      callback(err);
    } else {
      console.log('Reading the ftp password file.');
      fs.readFile(config.passwordFilePath, 'utf8', function(err, result) {
        if (err) {
          callback(err);
        } else {
          config.password = result.trim();
          callback(null, config);
        }
      });
    }
  });
}

function clean(config, callback) {

  var ftpClient = new FtpClient();

  console.log('Creating ftp connection to clean the remote root directory.');

  ftpClient.connect({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password
  });

  ftpClient.on('ready', function() {
    console.log('Making sure the remote root directory \'' + config.remoteRoot + '\' exists.');
    ftpClient.mkdir(config.remoteRoot, true, function(err) {
      if (err) {
        ftpClient.end();
        callback(err);
      } else {
        console.log('Removing the remote root directory.');
        ftpClient.rmdir(config.remoteRoot, true, function(err) {
          if (err) {
            ftpClient.end();
            callback(err);
          } else {
            console.log('Recreating the remote root directory.');
            ftpClient.mkdir(config.remoteRoot, false, function(err) {
              ftpClient.end();
              if (err) {
                callback(err);
              } else {
                callback(null, config);
              }
            });
          }
        });
      }
    });
  });

  ftpClient.on('error', function(err) {
    callback(err);
  });
}

function deploy(config, callback) {

  var ftpDeploy = new FtpDeploy();

  console.log('Deploying files:');

  ftpDeploy.deploy(config, function (err) {
    if (err) {
      callback(err);
    } else {
      callback(null, true);
    }
  });

  ftpDeploy.once('upload-error', function (data) {
    callback('An error happened during transfer of file \'' + data.relativePath + '\'.\n' + data.err);
  });

  ftpDeploy.on('uploaded', function(data) {
    console.log(data.percentComplete + '%\tUploaded file \'' +  data.filename + '\'. Remaining to upload: ' + (data.totalFileCount - data.transferredFileCount) + '.');
  });
}
