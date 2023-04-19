import axios from "axios";
import Qs from "qs";
let service = axios.create(); //创建一个独立的service 别人的service不会影响你的配置
service.defaults.baseURL = "http://127.0.0.1:8888";
service.defaults.headers["Content-Type"] = "multipart.form-data";
service.defaults.transformRequest = (data, headers) => {
  const contentType = headers["Content-Type"];
  if (contentType === "application/x-www-form-urlencoded")
    return Qs.stringify(data);
  return data;
};
service.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (reason) => {
    //统一做失败的提示处理
    return Promise.reject(reason);
  }
);

export default service;
