# 丫丫画作公开画廊

公开入口：https://possbb.github.io/little-art-gallery/

上传与管理：https://yaya-art-gallery.possbb.chatgpt.site/

GitHub Pages 从 main 分支根目录发布。页面打开或重新获得焦点时读取后台公开作品接口，因此后台新增、修改和删除作品后，刷新页面即可同步，无需重新发布图片。仅展示已开启公开展示的丫丫家庭；其他家庭保留在原后台。

此仓库的 app.js、index.html、style.css、accounts.js、cleaner.js、clean-worker.js 由现有网站源码中的 scripts/build-github.mjs 生成。修改页面后在 online 目录执行：

    node scripts/build-github.mjs ../.publish/gallery

然后提交并推送生成文件。请保留 art 目录，现有后台仍使用其中的历史原始文件。不要向此公开仓库加入登录密钥或家庭成员数据。
