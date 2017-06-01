/*
    Webtask to check whether Factorio mods on a given FTP server are up to date,
    and provide links to the latest versions if they're not.
*/

'use strict';

const FtpClient = require('ftp');
const Https = require('https');

module.exports = (ctx, cb) => {
    cb(null, 'Done');
};
