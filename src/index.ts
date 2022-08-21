import arg from "arg";
import {
  createWriteStream,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import sizeOf from "image-size";
import path from "path";
import {
  decodePNGFromStream,
  encodePNGToStream,
  make as makeImage,
} from "pureimage";
import { Readable } from "stream";
import potpack from "potpack";

(async () => {
  const args = arg({ "--out": String });

  const spritesDir = args._[0] ?? ".";
  const outDir = (args["--out"] as string) ?? ".";

  const fileNames = readdirSync(spritesDir);

  type PosDim = [number, number, number, number];
  interface FileTree {
    [letter: string]: FileTree | PosDim;
  }

  console.log(`reading ${fileNames.length} sprites...`);
  const filesData = fileNames.map((name) => {
    const buffer = readFileSync(path.join(spritesDir, name));

    const { height: h, width: w } = sizeOf(buffer);
    if (h === undefined || w === undefined) {
      throw new Error("undefined size for " + name);
    }

    return { name, buffer, w, h, x: 0, y: 0 };
  });

  const { w: fullWidth, h: fullHeight } = potpack(filesData);

  console.log("drawing sprites...");
  const fullImage = makeImage(fullWidth, fullHeight, undefined);
  const fullImageCtx = fullImage.getContext("2d");

  const _doneTresholds = [...new Array(10)].map((_, i) =>
    Math.floor((filesData.length / 10) * i)
  );
  let _tresholdIndex = 1;

  for (let index = 0; index < filesData.length; index++) {
    const { buffer, x, y, w, h } = filesData[index];
    const img = await decodePNGFromStream(Readable.from(buffer));
    fullImageCtx.drawImage(img, x, y, w, h);

    if (index === _doneTresholds[_tresholdIndex]) {
      console.log(`${_tresholdIndex * 10}%`);
      _tresholdIndex++;
    }
  }

  const fileTree: FileTree = {};

  filesData.forEach(({ name, x, y, w, h }) => {
    insertToTree(fileTree, name.substring(0, name.length - 4), [x, y, w, h]);
  });

  function insertToTree(tree: FileTree, fileName: string, data: PosDim) {
    const letter = fileName[0];
    const nextFileName = fileName.substring(1);
    if (nextFileName.length === 0) {
      if (tree[letter]) {
        throw new Error(`Two sprites have overlapping names`);
      }
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
