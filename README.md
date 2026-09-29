# 丫丫画作

公开画廊：https://possbb.github.io/little-art-gallery/
上传与管理：https://yaya-art-gallery.possbb.chatgpt.site/

页面、作品目录、图片和视频全部从 GitHub Pages 同源读取，浏览时不依赖后台域名。
GitHub Actions 每 15 分钟尝试同步公开作品并部署；实际执行可能延迟。也可在 Actions → Sync public gallery → Run workflow 手动立即同步。
只复制已公开的丫丫画廊，不复制账号或其他家庭资料。后台关闭公开展示后，下次成功同步清空当前作品目录；已发布文件可能仍留在 Git 历史和浏览器缓存中。后台网络失败时保留上次成功的公开版本。
保留 art 历史目录，原后台仍会读取其中的初始作品。
