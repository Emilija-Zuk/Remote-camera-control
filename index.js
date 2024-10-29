import express from "express";
import bodyParser from "body-parser";
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fs from 'fs';
import { Server } from 'socket.io';
// import { Gpio } from 'onoff';    // IO PIN CONTROL FOR RASPBERRY PI



////////////////////////////////////// DEBUGGING CAMERA DELAY /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var varToSend = "Test";




////////////////////////////////////// IO PIN CONTROL FOR RASPBERRY PI/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const PinPWM = 17; // orange
const PinIn1 = 27; // blue
const PinIn2 = 22; // purple

// const PWMPin = new Gpio(PinPWM, 'out'); // orange pin
// const In1Pin = new Gpio(PinIn1, 'out'); // blue pin
// const In2Pin = new Gpio(PinIn2, 'out'); // purple pin

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function turn_right() {

  In1Pin.writeSync(1); // blue
  In2Pin.writeSync(0); // purple
  PWMPin.writeSync(1); // orange
  await delay(5000);
  In1Pin.writeSync(0);
  In2Pin.writeSync(0);
  PWMPin.writeSync(0);
}

async function turn_left() {

  In1Pin.writeSync(0); // blue
  In2Pin.writeSync(1); // purple
  PWMPin.writeSync(1); // orange
  await delay(5000);
  In1Pin.writeSync(0);
  In2Pin.writeSync(0);
  PWMPin.writeSync(0);
}

////////////////////////////////////// WEB SERVER  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const app = express();
const port = 3000;
const mypassword = "emz"; // it is just for testing - it is not secure
const server = http.createServer(app);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
var userIsAuthorised = false;
const rtspStreamUrl = 'rtsp://192.168.50.5:554';
const publicPath = path.join(__dirname, 'public'); 
const hlsOutputPath = `${publicPath}/hls.m3u8`;
let ffmpegProcess; 

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

const io = new Server(server);

function passwordCheck(req, res, next) {
  const password = req.body["password"];
  if (password === mypassword) {
    userIsAuthorised = true;
  }
  next();
}

app.use(passwordCheck);

app.get("/", (req, res) => {
  console.log("HOME");
   initialize();   // STARTS FFMPEG PROCESS HERE
  // startFFmpegProcess();
  res.render("index.ejs");
});

app.post("/control", (req, res) => {
  if (userIsAuthorised) {
    res.render("control.ejs", { varA: varToSend });   // SENDS TS FILE NAME TO FRONT END
  } else {
    res.redirect("/");
  }
});

app.get("/test", (req, res) => {
  res.render("index.ejs");
});

app.get("/about", (req, res) => {
  res.render("about.ejs");
});

app.get("/contact", (req, res) => {
  res.render("contact.ejs");
});

app.get("/exitControlPage", (req, res) => {
  ffmpegProcess.kill();
  res.redirect("/"); // home page
});

deleteHLSAndTSFiles()

function initialize() {
  console.log("Initializing ffmpeg...");
  deleteHLSAndTSFiles()
    .then(() => startFFmpegProcess())
    .catch(err => {
      console.error("Error initializing:", err);
    });
}

io.on('connection', (socket) => {
  console.log('A client connected');

  socket.on('command', async (data) => {
    console.log(`Received command: ${data}`);
    
    if (data === 'turnright') {
      // await turn_right();
    } else if (data === 'turnleft') {
      // await turn_left();
    } else {
      console.log(`Unknown command: ${data}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('A client disconnected');
  });
});

function deleteHLSAndTSFiles() {
  return new Promise((resolve, reject) => {
    fs.readdir(publicPath, (err, files) => {
      if (err) {
        console.error("Error reading directory:", err);
        reject(err);
        return;
      }
      const deletionPromises = files.map(file => {
        if (file.endsWith('.m3u8') || file.endsWith('.ts')) {
          const filePath = path.join(publicPath, file);
          console.log(`Deleting file: ${filePath}`);
          return fs.promises.unlink(filePath);
        }
      }).filter(Boolean); // Filter out undefined entries
      // wait for  deletion promises to complete
      Promise.all(deletionPromises)
        .then(() => {
          console.log("All HLS and TS files deleted.");
          resolve();
        })
        .catch(err => {
          console.error("Error deleting files:", err);
          reject(err);
        });
    });
  });
}


const ffmpegArgs = [
  '-rtsp_transport', 'udp',
  '-i', rtspStreamUrl,
  '-c:v', 'h264',
  '-preset', 'superfast',
  '-c:a', 'aac',
  '-b:v', '2048k',
  '-s', '1280x720',
  '-crf', '32', 
  '-hls_time', '1', 
  '-hls_list_size', '5', 
  '-start_number', '1',
  '-hls_flags', 'delete_segments',  
  '-hls_segment_filename', `${publicPath}/ts%03d.ts`,
  '-g', '25',
  '-keyint_min', '25',
  hlsOutputPath
];


function startFFmpegProcess() {

  if (ffmpegProcess) {
    ffmpegProcess.kill();
    deleteHLSAndTSFiles()
  }

  ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

  ffmpegProcess.stdout.on('data', (data) => {
    console.log(`FFmpeg stdout: ${data}`);
  });

  ffmpegProcess.stderr.on('data', (data) => {
    //console.error(`FFmpeg stderr: ${data}`);
  });

  ffmpegProcess.on('close', (code) => {

  });

}

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
