const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const https = require("https");

var dir = "../uploads";

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

function deleteFilesAfterExpiration() {
  var files = fs.readdirSync(dir);

  files.forEach((file) => {
    var info = JSON.parse(fs.readFileSync(dir + "/" + file + "/info.json"));

    var expiration = new Date(info.expiration);

    if (expiration < new Date()) {
      fs.rmdirSync(dir + "/" + file, { recursive: true });
    }
  });
}

setTimeout(deleteFilesAfterExpiration, 10000);

const app = express();
const PORT = 443;

app.use(express.static("./public"));

var hex = "";

// Function to generate a random 4-digit hexadecimal string
function randomHexName() {
  hex = Math.floor(Math.random() * 0x10000)
    .toString(16)
    .padStart(4, "0");
  return hex;
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    var hex = randomHexName();
    var dir = "../uploads/" + hex;

    while (fs.existsSync(dir)) {
      hex = randomHexName();
      dir = "../uploads/" + hex;
    }

    fs.mkdirSync(dir);

    cb(null, "../uploads/" + hex + "/");

    var deleteAt = new Date();
    deleteAt.setHours(deleteAt.getHours() + 24 * 7);

    // if the file is over 100mb
    if (file.size > 100000000) {
      deleteAt.setHours(deleteAt.getHours() + 24);
    }

    fs.writeFileSync(
      "../uploads/" + hex + "/" + "info.json",
      JSON.stringify({
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
        expiration: deleteAt.toLocaleString(),
      })
    );

    console.log(file.mimetype);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); // Append the original file extension.
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 1024, // Set the file size limit to 1 GB.
  },
});
// Set up an endpoint for uploading files.
app.post(
  "/quickshare",
  upload.single("file"),
  (req, res) => {
    // Return the generated filename as the response
    res.send(hex); // Sends just the 4-digit hex without the file extension.
  },
  (error, req, res, next) => {
    res.status(400).send(error.message); // Error handling for large files or other multer errors.
  }
);

app.get("/dl", (req, res) => {
  var hexCode = req.query.hex;

  if (hexCode == null) {
    res.send("No hex code provided");
    return;
  }

  var dir = "../uploads/" + hexCode;

  if (!fs.existsSync(dir)) {
    res.send("No file found");
    return;
  }

  var info = JSON.parse(fs.readFileSync(dir + "/info.json"));

  var file = info.name;

  res.download(dir + "/" + file, file, (err) => {
    if (err) {
      res.send("No file found");
    }
  });
});

const server = https.createServer(
  {
    key: fs.readFileSync("../certs/private.key"),
    cert: fs.readFileSync("../certs/certificate.cert"),
  },
  app
);

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
