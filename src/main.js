import { createApp } from "vue";
import App from "./App.vue";
import "./registerServiceWorker";
import "../public/static/css/global.css";
import locale from "element-plus/lib/locale/lang/zh-cn";
import ElementPlus from "element-plus";
import "element-plus/theme-chalk/index.css";

createApp(App).use(ElementPlus, { locale }).mount("#app");
