const torrentStream = require('torrent-stream');
const path = require('path');
const fs = require('fs');
const pump = require('pump');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

export default function getTorrent(filename, magnetLink, req, res) {

    let downloadingStreams = {}
    ffmpeg.setFfmpegPath(ffmpegPath);

    // COVERSION
    const convert = function (file, thread) {
        if (!thread)
            thread = 8
        console.log('Start converting file...')
        let stream = file.createReadStream();
        return ffmpeg(stream)
            .videoCodec('libvpx')
            .audioCodec('libvorbis')
            .format('webm')
            .audioBitrate(128)
            .videoBitrate(1024)
            .outputOptions([
                '-threads ' + thread,
                '-deadline realtime',
                '-error-resilient 1'
            ])
            .on('end', function () {
                console.log('File is now webm !')
            })
            .on('error', function (err) { })
    }

    // INIT DOWNLOAD
    let engine = torrentStream(magnetLink)
    engine.on('ready', function () {
        console.log('Start Engine !')
        // // GET THE FILE
        console.log("MagnetLink => " + magnetLink)
        engine.files = engine.files.sort(function (a, b) {
            return b.length - a.length
        }).slice(0, 1)
        let file = engine.files[0]
        let ext = path.extname(file.name)
        console.log("Extension => " + ext)
        console.log('File found! (' + file.name + ')')
        console.log("\n\n\nFile length " + file.length)
        // Subtitles//
        const torrentHash = magnetLink.split(":")[3];
        // OpenSubtitles.search({
        //     sublanguageid: 'fre',       // Can be an array.join, 'all', or be omitted.
        //     hash: torrentHash,   // Size + 64bit checksum of the first and last 64k
        //     filesize: '129994823',      // Total size, in bytes.
        //     path: __dirname + `/../Downloads/238.mp4`,        // Complete path to the video file, it allows
        //     //   to automatically calculate 'hash'.
        //     filename: '238.mp4',        // The video file name. Better if extension
        //     //   is included.
        //     extensions: ['srt', 'vtt'], // Accepted extensions, defaults to 'srt'.
        //     limit: '3',                 // Can be 'best', 'all' or an
        //     // arbitrary nb. Defaults to 'best'
        //     imdbid: '238',           // 'tt528809' is fine too.
        //     fps: '23.96',               // Number of frames per sec in the video.
        //     query: 'The Godfather',   // Text-based query, this is not recommended.
        //     gzip: true                  // returns url to gzipped subtitles, defaults to false
        // });
        // CONVERT
        let needConvert = (ext !== '.webm' && ext !== '.mp4')
        let videoStream = needConvert ? convert(file) : file.createReadStream();
        ext = needConvert ? '.webm' : ext

        // MULTIPLE STREAMS
        let filePath = path.join(__dirname, '/../Downloads/' + filename + ext)
        const fileStream = fs.createWriteStream(filePath)
        engine.on('download', function () {
            console.log(file.name + " " + engine.swarm.downloaded / file.length * 100 + "% Downloaded");
            // if (engine.swarm.downloaded / file.length * 100 > 0.5)
            //     console.log("\n\n\n\n\n\n OK \n\n\n\n")
            // res.send({ status: "OK" })
        });
        res.on('close', function cb() {
            console.log("Connexion closed")
            engine.destroy(function cb() {
                console.log("Downloading Stopped")
            });
        });
        videoStream.on('end', () => {
            console.log('Video stream has reached is end')
        })
        if (needConvert) {
            console.log('Pumping to file...')
            pump(videoStream, fileStream)
        } else {
            console.log('Piping to file...')
            videoStream.pipe(fileStream)
        }
    })
}