/*
    Webtask to check whether Factorio mods on a given FTP server are up to date,
    and provide links to the latest versions if they're not.
*/

'use strict';

const FtpClient = require('ftp');
const Https = require('https');

/*
    ftpMeta is a hash containing info about the FTP server
    to connect to.
        host: FTP host
        port: FTP port
        user: FTP username
        password: FTP password
        mod_directory: directory where mods are
            stored (relative or absolute)
*/
function getModInfoPromise(ftpMeta) {
    return new Promise((resolve, reject) => {
        var c = new FtpClient();

        c.on('ready', function() {
            c.cwd(ftpMeta["mod_directory"], (err, workingDir) => {
                if (err)
                    reject(err);

                c.list(function(err, list) {
                    if (err)
                        reject(err);

                    var modFileNames = list
                        .map(function(file) { return file.name; })
                        .filter(function(name) { return name.endsWith(".zip"); });

                    var modInfo = modFileNames.map((fileName) => {
                        var pieces = fileName.replace(".zip", "").split('_');

                        return {
                            version: pieces.pop(),
                            name: pieces.join("_")
                        };
                    });

                    resolve(modInfo);

                    try {
                        c.end();
                    }
                    catch(err) {}
                })
            });
        });

        c.connect(ftpMeta);
    });
}

module.exports = (ctx, cb) => {
    var modInfoPromise = getModInfoPromise({
        host: ctx.secrets.ftpHost,
        port: ctx.secrets.ftpPort,
        user: ctx.secrets.ftpUser,
        password: ctx.secrets.ftpPassword,
        mod_directory: ctx.secrets.ftpModDirectory
    });

    modInfoPromise.then((modInfo) => {
        cb(null, modInfo);
    }, (err) => {
        cb(err, null);
    });
};
