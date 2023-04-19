const express = require("express"),
  fs = require("fs"),
  path = require("path"),
  bodyParser = require("body-parser"),
  multiparty = require("multiparty"),
  SparkMD5 = require("spark-md5");

/*-CREATE SERVER-*/
const app = express(),
  PORT = 8888,
  HOST = "http://127.0.0.1",
  HOSTNAME = `${HOST}:${PORT}`;
app.listen(PORT, () => {
  console.log(
    `THE WEB SERVICE IS CREATED SUCCESSFULLY AND IS LISTENING TO THE PORT：${PORT}，YOU CAN VISIT：${HOSTNAME}`
  );
});

/*-中间件-*/
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  req.method === "OPTIONS"
    ? res.send("CURRENT SERVICES SUPPORT CROSS DOMAIN REQUESTS!")
    : next();
});
app.use(
  bodyParser.urlencoded({
    extended: false,
    limit: "1024mb",
  })
);
/*-API-*/
// 延迟函数
const delay = (interval) => {
  typeof interval !== "number" ? (interval = 1000) : null;
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, interval);
  });
};

// 检测文件是否存在
const exists = (path) => {
  return new Promise((resolve) => {
    fs.access(path, fs.constants.F_OK, (err) => {
      if (err) {
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
};

// 创建文件并写入到指定的目录 & 返回客户端结果
const writeFile = (res, path, file, filename, stream) => {
  return new Promise((resolve, reject) => {
    if (stream) {
      try {
        let readStream = fs.createReadStream(file.path),
          writeStream = fs.createWriteStream(path);
        readStream.pipe(writeStream);
        readStream.on("end", () => {
          resolve();
          fs.unlinkSync(file.path);
          res.send({
            code: 0,
            msg: "upload success",
            originalFilename: filename,
            servicePath: path.replace(__dirname, HOSTNAME),
          });
        });
      } catch (err) {
        reject(err);
        res.send({
          code: 1,
          msg: err,
        });
      }
      return;
    }
    fs.writeFile(path, file, (err) => {
      if (err) {
        reject(err);
        res.send({
          code: 1,
          msg: err,
        });
        return;
      }
      resolve();
      res.send({
        code: 0,
        msg: "upload success",
        originalFilename: filename,
        servicePath: path.replace(__dirname, HOSTNAME),
      });
    });
  });
};

// 基于multiparty插件实现文件上传处理 & form-data解析
const uploadDir = `${__dirname}/upload`;
const multiparty_upload = (req, auto) => {
  typeof auto !== "boolean" ? (auto = false) : null;
  let config = {
    maxFieldsSize: 200 * 1024 * 1024,
  };
  if (auto) config.uploadDir = uploadDir;
  return new Promise(async (resolve, reject) => {
    await delay();
    new multiparty.Form(config).parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({
        fields,
        files,
      });
    });
  });
};

// 大文件切片上传 & 合并切片
const merge = (HASH, count) => {
  return new Promise(async (resolve, reject) => {
    let path = `${uploadDir}/${HASH}`,
      fileList = [],
      suffix,
      isExists;
    isExists = await exists(path);
    if (!isExists) {
      reject("HASH path is not found!");
      return;
    }
    fileList = fs.readdirSync(path);
    console.log(fileList.length);
    if (fileList.length < count) {
      reject("the slice has not been uploaded!");
      return;
    }
    fileList
      .sort((a, b) => {
        let reg = /_(\d+)/;
        return reg.exec(a)[1] - reg.exec(b)[1];
      })
      .forEach((item) => {
        !suffix ? (suffix = /\.([0-9a-zA-Z]+)$/.exec(item)[1]) : null;
        fs.appendFileSync(
          `${uploadDir}/${HASH}.${suffix}`,
          fs.readFileSync(`${path}/${item}`)
        );
        fs.unlinkSync(`${path}/${item}`);
      });
    fs.rmdirSync(path);
    resolve({
      path: `${uploadDir}/${HASH}.${suffix}`,
      filename: `${HASH}.${suffix}`,
    });
  });
};
app.post("/upload_chunk", async (req, res) => {
  try {
    let { fields, files } = await multiparty_upload(req);
    let file = (files.file && files.file[0]) || {},
      filename = (fields.filename && fields.filename[0]) || "",
      path = "",
      isExists = false;
    // 创建存放切片的临时目录
    let [, HASH] = /^([^_]+)_(\d+)/.exec(filename);
    path = `${uploadDir}/${HASH}`;
    !fs.existsSync(path) ? fs.mkdirSync(path) : null;
    // 把切片存储到临时目录中
    path = `${uploadDir}/${HASH}/${filename}`;
    isExists = await exists(path);
    if (isExists) {
      res.send({
        code: 0,
        msg: "file is exists",
        originalFilename: filename,
        servicePath: path.replace(__dirname, HOSTNAME),
      });
      return;
    }
    writeFile(res, path, file, filename, true);
  } catch (err) {
    res.send({
      code: 1,
      msg: err,
    });
  }
});
app.post("/upload_merge", async (req, res) => {
  let { HASH, count } = req.body;
  try {
    let { filename, path } = await merge(HASH, count);
    res.send({
      code: 0,
      msg: "merge success",
      originalFilename: filename,
      servicePath: path.replace(__dirname, HOSTNAME),
    });
  } catch (err) {
    res.send({
      code: 1,
      msg: err,
    });
  }
});
app.get("/upload_already", async (req, res) => {
  let { HASH } = req.query;
  let path = `${uploadDir}/${HASH}`,
    fileList = [];
  try {
    fileList = fs.readdirSync(path); //readdirSync 同步读取给定目录的内容，返回一个数组，其中包含目录中的所有文件名或对象
    fileList = fileList.sort((a, b) => {
      let reg = /_(\d+)/;
      return reg.exec(a)[1] - reg.exec(b)[1];
    });
    res.send({
      code: 0,
      msg: "success",
      fileList: fileList,
    });
  } catch (err) {
    console.log(err);
    res.send({
      code: 0,
      msg: "fail",
      fileList: fileList,
    });
  }
});
// const deleteFolderRecursive = (folderPath) => {
//   //判断文件夹是否存在
//   if (fs.existsSync(folderPath)) {
//     //读取文件夹下的文件目录，以数组形式输出
//     fs.readdirSync(folderPath).forEach((file) => {
//       //拼接路径
//       const curPath = path.join(folderPath, file);
//       //判断是不是文件夹，如果是，继续递归
//       if (fs.lstatSync(curPath).isDirectory()) {
//         deleteFolderRecursive(curPath);
//       } else {
//         //删除文件或文件夹
//         fs.unlinkSync(curPath);
//       }
//     });
//     //仅可用于删除空目录
//     fs.rmdirSync(folderPath);
//   } else {
//     fs.mkdirSync("upload");
//   }
// };
// app.get("/del_uploaded", async (req, res) => {
//   let { folderPath } = req.query;
//   deleteFolderRecursive(folderPath);
// });

app.use(express.static("./"));
app.use((req, res) => {
  res.status(404);
  res.send("NOT FOUND!");
});
