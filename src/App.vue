<template>
  <el-upload class="upload-demo" v-loading.fullscreen.lock="fullscreenLoading" text="上传中..." :before-upload="beforeUpload"
    :on-progress="progressHandler" :on-change="uploadChange" :on-success="successHandler"
    :before-remove="beforeRemoveHandler" :on-remove="removeHandler" :http-request="httpRequest" :limit="1"
    :auto-upload="true">
    <template #trigger>
      <el-button type="primary">选择文件</el-button>
    </template>

    <div class="demo-progress">
      <el-progress :text-inside="true" :stroke-width="18" :percentage="index" />
    </div>


    <template #tip>
      <div class="el-upload__tip">
        jpg/png files with a size less than 500kb
      </div>
    </template>
  </el-upload>
</template>

<script  setup>
import { ref } from 'vue'
import SparkMD5 from 'spark-md5'
import request from './request/request'
import { ElMessage } from 'element-plus'

const fullscreenLoading = ref(false) //全屏loading
const index = ref(0) //进度条数值(第几个切片)
let already = ref([]) //已完成切片数组
let chunks = ref([]) //所有切片数组
const progressHandler = (evt) => {
  console.log(evt);
}
const changeBuffer = file => {
  return new Promise(resolve => {
    let fileReader = new FileReader()
    fileReader.readAsArrayBuffer(file)
    fileReader.onload = (e) => {
      let buffer = e.target.result,
        spark = new SparkMD5.ArrayBuffer,//利用spark-md5计算文件的md5值
        HASH,
        suffix = /\.([a-zA-Z0-9]+)$/.exec(file.name)[1] //获取文件后缀
      spark.append(buffer)
      HASH = spark.end() //唯一的hash值
      resolve({
        buffer,
        HASH,
        suffix,
        filename: `${HASH}.${suffix}`
      })
    }
  })
}
const beforeUpload = (rawFile) => {
  console.log('beforeUpload', rawFile);
  fullscreenLoading.value = true //全屏loading开启
}
const uploadChange = async (file, fileList) => {
  console.log(file.raw);
  //获取文件的HASH
  let already = [],
    data = null,
    { HASH, suffix } = await changeBuffer(file.raw)
  //获取已经上传的切片信息
  try {
    data = await request.get("/upload_already", {
      params: {
        HASH,
      },
    });
    if (+data.code === 0) {
      already = data.fileList;
    }
  } catch (err) { }
  //实现文件的切片处理[固定大小 & 固定数量]
  // let max = 1024 * 100,
  let max = 1024 * 100,
    count = file.size / max,
    chunks = []
  console.log(count);
  if (count > 100) {
    //如果文件数量超过100个，那就只固定数量
    max = file.size / 100
    count = 100
  }

  while (index.value < count) {
    chunks.push({
      file: file.raw.slice(index.value * max, (index.value + 1) * max),
      filename: `${HASH}_${index.value + 1}.${suffix}`,
    })
    index.value++
  }
  index.value = 0
  // 上传成功的处理
  const complete = async () => {
    //管控进度条
    index.value++;
    if (file.size < max) {
      index.value = 100
    }
    //当所有切片上传都成功 ，合并切片
    if (index.value < count) return;

    try {
      data = await request.post(
        "/upload_merge",
        { HASH, count, },
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );
      if (+data.code === 0) {

        fullscreenLoading.value = false
        ElMessage({
          message: '恭喜您，文件上传成功',
          type: 'success',
        })
        return;
      }
      throw data.codeText;
    } catch (err) {
      console.log("切片合并失败，请稍后再试~~", err);
      ElMessage.error({
        message: '切片合并失败，请稍后再试'
      })
      fullscreenLoading.value = false
    }
  };
  //把每一个切片都上传服务器
  chunks.forEach(chunk => {
    //已经上传的切片 无需再上传
    if (already.length > 0 && already.includes(chunk.filename)) {
      complete();
      return
    }
    let fm = new FormData()
    fm.append('file', chunk.file)
    fm.append('filename', chunk.filename)
    request.post('upload_chunk', fm).then(res => {
      console.log(res);
      if (+data.code === 0) {
        complete()
        return
      }
      return Promise.reject(data.codeText)
    }).catch(err => {
      console.log('切片上传失败，请稍后再试----', err);
    })
  })
}
const submitUpload = () => {

}

const successHandler = (response) => {
  console.log('successHandler');
}
const beforeRemoveHandler = () => {
  console.log('beforeRemoveHandler');
  index.value = 0
}
const removeHandler = async (uploadFile) => {
  // const folderPath = `./upload`
  // await request.get('del_uploaded', { params: { folderPath } })
}
const httpRequest = (options) => {
  console.log('httpRequest');
}
</script>

<style lang="scss">
.upload-demo {
  margin: 200px auto;
  box-sizing: border-box;
  padding: 10px;
  width: 400px;
  min-height: 150px;
  border: 1px dashed #DDD;

  .ml-3 {
    margin-left: 30px;
  }

  .demo-progress .el-progress--line {
    margin: 15px 0;
    width: 350px;
  }
}
</style>
