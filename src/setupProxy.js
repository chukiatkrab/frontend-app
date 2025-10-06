// src/setupProxy.js
const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    "/api", // จับทุก path ที่ขึ้นต้นด้วย /api
    createProxyMiddleware({
      target: "https://cis.kku.ac.th", // โดเมนปลายทางของ API จริง
      changeOrigin: true,
      secure: true,
      logLevel: "debug"
    })
  );
};
