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

// Check the Factorio mods portal for the latest version
// of a given mod, and return an amended modInfo with that info.
function getLatestModInfoPromise(modInfo) {
    const kModPortalUriBase = 'https://mods.factorio.com';

    return new Promise((resolve, reject) => {
        let searchUri = kModPortalUriBase + '/api/mods?q=' + modInfo.name

        Https.get(searchUri, (response) => {
            var rawResponse = '';

            response.on('data', (d) => { rawResponse += d; });

            response.on('end', () => {
                var portalData = JSON.parse(rawResponse);

                if (!("results" in portalData)) {
                    reject("Could not get info for " + modInfo.name + " from the mod portal");
                    return;
                }

                portalData["results"].forEach((portalResult) => {
                    let latestRelease = portalResult["latest_release"];

                    if (latestRelease["info_json"]["name"] !== modInfo.name) {
                        return;
                    }

                    modInfo.portalLatestRelease = latestRelease;

                    resolve(modInfo);
                });
            });
        }).on('error', (e) => {
            console.error("Failed to query mod portal for " + modInfo.name);
            console.error(e);

            reject(e);
        });
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

    modInfoPromise.then((modInfoList) => {
        return Promise.all(modInfoList.map((modInfo) => {
            return getLatestModInfoPromise(modInfo);
        }));
    }).then((modInfoList) => {
        cb(null, modInfoList);
    }).catch((err) => {
        cb(err, null);
    });
};
