import fs from "fs";
import { default as split } from "split2";
import { default as pump } from "pump";
import * as through from "through2";
import { Chunk } from "./interfaces";

const streamNames = ["raw" /*, "console"*/];

let stream: {
  [x: string]: fs.WriteStream;
} = {};

let today = "";
const dirLogs = `${__dirname}/../logs`;

if (!fs.existsSync(dirLogs)) fs.mkdirSync(dirLogs);

function rotateDay() {
  today = new Date().toISOString().slice(0, 10);
  const timeFormat = new Date()
    .toISOString()
    .slice(0, -5)
    .replace(/[-:]/g, "")
    .replace("T", "_");
  streamNames.forEach((label) => {
    if (stream[label]) stream[label].end();
    const filename = `${dirLogs}/${label}_${timeFormat}.log`;
    stream[label] = fs.createWriteStream(filename, { flags: "w" });
  });
  console.log(`File rotation ${timeFormat}`);
}

function sink() {
  return split((data: string) => {
    try {
      return JSON.parse(data);
    } catch (error) {
      console.log(error);
      return {
        time: Date.now(),
        nojson: true,
        msg: data,
      };
    }
  });
}

const myTransport = through.obj(function (
  chunk: Chunk,
  _enc: unknown,
  callback: () => void
) {
  try {
    const { time, msg } = chunk;
    let message = msg.slice(0, 140);
    if (msg.length > 100) message += "...";

    const timeISO = new Date(time).toISOString();
    if (timeISO.slice(0, 10) !== today) rotateDay();

    stream.raw.write(`${JSON.stringify(chunk)}\n`);
    let toConsole = `${timeISO}: ${message}`;

    if (toConsole) {
      console.log(toConsole);
      //stream.console.write(toConsole + "\n");
    }
  } catch (error) {
    console.log("error in through");
    console.log(error);
    console.log(chunk);
  }
  callback();
});

pump(process.stdin, sink(), myTransport);
