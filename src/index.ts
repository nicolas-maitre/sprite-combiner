import arg from "arg";
import {
  createWriteStream,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { readFile, writeFile } from "fs/promises";
import sizeOf from "image-size";
import path from "path";
import {
  decodePNGFromStream,
  encodePNGToStream,
  make as makeImage,
} from "pureimage";
import { Readable } from "stream";
(async () => {
  const args = arg({ "--out": String });

  const spritesDir = args._[0] ?? ".";
  const outDir = (args["--out"] as string) ?? ".";

  const fileNames = readdirSync(spritesDir);

  type PosDim = [number, number, number, number];
  interface FileTree {
    [letter: string]: FileTree | PosDim;
  }

  let fullWidth = 0;
  let maxHeight = 0;

  console.log(`reading ${fileNames.length} sprites...`);

  const filesData = fileNames.map((name) => {
    const buffer = readFileSync(path.join(spritesDir, name));

    const { height, width } = sizeOf(buffer);

    fullWidth += width ?? 0;
    if (height && height > maxHeight) {
      maxHeight = height;
    }

    return { name, buffer, size: [0, 0, width, height] as PosDim };
  });

  const fullImage = makeImage(fullWidth, maxHeight, undefined);
  const fullImageCtx = fullImage.getContext("2d");

  console.log("drawing sprites...");

  const _doneTresholds = [...new Array(10)].map((_, i) =>
    Math.floor((filesData.length / 10) * i)
  );
  let _tresholdIndex = 1;

  let currentX = 0;
  for (let index = 0; index < filesData.length; index++) {
    const { buffer, name, size } = filesData[index];
    size[0] = currentX;
    const [x, y, width, height] = size;
    currentX += width;
    const img = await decodePNGFromStream(Readable.from(buffer));
    fullImageCtx.drawImage(img, x, y, width, height);

    if (index === _doneTresholds[_tresholdIndex]) {
      console.log(`${_tresholdIndex * 10}%`);
      _tresholdIndex++;
    }
  }

  const fileTree: FileTree = {};

  filesData.forEach(({ name, size }) => {
    insertToTree(fileTree, name.substring(0, name.length - 4), size);
  });

  function insertToTree(tree: FileTree, fileName: string, data: PosDim) {
    const letter = fileName[0];
    const nextFileName = fileName.substring(1);
    if (nextFileName.length === 0) {
      tree[letter] = data;
      return;
    }
    if (!tree[letter]) {
      tree[letter] = {};
    }
    insertToTree(tree[letter] as FileTree, fileName.substring(1), data);
  }

  writeFileSync(path.join(outDir, "out.json"), JSON.stringify(fileTree));

  console.log("writing image to file...");
  await encodePNGToStream(
    fullImage,
    createWriteStream(path.join(outDir, "out.png"))
  );

  console.log("done.");
})();
